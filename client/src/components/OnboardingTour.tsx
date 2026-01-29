import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight, CheckCircle, Sparkles, Palette, FileText, Image, Zap } from "lucide-react";

// 教程步骤定义
interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string; // CSS选择器，用于高亮目标元素
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon: React.ReactNode;
  tip?: string;
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: '欢迎使用 TapiPowerPoint',
    description: '这是一个AI驱动的专业PPT生成平台。只需几个简单步骤，即可生成咨询级演示文稿。让我们开始快速了解如何使用吧！',
    position: 'center',
    icon: <Sparkles className="w-8 h-8 text-amber-500" />,
    tip: '整个教程大约需要2分钟',
  },
  {
    id: 'design-spec',
    title: '第一步：选择设计规范',
    description: '设计规范定义了PPT的视觉风格，包括配色方案、字体等。选择一个已创建的规范，或从专业模板库创建新规范。',
    targetSelector: '[data-tour="design-spec"]',
    position: 'bottom',
    icon: <Palette className="w-6 h-6 text-blue-500" />,
    tip: '设计规范确保您的PPT风格统一、专业',
  },
  {
    id: 'title-input',
    title: '第二步：输入PPT标题',
    description: '输入您的PPT标题。如果您不上传文档或输入详细内容，AI将根据标题自动搜索资料并生成PPT。',
    targetSelector: '[data-tour="title-input"]',
    position: 'bottom',
    icon: <FileText className="w-6 h-6 text-green-500" />,
    tip: '标题越具体，生成的内容越精准',
  },
  {
    id: 'content-source',
    title: '第三步：提供内容来源（可选）',
    description: '您可以上传文档或直接输入Proposal内容。这一步是可选的——如果留空，AI将根据标题自动搜索相关资料。',
    targetSelector: '[data-tour="content-source"]',
    position: 'top',
    icon: <FileText className="w-6 h-6 text-purple-500" />,
    tip: '支持PDF、Word、TXT、Markdown格式',
  },
  {
    id: 'image-upload',
    title: '第四步：上传配图（可选）',
    description: '您可以预先上传希望在PPT中使用的图片，并描述放置位置。AI会优先使用您指定的图片，其他页面会自动搜索匹配的配图。',
    targetSelector: '[data-tour="image-upload"]',
    position: 'top',
    icon: <Image className="w-6 h-6 text-orange-500" />,
    tip: '描述越详细，图片放置越准确',
  },
  {
    id: 'generate',
    title: '第五步：开始生成',
    description: '点击"开始生成PPT"按钮，AI将自动完成内容规划、配图搜索和PPT制作。整个过程通常需要3-5分钟。',
    targetSelector: '[data-tour="generate-button"]',
    position: 'top',
    icon: <Zap className="w-6 h-6 text-amber-500" />,
    tip: 'AI会尽量自主完成，只在必要时询问您',
  },
  {
    id: 'complete',
    title: '恭喜！您已完成教程',
    description: '现在您已经了解了TapiPowerPoint的基本使用流程。开始创建您的第一个专业PPT吧！如有问题，可随时重新查看本教程。',
    position: 'center',
    icon: <CheckCircle className="w-8 h-8 text-green-500" />,
    tip: '点击侧边栏的"新手引导"可随时重新查看',
  },
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function OnboardingTour({ isOpen, onClose, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const step = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;

  // 更新高亮区域
  const updateHighlight = useCallback(() => {
    if (step.targetSelector) {
      const element = document.querySelector(step.targetSelector);
      if (element) {
        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);
        // 滚动到目标元素
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setHighlightRect(null);
      }
    } else {
      setHighlightRect(null);
    }
  }, [step.targetSelector]);

  useEffect(() => {
    if (isOpen) {
      updateHighlight();
      // 监听窗口大小变化
      window.addEventListener('resize', updateHighlight);
      return () => window.removeEventListener('resize', updateHighlight);
    }
  }, [isOpen, currentStep, updateHighlight]);

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (!isOpen) return null;

  // 计算提示框位置
  const getTooltipStyle = (): React.CSSProperties => {
    if (step.position === 'center' || !highlightRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
      };
    }

    const padding = 16;
    const tooltipWidth = 400;
    const tooltipHeight = 280;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case 'bottom':
        top = highlightRect.bottom + padding;
        left = highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = highlightRect.top - tooltipHeight - padding;
        left = highlightRect.left + highlightRect.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2;
        left = highlightRect.left - tooltipWidth - padding;
        break;
      case 'right':
        top = highlightRect.top + highlightRect.height / 2 - tooltipHeight / 2;
        left = highlightRect.right + padding;
        break;
    }

    // 确保不超出屏幕
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 10001,
    };
  };

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 bg-black/60 z-[10000] transition-opacity duration-300"
        onClick={handleSkip}
      />

      {/* 高亮区域 */}
      {highlightRect && (
        <div
          className="fixed z-[10000] pointer-events-none"
          style={{
            top: highlightRect.top - 8,
            left: highlightRect.left - 8,
            width: highlightRect.width + 16,
            height: highlightRect.height + 16,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
            borderRadius: '12px',
            border: '3px solid #f59e0b',
            animation: 'pulse 2s infinite',
          }}
        />
      )}

      {/* 提示框 */}
      <Card 
        className="w-[400px] shadow-2xl border-0 overflow-hidden"
        style={getTooltipStyle()}
      >
        {/* 顶部装饰条 */}
        <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
        
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center">
                {step.icon}
              </div>
              <div>
                <CardTitle className="text-lg">{step.title}</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  步骤 {currentStep + 1} / {tourSteps.length}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleSkip}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </p>

          {step.tip && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
              <p className="text-xs text-amber-700">{step.tip}</p>
            </div>
          )}

          {/* 进度指示器 */}
          <div className="flex justify-center gap-1.5 pt-2">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-6 bg-amber-500'
                    : index < currentStep
                    ? 'w-1.5 bg-amber-300'
                    : 'w-1.5 bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground"
            >
              跳过教程
            </Button>

            <div className="flex gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一步
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                className="gap-1 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {isLastStep ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    完成
                  </>
                ) : (
                  <>
                    下一步
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 动画样式 */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            border-color: #f59e0b;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 20px rgba(245, 158, 11, 0.5);
          }
          50% {
            border-color: #fbbf24;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6), 0 0 30px rgba(245, 158, 11, 0.8);
          }
        }
      `}</style>
    </>
  );
}
