import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  Layout,
  Loader2,
  Maximize2,
  Minimize2,
  Sparkles,
  Grid3X3,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideContent {
  id: string;
  slideNumber: number;
  title: string;
  content: string;
  type: 'cover' | 'toc' | 'content' | 'data' | 'summary' | 'divider';
  imageUrl?: string;
  status: 'generating' | 'completed';
}

interface SlidePreviewCanvasProps {
  slides: SlideContent[];
  isGenerating: boolean;
  currentSlideIndex?: number;
}

// Slide type configurations
const slideTypeConfig: Record<SlideContent['type'], { label: string; icon: React.ReactNode; color: string }> = {
  cover: { label: '封面', icon: <Layout className="w-3 h-3" />, color: 'bg-purple-100 text-purple-700' },
  toc: { label: '目录', icon: <List className="w-3 h-3" />, color: 'bg-blue-100 text-blue-700' },
  content: { label: '内容', icon: <FileText className="w-3 h-3" />, color: 'bg-green-100 text-green-700' },
  data: { label: '数据', icon: <Grid3X3 className="w-3 h-3" />, color: 'bg-amber-100 text-amber-700' },
  summary: { label: '总结', icon: <Sparkles className="w-3 h-3" />, color: 'bg-emerald-100 text-emerald-700' },
  divider: { label: '过渡', icon: <Layout className="w-3 h-3" />, color: 'bg-gray-100 text-gray-700' },
};

