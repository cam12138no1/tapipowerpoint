import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import {
  Briefcase,
  Building2,
  Check,
  ChevronRight,
  Loader2,
  Palette,
  Sparkles,
  Type,
  Layout,
  BarChart3,
  Table2,
  List,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

// Updated interface to match new template structure
interface TemplatePreview {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  category: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    backgroundAlt: string;
    text: string;
    textSecondary: string;
    textOnDark: string;
    success: string;
    warning: string;
    error: string;
    chartColors: string[];
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    monoFont: string;
    titleSize: number;
    subtitleSize: number;
    heading1Size: number;
    heading2Size: number;
    bodySize: number;
    captionSize: number;
    footnoteSize: number;
    titleLineHeight: number;
    bodyLineHeight: number;
    titleLetterSpacing: number;
    bodyLetterSpacing: number;
    titleWeight: number;
    bodyWeight: number;
    emphasisWeight: number;
    titleAlignment: string;
    bodyAlignment: string;
    numberAlignment: string;
  };
  layout: {
    slideWidth: number;
    slideHeight: number;
    slideRatio: string;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    safeZoneTop: number;
    safeZoneBottom: number;
    safeZoneLeft: number;
    safeZoneRight: number;
    gridColumns: number;
    gridGutter: number;
    paragraphSpacing: number;
    sectionSpacing: number;
    elementSpacing: number;
  };
  structure: {
    framework: string;
    maxBulletsPerSlide: number;
    maxWordsPerBullet: number;
    maxLinesPerTitle: number;
    actionTitles: boolean;
    executiveSummary: boolean;
    tableOfContents: boolean;
    appendix: boolean;
  };
  bullets: {
    bulletStyle: string;
    bulletColor: string;
    bulletSize: number;
    firstLevelIndent: number;
    secondLevelIndent: number;
    thirdLevelIndent: number;
    hangingIndent: number;
    bulletSpacing: number;
    itemSpacing: number;
    levelSpacing: number;
    firstLevelSize: number;
    secondLevelSize: number;
    thirdLevelSize: number;
  };
  charts: {
    chartAreaRatio: number;
    axisLineWidth: number;
    axisColor: string;
    showGridLines: boolean;
    gridLineColor: string;
    gridLineWidth: number;
    axisLabelSize: number;
    dataLabelSize: number;
    legendSize: number;
    showLegend: boolean;
    dataPointSize: number;
    lineWidth: number;
    barWidth: number;
    calloutEnabled: boolean;
    calloutStyle: string;
  };
  tables: {
    cellPaddingTop: number;
    cellPaddingBottom: number;
    cellPaddingLeft: number;
    cellPaddingRight: number;
    borderWidth: number;
    borderColor: string;
    headerBorderWidth: number;
    headerBackground: string;
    headerTextColor: string;
    headerFontWeight: number;
    headerFontSize: number;
    bodyFontSize: number;
    alternateRowColor: string;
    headerAlignment: string;
    textAlignment: string;
    numberAlignment: string;
  };
  headerFooter: {
    showHeader: boolean;
    headerHeight: number;
    headerContent: string[];
    showFooter: boolean;
    footerHeight: number;
    footerFontSize: number;
    showPageNumber: boolean;
    pageNumberPosition: string;
    pageNumberFormat: string;
    showDate: boolean;
    datePosition: string;
    dateFormat: string;
    showConfidential: boolean;
    confidentialText: string;
    confidentialPosition: string;
    showSource: boolean;
    sourcePosition: string;
  };
}

const categoryIcons: Record<string, React.ReactNode> = {
  consulting: <Briefcase className="w-5 h-5" />,
  corporate: <Building2 className="w-5 h-5" />,
  creative: <Sparkles className="w-5 h-5" />,
};

const categoryLabels: Record<string, string> = {
  consulting: "咨询风格",
  corporate: "企业商务",
  creative: "创意设计",
};

const frameworkLabels: Record<string, string> = {
  pyramid: "金字塔原理",
  scr: "SCR框架",
  mece: "MECE原则",
  standard: "标准结构",
};

