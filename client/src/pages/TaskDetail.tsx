import DashboardLayout from "@/components/DashboardLayout";
import { LiveCanvas, ContentBlock } from "@/components/LiveCanvas";
import { UserInteractionPanel } from "@/components/UserInteractionPanel";
import { RealProgressBar } from "@/components/RealProgressBar";
import { PPTPreview } from "@/components/PPTPreview";
import { EmbeddedPPTViewer } from "@/components/EmbeddedPPTViewer";
import { SlidePreviewCanvas, SlideContent } from "@/components/SlidePreviewCanvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { downloadFile } from "@/lib/download";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Eye,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Layout,
  Loader2,
  MessageSquare,
  Presentation,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
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

// Parse API output to content blocks for LiveCanvas
function parseOutputToBlocks(output: any[]): ContentBlock[] {
  if (!output || !Array.isArray(output)) return [];
  
  const blocks: ContentBlock[] = [];
  
  output.forEach((message, msgIndex) => {
    if (!message.content || !Array.isArray(message.content)) return;
    
    message.content.forEach((item: any, itemIndex: number) => {
      const blockId = `${msgIndex}-${itemIndex}`;
      
      if (item.type === 'output_text' && item.text) {
        const text = item.text;
        
        // 过滤掉包含内部指令的内容
        if (containsInternalInstructions(text)) {
          return; // 跳过这个内容块
        }
        
        // Check for slide content
        if (text.includes('## ') || text.includes('### ') || text.includes('幻灯片')) {
          blocks.push({
            id: `slide-${blockId}`,
            type: 'slide',
            title: extractTitle(text),
            content: text,
            status: 'completed',
            timestamp: new Date(),
          });
        } 
        // Check for thinking/analysis
        else if (text.includes('分析') || text.includes('思考') || text.includes('规划')) {
          blocks.push({
            id: `thinking-${blockId}`,
            type: 'thinking',
            title: '分析与规划',
            content: text,
            status: 'completed',
            timestamp: new Date(),
          });
        }
        // Check for action/operation
        else if (text.includes('正在') || text.includes('开始') || text.includes('执行')) {
          blocks.push({
            id: `action-${blockId}`,
            type: 'action',
            title: '执行操作',
            content: text,
            status: 'completed',
            timestamp: new Date(),
          });
        }
        // Default to content block
        else if (text.trim().length > 0) {
          blocks.push({
            id: `content-${blockId}`,
            type: 'content',
            title: '内容生成',
            content: text,
            status: 'completed',
            timestamp: new Date(),
          });
        }
      }
      
      // Handle file outputs
      if (item.fileUrl && item.fileName) {
        const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(item.fileName);
        blocks.push({
          id: `file-${blockId}`,
          type: isImage ? 'image' : 'result',
          title: item.fileName,
          content: isImage ? '已生成图片' : '已生成文件',
          status: 'completed',
          timestamp: new Date(),
          metadata: {
            imageUrl: isImage ? item.fileUrl : undefined,
            fileName: item.fileName,
          },
        });
      }
    });
  });
  
  return blocks;
}

// 无意义内容关键词 - 这些通常是AI的元信息或思考过程，不是真正的幻灯片内容
const MEANINGLESS_CONTENT_KEYWORDS = [
  '如何获取',
  '下载链接',
  '核心内容概览',
  '视觉设计亮点',
  '设计特点',
  '配色方案',
  '排版布局',
  '素材运用',
  '幻灯片概述',
  'PPTX文件',
  'PDF文件',
  '文件已生成',
  '点击下方链接',
  '查看演示文稿',
  '预览地址',
  '分享链接',
];

