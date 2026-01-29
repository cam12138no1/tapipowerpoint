import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Loader2,
  Maximize2,
  Minimize2,
  Presentation,
  RefreshCw,
  Save,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadFile } from "@/lib/download";
import { toast } from "sonner";

interface SlideData {
  index: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  content?: string;
  title?: string;
}

interface EmbeddedPPTViewerProps {
  pptxUrl: string;
  pdfUrl?: string | null;
  title: string;
  slides?: SlideData[];
  onRegenerateSlide?: (slideIndex: number, instruction: string) => Promise<void>;
  onEditSlide?: (slideIndex: number, content: string) => Promise<void>;
}

export function EmbeddedPPTViewer({
  pptxUrl,
  pdfUrl,
  title,
  slides: initialSlides,
  onRegenerateSlide,
  onEditSlide,
}: EmbeddedPPTViewerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<SlideData[]>(initialSlides || []);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  // 只有在有slides数据但还没加载完成时才显示loading
  // 如果没有slides数据，直接显示下载提示或PDF预览
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState<'pptx' | 'pdf' | null>(null);
  
  // 编辑状态
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [regenerateInstruction, setRegenerateInstruction] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRegeneratePanel, setShowRegeneratePanel] = useState(false);

  // 更新slides数据
  useEffect(() => {
    if (initialSlides?.length) {
      setSlides(initialSlides);
    }
  }, [initialSlides]);

  const totalSlides = slides.length || 1;

  const handlePrevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(totalSlides - 1, prev + 1));
  }, [totalSlides]);

  const handleZoomIn = () => setZoom((prev) => Math.min(200, prev + 25));
  const handleZoomOut = () => setZoom((prev) => Math.max(50, prev - 25));
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  // 下载处理
  const handleDownloadPptx = async () => {
    setIsDownloading('pptx');
    try {
      await downloadFile(pptxUrl, `${title}.pptx`);
      toast.success('PPTX 下载成功');
    } catch (error) {
      toast.error('下载失败，请重试');
      window.open(pptxUrl, '_blank');
    } finally {
      setIsDownloading(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!pdfUrl) return;
    setIsDownloading('pdf');
    try {
      await downloadFile(pdfUrl, `${title}.pdf`);
      toast.success('PDF 下载成功');
    } catch (error) {
      toast.error('下载失败，请重试');
      window.open(pdfUrl, '_blank');
    } finally {
      setIsDownloading(null);
    }
  };

  // 编辑处理
  const handleStartEdit = (slideIndex: number) => {
    setEditingSlide(slideIndex);
    setEditContent(slides[slideIndex]?.content || "");
  };

  const handleCancelEdit = () => {
    setEditingSlide(null);
    setEditContent("");
  };

  const handleSaveEdit = async () => {
    if (editingSlide === null || !onEditSlide) return;
    setIsSaving(true);
    try {
      await onEditSlide(editingSlide, editContent);
      toast.success('保存成功');
      setEditingSlide(null);
      setEditContent("");
    } catch (error) {
      toast.error('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 重新生成处理
  const handleRegenerate = async () => {
    if (!onRegenerateSlide || !regenerateInstruction.trim()) return;
    setIsRegenerating(true);
    try {
      await onRegenerateSlide(currentSlide, regenerateInstruction);
      toast.success('重新生成请求已提交');
      setShowRegeneratePanel(false);
      setRegenerateInstruction("");
    } catch (error) {
      toast.error('重新生成失败，请重试');
    } finally {
      setIsRegenerating(false);
    }
  };

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingSlide !== null) return; // 编辑时禁用键盘导航
      if (e.key === 'ArrowLeft') handlePrevSlide();
      else if (e.key === 'ArrowRight') handleNextSlide();
      else if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, editingSlide, handlePrevSlide, handleNextSlide]);

  return (
    <Card className={cn(
      "pro-card border-0 shadow-pro overflow-hidden transition-all duration-300",
      isFullscreen && "fixed inset-4 z-50 m-0"
    )}>
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center gradient-gold">
              <Presentation className="w-4 h-4 text-white" />
            </div>
            在线预览
            {slides.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-2">
                {currentSlide + 1} / {totalSlides}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* 缩放控制 */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
              <Button variant="ghost" size="sm" onClick={handleZoomOut} disabled={zoom <= 50} className="h-7 w-7 p-0">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium w-12 text-center">{zoom}%</span>
              <Button variant="ghost" size="sm" onClick={handleZoomIn} disabled={zoom >= 200} className="h-7 w-7 p-0">
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
            {/* 全屏切换 */}
            <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="h-8 w-8 p-0">
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* 预览区域 */}
        <div className={cn(
          "relative bg-gray-100 flex items-center justify-center overflow-hidden",
          isFullscreen ? "h-[calc(100vh-250px)]" : "h-[500px]"
        )}>
          {isLoading ? (
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">正在加载预览...</p>
            </div>
          ) : slides.length > 0 && slides[currentSlide]?.imageUrl ? (
            // 显示幻灯片图片
            <div 
              className="relative w-full h-full flex items-center justify-center p-4"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
            >
              <img
                src={slides[currentSlide].imageUrl}
                alt={`第 ${currentSlide + 1} 页`}
                className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
              />
            </div>
          ) : pdfUrl ? (
            // 使用PDF预览
            <iframe
              src={`${pdfUrl}#view=FitH&page=${currentSlide + 1}`}
              className="w-full h-full border-0"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
              title={`${title} 预览`}
            />
          ) : (
            // 无预览可用
            <div className="text-center p-8">
              <Presentation className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">PPT 已生成</h3>
              <p className="text-muted-foreground mb-6">点击下方按钮下载查看完整 PPT</p>
            </div>
          )}

          {/* 左右导航按钮 */}
          {(slides.length > 1 || pdfUrl) && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevSlide}
                disabled={currentSlide === 0}
                className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/80 hover:bg-white shadow-lg"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextSlide}
                disabled={currentSlide >= totalSlides - 1}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/80 hover:bg-white shadow-lg"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}
        </div>

        {/* 缩略图导航 */}
        {slides.length > 1 && (
          <div className="border-t border-border bg-secondary/30 p-3">
            <ScrollArea className="w-full">
              <div className="flex gap-2">
                {slides.map((slide, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={cn(
                      "flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all",
                      currentSlide === index 
                        ? "border-primary ring-2 ring-primary/20" 
                        : "border-transparent hover:border-muted-foreground/30"
                    )}
                  >
                    {slide.thumbnailUrl || slide.imageUrl ? (
                      <img
                        src={slide.thumbnailUrl || slide.imageUrl}
                        alt={`第 ${index + 1} 页`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">{index + 1}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* 重新生成面板 */}
        {showRegeneratePanel && (
          <div className="border-t border-border bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-amber-600 mt-1 flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <div>
                  <h4 className="font-medium text-amber-800">重新生成第 {currentSlide + 1} 页</h4>
                  <p className="text-sm text-amber-600">请描述您希望如何修改这一页</p>
                </div>
                <Textarea
                  placeholder="例如：请将标题改为更简洁的版本，并添加一张数据图表..."
                  value={regenerateInstruction}
                  onChange={(e) => setRegenerateInstruction(e.target.value)}
                  className="min-h-[80px]"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleRegenerate}
                    disabled={isRegenerating || !regenerateInstruction.trim()}
                    className="btn-pro-gold"
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重新生成
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setShowRegeneratePanel(false)}>
                    取消
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 控制栏 */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-background">
          <div className="flex items-center gap-2">
            {/* 编辑按钮 */}
            {onRegenerateSlide && slides.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRegeneratePanel(!showRegeneratePanel)}
                className={cn(showRegeneratePanel && "bg-amber-100 border-amber-300")}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重新生成此页
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleDownloadPptx}
              disabled={isDownloading === 'pptx'}
              className="btn-pro-gold"
            >
              {isDownloading === 'pptx' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              下载 PPTX
            </Button>
            {pdfUrl && (
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
          </div>
        </div>
      </CardContent>

      {/* 全屏背景遮罩 */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 bg-black/50 -z-10"
          onClick={() => setIsFullscreen(false)}
        />
      )}
    </Card>
  );
}