export default function Templates() {
  const [, setLocation] = useLocation();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePreview | null>(null);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [additionalRequirements, setAdditionalRequirements] = useState("");
  const [activeSpecTab, setActiveSpecTab] = useState("typography");

  const { data: templates, isLoading } = trpc.template.list.useQuery();
  const { data: templateDetail } = trpc.template.get.useQuery(
    { id: selectedTemplate?.id || "" },
    { enabled: !!selectedTemplate }
  );

  const applyMutation = trpc.template.applyToProject.useMutation({
    onSuccess: (project) => {
      toast.success("设计规范已创建！");
      setIsApplyDialogOpen(false);
      setSelectedTemplate(null);
      setProjectName("");
      setAdditionalRequirements("");
      setLocation("/projects");
    },
    onError: (error) => {
      toast.error(error.message || "创建失败，请重试");
    },
  });

  const handleApply = () => {
    if (!selectedTemplate || !projectName.trim()) {
      toast.error("请输入项目名称");
      return;
    }
    applyMutation.mutate({
      templateId: selectedTemplate.id,
      projectName: projectName.trim(),
      additionalRequirements: additionalRequirements.trim() || undefined,
    });
  };

  const consultingTemplates = templates?.filter((t) => t.category === "consulting") || [];
  const corporateTemplates = templates?.filter((t) => t.category === "corporate") || [];
  const creativeTemplates = templates?.filter((t) => t.category === "creative") || [];

  // Debug logging
  console.log('[Templates] templates:', templates?.length, 'consulting:', consultingTemplates.length, 'corporate:', corporateTemplates.length, 'creative:', creativeTemplates.length);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">专业模板库</h1>
          <p className="text-gray-500 mt-1">
            选择专业设计模板，一键应用顶级咨询公司的PPT设计规范，精确到行距、缩进、边距等所有细节
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Template List */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="consulting" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="consulting" className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4" />
                    咨询风格
                  </TabsTrigger>
                  <TabsTrigger value="corporate" className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    企业商务
                  </TabsTrigger>
                  <TabsTrigger value="creative" className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    创意设计
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="consulting" className="space-y-4">
                  {consultingTemplates.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">暂无咨询风格模板</div>
                  ) : (
                    consultingTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template as TemplatePreview}
                        isSelected={selectedTemplate?.id === template.id}
                        onSelect={() => setSelectedTemplate(template as TemplatePreview)}
                      />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="corporate" className="space-y-4">
                  {corporateTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template as TemplatePreview}
                      isSelected={selectedTemplate?.id === template.id}
                      onSelect={() => setSelectedTemplate(template as TemplatePreview)}
                    />
                  ))}
                </TabsContent>

                <TabsContent value="creative" className="space-y-4">
                  {creativeTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template as TemplatePreview}
                      isSelected={selectedTemplate?.id === template.id}
                      onSelect={() => setSelectedTemplate(template as TemplatePreview)}
                    />
                  ))}
                </TabsContent>
              </Tabs>
            </div>

            {/* Template Preview */}
            <div className="lg:col-span-1">
              {selectedTemplate ? (
                <Card className="sticky top-6">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {categoryLabels[selectedTemplate.category]}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {frameworkLabels[selectedTemplate.structure.framework]}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-3">{selectedTemplate.name}</CardTitle>
                    <CardDescription>{selectedTemplate.nameEn}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">{selectedTemplate.description}</p>

                    {/* Specification Tabs */}
                    <Tabs value={activeSpecTab} onValueChange={setActiveSpecTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-4 h-8">
                        <TabsTrigger value="typography" className="text-xs px-2">
                          <Type className="w-3 h-3 mr-1" />
                          字体
                        </TabsTrigger>
                        <TabsTrigger value="layout" className="text-xs px-2">
                          <Layout className="w-3 h-3 mr-1" />
                          版式
                        </TabsTrigger>
                        <TabsTrigger value="colors" className="text-xs px-2">
                          <Palette className="w-3 h-3 mr-1" />
                          配色
                        </TabsTrigger>
                        <TabsTrigger value="elements" className="text-xs px-2">
                          <List className="w-3 h-3 mr-1" />
                          元素
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="typography" className="mt-3">
                        <ScrollArea className="h-48">
                          <div className="space-y-2 text-xs">
                            <SpecRow label="标题字体" value={selectedTemplate.typography.headingFont} />
                            <SpecRow label="正文字体" value={selectedTemplate.typography.bodyFont} />
                            <SpecRow label="标题字号" value={`${selectedTemplate.typography.titleSize}pt`} />
                            <SpecRow label="副标题字号" value={`${selectedTemplate.typography.subtitleSize}pt`} />
                            <SpecRow label="正文字号" value={`${selectedTemplate.typography.bodySize}pt`} />
                            <SpecRow label="图表标签" value={`${selectedTemplate.typography.captionSize}pt`} />
                            <SpecRow label="脚注字号" value={`${selectedTemplate.typography.footnoteSize}pt`} />
                            <SpecRow label="标题行高" value={`${selectedTemplate.typography.titleLineHeight}`} />
                            <SpecRow label="正文行高" value={`${selectedTemplate.typography.bodyLineHeight}`} />
                            <SpecRow label="标题字重" value={`${selectedTemplate.typography.titleWeight}`} />
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="layout" className="mt-3">
                        <ScrollArea className="h-48">
                          <div className="space-y-2 text-xs">
                            <SpecRow label="幻灯片比例" value={selectedTemplate.layout.slideRatio} />
                            <SpecRow label="上边距" value={`${selectedTemplate.layout.marginTop}pt`} />
                            <SpecRow label="下边距" value={`${selectedTemplate.layout.marginBottom}pt`} />
                            <SpecRow label="左边距" value={`${selectedTemplate.layout.marginLeft}pt`} />
                            <SpecRow label="右边距" value={`${selectedTemplate.layout.marginRight}pt`} />
                            <SpecRow label="段落间距" value={`${selectedTemplate.layout.paragraphSpacing}pt`} />
                            <SpecRow label="章节间距" value={`${selectedTemplate.layout.sectionSpacing}pt`} />
                            <SpecRow label="元素间距" value={`${selectedTemplate.layout.elementSpacing}pt`} />
                            <SpecRow label="栅格列数" value={`${selectedTemplate.layout.gridColumns}列`} />
                            <SpecRow label="栅格间距" value={`${selectedTemplate.layout.gridGutter}pt`} />
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="colors" className="mt-3">
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <ColorSwatch color={selectedTemplate.colors.primary} label="主色" />
                            <ColorSwatch color={selectedTemplate.colors.secondary} label="辅助" />
                            <ColorSwatch color={selectedTemplate.colors.accent} label="强调" />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <ColorSwatch color={selectedTemplate.colors.success} label="正向" />
                            <ColorSwatch color={selectedTemplate.colors.warning} label="警示" />
                            <ColorSwatch color={selectedTemplate.colors.error} label="负向" />
                          </div>
                          <div className="pt-2 border-t">
                            <p className="text-xs text-gray-500 mb-2">图表配色</p>
                            <div className="flex gap-1">
                              {selectedTemplate.colors.chartColors.map((color, i) => (
                                <div
                                  key={i}
                                  className="w-6 h-6 rounded border"
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="elements" className="mt-3">
                        <ScrollArea className="h-48">
                          <div className="space-y-3 text-xs">
                            <div>
                              <p className="font-medium text-gray-700 mb-1">项目符号</p>
                              <SpecRow label="符号样式" value={selectedTemplate.bullets.bulletStyle} />
                              <SpecRow label="一级缩进" value={`${selectedTemplate.bullets.firstLevelIndent}pt`} />
                              <SpecRow label="二级缩进" value={`${selectedTemplate.bullets.secondLevelIndent}pt`} />
                              <SpecRow label="项目间距" value={`${selectedTemplate.bullets.itemSpacing}pt`} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-700 mb-1">表格</p>
                              <SpecRow label="单元格内边距" value={`${selectedTemplate.tables.cellPaddingTop}pt`} />
                              <SpecRow label="表头字号" value={`${selectedTemplate.tables.headerFontSize}pt`} />
                              <SpecRow label="正文字号" value={`${selectedTemplate.tables.bodyFontSize}pt`} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-700 mb-1">图表</p>
                              <SpecRow label="图表区域" value={`${selectedTemplate.charts.chartAreaRatio * 100}%`} />
                              <SpecRow label="显示网格" value={selectedTemplate.charts.showGridLines ? "是" : "否"} />
                              <SpecRow label="显示图例" value={selectedTemplate.charts.showLegend ? "是" : "否"} />
                            </div>
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>

                    {/* Slide Preview Mock */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">预览效果</h4>
                      <div
                        className="aspect-video rounded-lg border overflow-hidden"
                        style={{ backgroundColor: selectedTemplate.colors.background }}
                      >
                        <div className="h-full flex flex-col p-3">
                          {/* Action Title */}
                          <div
                            className="text-[10px] font-semibold mb-1"
                            style={{
                              color: selectedTemplate.colors.text,
                              fontFamily: selectedTemplate.typography.headingFont,
                              lineHeight: selectedTemplate.typography.titleLineHeight,
                            }}
                          >
                            市场增长率达15%，超出预期目标3个百分点
                          </div>
                          {/* Subtitle */}
                          <div
                            className="text-[7px] mb-2"
                            style={{
                              color: selectedTemplate.colors.textSecondary,
                              fontFamily: selectedTemplate.typography.bodyFont,
                            }}
                          >
                            数据来源：内部销售系统，2024年1-6月
                          </div>
                          {/* Content */}
                          <div className="flex-1 flex gap-2">
                            <div
                              className="flex-1 rounded p-2"
                              style={{ backgroundColor: selectedTemplate.colors.primary + "10" }}
                            >
                              <div
                                className="text-[7px] font-medium mb-1"
                                style={{ color: selectedTemplate.colors.primary }}
                              >
                                关键发现
                              </div>
                              <div
                                className="text-[6px] space-y-0.5"
                                style={{ color: selectedTemplate.colors.text }}
                              >
                                <div className="flex items-start gap-1">
                                  <span style={{ color: selectedTemplate.bullets.bulletColor }}>•</span>
                                  <span>市场份额提升至28%</span>
                                </div>
                                <div className="flex items-start gap-1">
                                  <span style={{ color: selectedTemplate.bullets.bulletColor }}>•</span>
                                  <span>客户满意度达92分</span>
                                </div>
                                <div className="flex items-start gap-1">
                                  <span style={{ color: selectedTemplate.bullets.bulletColor }}>•</span>
                                  <span>运营成本降低15%</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 rounded p-2 bg-gray-50">
                              <div
                                className="text-[7px] font-medium mb-1"
                                style={{ color: selectedTemplate.colors.text }}
                              >
                                季度增长趋势
                              </div>
                              <div className="h-10 flex items-end gap-1">
                                {[35, 48, 62, 75, 88, 95].map((h, i) => (
                                  <div
                                    key={i}
                                    className="flex-1 rounded-t transition-all"
                                    style={{
                                      height: `${h}%`,
                                      backgroundColor: selectedTemplate.colors.chartColors[i % selectedTemplate.colors.chartColors.length],
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          {/* Footer */}
                          {selectedTemplate.headerFooter.showFooter && (
                            <div
                              className="flex justify-between items-center mt-1 pt-1 border-t border-gray-100"
                              style={{ fontSize: '5px', color: selectedTemplate.colors.textSecondary }}
                            >
                              <span>{selectedTemplate.headerFooter.confidentialText}</span>
                              <span>12</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => setIsApplyDialogOpen(true)}
                    >
                      使用此模板
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="sticky top-6">
                  <CardContent className="py-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <Palette className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">选择模板</h3>
                    <p className="text-sm text-gray-500">
                      点击左侧模板卡片查看详细规范预览
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Apply Template Dialog */}
        <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>应用模板创建设计规范</DialogTitle>
              <DialogDescription>
                基于 {selectedTemplate?.name} 创建新的设计规范
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="projectName">规范名称</Label>
                <Input
                  id="projectName"
                  placeholder="例如：2024年度报告"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requirements">额外要求（可选）</Label>
                <Textarea
                  id="requirements"
                  placeholder="输入其他设计要求，如：使用公司Logo、特定配色调整等"
                  value={additionalRequirements}
                  onChange={(e) => setAdditionalRequirements(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Template Summary */}
              {selectedTemplate && (
                <div className="rounded-lg bg-gray-50 p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">模板配置摘要</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: selectedTemplate.colors.primary }}
                      />
                      <span className="text-gray-600">主色调</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Type className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">
                        {selectedTemplate.typography.headingFont}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Layout className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">
                        {selectedTemplate.layout.slideRatio}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">
                        {frameworkLabels[selectedTemplate.structure.framework]}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsApplyDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleApply} disabled={applyMutation.isPending}>
                {applyMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    创建中...
                  </>
                ) : (
                  "创建规范"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function TemplateCard({
  template,
  isSelected,
  onSelect,
}: {
  template: TemplatePreview;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all ${
        isSelected
          ? "ring-2 ring-blue-500 border-blue-500"
          : "hover:border-gray-300 hover:shadow-sm"
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: template.colors.primary + "15" }}
          >
            <div style={{ color: template.colors.primary }}>
              {categoryIcons[template.category]}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{template.name}</h3>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{template.nameEn}</p>
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{template.description}</p>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex gap-1">
                {[template.colors.primary, template.colors.secondary, template.colors.accent].map(
                  (color, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  )
                )}
              </div>
              <span className="text-xs text-gray-400">
                {template.typography.headingFont} / {template.typography.bodyFont}
              </span>
              <Badge variant="outline" className="text-xs">
                {frameworkLabels[template.structure.framework]}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="text-center">
      <div
        className="w-full aspect-square rounded-lg border mb-1"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-gray-400 block">{color}</span>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  );
}
