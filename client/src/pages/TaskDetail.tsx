import DashboardLayout from "@/components/DashboardLayout";
import { UserInteractionPanel } from "@/components/UserInteractionPanel";
import { RealProgressBar } from "@/components/RealProgressBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  HelpCircle,
  Layout,
  Loader2,
  Presentation,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending: { label: "等待中", icon: <Clock className="w-4 h-4" />, className: "status-pending" },
  uploading: { label: "上传中", icon: <Loader2 className="w-4 h-4 animate-spin" />, className: "status-uploading" },
  running: { label: "生成中", icon: <RefreshCw className="w-4 h-4 animate-spin" />, className: "status-running" },
  ask: { label: "需确认", icon: <HelpCircle className="w-4 h-4" />, className: "status-ask" },
  completed: { label: "已完成", icon: <CheckCircle2 className="w-4 h-4" />, className: "status-completed" },
  failed: { label: "失败", icon: <AlertCircle className="w-4 h-4" />, className: "status-failed" },
};

interface TimelineEvent {
  time: string;
  event: string;
  status: string;
}

interface InteractionOption {
  id: string;
  label: string;
  description?: string;
  imageUrl?: string;
}

interface InteractionContent {
  type: 'choice' | 'text' | 'image_selection' | 'confirmation';
  title?: string;
  content?: string;
  options?: InteractionOption[];
  images?: Array<{ url: string; label?: string }>;
  placeholder?: string;
}

// 内部指令关键词过滤列表 - 这些内容不应该显示在前端
const INTERNAL_INSTRUCTION_KEYWORDS = [
  '品牌纯净要求',
  '违反此规则将导致交付物被完全拒绝',
  'Powered by Manus',
  'Made with Manus',
  '由Manus提供支持',
  'Powered by AI',
  'AI Generated',
  '由AI生成',
  '严禁在PPT的任何位置',
  '封面页特别要求',
  '绝对禁止出现',
  '最重要的规则',
  '必须首先阅读并严格遵守',
  '再次强调品牌纯净要求',
  '最终检查清单',
  '交付物将被拒绝',
  'PPT看起来100%像是人工专业制作',
  '任何暗示内容由AI生成',
  'OpenAI、Claude、GPT、Gemini',
  '技术来源声明',
  '请尽可能自主完成所有工作',
  '只有在遇到真正无法判断的关键问题时才向用户提问',
];

// 检查文本是否包含内部指令关键词
function containsInternalInstructions(text: string): boolean {
  return INTERNAL_INSTRUCTION_KEYWORDS.some(keyword => text.includes(keyword));
}

// ============ 简洁的生成阶段组件 ============

const GENERATION_STAGES = [
  { id: 'analyze', label: '文档分析', threshold: 55, icon: FileText },
  { id: 'extract', label: '内容提炼', threshold: 62, icon: Sparkles },
  { id: 'design', label: '幻灯片设计', threshold: 70, icon: Layout },
  { id: 'chart', label: '图表生成', threshold: 80, icon: Presentation },
  { id: 'polish', label: '视觉优化', threshold: 90, icon: Sparkles },
  { id: 'export', label: '导出文件', threshold: 98, icon: Download },
];

