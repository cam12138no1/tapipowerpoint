import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { FolderKanban, Layout, ListTodo, LogOut, PanelLeft, Plus, Sparkles, User } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const menuItems = [
  { icon: Plus, label: "创建PPT", path: "/" },
  { icon: ListTodo, label: "任务列表", path: "/tasks" },
  { icon: FolderKanban, label: "设计规范", path: "/projects" },
  { icon: Layout, label: "专业模板", path: "/templates" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const STORAGE_KEY = 'pptmaster_user';

interface StoredUser {
  id: number;
  name: string;
  openId: string;
}

function getStoredUser(): StoredUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function setStoredUser(user: StoredUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function clearStoredUser() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  const handleLogin = () => {
    if (!username.trim()) {
      setLoginError('请输入您的名字');
      return;
    }
    
    const openId = `user_${username.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const newUser: StoredUser = {
      id: Date.now(),
      name: username.trim(),
      openId,
    };
    
    setStoredUser(newUser);
    setUser(newUser);
    setLoginError('');
    
    // Reload to refresh tRPC client with new headers
    window.location.reload();
  };

  const handleLogout = () => {
    clearStoredUser();
    setUser(null);
    window.location.reload();
  };

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen gradient-subtle">
        <div className="flex flex-col items-center gap-8 p-10 max-w-md w-full bg-white rounded-xl shadow-pro-lg animate-fade-in">
          {/* Logo */}
          <div className="flex flex-col items-center gap-5">
            <img 
              src="/logo.png" 
              alt="TapiPowerPoint" 
              className="w-24 h-24 object-contain"
            />
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'oklch(0.25 0.05 250)' }}>
                TapiPowerPoint
              </h1>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                专业级演示文稿智能生成平台
              </p>
            </div>
          </div>
          
          {/* Features */}
          <div className="w-full space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: 'oklch(0.95 0.01 85)' }}>
                <Sparkles className="w-4 h-4" style={{ color: 'oklch(0.55 0.1 85)' }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">AI 智能生成</p>
                <p className="text-xs text-muted-foreground">基于文档自动生成专业 PPT</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: 'oklch(0.95 0.01 85)' }}>
                <Layout className="w-4 h-4" style={{ color: 'oklch(0.55 0.1 85)' }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">咨询级模板</p>
                <p className="text-xs text-muted-foreground">麦肯锡、BCG 等专业风格</p>
              </div>
            </div>
          </div>

          {/* Login Form */}
          <div className="w-full space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium">
                请输入您的名字
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="例如：张三"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setLoginError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleLogin();
                    }
                  }}
                  className="pl-10 h-12"
                />
              </div>
              {loginError && (
                <p className="text-sm text-destructive">{loginError}</p>
              )}
            </div>
            
            <Button
              onClick={handleLogin}
              size="lg"
              className="w-full h-12 text-base font-medium btn-pro-gold"
            >
              开始使用
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            输入名字后即可开始使用，系统将自动保存您的工作
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent user={user} onLogout={handleLogout} setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  user: StoredUser;
  onLogout: () => void;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  user,
  onLogout,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0 bg-card"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-border">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-secondary rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <img 
                    src="/favicon.png" 
                    alt="TapiPowerPoint" 
                    className="w-8 h-8 object-contain"
                  />
                  <span className="font-bold tracking-tight truncate" style={{ color: 'oklch(0.25 0.05 250)' }}>
                    TapiPowerPoint
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-4">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal rounded-md ${
                        isActive 
                          ? 'bg-accent text-accent-foreground' 
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "" : "opacity-70"}`}
                        style={isActive ? { color: 'oklch(0.55 0.1 85)' } : undefined}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-md px-1 py-1 hover:bg-secondary transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border border-border shrink-0" style={{ background: 'oklch(0.25 0.05 250)' }}>
                    <AvatarFallback className="text-xs font-medium text-white bg-transparent">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-foreground">
                      {user.name || "用户"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      已登录
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={onLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize transition-colors ${isCollapsed ? "hidden" : ""}`}
          style={{ background: 'transparent' }}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = 'oklch(0.75 0.12 85 / 50%)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = 'transparent';
          }}
        />
      </div>

      <SidebarInset className="bg-background">
        {isMobile && (
          <div className="flex border-b border-border h-14 items-center justify-between bg-card px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-md bg-card" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground font-medium">
                    {activeMenuItem?.label ?? "菜单"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
