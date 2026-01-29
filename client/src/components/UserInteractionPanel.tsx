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
  Edit3,
  Sparkles,
  AlertTriangle,
  Clock,
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
  let title = "AI 需要您的输入";
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
    <Card className="border-2 shadow-lg overflow-hidden animate-pulse-slow" style={{ borderColor: '#f59e0b', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' }}>
      {/* Attention Banner */}
      <div className="bg-amber-500 text-white px-4 py-3 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1">
          <span className="font-semibold">任务暂停 - 需要您的输入</span>
          <span className="ml-2 text-amber-100 text-sm">请在下方回复后任务将继续执行</span>
        </div>
        <Clock className="w-5 h-5 animate-pulse" />
      </div>
      
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-amber-900">
          {interactionType === 'image_confirmation' ? (
            <ImageIcon className="w-5 h-5" />
          ) : (
            <MessageSquare className="w-5 h-5" />
          )}
          {title}
        </CardTitle>
        {content && (
          <CardDescription className="text-base whitespace-pre-wrap mt-2 text-amber-800">
            {content}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Image Preview Grid */}
        {images.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-700">
                AI 生成的配图 ({images.length} 张)
              </span>
              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
                点击图片可选择/取消
              </Badge>
            </div>
            
            <ScrollArea className="h-[300px] rounded-lg border bg-white p-3">
              <div className="grid grid-cols-2 gap-3">
                {images.map((image, index) => (
                  <div
                    key={image.url}
                    className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:shadow-lg ${
                      selectedImages.has(image.url)
                        ? "border-amber-500 ring-2 ring-amber-500/20"
                        : "border-gray-200 hover:border-amber-300"
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
                    ? "border-amber-500 bg-amber-50 shadow-md"
                    : "border-gray-200 bg-white hover:border-amber-300 hover:shadow-md"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedOption === option.id ? "border-amber-500 bg-amber-500" : "border-gray-300"
                  }`}>
                    {selectedOption === option.id ? (
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    ) : (
                      <span className="text-xs text-gray-500">{option.id}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{option.label}</p>
                    {option.description && (
                      <p className="text-sm text-gray-500 mt-1">{option.description}</p>
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
                className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-white"
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
                className="flex-1 h-12 border-amber-500 text-amber-700 hover:bg-amber-50"
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
                className="w-full bg-amber-100 text-amber-800 hover:bg-amber-200"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                仅使用选中的 {selectedImages.size} 张图片
              </Button>
            )}
          </div>
        )}
        
        {/* Custom Text Input - Always show for text type or when user wants to provide custom input */}
        {(interactionType === 'text' || showCustomInput) && (
          <div className="space-y-3">
            <div className="bg-amber-100 border border-amber-300 rounded-lg p-3">
              <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                请在下方输入您的回复，AI 将根据您的输入继续执行任务
              </p>
            </div>
            
            <Textarea
              placeholder={
                interactionType === 'image_confirmation'
                  ? "请输入您对配图的修改意见，例如：\n- 第2页的图片请换成更现代的风格\n- 封面图片颜色太暗，请调亮一些\n- 请为第5页添加一张数据图表"
                  : "请输入您的回复...\n\n例如：\n- 继续执行\n- 请使用更专业的风格\n- 添加更多数据图表"
              }
              value={textResponse}
              onChange={(e) => setTextResponse(e.target.value)}
              className="min-h-[120px] resize-none border-amber-300 focus:border-amber-500 focus:ring-amber-500"
            />
            
            <div className="flex gap-3">
              <Button
                onClick={handleSubmitCustom}
                disabled={isSubmitting || !textResponse.trim()}
                className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    发送回复并继续任务
                  </>
                )}
              </Button>
              
              {showCustomInput && (
                <Button
                  onClick={() => setShowCustomInput(false)}
                  variant="outline"
                  className="h-12 border-amber-500 text-amber-700"
                >
                  返回
                </Button>
              )}
            </div>
          </div>
        )}
        
        {/* Help Text */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            <strong>重要提示：</strong>
            {interactionType === 'image_confirmation'
              ? "AI 正在等待您的确认。如果您对配图满意，直接点击确认即可；如果需要修改，请点击【提供修改意见】并输入您的要求。"
              : "AI 遇到了需要您决策的问题。请仔细阅读上方内容，并在输入框中提供您的回复。任务将在您回复后继续执行。"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