function GenerationStages({ progress, status }: { progress: number; status: string }) {
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

  return (
    <div className="space-y-1">
      {GENERATION_STAGES.map((stage, index) => {
        let stageStatus: 'done' | 'active' | 'pending';
        
        if (isCompleted) {
          stageStatus = 'done';
        } else if (isFailed) {
          stageStatus = progress >= stage.threshold ? 'done' : 'pending';
        } else if (progress >= stage.threshold) {
          stageStatus = 'done';
        } else if (index === 0 || progress >= GENERATION_STAGES[index - 1].threshold) {
          stageStatus = 'active';
        } else {
          stageStatus = 'pending';
        }

        const Icon = stage.icon;

        return (
          <div
            key={stage.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-300",
              stageStatus === 'active' && "bg-primary/5",
            )}
          >
            {/* 状态图标 */}
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              {stageStatus === 'done' ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : stageStatus === 'active' ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : (
                <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />
              )}
            </div>

            {/* 阶段名称 */}
            <span className={cn(
              "text-sm transition-colors duration-300",
              stageStatus === 'done' && "text-green-700 font-medium",
              stageStatus === 'active' && "text-primary font-medium",
              stageStatus === 'pending' && "text-muted-foreground",
            )}>
              {stage.label}
            </span>

            {/* 当前活跃的阶段显示动画点 */}
            {stageStatus === 'active' && (
              <span className="text-xs text-primary/60 ml-auto">处理中...</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function TaskDetail() {
  const params = useParams<{ taskId: string }>();
  const taskId = parseInt(params.taskId || "0");
  const [, setLocation] = useLocation();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textResponse, setTextResponse] = useState("");
  const [isDownloading, setIsDownloading] = useState<'pptx' | null>(null);

  const { data: task, isLoading, refetch } = trpc.task.get.useQuery(
    { id: taskId },
    { enabled: taskId > 0 }
  );

  const pollMutation = trpc.task.poll.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const continueMutation = trpc.task.continue.useMutation({
    onSuccess: () => {
      toast.success("已提交，继续处理中...");
      setSelectedOption(null);
      setTextResponse("");
      refetch();
    },
    onError: () => {
      toast.error("提交失败，请重试");
    },
  });

  const retryMutation = trpc.task.retry.useMutation({
    onSuccess: () => {
      toast.success("正在重试任务，已保留原有配置和文件...");
      refetch();
    },
    onError: (error) => {
      toast.error(`重试失败: ${error.message || "请稍后再试"}`);
    },
  });

  // Poll for updates when task is active
  useEffect(() => {
    if (!task) return;
    
    const isActive = ["uploading", "running", "pending"].includes(task.status);
    if (!isActive) return;

    // Use a flag to prevent concurrent polling requests
    let isMounted = true;
    let isPolling = false;

    const interval = setInterval(() => {
      // Skip if previous poll is still in progress or component unmounted
      if (isPolling || !isMounted || pollMutation.isPending) {
        return;
      }
      
      isPolling = true;
      pollMutation.mutate({ taskId }, {
        onSettled: () => {
          isPolling = false;
        },
      });
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [task?.status, taskId]);

  // Switch to preview tab when completed
  // No preview tab to switch to - removed

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: 'oklch(0.75 0.12 85)' }} />
            <p className="text-muted-foreground">加载任务详情...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto text-center py-20 animate-fade-in">
          <AlertCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">任务不存在</h2>
          <p className="text-muted-foreground mb-6">该任务可能已被删除</p>
          <Button onClick={() => setLocation("/tasks")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回任务列表
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const status = statusConfig[task.status] || statusConfig.pending;
  const isActive = ["uploading", "running"].includes(task.status);
  const isCompleted = task.status === "completed";
  const isFailed = task.status === "failed";
  const needsInteraction = task.status === "ask";
  const timelineEvents: TimelineEvent[] = JSON.parse(task.timelineEvents || "[]");

  // Parse interaction data from real API
  let interactionContent: InteractionContent | null = null;
  if (needsInteraction && task.interactionData) {
    try {
      const rawData = JSON.parse(task.interactionData);
      // Parse from API output format
      if (Array.isArray(rawData) && rawData.length > 0) {
        const lastMessage = rawData[rawData.length - 1];
        if (lastMessage?.content && Array.isArray(lastMessage.content)) {
          const textContent = lastMessage.content.find((c: { type: string; text?: string }) => c.type === 'output_text');
          if (textContent?.text) {
            interactionContent = {
              type: 'text',
              title: '需要您的确认',
              content: textContent.text,
            };
          }
        }
      } else if (rawData && typeof rawData === 'object') {
        interactionContent = rawData;
      }
    } catch (e) {
      console.warn('[TaskDetail] Failed to parse interaction data:', e);
      interactionContent = {
        type: 'text',
        title: '需要您的输入',
        content: task.interactionData,
      };
    }
  }

  const handleContinue = (response: string) => {
    continueMutation.mutate({ taskId, userResponse: response });
  };

  const handleSubmitResponse = () => {
    if (interactionContent?.type === 'text' && textResponse.trim()) {
      handleContinue(textResponse.trim());
    } else if (selectedOption) {
      handleContinue(selectedOption);
    }
  };

  const handleRetry = () => {
    retryMutation.mutate({ taskId });
  };

  // 文件下载处理 - 增强版本，带进度和备用方案
  // 快速下载 PPTX（直接使用浏览器下载，不经过 fetch）
  const handleDownloadPptx = () => {
    if (!task.resultPptxUrl) {
      toast.error('文件链接不存在，请刷新页面');
      return;
    }
    
    const link = document.createElement('a');
    link.href = task.resultPptxUrl;
    link.download = `${task.title.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('开始下载 PPTX');
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto animate-fade-in">
        {/* Back Link */}
        <button
          onClick={() => setLocation("/tasks")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回任务列表
        </button>

        {/* Header */}
        <Card className="mb-6 pro-card border-0 shadow-pro overflow-hidden">
          <div className="h-1 gradient-gold" />
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 gradient-navy shadow-pro">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{task.title}</h1>
                  <div className="flex items-center gap-3 mt-2">
                    {task.project && (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full border"
                          style={{ backgroundColor: task.project.primaryColor }}
                        />
                        <span className="text-sm text-muted-foreground">{task.project.name}</span>
                      </div>
                    )}
                    <span className="text-border">•</span>
                    <span className="text-sm text-muted-foreground">{formatDate(task.createdAt)}</span>
                  </div>
                </div>
              </div>

              <Badge className={`${status.className} flex items-center gap-1.5 px-4 py-2`}>
                {status.icon}
                {status.label}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Section - Real Progress Bar */}
            {(isActive || needsInteraction) && (
              <Card className="pro-card border-0 shadow-pro overflow-hidden">
                <div className="h-1 gradient-gold" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center gradient-gold">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    生成进度
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RealProgressBar
                    backendProgress={task.progress}
                    currentStep={task.currentStep || undefined}
                    status={task.status as any}
                    showStages={true}
                  />
                </CardContent>
              </Card>
            )}

            {/* AI 生成阶段展示 - 仅在生成中时显示 */}
            {isActive && (
              <Card className="pro-card border-0 shadow-pro overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    AI 生成过程
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <GenerationStages progress={task.progress} status={task.status} />
                </CardContent>
              </Card>
            )}

            {/* Interaction Section */}
            {needsInteraction && (
              <UserInteractionPanel
                interactionData={task.interactionData}
                outputContent={task.outputContent}
                onSubmit={handleContinue}
                isSubmitting={continueMutation.isPending}
              />
            )}

            {/* Completed Section - 成果展示 + 下载 */}
            {isCompleted && (
              <Card className="pro-card border-0 shadow-pro overflow-hidden">
                <div className="h-1 bg-green-500" />
                <CardContent className="pt-6 space-y-5">
                  {task.resultPptxUrl ? (
                    <>
                      {/* 标题 */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-100">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-green-700">专业 PPT 已生成完成</h3>
                          <p className="text-sm text-muted-foreground">
                            用时 {(() => {
                              const start = new Date(task.createdAt).getTime();
                              const end = new Date(task.updatedAt).getTime();
                              const minutes = Math.floor((end - start) / 60000);
                              const seconds = Math.floor(((end - start) % 60000) / 1000);
                              return `${minutes} 分 ${seconds} 秒`;
                            })()}
                            {task.project && ` · ${task.project.name}`}
                          </p>
                        </div>
                      </div>

                      {/* PPT 特点 */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          <span className="text-xs text-green-700">专业商务风格</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          <span className="text-xs text-green-700">数据可视化</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          <span className="text-xs text-green-700">逻辑结构清晰</span>
                        </div>
                      </div>
                      
                      {/* 下载按钮 */}
                      <Button 
                        onClick={handleDownloadPptx}
                        className="btn-pro-gold w-full"
                        size="lg"
                      >
                        <Download className="w-5 h-5 mr-2" />
                        下载 PPTX
                      </Button>
                    </>
                  ) : (
                    <div className="text-center space-y-4 py-4">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        文件正在处理中，请稍候...
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={() => refetch()}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        刷新状态
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Failed Section with Retry */}
            {isFailed && (
              <Card className="pro-card border-0 shadow-pro overflow-hidden">
                <div className="h-1 bg-red-500" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    生成失败
                  </CardTitle>
                  <CardDescription>
                    {task.errorMessage || "生成过程中发生错误"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-700">
                      <strong>错误信息：</strong>{task.errorMessage || "未知错误"}
                    </p>
                    <p className="text-sm text-red-600 mt-2">
                      点击下方按钮可一键重试，系统将自动保留您之前的配置和上传的文件。
                    </p>
                  </div>
                  <Button 
                    onClick={handleRetry} 
                    disabled={retryMutation.isPending}
                    className="btn-pro-gold"
                  >
                    {retryMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        重试中...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        一键重试（保留配置）
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Task Info */}
            <Card className="pro-card border-0 shadow-pro">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">任务信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {task.sourceFileName && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">源文档</p>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">{task.sourceFileName}</span>
                    </div>
                  </div>
                )}
                
                {task.imageAttachments && JSON.parse(task.imageAttachments).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">配图数量</p>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {JSON.parse(task.imageAttachments).length} 张
                      </span>
                    </div>
                  </div>
                )}

                {task.project && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">设计规范</p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: task.project.primaryColor }}
                      />
                      <span className="text-sm font-medium">{task.project.name}</span>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>

            {/* Timeline */}
            {timelineEvents.length > 0 && (
              <Card className="pro-card border-0 shadow-pro">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">时间线</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      {timelineEvents.map((event, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 ${
                            event.status === 'completed' ? 'bg-green-500' :
                            event.status === 'failed' ? 'bg-red-500' :
                            event.status === 'running' ? 'bg-blue-500' :
                            'bg-gray-300'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{event.event}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(event.time).toLocaleTimeString('zh-CN')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