// 检查文本是否是无意义的元信息
function isMeaninglessContent(text: string): boolean {
  // 检查是否包含无意义关键词
  if (MEANINGLESS_CONTENT_KEYWORDS.some(keyword => text.includes(keyword))) {
    return true;
  }
  // 检查是否包含内部指令
  if (containsInternalInstructions(text)) {
    return true;
  }
  // 检查内容是否太短（少于50字符的标题通常不是有意义的幻灯片）
  const cleanText = text.replace(/^##?\s*[^\n]+\n/, '').trim();
  if (cleanText.length < 50) {
    return true;
  }
  return false;
}

// Parse API output to slide content for SlidePreviewCanvas
// 注意：这个功能目前已禁用，因为AI输出格式不稳定，无法可靠地解析幻灯片内容
function parseOutputToSlides(output: any[]): SlideContent[] {
  // 暂时禁用幻灯片预览功能，因为解析逻辑不可靠
  // 用户应该使用"成片预览"Tab查看最终的PPTX文件
  return [];
  
  /* 原始解析逻辑已禁用
  if (!output || !Array.isArray(output)) return [];
  
  const slides: SlideContent[] = [];
  let slideNumber = 0;
  
  output.forEach((message, msgIndex) => {
    if (!message.content || !Array.isArray(message.content)) return;
    
    message.content.forEach((item: any, itemIndex: number) => {
      if (item.type === 'output_text' && item.text) {
        const text = item.text;
        
        // 过滤掉无意义的内容
        if (isMeaninglessContent(text)) {
          return;
        }
        
        // Look for slide markers in the text
        const slideMatches = text.match(/(?:##|###)\s*(?:第\s*\d+\s*页|幻灯片\s*\d+|Slide\s*\d+|封面|目录|总结|结论)/gi);
        
        if (slideMatches || text.includes('## ') || text.includes('### ')) {
          // Parse sections as slides
          const sections = text.split(/(?=##\s)/);
          
          sections.forEach((section: string) => {
            // 再次检查每个部分是否有意义
            if (section.trim().length < 100 || isMeaninglessContent(section)) return;
            
            slideNumber++;
            const title = extractTitle(section);
            const type = determineSlideType(title, section, slideNumber);
            
            slides.push({
              id: `slide-${msgIndex}-${itemIndex}-${slideNumber}`,
              slideNumber,
              title: title || `第 ${slideNumber} 页`,
              content: section.replace(/^##?\s*[^\n]+\n/, '').trim(),
              type,
              status: 'completed',
            });
          });
        }
      }
      
      // Handle image outputs - attach to last slide
      if (item.fileUrl && item.fileName) {
        const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(item.fileName);
        if (isImage && slides.length > 0) {
          slides[slides.length - 1].imageUrl = item.fileUrl;
        }
      }
    });
  });
  
  return slides;
  */
}

function extractTitle(text: string): string {
  const match = text.match(/^##?\s*(.+)$/m);
  return match ? match[1].trim() : '内容';
}

function determineSlideType(title: string, content: string, slideNumber: number): SlideContent['type'] {
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();
  
  if (slideNumber === 1 || lowerTitle.includes('封面') || lowerTitle.includes('cover')) {
    return 'cover';
  }
  if (lowerTitle.includes('目录') || lowerTitle.includes('contents') || lowerTitle.includes('agenda')) {
    return 'toc';
  }
  if (lowerTitle.includes('总结') || lowerTitle.includes('结论') || lowerTitle.includes('summary') || lowerTitle.includes('conclusion')) {
    return 'summary';
  }
  if (lowerTitle.includes('数据') || lowerContent.includes('图表') || lowerContent.includes('chart') || lowerContent.includes('%')) {
    return 'data';
  }
  if (lowerTitle.includes('过渡') || lowerTitle.includes('章节')) {
    return 'divider';
  }
  return 'content';
}

export default function TaskDetail() {
  const params = useParams<{ taskId: string }>();
  const taskId = parseInt(params.taskId || "0");
  const [, setLocation] = useLocation();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textResponse, setTextResponse] = useState("");
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [slideContents, setSlideContents] = useState<SlideContent[]>([]);
  const [activeTab, setActiveTab] = useState<'process' | 'slides' | 'preview'>('process');
  const [isDownloading, setIsDownloading] = useState<'pptx' | 'pdf' | null>(null);
  const lastOutputRef = useRef<string>("");

  const { data: task, isLoading, refetch } = trpc.task.get.useQuery(
    { id: taskId },
    { enabled: taskId > 0 }
  );

  const pollMutation = trpc.task.poll.useMutation({
    onSuccess: (data) => {
      refetch();
      // Update content blocks and slides from real API output
      if (data?.outputContent) {
        try {
          const output = JSON.parse(data.outputContent);
          if (Array.isArray(output)) {
            const blocks = parseOutputToBlocks(output);
            const slides = parseOutputToSlides(output);
            if (blocks.length > 0) {
              setContentBlocks(blocks);
            }
            if (slides.length > 0) {
              setSlideContents(slides);
              // Auto-switch to slides tab when slides are available
              if (activeTab === 'process' && slides.length >= 2) {
                setActiveTab('slides');
              }
            }
          }
        } catch (e) {
          // If not JSON, parse as text
          updateContentBlocksFromText(data.outputContent);
        }
      }
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
      setContentBlocks([]);
      setSlideContents([]);
      setActiveTab('process');
      refetch();
    },
    onError: (error) => {
      toast.error(`重试失败: ${error.message || "请稍后再试"}`);
    },
  });

  // Parse text output to content blocks (fallback)
  const updateContentBlocksFromText = useCallback((output: string | null | undefined) => {
    if (!output || output === lastOutputRef.current) return;
    lastOutputRef.current = output;

    const lines = output.split('\n');
    const newBlocks: ContentBlock[] = [];
    let currentBlock: Partial<ContentBlock> | null = null;

    lines.forEach((line, index) => {
      if (line.startsWith('## ') || line.startsWith('### ')) {
        if (currentBlock) {
          newBlocks.push(currentBlock as ContentBlock);
        }
        currentBlock = {
          id: `block-${index}`,
          type: 'slide',
          title: line.replace(/^#+\s*/, ''),
          content: '',
          status: 'completed',
          timestamp: new Date(),
        };
      } else if (line.includes('正在分析') || line.includes('分析中')) {
        if (currentBlock) {
          newBlocks.push(currentBlock as ContentBlock);
        }
        currentBlock = {
          id: `block-${index}`,
          type: 'thinking',
          title: '分析文档',
          content: line,
          status: 'completed',
          timestamp: new Date(),
        };
      } else if (line.includes('生成') || line.includes('创建')) {
        if (currentBlock) {
          newBlocks.push(currentBlock as ContentBlock);
        }
        currentBlock = {
          id: `block-${index}`,
          type: 'content',
          title: '生成内容',
          content: line,
          status: 'completed',
          timestamp: new Date(),
        };
      } else if (currentBlock) {
        currentBlock.content = (currentBlock.content || '') + '\n' + line;
      }
    });

    if (currentBlock) {
      newBlocks.push(currentBlock as ContentBlock);
    }

    if (newBlocks.length > 0) {
      setContentBlocks(newBlocks);
    }
  }, []);

  // Poll for updates when task is active
  useEffect(() => {
    if (!task) return;
    
    const isActive = ["uploading", "running"].includes(task.status);
    if (!isActive) return;

    // Initial content blocks update
    if (task.outputContent) {
      try {
        const output = JSON.parse(task.outputContent);
        if (Array.isArray(output)) {
          const blocks = parseOutputToBlocks(output);
          const slides = parseOutputToSlides(output);
          if (blocks.length > 0) {
            setContentBlocks(blocks);
          }
          if (slides.length > 0) {
            setSlideContents(slides);
          }
        }
      } catch (e) {
        updateContentBlocksFromText(task.outputContent);
      }
    }

    const interval = setInterval(() => {
      pollMutation.mutate({ taskId });
    }, 2000);

    return () => clearInterval(interval);
  }, [task?.status, taskId, updateContentBlocksFromText]);

  // Switch to preview tab when completed
  useEffect(() => {
    if (task?.status === 'completed' && task.resultPptxUrl) {
      setActiveTab('preview');
    }
  }, [task?.status, task?.resultPptxUrl]);

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
      if (Array.isArray(rawData)) {
        const lastMessage = rawData[rawData.length - 1];
        if (lastMessage?.content) {
          const textContent = lastMessage.content.find((c: any) => c.type === 'output_text');
          if (textContent?.text) {
            interactionContent = {
              type: 'text',
              title: '需要您的确认',
              content: textContent.text,
            };
          }
        }
      } else {
        interactionContent = rawData;
      }
    } catch {
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

  // 真实文件下载处理
  const handleDownloadPptx = async () => {
    if (!task.resultPptxUrl) return;
    setIsDownloading('pptx');
    try {
      await downloadFile(task.resultPptxUrl, `${task.title}.pptx`);
      toast.success('PPTX 下载成功');
    } catch (error) {
      toast.error('下载失败，请重试');
      // 回退到直接打开链接
      window.open(task.resultPptxUrl, '_blank');
    } finally {
      setIsDownloading(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!task.resultPdfUrl) return;
    setIsDownloading('pdf');
    try {
      await downloadFile(task.resultPdfUrl, `${task.title}.pdf`);
      toast.success('PDF 下载成功');
    } catch (error) {
      toast.error('下载失败，请重试');
      // 回退到直接打开链接
      window.open(task.resultPdfUrl, '_blank');
    } finally {
      setIsDownloading(null);
    }
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
                    currentStep={task.currentStep}
                    status={task.status as any}
                    showStages={true}
                  />
                </CardContent>
              </Card>
            )}

            {/* Tabs for Process/Preview - 简化为两个Tab */}
            {(isCompleted || contentBlocks.length > 0) && (
              <Tabs value={activeTab === 'slides' ? 'process' : activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="process" className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    生成过程
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex items-center gap-2" disabled={!isCompleted}>
                    <Presentation className="w-4 h-4" />
                    成片预览
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="process" className="mt-4">
                  <LiveCanvas
                    blocks={contentBlocks}
                    isStreaming={isActive}
                    currentStep={task.currentStep}
                  />
                </TabsContent>
                
                <TabsContent value="preview" className="mt-4">
                  {isCompleted ? (
                    task.resultPptxUrl ? (
                      <EmbeddedPPTViewer
                        pptxUrl={task.resultPptxUrl}
                        pdfUrl={task.resultPdfUrl}
                        title={task.title}
                      />
                    ) : (
                      <Card className="pro-card border-0 shadow-pro">
                        <CardContent className="p-8 text-center">
                          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
                          <h3 className="text-lg font-semibold mb-2">PPT 文件正在处理中</h3>
                          <p className="text-muted-foreground mb-4">文件可能仍在上传到服务器，请稍后刷新页面</p>
                          <Button variant="outline" onClick={() => refetch()}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            刷新状态
                          </Button>
                        </CardContent>
                      </Card>
                    )
                  ) : (
                    <Card className="pro-card border-0 shadow-pro">
                      <CardContent className="p-8 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">PPT 生成完成后可预览</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            )}

            {/* Live Canvas for active tasks without tabs */}
            {isActive && contentBlocks.length === 0 && slideContents.length === 0 && (
              <LiveCanvas
                blocks={contentBlocks}
                isStreaming={isActive}
                currentStep={task.currentStep}
              />
            )}

            {/* Interaction Section - Enhanced with UserInteractionPanel */}
            {needsInteraction && (
              <UserInteractionPanel
                interactionData={task.interactionData}
                outputContent={task.outputContent}
                onSubmit={handleContinue}
                isSubmitting={continueMutation.isPending}
              />
            )}

            {/* Completed Section */}
            {isCompleted && (
              <Card className="pro-card border-0 shadow-pro overflow-hidden">
                <div className="h-1 bg-green-500" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    生成完成
                  </CardTitle>
                  <CardDescription>
                    {task.resultPptxUrl 
                      ? '您的PPT已成功生成，可以下载或在上方预览'
                      : '任务已完成，文件正在处理中，请稍后刷新...'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {task.resultPptxUrl ? (
                      <>
                        <Button 
                          className="btn-pro-gold" 
                          onClick={handleDownloadPptx}
                          disabled={isDownloading === 'pptx'}
                        >
                          {isDownloading === 'pptx' ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          下载 PPTX
                        </Button>
                        {task.resultPdfUrl && (
                          <Button 
                            variant="outline" 
                            onClick={handleDownloadPdf}
                            disabled={isDownloading === 'pdf'}
                          >
                            {isDownloading === 'pdf' ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4 mr-2" />
                            )}
                            下载 PDF
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button 
                        variant="outline" 
                        onClick={() => refetch()}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        刷新状态
                      </Button>
                    )}
                  </div>
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
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
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

                {slideContents.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">已生成幻灯片</p>
                    <div className="flex items-center gap-2">
                      <Layout className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{slideContents.length} 页</span>
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