function SlideCard({ 
  slide, 
  isActive, 
  onClick,
  isExpanded,
  onToggleExpand,
}: { 
  slide: SlideContent; 
  isActive: boolean;
  onClick: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const typeConfig = slideTypeConfig[slide.type];

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(slide.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 transition-all cursor-pointer overflow-hidden",
        isActive 
          ? "border-primary ring-2 ring-primary/20 shadow-lg" 
          : "border-border hover:border-primary/50 hover:shadow-md",
        slide.status === 'generating' && "animate-pulse"
      )}
      onClick={onClick}
    >
      {/* Slide Header */}
      <div className="flex items-center justify-between p-3 bg-secondary/30 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={cn("text-xs px-2 py-0.5", typeConfig.color)}>
            {typeConfig.icon}
            <span className="ml-1">{typeConfig.label}</span>
          </Badge>
          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
            {slide.title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-xs">
            第 {slide.slideNumber} 页
          </Badge>
          {slide.status === 'generating' && (
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
          )}
        </div>
      </div>

      {/* Slide Preview */}
      <div className="relative aspect-[16/9] bg-white overflow-hidden">
        {slide.imageUrl ? (
          <img 
            src={slide.imageUrl} 
            alt={slide.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full p-4 flex flex-col">
            {/* Simulated slide content */}
            <div className="text-lg font-bold text-gray-800 mb-2 truncate">
              {slide.title}
            </div>
            <div className={cn(
              "text-xs text-gray-600 overflow-hidden",
              isExpanded ? "max-h-none" : "max-h-20"
            )}>
              {slide.content.split('\n').slice(0, isExpanded ? undefined : 4).map((line, i) => (
                <p key={i} className="truncate">{line}</p>
              ))}
            </div>
            {!isExpanded && slide.content.split('\n').length > 4 && (
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
            )}
          </div>
        )}
      </div>

      {/* Slide Actions */}
      <div className="flex items-center justify-between p-2 bg-secondary/20 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExpand}
          className="h-7 text-xs"
        >
          {isExpanded ? (
            <>
              <ChevronsUp className="w-3 h-3 mr-1" />
              收起
            </>
          ) : (
            <>
              <ChevronsDown className="w-3 h-3 mr-1" />
              展开
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 text-xs"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 mr-1 text-green-500" />
              已复制
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 mr-1" />
              复制内容
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function SlidePreviewCanvas({ 
  slides, 
  isGenerating, 
  currentSlideIndex = 0 
}: SlidePreviewCanvasProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [expandedSlides, setExpandedSlides] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest slide when generating
  useEffect(() => {
    if (isGenerating && slides.length > 0) {
      setActiveSlide(slides.length - 1);
    }
  }, [slides.length, isGenerating]);

  const handleToggleExpand = (slideId: string) => {
    setExpandedSlides(prev => ({
      ...prev,
      [slideId]: !prev[slideId],
    }));
  };

  const handleExpandAll = () => {
    const newState: Record<string, boolean> = {};
    slides.forEach(s => { newState[s.id] = true; });
    setExpandedSlides(newState);
  };

  const handleCollapseAll = () => {
    setExpandedSlides({});
  };

  const handlePrevSlide = () => {
    setActiveSlide(prev => Math.max(0, prev - 1));
  };

  const handleNextSlide = () => {
    setActiveSlide(prev => Math.min(slides.length - 1, prev + 1));
  };

  if (slides.length === 0) {
    return (
      <Card className="pro-card border-0 shadow-pro overflow-hidden">
        <CardContent className="p-8 text-center">
          {isGenerating ? (
            <>
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">正在生成幻灯片内容...</p>
              <p className="text-xs text-muted-foreground mt-1">内容将实时显示在此处</p>
            </>
          ) : (
            <>
              <Layout className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无幻灯片内容</p>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "pro-card border-0 shadow-pro overflow-hidden transition-all duration-300",
      isFullscreen && "fixed inset-4 z-50 m-0"
    )}>
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center gradient-gold">
              <Layout className="w-4 h-4 text-white" />
            </div>
            幻灯片预览
            <Badge variant="secondary" className="text-xs ml-2">
              {slides.length} 页
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-7 px-2"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'single' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('single')}
                className="h-7 px-2"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Expand/Collapse All */}
            {viewMode === 'grid' && (
              <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExpandAll}
                  className="h-7 px-2 text-xs"
                >
                  展开
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCollapseAll}
                  className="h-7 px-2 text-xs"
                >
                  折叠
                </Button>
              </div>
            )}

            {/* Fullscreen Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 p-0"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>

            {isGenerating && (
              <Badge className="bg-primary/10 text-primary border-primary/20 animate-pulse">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                生成中
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {viewMode === 'grid' ? (
          <ScrollArea 
            ref={scrollRef} 
            className={cn(
              "p-4",
              isFullscreen ? "h-[calc(100vh-200px)]" : "h-[500px]"
            )}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {slides.map((slide, index) => (
                <SlideCard
                  key={slide.id}
                  slide={slide}
                  isActive={index === activeSlide}
                  onClick={() => {
                    setActiveSlide(index);
                    setViewMode('single');
                  }}
                  isExpanded={expandedSlides[slide.id] || false}
                  onToggleExpand={() => handleToggleExpand(slide.id)}
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className={cn(
            "relative",
            isFullscreen ? "h-[calc(100vh-200px)]" : "h-[500px]"
          )}>
            {/* Single Slide View */}
            <div className="h-full flex flex-col">
              {/* Slide Content */}
              <div className="flex-1 p-6 overflow-auto">
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="secondary" className={cn(
                      "text-xs px-2 py-0.5",
                      slideTypeConfig[slides[activeSlide].type].color
                    )}>
                      {slideTypeConfig[slides[activeSlide].type].icon}
                      <span className="ml-1">{slideTypeConfig[slides[activeSlide].type].label}</span>
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      第 {slides[activeSlide].slideNumber} / {slides.length} 页
                    </Badge>
                    {slides[activeSlide].status === 'generating' && (
                      <Badge className="bg-primary/10 text-primary animate-pulse">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        生成中
                      </Badge>
                    )}
                  </div>
                  
                  <h2 className="text-2xl font-bold text-foreground mb-4">
                    {slides[activeSlide].title}
                  </h2>
                  
                  {slides[activeSlide].imageUrl && (
                    <div className="mb-4 rounded-lg overflow-hidden border border-border">
                      <img 
                        src={slides[activeSlide].imageUrl}
                        alt={slides[activeSlide].title}
                        className="w-full h-auto"
                      />
                    </div>
                  )}
                  
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-muted-foreground">
                      {slides[activeSlide].content}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between p-4 border-t border-border bg-background">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevSlide}
                  disabled={activeSlide === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  上一页
                </Button>
                
                <div className="flex items-center gap-2">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveSlide(index)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        index === activeSlide 
                          ? "w-6 bg-primary" 
                          : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                      )}
                    />
                  ))}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextSlide}
                  disabled={activeSlide === slides.length - 1}
                >
                  下一页
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 bg-black/50 -z-10"
          onClick={() => setIsFullscreen(false)}
        />
      )}
    </Card>
  );
}

// Export types
export type { SlideContent };
