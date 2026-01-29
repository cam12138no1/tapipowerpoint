import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronDown, 
  ChevronUp, 
  ChevronsDown,
  ChevronsUp,
  FileText, 
  Image as ImageIcon, 
  Layout, 
  Loader2, 
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentBlock {
  id: string;
  type: 'thinking' | 'content' | 'slide' | 'image' | 'action' | 'result';
  title?: string;
  content: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp: Date;
  metadata?: {
    slideNumber?: number;
    imageUrl?: string;
    fileName?: string;
  };
}

interface LiveCanvasProps {
  blocks: ContentBlock[];
  isStreaming: boolean;
  currentStep?: string;
}

const blockIcons: Record<ContentBlock['type'], React.ReactNode> = {
  thinking: <Sparkles className="w-4 h-4" />,
  content: <FileText className="w-4 h-4" />,
  slide: <Layout className="w-4 h-4" />,
  image: <ImageIcon className="w-4 h-4" />,
  action: <Clock className="w-4 h-4" />,
  result: <CheckCircle2 className="w-4 h-4" />,
};

const blockColors: Record<ContentBlock['type'], string> = {
  thinking: 'bg-purple-100 text-purple-700 border-purple-200',
  content: 'bg-blue-100 text-blue-700 border-blue-200',
  slide: 'bg-green-100 text-green-700 border-green-200',
  image: 'bg-amber-100 text-amber-700 border-amber-200',
  action: 'bg-gray-100 text-gray-700 border-gray-200',
  result: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const blockLabels: Record<ContentBlock['type'], string> = {
  thinking: 'AI 思考',
  content: '内容生成',
  slide: '幻灯片',
  image: '图片处理',
  action: '执行操作',
  result: '生成结果',
};

// Content length threshold for auto-collapse
const AUTO_COLLAPSE_THRESHOLD = 300;
const SHOW_TOGGLE_THRESHOLD = 150;

function ContentBlockItem({ 
  block, 
  isLast, 
  isExpanded: externalExpanded,
  onToggle 
}: { 
  block: ContentBlock; 
  isLast: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
}) {
  const [internalExpanded, setInternalExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Use external control if provided, otherwise use internal state
  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const handleToggle = onToggle || (() => setInternalExpanded(!internalExpanded));
  
  // Auto-collapse long content after completion (only for internal state)
  useEffect(() => {
    if (externalExpanded === undefined && block.status === 'completed' && block.content.length > AUTO_COLLAPSE_THRESHOLD && !isLast) {
      setInternalExpanded(false);
    }
  }, [block.status, block.content.length, isLast, externalExpanded]);

  const shouldShowToggle = block.content.length > SHOW_TOGGLE_THRESHOLD;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(block.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Calculate content preview
  const getPreviewContent = () => {
    if (isExpanded) return block.content;
    const lines = block.content.split('\n').slice(0, 3);
    const preview = lines.join('\n');
    return preview.length > 200 ? preview.substring(0, 200) + '...' : preview;
  };

  return (
    <div className={cn(
      "relative pl-8 pb-6",
      !isLast && "border-l-2 border-border ml-3"
    )}>
      {/* Timeline dot */}
      <div className={cn(
        "absolute left-0 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-background",
        block.status === 'running' && "border-primary animate-pulse",
        block.status === 'completed' && "border-green-500",
        block.status === 'error' && "border-red-500",
        block.status === 'pending' && "border-gray-300"
      )}>
        {block.status === 'running' ? (
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
        ) : block.status === 'completed' ? (
          <CheckCircle2 className="w-3 h-3 text-green-500" />
        ) : block.status === 'error' ? (
          <AlertCircle className="w-3 h-3 text-red-500" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-gray-300" />
        )}
      </div>

      {/* Content card */}
      <div className="ml-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge variant="outline" className={cn("text-xs px-2 py-0.5", blockColors[block.type])}>
            {blockIcons[block.type]}
            <span className="ml-1">{blockLabels[block.type]}</span>
          </Badge>
          {block.title && (
            <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{block.title}</span>
          )}
          {block.metadata?.slideNumber && (
            <Badge variant="secondary" className="text-xs">
              第 {block.metadata.slideNumber} 页
            </Badge>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {/* Copy button */}
            {block.content.length > 50 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                title="复制内容"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {block.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        <div 
          ref={contentRef}
          className={cn(
            "text-sm text-muted-foreground bg-secondary/30 rounded-lg p-3 transition-all duration-300 overflow-hidden",
            !isExpanded && "max-h-24 relative"
          )}
        >
          {block.type === 'image' && block.metadata?.imageUrl ? (
            <div className="space-y-2">
              <img 
                src={block.metadata.imageUrl} 
                alt={block.title || '生成的图片'} 
                className="max-w-full h-auto rounded-md max-h-[300px] object-contain"
              />
              {block.content && <p>{block.content}</p>}
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words">
              {isExpanded ? block.content : getPreviewContent()}
            </div>
          )}
          
          {!isExpanded && shouldShowToggle && (
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-secondary/50 to-transparent pointer-events-none" />
          )}
        </div>

        {shouldShowToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            className="mt-1 h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                收起内容
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                展开查看 ({block.content.length} 字符)
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export function LiveCanvas({ blocks, isStreaming, currentStep }: LiveCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [allExpanded, setAllExpanded] = useState<boolean | null>(null); // null = mixed state
  const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [blocks, autoScroll]);

  // Detect manual scroll
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  // Expand/collapse all
  const handleExpandAll = useCallback(() => {
    const newState: Record<string, boolean> = {};
    blocks.forEach(block => {
      newState[block.id] = true;
    });
    setExpandedStates(newState);
    setAllExpanded(true);
  }, [blocks]);

  const handleCollapseAll = useCallback(() => {
    const newState: Record<string, boolean> = {};
    blocks.forEach(block => {
      newState[block.id] = false;
    });
    setExpandedStates(newState);
    setAllExpanded(false);
  }, [blocks]);

  const handleToggleBlock = useCallback((blockId: string) => {
    setExpandedStates(prev => {
      const newState = { ...prev, [blockId]: !prev[blockId] };
      // Check if all are same state
      const values = Object.values(newState);
      if (values.every(v => v)) setAllExpanded(true);
      else if (values.every(v => !v)) setAllExpanded(false);
      else setAllExpanded(null);
      return newState;
    });
  }, []);

  // Count collapsible blocks
  const collapsibleCount = blocks.filter(b => b.content.length > SHOW_TOGGLE_THRESHOLD).length;

  if (blocks.length === 0 && !isStreaming) {
    return null;
  }

  return (
    <Card className="pro-card border-0 shadow-pro overflow-hidden relative">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center gradient-gold">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            AI 生成过程
            {blocks.length > 0 && (
              <Badge variant="secondary" className="text-xs ml-2">
                {blocks.length} 个步骤
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Expand/Collapse All buttons */}
            {collapsibleCount > 1 && (
              <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExpandAll}
                  disabled={allExpanded === true}
                  className="h-7 px-2 text-xs"
                  title="展开全部"
                >
                  <ChevronsDown className="w-3 h-3 mr-1" />
                  展开
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCollapseAll}
                  disabled={allExpanded === false}
                  className="h-7 px-2 text-xs"
                  title="折叠全部"
                >
                  <ChevronsUp className="w-3 h-3 mr-1" />
                  折叠
                </Button>
              </div>
            )}
            {isStreaming && (
              <Badge className="bg-primary/10 text-primary border-primary/20 animate-pulse">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                实时生成中
              </Badge>
            )}
          </div>
        </div>
        {currentStep && (
          <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            {currentStep}
          </p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea 
          ref={scrollRef} 
          className="h-[400px] p-4"
          onScroll={handleScroll}
        >
          <div className="space-y-0">
            {blocks.map((block, index) => (
              <ContentBlockItem 
                key={block.id} 
                block={block} 
                isLast={index === blocks.length - 1}
                isExpanded={expandedStates[block.id]}
                onToggle={() => handleToggleBlock(block.id)}
              />
            ))}
          </div>
          
          {isStreaming && blocks.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4 pl-8">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>AI 正在处理中...</span>
            </div>
          )}

          {blocks.length === 0 && isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
              <p className="text-muted-foreground">正在等待 AI 响应...</p>
              <p className="text-xs text-muted-foreground mt-1">内容将实时显示在此处</p>
            </div>
          )}
        </ScrollArea>
        
        {!autoScroll && blocks.length > 3 && (
          <div className="absolute bottom-4 right-4 z-10">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setAutoScroll(true);
                if (scrollRef.current) {
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
              }}
              className="shadow-lg"
            >
              <ChevronDown className="w-4 h-4 mr-1" />
              滚动到底部
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Export types for use in other components
export type { ContentBlock };
