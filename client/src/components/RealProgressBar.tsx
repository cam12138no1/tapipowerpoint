import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressStage {
  id: string;
  label: string;
  minProgress: number;
  maxProgress: number;
}

// Define realistic progress stages based on actual task workflow
const PROGRESS_STAGES: ProgressStage[] = [
  { id: 'init', label: '初始化任务', minProgress: 0, maxProgress: 5 },
  { id: 'upload', label: '上传文件', minProgress: 5, maxProgress: 15 },
  { id: 'analyze', label: '分析文档内容', minProgress: 15, maxProgress: 25 },
  { id: 'structure', label: '规划PPT结构', minProgress: 25, maxProgress: 35 },
  { id: 'outline', label: '生成内容大纲', minProgress: 35, maxProgress: 45 },
  { id: 'content', label: '撰写幻灯片内容', minProgress: 45, maxProgress: 65 },
  { id: 'design', label: '应用设计规范', minProgress: 65, maxProgress: 75 },
  { id: 'images', label: '处理配图', minProgress: 75, maxProgress: 85 },
  { id: 'render', label: '渲染PPT文件', minProgress: 85, maxProgress: 95 },
  { id: 'finalize', label: '完成生成', minProgress: 95, maxProgress: 100 },
];

interface RealProgressBarProps {
  // Actual progress from backend (0-100)
  backendProgress: number;
  // Current step description from backend
  currentStep?: string;
  // Task status
  status: 'pending' | 'uploading' | 'running' | 'ask' | 'completed' | 'failed';
  // Whether to show detailed stage info
  showStages?: boolean;
  // Custom class name
  className?: string;
}

export function RealProgressBar({
  backendProgress,
  currentStep,
  status,
  showStages = false,
  className,
}: RealProgressBarProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<ProgressStage | null>(null);

  // Smoothly animate progress changes
  useEffect(() => {
    // Don't animate if completed or failed
    if (status === 'completed') {
      setDisplayProgress(100);
      return;
    }
    if (status === 'failed') {
      return;
    }

    // Smooth animation to target progress
    const targetProgress = Math.min(backendProgress, 99); // Never show 100% until truly complete
    
    if (displayProgress < targetProgress) {
      const step = Math.max(0.5, (targetProgress - displayProgress) / 20);
      const timer = setTimeout(() => {
        setDisplayProgress(prev => Math.min(prev + step, targetProgress));
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [backendProgress, displayProgress, status]);

  // Determine current stage based on progress
  useEffect(() => {
    const stage = PROGRESS_STAGES.find(
      s => displayProgress >= s.minProgress && displayProgress < s.maxProgress
    ) || PROGRESS_STAGES[PROGRESS_STAGES.length - 1];
    setCurrentStage(stage);
  }, [displayProgress]);

  // Get progress bar color based on status
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

  // Get stage status
  const getStageStatus = (stage: ProgressStage) => {
    if (displayProgress >= stage.maxProgress) return 'completed';
    if (displayProgress >= stage.minProgress) return 'active';
    return 'pending';
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Main progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-2">
            {status === 'running' && (
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
            {currentStep || currentStage?.label || '准备中...'}
          </span>
          <span className="font-semibold tabular-nums" style={{ color: 'oklch(0.25 0.05 250)' }}>
            {Math.round(displayProgress)}%
          </span>
        </div>
        
        <div className="relative">
          <Progress 
            value={displayProgress} 
            className={cn(
              "h-3 transition-all duration-300",
              status === 'running' && "progress-animated"
            )}
          />
          {/* Animated shine effect for running state */}
          {status === 'running' && displayProgress > 0 && displayProgress < 100 && (
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
              style={{ width: `${displayProgress}%` }}
            />
          )}
        </div>
      </div>

      {/* Stage indicators (optional) */}
      {showStages && (
        <div className="grid grid-cols-5 gap-1 mt-4">
          {PROGRESS_STAGES.filter((_, i) => i % 2 === 0).map((stage) => {
            const stageStatus = getStageStatus(stage);
            return (
              <div key={stage.id} className="text-center">
                <div 
                  className={cn(
                    "w-3 h-3 rounded-full mx-auto mb-1 transition-all duration-300",
                    stageStatus === 'completed' && "bg-green-500",
                    stageStatus === 'active' && "bg-primary animate-pulse",
                    stageStatus === 'pending' && "bg-gray-200"
                  )}
                />
                <span 
                  className={cn(
                    "text-xs transition-colors duration-300",
                    stageStatus === 'completed' && "text-green-600",
                    stageStatus === 'active' && "text-primary font-medium",
                    stageStatus === 'pending' && "text-muted-foreground"
                  )}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Add shimmer animation to CSS
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

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = shimmerStyle;
  document.head.appendChild(styleEl);
}
