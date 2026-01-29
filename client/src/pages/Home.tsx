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
import { FileText, HelpCircle, Image as ImageIcon, Info, Loader2, MessageSquare, Plus, Sparkles, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UploadedFile {
  file: File;
  preview?: string;
  placement?: string;
}

type InputMode = 'file' | 'proposal';

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [sourceFile, setSourceFile] = useState<UploadedFile | null>(null);
  const [imageFiles, setImageFiles] = useState<UploadedFile[]>([]);
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

  // Handle image drop
  const handleImageDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    
    const validFiles = files.filter(f => imageTypes.includes(f.type));
    if (validFiles.length < files.length) {
      toast.error("部分文件不是有效的图片格式");
    }
    
    const newImages = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      placement: "",
    }));
    
    setImageFiles(prev => [...prev, ...newImages]);
  }, []);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      placement: "",
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

  const updateImagePlacement = useCallback((index: number, placement: string) => {
    setImageFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = { ...newFiles[index], placement };
      return newFiles;
    });
  }, []);

  // Handle form submission
  const handleSubmit = async () => {
    if (!selectedProjectId) {
      toast.error("请选择设计规范");
      return;
    }
    if (!title.trim()) {
      toast.error("请输入PPT标题");
      return;
    }
    
    // 检查是否有输入内容
    if (inputMode === 'file' && !sourceFile) {
      toast.error("请上传源文档或切换到Proposal模式");
      return;
    }
    if (inputMode === 'proposal' && !proposalContent.trim()) {
      toast.error("请输入Proposal内容");
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
      } else if (inputMode === 'proposal') {
        proposalText = proposalContent.trim();
      }

      // Upload images
      const imageFileIds: Array<{ fileId: string; placement: string }> = [];
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
            placement: img.placement || `配图 ${imageFileIds.length + 1}`,
          });
        }
      }

      // Create task
      const task = await createTaskMutation.mutateAsync({
        title: title.trim(),
        projectId: parseInt(selectedProjectId),
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
                <p className="text-muted-foreground text-sm">上传源文档或直接输入Proposal，AI 将根据设计规范自动生成咨询级演示文稿</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Project Selection */}
            <Card className="pro-card border-0 shadow-pro overflow-hidden">
              <div className="h-1 gradient-gold" />
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white gradient-navy">1</div>
                  选择设计规范
                </CardTitle>
                <CardDescription className="ml-11">选择一个已创建的设计规范，或从模板库创建新规范</CardDescription>
              </CardHeader>
              <CardContent className="ml-11">
                <div className="flex gap-3">
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="flex-1 h-12 input-pro text-base">
                      <SelectValue placeholder={projectsLoading ? "加载中..." : "选择设计规范"} />
                    </SelectTrigger>
                    <SelectContent>
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
              </CardContent>
            </Card>

            {/* Title Input */}
            <Card className="pro-card border-0 shadow-pro overflow-hidden">
              <div className="h-1 gradient-gold" />
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white gradient-navy">2</div>
                  PPT 标题
                </CardTitle>
              </CardHeader>
              <CardContent className="ml-11">
                <Input
                  placeholder="例如：2024年度市场分析报告"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-12 input-pro text-base"
                />
              </CardContent>
            </Card>

            {/* Source Content - File or Proposal */}
            <Card className="pro-card border-0 shadow-pro overflow-hidden">
              <div className="h-1 gradient-gold" />
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white gradient-navy">3</div>
                  内容来源
                </CardTitle>
                <CardDescription className="ml-11">选择上传文档或直接输入Proposal内容</CardDescription>
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

            {/* Image Attachments - Enhanced with better guidance */}
            <Card className="pro-card border-0 shadow-pro overflow-hidden">
              <div className="h-1 gradient-gold" />
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white gradient-navy">4</div>
                  上传配图
                  <span className="text-xs font-normal text-muted-foreground ml-1">(可选)</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="ml-1 text-muted-foreground hover:text-foreground transition-colors">
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs p-3">
                      <p className="text-sm">
                        <strong>配图说明：</strong>AI 会根据您的文档内容自动规划 PPT 页数和结构。您可以预先上传希望在特定位置使用的图片，并在下方描述放置位置。
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
                <CardDescription className="ml-11">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <span>
                      AI 将根据内容智能规划 PPT 结构。您可以上传希望使用的图片，并描述放置位置（如"封面"、"市场分析章节"、"结尾页"等）。未指定位置的图片，AI 会根据内容相关性自动匹配。
                    </span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="ml-11">
                <div className="space-y-4">
                  {imageFiles.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {imageFiles.map((img, index) => (
                        <div key={index} className="relative group rounded-xl overflow-hidden border border-border bg-card shadow-pro-sm">
                          <div className="aspect-video overflow-hidden bg-secondary">
                            <img
                              src={img.preview}
                              alt={`配图 ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            onClick={() => removeImage(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <div className="p-3">
                            <Textarea
                              placeholder="描述放置位置，例如：&#10;• 封面背景图&#10;• 市场规模分析页&#10;• 竞争格局章节配图"
                              value={img.placement}
                              onChange={(e) => updateImagePlacement(index, e.target.value)}
                              className="text-sm min-h-[70px] resize-none"
                              rows={2}
                            />
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
            <div className="flex justify-end pt-4 pb-8">
              <Button
                size="lg"
                onClick={handleSubmit}
                disabled={isUploading || !selectedProjectId || !title.trim() || (inputMode === 'file' && !sourceFile) || (inputMode === 'proposal' && !proposalContent.trim())}
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
