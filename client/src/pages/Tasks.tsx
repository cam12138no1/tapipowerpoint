import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Clock, FileText, HelpCircle, ListTodo, Loader2, Plus, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending: { label: "等待中", icon: <Clock className="w-4 h-4" />, className: "status-pending" },
  uploading: { label: "上传中", icon: <Loader2 className="w-4 h-4 animate-spin" />, className: "status-uploading" },
  running: { label: "生成中", icon: <RefreshCw className="w-4 h-4 animate-spin" />, className: "status-running" },
  ask: { label: "需确认", icon: <HelpCircle className="w-4 h-4" />, className: "status-ask" },
  completed: { label: "已完成", icon: <CheckCircle2 className="w-4 h-4" />, className: "status-completed" },
  failed: { label: "失败", icon: <AlertCircle className="w-4 h-4" />, className: "status-failed" },
};

export default function Tasks() {
  const [, setLocation] = useLocation();
  const { data: tasks, isLoading, refetch } = trpc.task.list.useQuery(undefined, {
    refetchInterval: 5000, // Poll every 5 seconds for active tasks
  });

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'oklch(0.95 0.01 85)' }}>
              <ListTodo className="w-5 h-5" style={{ color: 'oklch(0.55 0.1 85)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'oklch(0.25 0.05 250)' }}>任务列表</h1>
              <p className="text-muted-foreground text-sm">查看和管理所有 PPT 生成任务</p>
            </div>
          </div>
          <Button onClick={() => setLocation("/")} className="btn-pro-gold h-10">
            <Plus className="w-4 h-4 mr-2" />
            创建新任务
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'oklch(0.55 0.1 85)' }} />
          </div>
        ) : tasks && tasks.length > 0 ? (
          <div className="space-y-4">
            {tasks.map((task) => {
              const status = statusConfig[task.status] || statusConfig.pending;
              const isActive = ["uploading", "running"].includes(task.status);
              
              return (
                <Card
                  key={task.id}
                  className="pro-card border-0 shadow-pro cursor-pointer"
                  onClick={() => setLocation(`/tasks/${task.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'oklch(0.25 0.05 250)' }}>
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-foreground truncate">{task.title}</h3>
                            <div className="flex items-center gap-3 mt-1">
                              {task.project && (
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full border"
                                    style={{ backgroundColor: task.project.primaryColor }}
                                  />
                                  <span className="text-sm text-muted-foreground">{task.project.name}</span>
                                </div>
                              )}
                              <span className="text-sm text-muted-foreground">
                                {formatDate(task.createdAt)}
                              </span>
                            </div>
                          </div>
                          
                          <Badge className={`${status.className} flex items-center gap-1.5`}>
                            {status.icon}
                            {status.label}
                          </Badge>
                        </div>
                        
                        {isActive && (
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="text-muted-foreground">{task.currentStep || "处理中..."}</span>
                              <span className="font-medium" style={{ color: 'oklch(0.25 0.05 250)' }}>{task.progress}%</span>
                            </div>
                            <Progress value={task.progress} className="h-2" />
                          </div>
                        )}
                        
                        {task.status === "ask" && (
                          <div className="mt-3 p-3 rounded-lg border-2" style={{ background: 'oklch(0.98 0.01 85)', borderColor: 'oklch(0.85 0.08 85)' }}>
                            <p className="text-sm" style={{ color: 'oklch(0.45 0.08 85)' }}>
                              需要您的确认才能继续，点击查看详情
                            </p>
                          </div>
                        )}
                        
                        {task.status === "completed" && (
                          <div className="mt-3 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" style={{ color: 'oklch(0.5 0.15 145)' }} />
                            <span className="text-sm" style={{ color: 'oklch(0.45 0.12 145)' }}>PPT 已生成，点击下载</span>
                          </div>
                        )}
                        
                        {task.status === "failed" && task.errorMessage && (
                          <div className="mt-3 p-3 rounded-lg border" style={{ background: 'oklch(0.98 0.02 25)', borderColor: 'oklch(0.85 0.1 25)' }}>
                            <p className="text-sm truncate" style={{ color: 'oklch(0.5 0.12 25)' }}>{task.errorMessage}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="pro-card border-0 shadow-pro">
            <CardContent className="py-20 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'oklch(0.95 0.01 85)' }}>
                <FileText className="w-8 h-8" style={{ color: 'oklch(0.55 0.1 85)' }} />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">暂无任务</h3>
              <p className="text-muted-foreground mb-6">创建您的第一个 PPT 生成任务</p>
              <Button onClick={() => setLocation("/")} className="btn-pro-gold">
                <Plus className="w-4 h-4 mr-2" />
                创建任务
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
