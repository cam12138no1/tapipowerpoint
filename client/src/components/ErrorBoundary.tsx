import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV;

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development, could send to error tracking service in production
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      // User-friendly error message
      const userMessage = this.getUserFriendlyMessage(this.state.error);
      
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-md p-8 text-center">
            <AlertTriangle
              size={48}
              className="text-amber-500 mb-6 flex-shrink-0"
            />

            <h2 className="text-xl font-semibold mb-2 text-foreground">
              页面出现问题
            </h2>
            
            <p className="text-muted-foreground mb-6">
              {userMessage}
            </p>

            <div className="flex gap-3 mb-6">
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 cursor-pointer"
                )}
              >
                <RotateCcw size={16} />
                刷新页面
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-secondary text-secondary-foreground",
                  "hover:opacity-90 cursor-pointer"
                )}
              >
                返回首页
              </button>
            </div>

            {/* Only show technical details in development */}
            {isDevelopment && this.state.error && (
              <div className="w-full">
                <button
                  onClick={this.toggleDetails}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mx-auto mb-2"
                >
                  {this.state.showDetails ? (
                    <>
                      隐藏技术详情
                      <ChevronUp size={14} />
                    </>
                  ) : (
                    <>
                      显示技术详情
                      <ChevronDown size={14} />
                    </>
                  )}
                </button>
                
                {this.state.showDetails && (
                  <div className="p-4 w-full rounded bg-muted overflow-auto text-left">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                      {this.state.error?.stack || this.state.error?.message}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }

  private getUserFriendlyMessage(error: Error | null): string {
    if (!error) return '发生了未知错误，请刷新页面重试。';
    
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return '网络连接出现问题，请检查网络后重试。';
    }
    if (message.includes('unauthorized') || message.includes('401')) {
      return '登录已过期，请重新登录。';
    }
    if (message.includes('not found') || message.includes('404')) {
      return '请求的资源不存在。';
    }
    if (message.includes('timeout')) {
      return '请求超时，请稍后重试。';
    }
    
    return '应用遇到了问题，请刷新页面重试。如果问题持续，请联系支持。';
  }
}

export default ErrorBoundary;
