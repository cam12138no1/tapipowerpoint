import { useEffect, useState, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";

interface RealProgressBarProps {
  // Actual progress from backend (0-100)
  backendProgress: number;
  // Current step description from backend
  currentStep?: string;
  // Task status
  status: 'pending' | 'uploading' | 'running' | 'ask' | 'completed' | 'failed';
  // Whether to show detailed stage info (deprecated, kept for compatibility)
  showStages?: boolean;
  // Custom class name
  className?: string;
}

// 状态消息映射
const STATUS_MESSAGES: Record<string, string> = {
  pending: '准备中...',
  uploading: '正在上传文件...',
  running: '正在生成PPT...',
  ask: '等待您的确认',
  completed: '生成完成',
  failed: '生成失败',
};

export function RealProgressBar({
  backendProgress,
  currentStep,
  status,
  showStages = false,
  className,
}: RealProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  // 计时器 - 显示已用时间
  useEffect(() => {
    if (status === 'running' || status === 'uploading') {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      
      const timer = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
      
      return () => clearInterval(timer);
    } else if (status === 'completed' || status === 'failed') {
      // 任务结束时停止计时
      startTimeRef.current = null;
    }
  }, [status]);

  // 平滑动画进度
  useEffect(() => {
    if (status === 'completed') {
      setDisplayProgress(100);
      return;
    }
    if (status === 'failed') {
      return;
    }

    // 目标进度（永远不在完成前显示100%）
    const targetProgress = Math.min(backendProgress, 99);
    
    // 平滑动画
    const animate = () => {
      setDisplayProgress(prev => {
        if (prev < targetProgress) {
          const step = Math.max(0.3, (targetProgress - prev) / 30);
          const newProgress = Math.min(prev + step, targetProgress);
          animationRef.current = requestAnimationFrame(animate);
          return newProgress;
        }
        return prev;
      });
    };

    // 如果当前进度小于目标，启动动画
    if (displayProgress < targetProgress) {
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [backendProgress, status]);

  // 格式化时间显示
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}分${secs}秒`;
  };

  // 获取状态图标
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'ask':
        return <HelpCircle className="w-5 h-5 text-amber-500" />;
      default:
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
    }
  };

  // 获取进度条颜色
  const getProgressColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'ask':
        return 'bg-amber-500';
      default:
        return 'bg-primary';
    }
  };

  // 获取显示的消息
  const getDisplayMessage = (): string => {
    // 优先使用后端返回的当前步骤
    if (currentStep && currentStep.trim()) {
      return currentStep;
    }
    // 否则使用状态默认消息
    return STATUS_MESSAGES[status] || '处理中...';
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* 主进度区域 */}
      <div className="space-y-3">
        {/* 状态信息行 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <span className="text-sm font-medium text-foreground">
              {getDisplayMessage()}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* 已用时间 */}
            {(status === 'running' || status === 'uploading') && elapsedTime > 0 && (
              <span className="text-xs text-muted-foreground">
                已用时 {formatTime(elapsedTime)}
              </span>
            )}
            {/* 进度百分比 */}
            <span className="text-sm font-semibold tabular-nums" style={{ color: 'oklch(0.25 0.05 250)' }}>
              {Math.round(displayProgress)}%
            </span>
          </div>
        </div>
        
        {/* 进度条 */}
        <div className="relative">
          <Progress 
            value={displayProgress} 
            className={cn(
              "h-2 transition-all duration-300",
              status === 'running' && "progress-animated"
            )}
          />
          {/* 动画光效 */}
          {(status === 'running' || status === 'uploading') && displayProgress > 0 && displayProgress < 100 && (
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer rounded-full"
              style={{ width: `${displayProgress}%` }}
            />
          )}
        </div>
      </div>

      {/* 提示信息 */}
      {status === 'running' && (
        <p className="text-xs text-muted-foreground text-center">
          PPT生成通常需要2-5分钟，请耐心等待
        </p>
      )}
      
      {status === 'ask' && (
        <p className="text-xs text-amber-600 text-center">
          请在下方查看并回复确认信息
        </p>
      )}
    </div>
  );
}

// 添加shimmer动画样式
const shimmerStyle = `
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}
`;

// 注入样式
if (typeof document !== 'undefined') {
  const existingStyle = document.getElementById('progress-shimmer-style');
  if (!existingStyle) {
    const styleEl = document.createElement('style');
    styleEl.id = 'progress-shimmer-style';
    styleEl.textContent = shimmerStyle;
    document.head.appendChild(styleEl);
  }
}
