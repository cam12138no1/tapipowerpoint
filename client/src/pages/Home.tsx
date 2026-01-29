import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { FileText, HelpCircle, Image as ImageIcon, Info, Loader2, MessageSquare, Plus, Sparkles, Upload, X, Check, AlertCircle } from "lucide-react";
import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// 图片使用方式
type ImageUsageMode = 'must_use' | 'suggest_use' | 'ai_decide';

// 图片用途分类
type ImageCategory = 'cover' | 'content' | 'chart' | 'logo' | 'background' | 'other';

interface UploadedImage {
  file: File;
  preview?: string;
  usageMode: ImageUsageMode;
  category: ImageCategory;
  description: string;
}

interface UploadedFile {
  file: File;
  preview?: string;
  placement?: string;
}

type InputMode = 'file' | 'proposal';

// 图片用途分类选项
const IMAGE_CATEGORIES: { value: ImageCategory; label: string; description: string }[] = [
  { value: 'cover', label: '封面/封底', description: '用于PPT封面或封底页面' },
  { value: 'content', label: '内容配图', description: '用于内容页面的配图说明' },
  { value: 'chart', label: '数据图表', description: '数据可视化、图表、统计图' },
  { value: 'logo', label: 'Logo/品牌', description: '公司Logo、品牌标识等' },
  { value: 'background', label: '背景图片', description: '用作页面背景的图片' },
  { value: 'other', label: '其他', description: '其他用途的图片' },
];

