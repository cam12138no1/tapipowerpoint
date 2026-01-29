import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Send,
  ThumbsUp,
  ThumbsDown,
  Edit3,
  Sparkles,
  AlertCircle,
} from "lucide-react";

interface InteractionImage {
  url: string;
  label?: string;
  description?: string;
  slideNumber?: number;
  placement?: string;
}

interface InteractionOption {
  id: string;
  label: string;
  description?: string;
}

interface UserInteractionPanelProps {
  interactionData: string | null;
  outputContent: string | null;
  onSubmit: (response: string) => void;
  isSubmitting: boolean;
}

// Parse AI output to extract interaction content
function parseInteractionContent(interactionData: string | null, outputContent: string | null) {
  let title = "需要您的确认";
  let content = "";
  let images: InteractionImage[] = [];
  let options: InteractionOption[] = [];
  let interactionType: 'text' | 'choice' | 'image_confirmation' | 'image_selection' = 'text';
  
  // Try to parse interaction data first
  if (interactionData) {
    try {
      const data = JSON.parse(interactionData);
      
      // Handle array format (API output)
      if (Array.isArray(data)) {
        // Find the last message with ask content
        for (let i = data.length - 1; i >= 0; i--) {
          const message = data[i];
          if (message?.content && Array.isArray(message.content)) {
            for (const item of message.content) {
              // Extract text content
              if (item.type === 'output_text' && item.text) {
                content = item.text;
                
                // Check if it's asking about images
                if (content.includes('图片') || content.includes('配图') || content.includes('图像')) {
                  interactionType = 'image_confirmation';
                  title = "配图方案确认";
                }
                
                // Check for choice patterns
                if (content.includes('选择') || content.includes('请选择') || content.match(/\d+\.\s/)) {
                  interactionType = 'choice';
                  title = "请选择一个选项";
                  
                  // Extract numbered options
                  const optionMatches = content.matchAll(/(\d+)[.、]\s*([^\n]+)/g);
                  for (const match of optionMatches) {
                    options.push({
                      id: match[1],
                      label: match[2].trim(),
                    });
                  }
                }
              }
              
              // Extract image URLs from file outputs
              if (item.fileUrl && item.fileName) {
                const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(item.fileName);
                if (isImage) {
                  images.push({
                    url: item.fileUrl,
                    label: item.fileName,
                  });
                }
              }
            }
          }
        }
      }
      // Handle object format
      else if (typeof data === 'object') {
        if (data.title) title = data.title;
        if (data.content) content = data.content;
        if (data.images) images = data.images;
        if (data.options) options = data.options;
        if (data.type) interactionType = data.type;
      }
    } catch (e) {
      // If parsing fails, use raw data as content
      content = interactionData;
    }
  }
  
  // Also check output content for images
  if (outputContent) {
    try {
      const output = JSON.parse(outputContent);
      if (Array.isArray(output)) {
        output.forEach((message) => {
          if (message?.content && Array.isArray(message.content)) {
            message.content.forEach((item: any) => {
              // Extract images from output
              if (item.fileUrl && item.fileName) {
                const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(item.fileName);
                if (isImage && !images.find(img => img.url === item.fileUrl)) {
                  // Try to extract slide number from context
                  let slideNumber: number | undefined;
                  let placement: string | undefined;
                  
                  // Look for slide context in surrounding text
                  const slideMatch = item.fileName.match(/slide[_-]?(\d+)/i) || 
                                    item.fileName.match(/第(\d+)页/);
                  if (slideMatch) {
                    slideNumber = parseInt(slideMatch[1]);
                  }
                  
                  images.push({
                    url: item.fileUrl,
                    label: item.fileName,
                    slideNumber,
                    placement,
                  });
                }
              }
            });
          }
        });
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  // If we found images, it's likely an image confirmation
  if (images.length > 0 && interactionType === 'text') {
    interactionType = 'image_confirmation';
    title = "配图方案确认";
    if (!content) {
      content = "AI 已为您的 PPT 生成了以下配图方案，请确认是否满意，或提供修改意见。";
    }
  }
  
  return { title, content, images, options, interactionType };
}

export function UserInteractionPanel({
  interactionData,
  outputContent,
  onSubmit,
  isSubmitting,
}: UserInteractionPanelProps) {
  const [textResponse, setTextResponse] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [showCustomInput, setShowCustomInput] = useState(false);
  
  const { title, content, images, options, interactionType } = parseInteractionContent(
    interactionData,
    outputContent
  );
  
  // Reset state when interaction data changes
  useEffect(() => {
    setTextResponse("");
    setSelectedOption(null);
    setSelectedImages(new Set());
    setShowCustomInput(false);
  }, [interactionData]);
  
  const handleQuickConfirm = () => {
    onSubmit("确认，请继续");
  };
  
  const handleQuickReject = () => {
    setShowCustomInput(true);
  };
  
  const handleSubmitCustom = () => {
    if (textResponse.trim()) {
      onSubmit(textResponse.trim());
    }
  };
  
  const handleOptionSelect = (optionId: string) => {
    setSelectedOption(optionId);
    onSubmit(optionId);
  };
  
  const handleImageToggle = (imageUrl: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageUrl)) {
      newSelected.delete(imageUrl);
    } else {
      newSelected.add(imageUrl);
    }
    setSelectedImages(newSelected);
  };
  
  const handleConfirmImages = () => {
    if (selectedImages.size === 0) {
      // Confirm all images
      onSubmit("确认所有配图，请继续生成 PPT");
    } else {
      // Confirm selected images
      const selectedList = Array.from(selectedImages).join(", ");
      onSubmit(`确认使用以下图片: ${selectedList}`);
    }
  };
  
  return (
    <Card className="border-2 shadow-pro overflow-hidden animate-fade-in" style={{ borderColor: 'oklch(0.85 0.08 85)', background: 'oklch(0.98 0.01 85)' }}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2" style={{ color: 'oklch(0.35 0.08 85)' }}>
          {interactionType === 'image_confirmation' ? (
            <ImageIcon className="w-5 h-5" />
          ) : (
            <MessageSquare className="w-5 h-5" />
          )}
          {title}
        </CardTitle>
        {content && (
          <CardDescription className="text-base whitespace-pre-wrap mt-2" style={{ color: 'oklch(0.45 0.05 85)' }}>
            {content}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Image Preview Grid */}
        {images.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                AI 生成的配图 ({images.length} 张)
              </span>
              <Badge variant="secondary" className="text-xs">
                点击图片可选择/取消
              </Badge>
            </div>
            
            <ScrollArea className="h-[300px] rounded-lg border bg-background p-3">
              <div className="grid grid-cols-2 gap-3">
                {images.map((image, index) => (
                  <div
                    key={image.url}
                    className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:shadow-lg ${
                      selectedImages.has(image.url)
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    onClick={() => handleImageToggle(image.url)}
                  >
                    <img
                      src={image.url}
                      alt={image.label || `配图 ${index + 1}`}
                      className="w-full aspect-video object-cover"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-xs font-medium truncate">
                          {image.slideNumber ? `第 ${image.slideNumber} 页` : image.label || `图片 ${index + 1}`}
                        </span>
                        {selectedImages.has(image.url) && (
                          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {/* Choice Options */}
        {interactionType === 'choice' && options.length > 0 && (
          <div className="space-y-2">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleOptionSelect(option.id)}
                disabled={isSubmitting}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  selectedOption === option.id
                    ? "border-primary bg-accent shadow-pro-sm"
                    : "border-border bg-card hover:border-muted-foreground/30 hover:shadow-pro-sm"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedOption === option.id ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`}>
                    {selectedOption === option.id ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{option.id}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{option.label}</p>
                    {option.description && (
                      <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        
        {/* Quick Actions for Image Confirmation */}
        {interactionType === 'image_confirmation' && !showCustomInput && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <Button
                onClick={handleQuickConfirm}
                disabled={isSubmitting}
                className="flex-1 h-12 btn-pro-gold"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ThumbsUp className="w-4 h-4 mr-2" />
                )}
                确认配图，继续生成
              </Button>
              <Button
                onClick={handleQuickReject}
                disabled={isSubmitting}
                variant="outline"
                className="flex-1 h-12"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                提供修改意见
              </Button>
            </div>
            
            {images.length > 0 && selectedImages.size > 0 && (
              <Button
                onClick={handleConfirmImages}
                disabled={isSubmitting}
                variant="secondary"
                className="w-full"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                仅使用选中的 {selectedImages.size} 张图片
              </Button>
            )}
          </div>
        )}
        
        {/* Custom Text Input */}
        {(interactionType === 'text' || showCustomInput) && (
          <div className="space-y-3">
            <Textarea
              placeholder={
                interactionType === 'image_confirmation'
                  ? "请输入您对配图的修改意见，例如：\n- 第2页的图片请换成更现代的风格\n- 封面图片颜色太暗，请调亮一些\n- 请为第5页添加一张数据图表"
                  : "请输入您的回复..."
              }
              value={textResponse}
              onChange={(e) => setTextResponse(e.target.value)}
              className="min-h-[120px] resize-none"
            />
            
            <div className="flex gap-3">
              <Button
                onClick={handleSubmitCustom}
                disabled={isSubmitting || !textResponse.trim()}
                className="flex-1 h-12 btn-pro-gold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    发送回复
                  </>
                )}
              </Button>
              
              {showCustomInput && (
                <Button
                  onClick={() => setShowCustomInput(false)}
                  variant="outline"
                  className="h-12"
                >
                  返回
                </Button>
              )}
            </div>
          </div>
        )}
        
        {/* Help Text */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
          <Sparkles className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            {interactionType === 'image_confirmation'
              ? "AI 会根据您的确认或修改意见继续生成 PPT。如果您对配图满意，直接点击确认即可。"
              : "请仔细阅读 AI 的问题，并提供您的回复。您的输入将帮助 AI 更好地完成 PPT 生成。"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
