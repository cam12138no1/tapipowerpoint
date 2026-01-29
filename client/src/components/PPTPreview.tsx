import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  Presentation,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PPTPreviewProps {
  pptxUrl: string;
  pdfUrl?: string | null;
  shareUrl?: string | null;
  title: string;
}

interface SlideData {
  index: number;
  imageUrl?: string;
  content?: string;
}

export function PPTPreview({ pptxUrl, pdfUrl, shareUrl, title }: PPTPreviewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState<'iframe' | 'pdf' | 'download'>('iframe');

  // Determine best preview mode
  useEffect(() => {
    if (shareUrl) {
      setPreviewMode('iframe');
      setIsLoading(false);
    } else if (pdfUrl) {
      setPreviewMode('pdf');
      setIsLoading(false);
    } else {
      setPreviewMode('download');
      setIsLoading(false);
    }
  }, [shareUrl, pdfUrl]);

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => Math.max(0, prev - 1));
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => Math.min(totalSlides - 1, prev + 1));
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(200, prev + 25));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(50, prev - 25));
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevSlide();
      } else if (e.key === 'ArrowRight') {
        handleNextSlide();
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, totalSlides]);

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
            PPT 预览
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                className="h-7 w-7 p-0"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-xs font-medium w-12 text-center">{zoom}%</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 200}
                className="h-7 w-7 p-0"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            {/* Fullscreen Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 w-8 p-0"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Preview Area */}
        <div 
          className={cn(
            "relative bg-gray-100 flex items-center justify-center overflow-hidden",
            isFullscreen ? "h-[calc(100vh-200px)]" : "h-[500px]"
          )}
        >
          {isLoading ? (
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">正在加载预览...</p>
            </div>
          ) : previewMode === 'iframe' && shareUrl ? (
            <iframe
              src={shareUrl}
              className="w-full h-full border-0"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
              title={`${title} 预览`}
              allowFullScreen
            />
          ) : previewMode === 'pdf' && pdfUrl ? (
            <iframe
              src={`${pdfUrl}#view=FitH`}
              className="w-full h-full border-0"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
              title={`${title} PDF 预览`}
            />
          ) : (
            <div className="text-center p-8">
              <Presentation className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">PPT 已生成</h3>
              <p className="text-muted-foreground mb-6">
                点击下方按钮下载查看完整 PPT
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild className="btn-pro-gold">
                  <a href={pptxUrl} download={`${title}.pptx`}>
                    <Download className="w-4 h-4 mr-2" />
                    下载 PPTX
                  </a>
                </Button>
                {shareUrl && (
                  <Button variant="outline" asChild>
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      在新窗口打开
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-background">
          <div className="flex items-center gap-2">
            {shareUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  新窗口打开
                </a>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <a href={pptxUrl} download={`${title}.pptx`}>
                <Download className="w-4 h-4 mr-2" />
                下载 PPTX
              </a>
            </Button>
            {pdfUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={pdfUrl} download={`${title}.pdf`}>
                  <Download className="w-4 h-4 mr-2" />
                  下载 PDF
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      {/* Fullscreen overlay background */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 bg-black/50 -z-10"
          onClick={() => setIsFullscreen(false)}
        />
      )}
    </Card>
  );
}