// 图片使用方式选项
const IMAGE_USAGE_MODES: { value: ImageUsageMode; label: string; description: string }[] = [
  { value: 'must_use', label: '必须使用', description: 'AI必须在PPT中使用此图片' },
  { value: 'suggest_use', label: '建议使用', description: 'AI优先考虑使用此图片' },
  { value: 'ai_decide', label: 'AI自行决定', description: 'AI根据内容相关性决定是否使用' },
];

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [sourceFile, setSourceFile] = useState<UploadedFile | null>(null);
  const [imageFiles, setImageFiles] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // 新增：输入模式和proposal内容
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [proposalContent, setProposalContent] = useState("");

  // Fetch user's projects
  const { data: projects, isLoading: projectsLoading } = trpc.project.list.useQuery();

  // Mutations
  const uploadMutation = trpc.file.upload.useMutation();
  const createTaskMutation = trpc.task.create.useMutation();
  const startTaskMutation = trpc.task.start.useMutation();

  // Handle source document drop
  const handleSourceDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const validTypes = ['.pdf', '.doc', '.docx', '.txt', '.md'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (validTypes.includes(ext)) {
        setSourceFile({ file });
      } else {
        toast.error("不支持的文件格式，请上传 PDF、Word、TXT 或 Markdown 文件");
      }
    }
  }, []);

  const handleSourceSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSourceFile({ file });
    }
  }, []);

  // Handle image drop - 新版本带有模块化配置
  const handleImageDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    
    const validFiles = files.filter(f => imageTypes.includes(f.type));
    if (validFiles.length < files.length) {
      toast.error("部分文件不是有效的图片格式");
    }
    
    const newImages: UploadedImage[] = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      usageMode: 'ai_decide',
      category: 'content',
      description: "",
    }));
    
    setImageFiles(prev => [...prev, ...newImages]);
  }, []);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages: UploadedImage[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      usageMode: 'ai_decide',
      category: 'content',
      description: "",
    }));
    setImageFiles(prev => [...prev, ...newImages]);
  }, []);

  const removeImage = useCallback((index: number) => {
    setImageFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  }, []);

  const updateImageConfig = useCallback((index: number, updates: Partial<UploadedImage>) => {
    setImageFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], ...updates };
      return newFiles;
    });
  }, []);

  // Handle form submission
  const handleSubmit = async () => {
    // 设计规范现在是可选的
    if (!title.trim()) {
      toast.error("请输入PPT标题");
      return;
    }

    setIsUploading(true);
    
    try {
      // Upload source file to S3 and engine
      let sourceFileId: string | undefined;
      let sourceFileUrl: string | undefined;
      let proposalText: string | undefined;
      
      if (inputMode === 'file' && sourceFile) {
        const base64 = await fileToBase64(sourceFile.file);
        const result = await uploadMutation.mutateAsync({
          fileName: sourceFile.file.name,
          contentType: sourceFile.file.type || 'application/octet-stream',
          base64Data: base64,
          uploadToEngine: true,
        });
        sourceFileId = result.engineFileId;
        sourceFileUrl = result.url;
      } else if (inputMode === 'proposal' && proposalContent.trim()) {
        proposalText = proposalContent.trim();
      } else {
        // 没有上传文件也没有输入Proposal，使用标题作为唯一输入
        proposalText = title.trim();
      }

      // Upload images with enhanced metadata
      const imageFileIds: Array<{ 
        fileId: string; 
        usageMode: ImageUsageMode;
        category: ImageCategory;
        description: string;
      }> = [];
      
      for (const img of imageFiles) {
        const base64 = await fileToBase64(img.file);
        const result = await uploadMutation.mutateAsync({
          fileName: img.file.name,
          contentType: img.file.type,
          base64Data: base64,
          uploadToEngine: true,
        });
        if (result.engineFileId) {
          imageFileIds.push({
            fileId: result.engineFileId,
            usageMode: img.usageMode,
            category: img.category,
            description: img.description || `${IMAGE_CATEGORIES.find(c => c.value === img.category)?.label || '配图'}`,
          });
        }
      }

      // Create task - projectId is now optional
      const task = await createTaskMutation.mutateAsync({
        title: title.trim(),
        projectId: selectedProjectId ? parseInt(selectedProjectId) : undefined,
        sourceFileName: sourceFile?.file.name,
        sourceFileUrl,
        proposalContent: proposalText,
        imageAttachments: JSON.stringify(imageFileIds),
      });

      // Start task processing
      await startTaskMutation.mutateAsync({
        taskId: task.id,
        sourceFileId,
        proposalContent: proposalText,
        imageFileIds,
      });

      toast.success("任务创建成功！");
      setLocation(`/tasks/${task.id}`);
      
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error("创建任务失败，请重试");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="max-w-4xl mx-auto animate-fade-in">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center gradient-gold shadow-pro">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: 'oklch(0.25 0.05 250)' }}>创建专业PPT</h1>
                <p className="text-muted-foreground text-sm">上传源文档或直接输入Proposal，AI 将自动生成咨询级演示文稿</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Project Selection - Now Optional */}
            <Card className="pro-card border-0 shadow-pro overflow-hidden">
              <div className="h-1 gradient-gold" />
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white gradient-navy">1</div>
                  选择设计规范
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">可选</span>
                </CardTitle>
                <CardDescription className="ml-11">
                  <div className="space-y-2">
                    <p>选择一个已创建的设计规范，确保PPT风格统一、专业。</p>
                    <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                      <p className="text-sm text-amber-700">
                        <strong>不选择也可以继续：</strong>如果您不选择设计规范，AI将根据内容自动选择合适的专业风格。
                        如需统一品牌风格，建议先在"设计规范"页面创建规范。
                      </p>
                    </div>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="ml-11">
                <div className="flex gap-3" data-tour="design-spec">
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="flex-1 h-12 input-pro text-base">
                      <SelectValue placeholder={projectsLoading ? "加载中..." : "选择设计规范（可选）"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <div className="w-3 h-3 rounded-full border border-dashed border-gray-400" />
                          不使用设计规范（AI自由发挥）
                        </div>
                      </SelectItem>
                      {projects?.map(project => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full border" 
                              style={{ backgroundColor: project.primaryColor }}
                            />
                            {project.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => setLocation("/templates")} className="h-12 px-5">
                    <Plus className="w-4 h-4 mr-2" />
                    从模板创建
                  </Button>
                </div>
                {selectedProjectId && selectedProjectId !== "none" && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                    <Check className="w-4 h-4" />
                    已选择设计规范，PPT将遵循该规范的配色、字体和版式要求
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Title Input */}
            <Card className="pro-card border-0 shadow-pro overflow-hidden">
              <div className="h-1 gradient-gold" />
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white gradient-navy">2</div>
                  PPT 标题
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-red-100 text-red-700">必填</span>
                </CardTitle>
                <CardDescription className="ml-11">
                  输入PPT标题。如果您不上传文档或输入详细内容，AI将根据标题自动搜索资料并生成PPT。
                </CardDescription>
              </CardHeader>
              <CardContent className="ml-11" data-tour="title-input">
                <Input
                  placeholder="例如：2024年度市场分析报告"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-12 input-pro text-base"
                />
              </CardContent>
            </Card>

            {/* Source Content - File or Proposal */}
            <Card className="pro-card border-0 shadow-pro overflow-hidden" data-tour="content-source">
              <div className="h-1 gradient-gold" />
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white gradient-navy">3</div>
                  内容来源
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">可选</span>
                </CardTitle>
                <CardDescription className="ml-11">可选：上传文档或输入Proposal。如果留空，AI将根据标题自动搜索资料生成PPT</CardDescription>
              </CardHeader>
              <CardContent className="ml-11">
                <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as InputMode)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="file" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      上传文档
                    </TabsTrigger>
                    <TabsTrigger value="proposal" className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      输入Proposal
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="file">
                    {sourceFile ? (
                      <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-xl border border-border">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center gradient-gold shadow-pro-sm">
                          <FileText className="w-7 h-7 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{sourceFile.file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(sourceFile.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSourceFile(null)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="dropzone group"
                        onDrop={handleSourceDrop}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => document.getElementById('source-input')?.click()}
                      >
                        <div className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center bg-secondary/50 group-hover:bg-secondary transition-colors mb-4">
                          <Upload className="w-8 h-8 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                        <p className="text-foreground font-medium mb-2">点击或拖拽文件到此处</p>
                        <p className="text-sm text-muted-foreground">支持 PDF、Word、TXT、Markdown 格式，最大 50MB</p>
                        <input
                          id="source-input"
                          type="file"
                          accept=".pdf,.doc,.docx,.txt,.md"
                          className="hidden"
                          onChange={handleSourceSelect}
                        />
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="proposal">
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                        <p className="text-sm text-blue-700">
                          直接输入您的Proposal内容，AI将根据内容自动规划PPT结构并生成专业演示文稿。
                          您可以描述主题、要点、数据等信息。
                        </p>
                      </div>
                      <Textarea
                        placeholder="请输入您的Proposal内容...&#10;&#10;例如：&#10;主题：2024年Q4市场分析报告&#10;&#10;一、市场概况&#10;- 整体市场规模达到500亿元&#10;- 同比增长15%&#10;&#10;二、竞争格局&#10;- 主要竞争对手分析&#10;- 我们的市场份额变化&#10;&#10;三、未来展望&#10;- 2025年市场预测&#10;- 战略建议"
                        value={proposalContent}
                        onChange={(e) => setProposalContent(e.target.value)}
                        className="min-h-[300px] text-base leading-relaxed"
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        已输入 {proposalContent.length} 字符
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Image Attachments - Enhanced Modular Management */}
            <Card className="pro-card border-0 shadow-pro overflow-hidden" data-tour="image-upload">
              <div className="h-1 gradient-gold" />
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white gradient-navy">4</div>
                  上传配图
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">可选</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="ml-1 text-muted-foreground hover:text-foreground transition-colors">
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-3">
                      <p className="text-sm">
                        <strong>配图说明：</strong>上传图片后，您可以精确控制每张图片的使用方式和用途，确保AI按照您的要求生成PPT。
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
                <CardDescription className="ml-11">
                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                    <div className="text-sm text-blue-700 space-y-1">
                      <p><strong>专业配图管理：</strong>上传图片后，您可以为每张图片设置：</p>
                      <ul className="list-disc list-inside pl-2 space-y-0.5">
                        <li><strong>使用方式</strong>：必须使用 / 建议使用 / AI自行决定</li>
                        <li><strong>图片用途</strong>：封面/封底、内容配图、数据图表、Logo/品牌、背景图片等</li>
                        <li><strong>详细描述</strong>：说明图片的具体用途和放置位置</li>
                      </ul>
                    </div>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="ml-11">
                <div className="space-y-6">
                  {imageFiles.length > 0 && (
                    <div className="space-y-4">
                      {imageFiles.map((img, index) => (
                        <div key={index} className="relative rounded-xl border border-border bg-card shadow-pro-sm overflow-hidden">
                          <div className="flex gap-4 p-4">
                            {/* 图片预览 */}
                            <div className="relative flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden bg-secondary">
                              <img
                                src={img.preview}
                                alt={`配图 ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 w-6 h-6 shadow-lg"
                                onClick={() => removeImage(index)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                            
                            {/* 配置区域 */}
                            <div className="flex-1 space-y-4">
                              {/* 第一行：使用方式和图片用途 */}
                              <div className="grid grid-cols-2 gap-4">
                                {/* 使用方式 */}
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">使用方式</Label>
                                  <Select 
                                    value={img.usageMode} 
                                    onValueChange={(v) => updateImageConfig(index, { usageMode: v as ImageUsageMode })}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {IMAGE_USAGE_MODES.map(mode => (
                                        <SelectItem key={mode.value} value={mode.value}>
                                          <div className="flex flex-col">
                                            <span className="font-medium">{mode.label}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-muted-foreground">
                                    {IMAGE_USAGE_MODES.find(m => m.value === img.usageMode)?.description}
                                  </p>
                                </div>
                                
                                {/* 图片用途 */}
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">图片用途</Label>
                                  <Select 
                                    value={img.category} 
                                    onValueChange={(v) => updateImageConfig(index, { category: v as ImageCategory })}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {IMAGE_CATEGORIES.map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                          <div className="flex flex-col">
                                            <span className="font-medium">{cat.label}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-muted-foreground">
                                    {IMAGE_CATEGORIES.find(c => c.value === img.category)?.description}
                                  </p>
                                </div>
                              </div>
                              
                              {/* 第二行：详细描述 */}
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">详细描述（可选）</Label>
                                <Input
                                  placeholder="例如：用于第3页的市场规模分析配图，展示增长趋势"
                                  value={img.description}
                                  onChange={(e) => updateImageConfig(index, { description: e.target.value })}
                                  className="h-9"
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* 配置状态指示 */}
                          <div className="px-4 py-2 bg-secondary/30 border-t border-border flex items-center gap-4 text-xs">
                            <span className={`flex items-center gap-1 ${img.usageMode === 'must_use' ? 'text-red-600' : img.usageMode === 'suggest_use' ? 'text-amber-600' : 'text-gray-500'}`}>
                              {img.usageMode === 'must_use' && <span className="w-2 h-2 rounded-full bg-red-500" />}
                              {img.usageMode === 'suggest_use' && <span className="w-2 h-2 rounded-full bg-amber-500" />}
                              {img.usageMode === 'ai_decide' && <span className="w-2 h-2 rounded-full bg-gray-400" />}
                              {IMAGE_USAGE_MODES.find(m => m.value === img.usageMode)?.label}
                            </span>
                            <span className="text-muted-foreground">|</span>
                            <span className="text-muted-foreground">
                              {IMAGE_CATEGORIES.find(c => c.value === img.category)?.label}
                            </span>
                            {img.description && (
                              <>
                                <span className="text-muted-foreground">|</span>
                                <span className="text-muted-foreground truncate max-w-[200px]">{img.description}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div
                    className="dropzone group"
                    onDrop={handleImageDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => document.getElementById('image-input')?.click()}
                  >
                    <div className="w-16 h-16 mx-auto rounded-xl flex items-center justify-center bg-secondary/50 group-hover:bg-secondary transition-colors mb-4">
                      <ImageIcon className="w-8 h-8 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <p className="text-foreground font-medium mb-2">点击或拖拽图片到此处</p>
                    <p className="text-sm text-muted-foreground">支持 PNG、JPG、GIF、WebP 格式，可上传多张</p>
                    <input
                      id="image-input"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end pt-4 pb-8" data-tour="generate-button">
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={isUploading || !title.trim()}
                className="h-14 px-10 text-base font-semibold btn-pro-gold shadow-pro"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    开始生成 PPT
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
}

// Helper function to convert file to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
