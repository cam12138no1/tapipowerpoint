import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Edit2, FolderKanban, Loader2, MoreVertical, Palette, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";

interface ProjectFormData {
  name: string;
  designSpec: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
}

const defaultFormData: ProjectFormData = {
  name: "",
  designSpec: "",
  primaryColor: "#0033A0",
  secondaryColor: "#58595B",
  accentColor: "#C8A951",
  fontFamily: "Arial",
};

export default function Projects() {
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(defaultFormData);

  const { data: projects, isLoading, refetch } = trpc.project.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.project.create.useMutation({
    onSuccess: () => {
      toast.success("设计规范创建成功！");
      setIsCreateOpen(false);
      setFormData(defaultFormData);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "创建失败，请重试");
    },
  });

  const updateMutation = trpc.project.update.useMutation({
    onSuccess: () => {
      toast.success("设计规范已更新！");
      setIsEditOpen(false);
      setEditingId(null);
      setFormData(defaultFormData);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "更新失败，请重试");
    },
  });

  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => {
      toast.success("设计规范已删除");
      setDeleteId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "删除失败，请重试");
    },
  });

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast.error("请输入规范名称");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editingId || !formData.name.trim()) {
      toast.error("请输入规范名称");
      return;
    }
    updateMutation.mutate({ id: editingId, ...formData });
  };

  const handleEdit = (project: any) => {
    setEditingId(project.id);
    setFormData({
      name: project.name,
      designSpec: project.designSpec || "",
      primaryColor: project.primaryColor,
      secondaryColor: project.secondaryColor,
      accentColor: project.accentColor,
      fontFamily: project.fontFamily,
    });
    setIsEditOpen(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate({ id: deleteId });
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'oklch(0.95 0.01 85)' }}>
              <Palette className="w-5 h-5" style={{ color: 'oklch(0.55 0.1 85)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'oklch(0.25 0.05 250)' }}>设计规范</h1>
              <p className="text-muted-foreground text-sm">管理 PPT 的品牌视觉规范，包括配色、字体等</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setLocation("/templates")} className="h-10">
              从模板创建
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="btn-pro-gold h-10">
                  <Plus className="w-4 h-4 mr-2" />
                  新建规范
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>创建设计规范</DialogTitle>
                  <DialogDescription>
                    定义 PPT 的品牌视觉规范，AI 将根据这些设置生成一致风格的演示文稿
                  </DialogDescription>
                </DialogHeader>
                <ProjectForm formData={formData} setFormData={setFormData} />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreate} disabled={createMutation.isPending} className="btn-pro-gold">
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        创建中...
                      </>
                    ) : (
                      "创建"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'oklch(0.55 0.1 85)' }} />
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="pro-card border-0 shadow-pro">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: project.primaryColor + "15" }}
                      >
                        <FolderKanban
                          className="w-5 h-5"
                          style={{ color: project.primaryColor }}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-base">{project.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {formatDate(project.createdAt)}
                        </CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(project)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(project.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">配色方案</p>
                      <div className="flex gap-2">
                        <div
                          className="w-8 h-8 rounded-lg border border-border"
                          style={{ backgroundColor: project.primaryColor || '#0033A0' }}
                          title={`主色调: ${project.primaryColor || '#0033A0'}`}
                        />
                        <div
                          className="w-8 h-8 rounded-lg border border-border"
                          style={{ backgroundColor: project.secondaryColor || '#58595B' }}
                          title={`辅助色: ${project.secondaryColor || '#58595B'}`}
                        />
                        <div
                          className="w-8 h-8 rounded-lg border border-border"
                          style={{ backgroundColor: project.accentColor || '#C8A951' }}
                          title={`强调色: ${project.accentColor || '#C8A951'}`}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">字体</p>
                      <p className="text-sm text-foreground">{project.fontFamily}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="pro-card border-0 shadow-pro">
            <CardContent className="py-20 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'oklch(0.95 0.01 85)' }}>
                <FolderKanban className="w-8 h-8" style={{ color: 'oklch(0.55 0.1 85)' }} />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">暂无设计规范</h3>
              <p className="text-muted-foreground mb-6">创建您的第一个设计规范，定义 PPT 的视觉风格</p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => setLocation("/templates")}>
                  从模板创建
                </Button>
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  className="btn-pro-gold"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新建规范
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>编辑设计规范</DialogTitle>
              <DialogDescription>修改 PPT 的品牌视觉规范设置</DialogDescription>
            </DialogHeader>
            <ProjectForm formData={formData} setFormData={setFormData} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending} className="btn-pro-gold">
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                此操作无法撤销，删除后该设计规范将无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    删除中...
                  </>
                ) : (
                  "删除"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

function ProjectForm({
  formData,
  setFormData,
}: {
  formData: ProjectFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">规范名称</Label>
        <Input
          id="name"
          placeholder="例如：公司品牌规范"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="input-pro"
        />
      </div>

      <div className="space-y-2">
        <Label>配色方案</Label>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">主色调</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.primaryColor}
                onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <Input
                value={formData.primaryColor}
                onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                className="flex-1 text-sm"
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">辅助色</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.secondaryColor}
                onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <Input
                value={formData.secondaryColor}
                onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                className="flex-1 text-sm"
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">强调色</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData.accentColor}
                onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <Input
                value={formData.accentColor}
                onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                className="flex-1 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fontFamily">字体</Label>
        <Input
          id="fontFamily"
          placeholder="例如：Arial"
          value={formData.fontFamily}
          onChange={(e) => setFormData({ ...formData, fontFamily: e.target.value })}
          className="input-pro"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="designSpec">额外设计要求（可选）</Label>
        <Textarea
          id="designSpec"
          placeholder="输入其他设计要求，如：使用简洁现代风格、每页不超过5个要点等"
          value={formData.designSpec}
          onChange={(e) => setFormData({ ...formData, designSpec: e.target.value })}
          rows={3}
          className="input-pro"
        />
      </div>
    </div>
  );
}
