/**
 * Professional PPT Design Templates
 * Based on extensive research of McKinsey, BCG, Bain and other top consulting firms
 * 
 * This file contains precise design specifications that meet consulting-grade delivery standards
 * 
 * OPTIMIZED VERSION: Based on professional evaluation report findings
 * - Enhanced pyramid principle implementation
 * - Improved executive summary structure
 * - Better whitespace and visual hierarchy
 * - Stronger action-oriented titles
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PPTTemplate {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  category: 'consulting' | 'corporate' | 'creative';
  
  // Visual Design - Colors
  colors: ColorPalette;
  
  // Typography - Precise specifications
  typography: TypographySpec;
  
  // Layout - Precise measurements in points (pt) or inches
  layout: LayoutSpec;
  
  // Content Structure Guidelines
  structure: StructureSpec;
  
  // Chart and Data Visualization
  charts: ChartSpec;
  
  // Table Formatting
  tables: TableSpec;
  
  // Bullet Point Rules
  bullets: BulletSpec;
  
  // Footer and Header
  headerFooter: HeaderFooterSpec;
  
  // Detailed Design Specifications (for AI prompt)
  designSpec: string;
  
  // Preview thumbnail
  thumbnail?: string;
}

export interface ColorPalette {
  primary: string;           // Main brand color
  secondary: string;         // Secondary brand color
  accent: string;            // Highlight/emphasis color
  background: string;        // Slide background
  backgroundAlt: string;     // Alternative background (dark slides)
  text: string;              // Primary text color
  textSecondary: string;     // Secondary text color
  textOnDark: string;        // Text on dark background
  success: string;           // Positive metrics
  warning: string;           // Warning/attention
  error: string;             // Negative/problems
  chartColors: string[];     // Data visualization palette
}

export interface TypographySpec {
  // Font Families
  headingFont: string;
  bodyFont: string;
  monoFont: string;          // For code/numbers
  
  // Font Sizes (in points)
  titleSize: number;         // Slide title / Action title
  subtitleSize: number;      // Subtitle / Source line
  heading1Size: number;      // H1 within content
  heading2Size: number;      // H2 within content
  bodySize: number;          // Body text
  captionSize: number;       // Chart labels, footnotes
  footnoteSize: number;      // Source citations
  
  // Line Heights (multiplier)
  titleLineHeight: number;
  bodyLineHeight: number;
  
  // Letter Spacing (em)
  titleLetterSpacing: number;
  bodyLetterSpacing: number;
  
  // Font Weights
  titleWeight: number;       // 400=normal, 700=bold
  bodyWeight: number;
  emphasisWeight: number;
  
  // Text Alignment
  titleAlignment: 'left' | 'center' | 'right';
  bodyAlignment: 'left' | 'center' | 'right';
  numberAlignment: 'left' | 'center' | 'right';
}

export interface LayoutSpec {
  // Slide Dimensions
  slideWidth: number;        // in points (1 inch = 72pt)
  slideHeight: number;
  slideRatio: '16:9' | '4:3' | '16:10';
  
  // Margins (in points)
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  
  // Safe Zone (content area)
  safeZoneTop: number;
  safeZoneBottom: number;
  safeZoneLeft: number;
  safeZoneRight: number;
  
  // Grid System
  gridColumns: number;
  gridGutter: number;        // Space between columns (pt)
  
  // Spacing
  paragraphSpacing: number;  // Space between paragraphs (pt)
  sectionSpacing: number;    // Space between sections (pt)
  elementSpacing: number;    // Space between elements (pt)
}

export interface StructureSpec {
  framework: 'pyramid' | 'scr' | 'mece' | 'standard';
  maxBulletsPerSlide: number;
  maxWordsPerBullet: number;
  maxLinesPerTitle: number;
  actionTitles: boolean;
  executiveSummary: boolean;
  tableOfContents: boolean;
  appendix: boolean;
  
  // Presentation Structure
  sections: {
    coverSlide: boolean;
    executiveSummary: boolean;
    tableOfContents: boolean;
    situationSection: boolean;
    complicationSection: boolean;
    resolutionSection: boolean;
    recommendationSlide: boolean;
    appendix: boolean;
  };
}

export interface ChartSpec {
  // Chart Area
  chartAreaRatio: number;    // Percentage of slide for chart (0.7 = 70%)
  
  // Axis
  axisLineWidth: number;     // in points
  axisColor: string;
  showGridLines: boolean;
  gridLineColor: string;
  gridLineWidth: number;
  
  // Labels
  axisLabelSize: number;
  dataLabelSize: number;
  legendSize: number;
  showLegend: boolean;       // Prefer direct labels over legends
  
  // Data Points
  dataPointSize: number;
  lineWidth: number;
  barWidth: number;          // Percentage of available space
  
  // Callouts
  calloutEnabled: boolean;
  calloutStyle: 'arrow' | 'box' | 'circle';
}

export interface TableSpec {
  // Cell Padding (in points)
  cellPaddingTop: number;
  cellPaddingBottom: number;
  cellPaddingLeft: number;
  cellPaddingRight: number;
  
  // Borders
  borderWidth: number;
  borderColor: string;
  headerBorderWidth: number;
  
  // Header Style
  headerBackground: string;
  headerTextColor: string;
  headerFontWeight: number;
  headerFontSize: number;
  
  // Body Style
  bodyFontSize: number;
  alternateRowColor: string;
  
  // Alignment
  headerAlignment: 'left' | 'center' | 'right';
  textAlignment: 'left' | 'center' | 'right';
  numberAlignment: 'left' | 'center' | 'right';
}

export interface BulletSpec {
  // Bullet Style
  bulletStyle: 'disc' | 'circle' | 'square' | 'dash' | 'none';
  bulletColor: string;
  bulletSize: number;        // in points
  
  // Indentation (in points)
  firstLevelIndent: number;
  secondLevelIndent: number;
  thirdLevelIndent: number;
  hangingIndent: number;     // Text indent after bullet
  
  // Spacing
  bulletSpacing: number;     // Space between bullet and text
  itemSpacing: number;       // Space between bullet items
  levelSpacing: number;      // Additional space for nested levels
  
  // Text
  firstLevelSize: number;
  secondLevelSize: number;
  thirdLevelSize: number;
}

export interface HeaderFooterSpec {
  // Header
  showHeader: boolean;
  headerHeight: number;
  headerContent: string[];   // e.g., ['logo', 'title']
  
  // Footer
  showFooter: boolean;
  footerHeight: number;
  footerFontSize: number;
  
  // Footer Elements
  showPageNumber: boolean;
  pageNumberPosition: 'left' | 'center' | 'right';
  pageNumberFormat: string;  // e.g., 'Page {n} of {total}'
  
  showDate: boolean;
  datePosition: 'left' | 'center' | 'right';
  dateFormat: string;
  
  showConfidential: boolean;
  confidentialText: string;
  confidentialPosition: 'left' | 'center' | 'right';
  
  showSource: boolean;
  sourcePosition: 'left' | 'center' | 'right';
}

// ============================================================================
// MCKINSEY TEMPLATE - OPTIMIZED VERSION
// ============================================================================

/**
 * McKinsey Consulting Style Template - OPTIMIZED
 * Based on McKinsey's 2019 visual identity update by Wolff Olins
 * Enhanced based on professional evaluation report findings:
 * - Stronger pyramid principle implementation
 * - Enhanced executive summary with action recommendations
 * - Improved whitespace and visual hierarchy
 * - Better "Why" analysis depth
 * 
 * PRECISE SPECIFICATIONS FOR CONSULTING-GRADE DELIVERY:
 * - All measurements in points (1 inch = 72 points)
 * - Font sizes follow three-tier system: 24-28pt titles, 16-18pt body, 12-14pt labels
 * - Line spacing: 1.5 standard, 1.2 for dense content
 * - Margins: 1 inch minimum on all sides
 */
export const MCKINSEY_TEMPLATE: PPTTemplate = {
  id: 'mckinsey',
  name: '麦肯锡咨询风格',
  nameEn: 'McKinsey Consulting Style',
  description: '专业、简洁、数据驱动的咨询演示风格，采用金字塔原理和MECE框架，符合顶级咨询公司交付标准',
  category: 'consulting',
  
  colors: {
    primary: '#0033A0',           // McKinsey Blue - 主品牌色
    secondary: '#001E62',         // Deep Navy - 深色变体
    accent: '#00A3E0',            // Bright Blue - 数据强调
    background: '#FFFFFF',        // Clean White
    backgroundAlt: '#0033A0',     // Dark blue for contrast slides
    text: '#1A1A1A',              // Primary text - near black
    textSecondary: '#666666',     // Secondary text - dark gray
    textOnDark: '#FFFFFF',        // Text on dark backgrounds
    success: '#00875A',           // Green - positive metrics
    warning: '#F5A623',           // Orange - warnings
    error: '#D0021B',             // Red - negative/problems only
    chartColors: [
      '#0033A0',  // Primary blue
      '#00A3E0',  // Light blue
      '#666666',  // Gray
      '#00875A',  // Green
      '#F5A623',  // Orange
      '#001E62',  // Dark blue
    ],
  },
  
  typography: {
    // Font Families
    headingFont: 'Georgia',       // Serif for titles (substitute for Bower)
    bodyFont: 'Arial',            // Sans-serif for body
    monoFont: 'Consolas',         // Monospace for numbers/data
    
    // Font Sizes (in points) - Three-Tier System - OPTIMIZED
    titleSize: 26,                // Action title: 24-28pt (slightly smaller for more content)
    subtitleSize: 14,             // Source/subtitle: 14pt
    heading1Size: 20,             // Section headers: 20pt
    heading2Size: 18,             // Subsection: 18pt
    bodySize: 14,                 // Body text: 14-16pt (optimized for readability)
    captionSize: 12,              // Chart labels: 12-14pt
    footnoteSize: 10,             // Source citations: 10pt
    
    // Line Heights - OPTIMIZED for better whitespace
    titleLineHeight: 1.3,         // Slightly more breathing room
    bodyLineHeight: 1.6,          // Enhanced readability
    
    // Letter Spacing
    titleLetterSpacing: -0.02,    // Slightly tighter for titles
    bodyLetterSpacing: 0,         // Normal for body
    
    // Font Weights
    titleWeight: 400,             // Normal weight for Georgia
    bodyWeight: 400,              // Normal weight
    emphasisWeight: 700,          // Bold for emphasis only
    
    // Alignment
    titleAlignment: 'left',       // Left-aligned titles
    bodyAlignment: 'left',        // Left-aligned body (easier to scan)
    numberAlignment: 'right',     // Right-aligned numbers in tables
  },
  
  layout: {
    // Slide Dimensions (16:9 standard)
    slideWidth: 960,              // 13.33 inches at 72dpi
    slideHeight: 540,             // 7.5 inches at 72dpi
    slideRatio: '16:9',
    
    // Margins (1 inch = 72pt minimum) - OPTIMIZED for more whitespace
    marginTop: 80,                // Increased for better visual hierarchy
    marginBottom: 60,             // Footer space
    marginLeft: 80,               // Increased for cleaner look
    marginRight: 80,              // Increased for cleaner look
    
    // Safe Zone (0.5 inch from edge)
    safeZoneTop: 40,
    safeZoneBottom: 40,
    safeZoneLeft: 40,
    safeZoneRight: 40,
    
    // Grid System
    gridColumns: 12,
    gridGutter: 20,               // Increased gutter for better separation
    
    // Spacing - OPTIMIZED for better breathing room
    paragraphSpacing: 16,         // Increased paragraph spacing
    sectionSpacing: 28,           // Increased section spacing
    elementSpacing: 20,           // Increased element spacing
  },
  
  structure: {
    framework: 'pyramid',
    maxBulletsPerSlide: 4,        // Reduced from 5 for "one message per slide"
    maxWordsPerBullet: 18,        // Reduced for conciseness
    maxLinesPerTitle: 2,
    actionTitles: true,
    executiveSummary: true,
    tableOfContents: true,
    appendix: true,
    
    sections: {
      coverSlide: true,
      executiveSummary: true,
      tableOfContents: true,
      situationSection: true,
      complicationSection: true,
      resolutionSection: true,
      recommendationSlide: true,
      appendix: true,
    },
  },
  
  charts: {
    chartAreaRatio: 0.70,         // Reduced to 70% for more whitespace
    
    axisLineWidth: 1,
    axisColor: '#666666',
    showGridLines: false,         // No gridlines - cleaner
    gridLineColor: '#E0E0E0',
    gridLineWidth: 0.5,
    
    axisLabelSize: 12,            // Increased for better readability
    dataLabelSize: 12,            // Increased for better readability
    legendSize: 11,
    showLegend: false,            // Prefer direct labels
    
    dataPointSize: 6,
    lineWidth: 2.5,               // Slightly thicker for visibility
    barWidth: 0.65,               // Slightly narrower for better spacing
    
    calloutEnabled: true,
    calloutStyle: 'arrow',
  },
  
  tables: {
    cellPaddingTop: 10,           // Increased padding
    cellPaddingBottom: 10,
    cellPaddingLeft: 14,
    cellPaddingRight: 14,
    
    borderWidth: 1,
    borderColor: '#E0E0E0',
    headerBorderWidth: 2,
    
    headerBackground: '#0033A0',
    headerTextColor: '#FFFFFF',
    headerFontWeight: 700,
    headerFontSize: 13,           // Slightly smaller for balance
    
    bodyFontSize: 12,
    alternateRowColor: '#F8F9FA',
    
    headerAlignment: 'left',
    textAlignment: 'left',
    numberAlignment: 'right',
  },
  
  bullets: {
    bulletStyle: 'disc',
    bulletColor: '#0033A0',
    bulletSize: 6,
    
    // Indentation (in points) - 0.25 inch per level
    firstLevelIndent: 0,
    secondLevelIndent: 20,        // Increased for clarity
    thirdLevelIndent: 40,         // Increased for clarity
    hangingIndent: 20,            // Text indent after bullet
    
    bulletSpacing: 10,            // Increased space between bullet and text
    itemSpacing: 12,              // Increased space between items
    levelSpacing: 6,              // Additional space for nested
    
    firstLevelSize: 14,           // Optimized sizes
    secondLevelSize: 13,
    thirdLevelSize: 12,
  },
  
  headerFooter: {
    showHeader: false,            // Clean slides, no header
    headerHeight: 0,
    headerContent: [],
    
    showFooter: true,
    footerHeight: 28,             // Slightly taller footer
    footerFontSize: 10,
    
    showPageNumber: true,
    pageNumberPosition: 'right',
    pageNumberFormat: '{n}',
    
    showDate: false,
    datePosition: 'left',
    dateFormat: 'MMMM YYYY',
    
    showConfidential: true,
    confidentialText: 'Confidential',
    confidentialPosition: 'left',
    
    showSource: true,
    sourcePosition: 'left',
  },
  
  designSpec: `
# 麦肯锡风格PPT设计规范 - 咨询级交付标准 (优化版)

## 1. 核心设计原则 - 决策驱动

### 1.1 金字塔原则 (Pyramid Principle) - 最高优先级
- **先给答案，后给论据** - 每个章节开头先陈述核心建议
- 执行摘要必须包含明确的行动建议，不仅仅是信息汇总
- 在目录页后增加"核心建议概览"页
- 每张幻灯片的标题就是该页的结论

### 1.2 一页一信息 (One Message Per Slide)
- 每张幻灯片只传达**一个核心观点**
- 如果需要传达多个观点，拆分为多页
- 删除所有不直接支持结论的内容
- 留白是设计的重要组成部分，信息密度不宜过高

### 1.3 深度分析 (Deep Analysis)
- 从"是什么"到"为什么"再到"怎么办"
- 每个数据点后增加因果分析
- 为核心数据提供行业对比或历史对比基准
- 包含2-3种市场假设情景分析

### 1.4 行动导向 (Action-Oriented)
- 标题必须是可执行的行动建议或洞察陈述
- 回答三个问题：建议是什么？为什么相信？下一步做什么？
- 避免描述性标题（如"市场概况"），使用洞察性标题（如"市场规模5年增长40%，但增速正在放缓"）

---

## 2. 精确排版规范

### 2.1 字体规范
| 元素 | 字体 | 字号 | 字重 | 行高 |
|------|------|------|------|------|
| 行动标题 | Georgia | 26pt | Normal (400) | 1.3 |
| 副标题/来源 | Arial | 14pt | Normal (400) | 1.4 |
| 一级标题 | Arial | 20pt | Bold (700) | 1.3 |
| 二级标题 | Arial | 18pt | Bold (700) | 1.3 |
| 正文 | Arial | 14pt | Normal (400) | 1.6 |
| 图表标签 | Arial | 12pt | Normal (400) | 1.3 |
| 脚注/来源 | Arial | 10pt | Normal (400) | 1.2 |

### 2.2 页面边距 - 优化留白
| 位置 | 边距值 | 说明 |
|------|--------|------|
| 上边距 | 80pt | 标题区域，增加呼吸空间 |
| 下边距 | 60pt | 页脚区域 |
| 左边距 | 80pt | 内容起始，增加留白 |
| 右边距 | 80pt | 内容结束，增加留白 |
| 安全区 | 40pt | 距边缘最小距离 |

### 2.3 段落间距 - 优化呼吸感
| 元素 | 间距 |
|------|------|
| 段落间距 | 16pt |
| 章节间距 | 28pt |
| 元素间距 | 20pt |
| 项目符号间距 | 12pt |

### 2.4 缩进规范
| 层级 | 缩进值 |
|------|--------|
| 一级项目符号 | 0pt |
| 二级项目符号 | 20pt |
| 三级项目符号 | 40pt |
| 悬挂缩进 | 20pt |

---

## 3. 幻灯片结构 (金字塔原理 + MECE原则)

### 3.1 单页结构
每张幻灯片必须包含三个层次:

**A. 行动标题 (Action Title)**
- 位置：页面顶部，左对齐
- 字号：26pt Georgia
- 行数：最多2行
- 内容：完整句子，阐述核心洞察或建议
- 示例：✓ "跨境电商市场规模突破15万亿，但增速从35%降至10%"
- 反例：✗ "市场规模分析"

**B. 副标题/数据来源**
- 位置：行动标题下方
- 字号：14pt Arial
- 内容：数据来源、时间范围、单位说明
- 示例："中国跨境电商市场规模，万亿人民币，2019-2025"

**C. 内容主体**
- 占据页面65-70%空间（为留白预留空间）
- 支撑行动标题的数据、图表或文字
- 遵循"标题中没有的内容不出现在主体中"原则

### 3.2 整体叙事结构 (SCR框架) - 优化版

**执行摘要 (Executive Summary) - 2页**
- 第1页：核心发现与关键数据
- 第2页：核心建议与行动计划
- 必须能独立讲述完整故事
- 包含明确的"所以呢"——影响和下一步

**核心建议概览 (Key Recommendations) - 1页**
- 紧跟执行摘要
- 3-5条核心建议，每条一句话
- 体现金字塔原则：先给答案

**Situation (情境) - 2-4页**
- 建立当前状态和背景
- 提供相关趋势和数据
- 建立共识基础
- 包含行业对比基准

**Complication (挑战) - 2-4页**
- 引入问题、挑战或机会
- 量化影响（成本、风险、错失的机会）
- 创造行动紧迫感
- 分析根本原因（"为什么"）

**Resolution (解决方案) - 10-20页**
- 逐一呈现支撑论点
- 每个章节证明一个关键点
- 混合数据页、文字页和可视化页
- 遵循金字塔原则：先结论，后证据
- 包含情景分析（乐观/基准/悲观）

**建议与下一步 (Recommendations & Next Steps) - 2-3页**
- 明确的行动建议
- 实施路径和时间表
- 预期成果和KPI

---

## 4. 配色规范

### 4.1 主色板
| 颜色名称 | 色值 | 用途 |
|----------|------|------|
| 麦肯锡蓝 | #0033A0 | 主品牌色、重要数据、强调 |
| 深海蓝 | #001E62 | 深色背景、次要强调 |
| 亮蓝 | #00A3E0 | 数据高亮、图表强调 |
| 纯白 | #FFFFFF | 背景、深色上的文字 |
| 近黑 | #1A1A1A | 主要文字 |
| 深灰 | #666666 | 次要文字、辅助信息 |

### 4.2 功能色
| 颜色名称 | 色值 | 用途 |
|----------|------|------|
| 正向绿 | #00875A | 正面指标、达标、增长 |
| 警示橙 | #F5A623 | 警告、需关注 |
| 负向红 | #D0021B | 仅用于问题和负面指标 |

### 4.3 颜色使用规则
- 限制调色板：2-3种主色 + 灰度
- 颜色必须有功能意义
- 绿色=超标，灰色=达标，红色=未达标
- 深蓝背景页与白色背景页交替使用以保持注意力

---

## 5. 图表规范 - 优化版

### 5.1 图表类型选择
| 目的 | 推荐图表 | 原因 |
|------|----------|------|
| 类别比较 | 水平条形图 | 类别标签更易阅读 |
| 时间趋势 | 折线图 | 趋势更清晰 |
| 部分与整体 | 堆叠条形图/树状图 | 避免饼图 |
| 变量相关性 | 散点图+趋势线 | 直观展示关系 |
| 分布 | 直方图/箱线图 | 清晰展示分布 |
| 流程 | 桑基图/流程图 | 展示转化和流向 |

### 5.2 图表设计规则 - 优化版
- **从洞察出发**选择图表，而非从数据出发
- 使用**最简单有效**的图表形式
- 重要图表**独占一页**，周围保留充足留白
- **直接在图表上标注**，避免使用图例
- 用**颜色、箭头或标注框**突出关键数据点
- **移除**网格线、3D效果、多余颜色
- 底部添加**数据来源**
- 使用**高亮色块**将洞察与数据点建立视觉关联
- 图表标签字号不小于12pt，确保远距离可读

### 5.3 图表尺寸 - 优化版
- 图表区域占页面65-70%（预留更多留白）
- 坐标轴线宽：1pt
- 数据线宽：2.5pt
- 数据点大小：6pt
- 条形宽度：可用空间的65%

---

## 6. 表格规范

### 6.1 单元格设置 - 优化版
| 属性 | 值 |
|------|-----|
| 上内边距 | 10pt |
| 下内边距 | 10pt |
| 左内边距 | 14pt |
| 右内边距 | 14pt |

### 6.2 边框设置
| 属性 | 值 |
|------|-----|
| 边框宽度 | 1pt |
| 边框颜色 | #E0E0E0 |
| 表头边框 | 2pt |

### 6.3 表头样式
| 属性 | 值 |
|------|-----|
| 背景色 | #0033A0 |
| 文字颜色 | #FFFFFF |
| 字重 | Bold (700) |
| 字号 | 13pt |

### 6.4 对齐规则
- 表头：左对齐
- 文字：左对齐
- 数字：右对齐

---

## 7. 项目符号规范

### 7.1 样式设置
| 属性 | 值 |
|------|-----|
| 符号样式 | 实心圆点 (disc) |
| 符号颜色 | #0033A0 |
| 符号大小 | 6pt |

### 7.2 层级字号
| 层级 | 字号 |
|------|------|
| 一级 | 14pt |
| 二级 | 13pt |
| 三级 | 12pt |

### 7.3 内容规则 - 优化版
- 每页最多**4个**要点（减少信息密度）
- 每个要点最多**18个字**（英文）或**36个字**（中文）
- 每个要点最多**1-2行**
- 谨慎使用子项目符号，最多2级
- 使用**主动语态**

---

## 8. 页脚规范

### 8.1 页脚设置
| 属性 | 值 |
|------|-----|
| 高度 | 28pt |
| 字号 | 10pt |
| 字体 | Arial |

### 8.2 页脚内容
| 元素 | 位置 | 格式 |
|------|------|------|
| 保密声明 | 左侧 | "Confidential" |
| 数据来源 | 左侧 | "Source: [来源名称]" |
| 页码 | 右侧 | 纯数字 |

---

## 9. 演示文稿结构 - 优化版

### 9.1 标准结构
1. **封面页** - 标题、公司名、日期
2. **执行摘要** - 2页（发现+建议）
3. **核心建议概览** - 1页（金字塔原则：先给答案）
4. **目录** (可选) - 20+页时使用
5. **情境分析** - 2-4页（含行业对比）
6. **挑战/问题** - 2-4页（含根因分析）
7. **解决方案/分析** - 10-20页（含情景分析）
8. **建议与下一步** - 2-3页（含实施路径）
9. **附录** - 支撑材料

### 9.2 执行摘要规则 - 优化版
- 扩展为2页：发现页 + 建议页
- 遵循SCR框架
- **先给出主要建议**（金字塔原则）
- 总结3-5个关键支撑点
- 包含"所以呢"——影响和下一步
- 应能独立讲述完整故事
- 包含明确的行动建议，不仅仅是信息汇总

---

## 10. 质量检查清单 - 优化版

### 10.1 叙事检查
- [ ] 只读行动标题能否讲述完整、逻辑清晰的故事？
- [ ] 从情境到挑战到解决方案的叙事流程是否清晰？
- [ ] 是否存在逻辑断层或未解释的跳跃？
- [ ] 是否体现金字塔原则（先给答案）？

### 10.2 证据检查
- [ ] 每个论断是否有数据或分析支撑？
- [ ] 来源是否可信且清晰标注？
- [ ] 怀疑论者是否会被证据说服？
- [ ] 是否包含"为什么"的因果分析？
- [ ] 是否有行业对比或历史对比基准？

### 10.3 设计检查
- [ ] 每页是否一眼就能看懂？
- [ ] 3-5秒内能否理解信息？
- [ ] 颜色、字体、版式是否一致？
- [ ] 是否有足够留白？
- [ ] 图表标签是否足够大（≥12pt）？

### 10.4 信息检查
- [ ] 每页是否都有存在的必要？
- [ ] 是否删除了所有不直接支持建议的页面？
- [ ] 语言是否精确、无行话？
- [ ] 每页是否只传达一个核心信息？

### 10.5 行动导向检查
- [ ] 执行摘要是否包含明确的行动建议？
- [ ] 是否有核心建议概览页？
- [ ] 建议是否具体、可执行？
- [ ] 是否包含实施路径和时间表？
`,
};

// ============================================================================
// BCG TEMPLATE
// ============================================================================

export const BCG_TEMPLATE: PPTTemplate = {
  id: 'bcg',
  name: 'BCG咨询风格',
  nameEn: 'BCG Consulting Style',
  description: '战略咨询风格，强调框架思维和结构化分析，以BCG矩阵和增长份额分析著称',
  category: 'consulting',
  
  colors: {
    primary: '#00A651',
    secondary: '#1A1A1A',
    accent: '#00B388',
    background: '#FFFFFF',
    backgroundAlt: '#00A651',
    text: '#1A1A1A',
    textSecondary: '#666666',
    textOnDark: '#FFFFFF',
    success: '#00A651',
    warning: '#FDB913',
    error: '#E31837',
    chartColors: ['#00A651', '#00B388', '#666666', '#FDB913', '#E31837', '#1A1A1A'],
  },
  
  typography: {
    headingFont: 'Trebuchet MS',
    bodyFont: 'Trebuchet MS',
    monoFont: 'Consolas',
    titleSize: 26,
    subtitleSize: 14,
    heading1Size: 18,
    heading2Size: 16,
    bodySize: 14,
    captionSize: 11,
    footnoteSize: 9,
    titleLineHeight: 1.2,
    bodyLineHeight: 1.4,
    titleLetterSpacing: 0,
    bodyLetterSpacing: 0,
    titleWeight: 700,
    bodyWeight: 400,
    emphasisWeight: 700,
    titleAlignment: 'left',
    bodyAlignment: 'left',
    numberAlignment: 'right',
  },
  
  layout: {
    slideWidth: 960,
    slideHeight: 540,
    slideRatio: '16:9',
    marginTop: 55,
    marginBottom: 35,
    marginLeft: 35,
    marginRight: 35,
    safeZoneTop: 30,
    safeZoneBottom: 30,
    safeZoneLeft: 30,
    safeZoneRight: 30,
    gridColumns: 12,
    gridGutter: 14,
    paragraphSpacing: 10,
    sectionSpacing: 20,
    elementSpacing: 14,
  },
  
  structure: {
    framework: 'mece',
    maxBulletsPerSlide: 6,
    maxWordsPerBullet: 25,
    maxLinesPerTitle: 2,
    actionTitles: true,
    executiveSummary: true,
    tableOfContents: true,
    appendix: true,
    sections: {
      coverSlide: true,
      executiveSummary: true,
      tableOfContents: true,
      situationSection: true,
      complicationSection: true,
      resolutionSection: true,
      recommendationSlide: true,
      appendix: true,
    },
  },
  
  charts: {
    chartAreaRatio: 0.70,
    axisLineWidth: 1,
    axisColor: '#666666',
    showGridLines: false,
    gridLineColor: '#E0E0E0',
    gridLineWidth: 0.5,
    axisLabelSize: 11,
    dataLabelSize: 10,
    legendSize: 10,
    showLegend: false,
    dataPointSize: 5,
    lineWidth: 2,
    barWidth: 0.65,
    calloutEnabled: true,
    calloutStyle: 'box',
  },
  
  tables: {
    cellPaddingTop: 6,
    cellPaddingBottom: 6,
    cellPaddingLeft: 10,
    cellPaddingRight: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    headerBorderWidth: 2,
    headerBackground: '#00A651',
    headerTextColor: '#FFFFFF',
    headerFontWeight: 700,
    headerFontSize: 12,
    bodyFontSize: 11,
    alternateRowColor: '#F5FAF7',
    headerAlignment: 'left',
    textAlignment: 'left',
    numberAlignment: 'right',
  },
  
  bullets: {
    bulletStyle: 'disc',
    bulletColor: '#00A651',
    bulletSize: 5,
    firstLevelIndent: 0,
    secondLevelIndent: 16,
    thirdLevelIndent: 32,
    hangingIndent: 16,
    bulletSpacing: 6,
    itemSpacing: 6,
    levelSpacing: 4,
    firstLevelSize: 14,
    secondLevelSize: 12,
    thirdLevelSize: 11,
  },
  
  headerFooter: {
    showHeader: false,
    headerHeight: 0,
    headerContent: [],
    showFooter: true,
    footerHeight: 20,
    footerFontSize: 9,
    showPageNumber: true,
    pageNumberPosition: 'right',
    pageNumberFormat: '{n}',
    showDate: false,
    datePosition: 'left',
    dateFormat: 'MMMM YYYY',
    showConfidential: true,
    confidentialText: 'Confidential',
    confidentialPosition: 'left',
    showSource: true,
    sourcePosition: 'left',
  },
  
  designSpec: `
# BCG风格PPT设计规范

## 核心特点
- 强调战略框架和矩阵分析（BCG矩阵、增长份额矩阵）
- 使用BCG经典绿色(#00A651)作为品牌色
- 结构化的问题分解方法
- 清晰的逻辑层次

## 排版规范
- 标题：Trebuchet MS, 26pt, Bold
- 正文：Trebuchet MS, 14pt
- 图表标签：11pt
- 行高：1.4

## 设计原则
- 绿色用于强调和突出重点
- 灰色用于辅助信息
- 保持视觉层次清晰
- 大量使用2x2矩阵进行分析

## 内容结构
- 采用MECE原则组织内容
- 明确的假设-分析-结论流程
- 数据支撑每个论点
`,
};

// ============================================================================
// BAIN TEMPLATE
// ============================================================================

export const BAIN_TEMPLATE: PPTTemplate = {
  id: 'bain',
  name: 'Bain咨询风格',
  nameEn: 'Bain & Company Style',
  description: '实用主义咨询风格，注重结果导向和可执行性，强调实施路径和可衡量成果',
  category: 'consulting',
  
  colors: {
    primary: '#CC0000',
    secondary: '#1A1A1A',
    accent: '#666666',
    background: '#FFFFFF',
    backgroundAlt: '#CC0000',
    text: '#1A1A1A',
    textSecondary: '#666666',
    textOnDark: '#FFFFFF',
    success: '#00875A',
    warning: '#F5A623',
    error: '#CC0000',
    chartColors: ['#CC0000', '#666666', '#1A1A1A', '#00875A', '#F5A623', '#999999'],
  },
  
  typography: {
    headingFont: 'Arial',
    bodyFont: 'Arial',
    monoFont: 'Consolas',
    titleSize: 26,
    subtitleSize: 14,
    heading1Size: 18,
    heading2Size: 16,
    bodySize: 14,
    captionSize: 11,
    footnoteSize: 9,
    titleLineHeight: 1.2,
    bodyLineHeight: 1.4,
    titleLetterSpacing: 0,
    bodyLetterSpacing: 0,
    titleWeight: 700,
    bodyWeight: 400,
    emphasisWeight: 700,
    titleAlignment: 'left',
    bodyAlignment: 'left',
    numberAlignment: 'right',
  },
  
  layout: {
    slideWidth: 960,
    slideHeight: 540,
    slideRatio: '16:9',
    marginTop: 55,
    marginBottom: 35,
    marginLeft: 35,
    marginRight: 35,
    safeZoneTop: 30,
    safeZoneBottom: 30,
    safeZoneLeft: 30,
    safeZoneRight: 30,
    gridColumns: 12,
    gridGutter: 14,
    paragraphSpacing: 10,
    sectionSpacing: 20,
    elementSpacing: 14,
  },
  
  structure: {
    framework: 'standard',
    maxBulletsPerSlide: 5,
    maxWordsPerBullet: 20,
    maxLinesPerTitle: 2,
    actionTitles: true,
    executiveSummary: true,
    tableOfContents: false,
    appendix: true,
    sections: {
      coverSlide: true,
      executiveSummary: true,
      tableOfContents: false,
      situationSection: true,
      complicationSection: true,
      resolutionSection: true,
      recommendationSlide: true,
      appendix: true,
    },
  },
  
  charts: {
    chartAreaRatio: 0.70,
    axisLineWidth: 1,
    axisColor: '#666666',
    showGridLines: false,
    gridLineColor: '#E0E0E0',
    gridLineWidth: 0.5,
    axisLabelSize: 11,
    dataLabelSize: 10,
    legendSize: 10,
    showLegend: false,
    dataPointSize: 5,
    lineWidth: 2,
    barWidth: 0.65,
    calloutEnabled: true,
    calloutStyle: 'circle',
  },
  
  tables: {
    cellPaddingTop: 6,
    cellPaddingBottom: 6,
    cellPaddingLeft: 10,
    cellPaddingRight: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    headerBorderWidth: 2,
    headerBackground: '#CC0000',
    headerTextColor: '#FFFFFF',
    headerFontWeight: 700,
    headerFontSize: 12,
    bodyFontSize: 11,
    alternateRowColor: '#FFF5F5',
    headerAlignment: 'left',
    textAlignment: 'left',
    numberAlignment: 'right',
  },
  
  bullets: {
    bulletStyle: 'disc',
    bulletColor: '#CC0000',
    bulletSize: 5,
    firstLevelIndent: 0,
    secondLevelIndent: 16,
    thirdLevelIndent: 32,
    hangingIndent: 16,
    bulletSpacing: 6,
    itemSpacing: 6,
    levelSpacing: 4,
    firstLevelSize: 14,
    secondLevelSize: 12,
    thirdLevelSize: 11,
  },
  
  headerFooter: {
    showHeader: false,
    headerHeight: 0,
    headerContent: [],
    showFooter: true,
    footerHeight: 20,
    footerFontSize: 9,
    showPageNumber: true,
    pageNumberPosition: 'right',
    pageNumberFormat: '{n}',
    showDate: false,
    datePosition: 'left',
    dateFormat: 'MMMM YYYY',
    showConfidential: true,
    confidentialText: 'Confidential',
    confidentialPosition: 'left',
    showSource: true,
    sourcePosition: 'left',
  },
  
  designSpec: `
# Bain风格PPT设计规范

## 核心特点
- 实用主义导向，注重可执行性
- 使用Bain红色(#CC0000)作为品牌色
- 强调结果和ROI
- 清晰的实施路径

## 排版规范
- 标题：Arial, 26pt, Bold
- 正文：Arial, 14pt
- 图表标签：11pt
- 行高：1.4

## 设计原则
- 红色用于强调关键指标和行动项
- 简洁直接的视觉风格
- 数据可视化注重趋势和对比
- 每页聚焦一个核心信息

## 内容结构
- 结果导向的叙事
- 明确的价值量化
- 可执行的建议
- 清晰的时间表
`,
};

// ============================================================================
// CORPORATE TEMPLATE
// ============================================================================

export const CORPORATE_TEMPLATE: PPTTemplate = {
  id: 'corporate',
  name: '企业商务风格',
  nameEn: 'Corporate Business Style',
  description: '专业商务演示风格，适用于企业内部汇报、商务提案和正式场合',
  category: 'corporate',
  
  colors: {
    primary: '#2C3E50',
    secondary: '#34495E',
    accent: '#3498DB',
    background: '#FFFFFF',
    backgroundAlt: '#2C3E50',
    text: '#2C3E50',
    textSecondary: '#7F8C8D',
    textOnDark: '#FFFFFF',
    success: '#27AE60',
    warning: '#F39C12',
    error: '#E74C3C',
    chartColors: ['#3498DB', '#2C3E50', '#27AE60', '#F39C12', '#E74C3C', '#9B59B6'],
  },
  
  typography: {
    headingFont: 'Calibri',
    bodyFont: 'Calibri',
    monoFont: 'Consolas',
    titleSize: 32,
    subtitleSize: 18,
    heading1Size: 24,
    heading2Size: 20,
    bodySize: 16,
    captionSize: 12,
    footnoteSize: 10,
    titleLineHeight: 1.2,
    bodyLineHeight: 1.5,
    titleLetterSpacing: 0,
    bodyLetterSpacing: 0,
    titleWeight: 700,
    bodyWeight: 400,
    emphasisWeight: 700,
    titleAlignment: 'left',
    bodyAlignment: 'left',
    numberAlignment: 'right',
  },
  
  layout: {
    slideWidth: 960,
    slideHeight: 540,
    slideRatio: '16:9',
    marginTop: 60,
    marginBottom: 40,
    marginLeft: 50,
    marginRight: 50,
    safeZoneTop: 30,
    safeZoneBottom: 30,
    safeZoneLeft: 30,
    safeZoneRight: 30,
    gridColumns: 12,
    gridGutter: 16,
    paragraphSpacing: 12,
    sectionSpacing: 24,
    elementSpacing: 16,
  },
  
  structure: {
    framework: 'standard',
    maxBulletsPerSlide: 6,
    maxWordsPerBullet: 25,
    maxLinesPerTitle: 2,
    actionTitles: false,
    executiveSummary: true,
    tableOfContents: true,
    appendix: true,
    sections: {
      coverSlide: true,
      executiveSummary: true,
      tableOfContents: true,
      situationSection: true,
      complicationSection: false,
      resolutionSection: true,
      recommendationSlide: true,
      appendix: true,
    },
  },
  
  charts: {
    chartAreaRatio: 0.65,
    axisLineWidth: 1,
    axisColor: '#7F8C8D',
    showGridLines: true,
    gridLineColor: '#ECF0F1',
    gridLineWidth: 0.5,
    axisLabelSize: 12,
    dataLabelSize: 11,
    legendSize: 11,
    showLegend: true,
    dataPointSize: 5,
    lineWidth: 2,
    barWidth: 0.6,
    calloutEnabled: false,
    calloutStyle: 'box',
  },
  
  tables: {
    cellPaddingTop: 8,
    cellPaddingBottom: 8,
    cellPaddingLeft: 12,
    cellPaddingRight: 12,
    borderWidth: 1,
    borderColor: '#BDC3C7',
    headerBorderWidth: 2,
    headerBackground: '#2C3E50',
    headerTextColor: '#FFFFFF',
    headerFontWeight: 700,
    headerFontSize: 14,
    bodyFontSize: 12,
    alternateRowColor: '#F8F9FA',
    headerAlignment: 'center',
    textAlignment: 'left',
    numberAlignment: 'right',
  },
  
  bullets: {
    bulletStyle: 'disc',
    bulletColor: '#3498DB',
    bulletSize: 6,
    firstLevelIndent: 0,
    secondLevelIndent: 20,
    thirdLevelIndent: 40,
    hangingIndent: 20,
    bulletSpacing: 8,
    itemSpacing: 8,
    levelSpacing: 4,
    firstLevelSize: 16,
    secondLevelSize: 14,
    thirdLevelSize: 12,
  },
  
  headerFooter: {
    showHeader: true,
    headerHeight: 30,
    headerContent: ['logo', 'title'],
    showFooter: true,
    footerHeight: 25,
    footerFontSize: 10,
    showPageNumber: true,
    pageNumberPosition: 'right',
    pageNumberFormat: '{n} / {total}',
    showDate: true,
    datePosition: 'left',
    dateFormat: 'YYYY年MM月DD日',
    showConfidential: false,
    confidentialText: '',
    confidentialPosition: 'left',
    showSource: false,
    sourcePosition: 'left',
  },
  
  designSpec: `
# 企业商务风格PPT设计规范

## 核心特点
- 专业稳重的视觉风格
- 深蓝色(#2C3E50)为主色调
- 清晰的信息层次
- 适合正式商务场合

## 排版规范
- 标题：Calibri, 32pt, Bold
- 正文：Calibri, 16pt
- 图表标签：12pt
- 行高：1.5

## 设计原则
- 蓝色系传达专业和信任
- 保持视觉一致性
- 适当使用图表和数据可视化
- 留白适中，信息清晰

## 内容结构
- 标准的商务演示结构
- 包含执行摘要和目录
- 数据支撑论点
- 明确的结论和建议
`,
};

// ============================================================================
// MINIMALIST TEMPLATE
// ============================================================================

export const MINIMALIST_TEMPLATE: PPTTemplate = {
  id: 'minimalist',
  name: '极简现代风格',
  nameEn: 'Minimalist Modern Style',
  description: '简约现代设计风格，大量留白，适合创意展示和产品发布',
  category: 'creative',
  
  colors: {
    primary: '#1A1A1A',
    secondary: '#333333',
    accent: '#FF6B6B',
    background: '#FFFFFF',
    backgroundAlt: '#1A1A1A',
    text: '#1A1A1A',
    textSecondary: '#999999',
    textOnDark: '#FFFFFF',
    success: '#4ECDC4',
    warning: '#FFE66D',
    error: '#FF6B6B',
    chartColors: ['#1A1A1A', '#FF6B6B', '#4ECDC4', '#FFE66D', '#999999', '#333333'],
  },
  
  typography: {
    headingFont: 'Helvetica Neue',
    bodyFont: 'Helvetica Neue',
    monoFont: 'SF Mono',
    titleSize: 48,
    subtitleSize: 20,
    heading1Size: 32,
    heading2Size: 24,
    bodySize: 18,
    captionSize: 14,
    footnoteSize: 12,
    titleLineHeight: 1.1,
    bodyLineHeight: 1.6,
    titleLetterSpacing: -0.03,
    bodyLetterSpacing: 0,
    titleWeight: 700,
    bodyWeight: 300,
    emphasisWeight: 500,
    titleAlignment: 'left',
    bodyAlignment: 'left',
    numberAlignment: 'left',
  },
  
  layout: {
    slideWidth: 960,
    slideHeight: 540,
    slideRatio: '16:9',
    marginTop: 80,
    marginBottom: 60,
    marginLeft: 80,
    marginRight: 80,
    safeZoneTop: 40,
    safeZoneBottom: 40,
    safeZoneLeft: 40,
    safeZoneRight: 40,
    gridColumns: 12,
    gridGutter: 24,
    paragraphSpacing: 20,
    sectionSpacing: 40,
    elementSpacing: 24,
  },
  
  structure: {
    framework: 'standard',
    maxBulletsPerSlide: 4,
    maxWordsPerBullet: 15,
    maxLinesPerTitle: 2,
    actionTitles: false,
    executiveSummary: false,
    tableOfContents: false,
    appendix: false,
    sections: {
      coverSlide: true,
      executiveSummary: false,
      tableOfContents: false,
      situationSection: false,
      complicationSection: false,
      resolutionSection: true,
      recommendationSlide: true,
      appendix: false,
    },
  },
  
  charts: {
    chartAreaRatio: 0.60,
    axisLineWidth: 1,
    axisColor: '#999999',
    showGridLines: false,
    gridLineColor: '#E0E0E0',
    gridLineWidth: 0.5,
    axisLabelSize: 14,
    dataLabelSize: 14,
    legendSize: 14,
    showLegend: false,
    dataPointSize: 8,
    lineWidth: 3,
    barWidth: 0.5,
    calloutEnabled: false,
    calloutStyle: 'box',
  },
  
  tables: {
    cellPaddingTop: 12,
    cellPaddingBottom: 12,
    cellPaddingLeft: 16,
    cellPaddingRight: 16,
    borderWidth: 0,
    borderColor: 'transparent',
    headerBorderWidth: 2,
    headerBackground: 'transparent',
    headerTextColor: '#1A1A1A',
    headerFontWeight: 700,
    headerFontSize: 16,
    bodyFontSize: 14,
    alternateRowColor: '#F8F8F8',
    headerAlignment: 'left',
    textAlignment: 'left',
    numberAlignment: 'left',
  },
  
  bullets: {
    bulletStyle: 'none',
    bulletColor: '#1A1A1A',
    bulletSize: 0,
    firstLevelIndent: 0,
    secondLevelIndent: 24,
    thirdLevelIndent: 48,
    hangingIndent: 0,
    bulletSpacing: 0,
    itemSpacing: 16,
    levelSpacing: 8,
    firstLevelSize: 18,
    secondLevelSize: 16,
    thirdLevelSize: 14,
  },
  
  headerFooter: {
    showHeader: false,
    headerHeight: 0,
    headerContent: [],
    showFooter: false,
    footerHeight: 0,
    footerFontSize: 12,
    showPageNumber: false,
    pageNumberPosition: 'right',
    pageNumberFormat: '{n}',
    showDate: false,
    datePosition: 'left',
    dateFormat: 'YYYY',
    showConfidential: false,
    confidentialText: '',
    confidentialPosition: 'left',
    showSource: false,
    sourcePosition: 'left',
  },
  
  designSpec: `
# 极简现代风格PPT设计规范

## 核心特点
- 大量留白，呼吸感强
- 黑白为主，点缀强调色
- 简洁的排版
- 适合创意和产品展示

## 排版规范
- 标题：Helvetica Neue, 48pt, Bold
- 正文：Helvetica Neue, 18pt, Light
- 图表标签：14pt
- 行高：1.6

## 设计原则
- 少即是多
- 高对比度（黑白为主）
- 清晰的视觉焦点
- 无边框表格
- 无项目符号

## 内容结构
- 每页最多4个要点
- 每个要点最多15个字
- 避免复杂的层级结构
`,
};

// ============================================================================
// TEMPLATE COLLECTION AND UTILITIES
// ============================================================================

export const PPT_TEMPLATES: PPTTemplate[] = [
  MCKINSEY_TEMPLATE,
  BCG_TEMPLATE,
  BAIN_TEMPLATE,
  CORPORATE_TEMPLATE,
  MINIMALIST_TEMPLATE,
];

export function getTemplateById(id: string): PPTTemplate | undefined {
  return PPT_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: PPTTemplate['category']): PPTTemplate[] {
  return PPT_TEMPLATES.filter(t => t.category === category);
}

/**
 * Build a comprehensive prompt from template for AI generation
 * This includes all precise specifications for consulting-grade output
 * OPTIMIZED: Enhanced with evaluation report findings
 */
export function buildPromptFromTemplate(template: PPTTemplate, userRequirements?: string): string {
  const parts: string[] = [];
  
  parts.push(`# PPT设计规范: ${template.name}`);
  parts.push('');
  
  // Key principles for consulting-grade output
  parts.push('## 核心原则');
  parts.push('- 金字塔原则：先给答案，后给论据');
  parts.push('- 一页一信息：每页只传达一个核心观点');
  parts.push('- 行动导向：标题必须是洞察或建议，而非描述');
  parts.push('- 深度分析：从"是什么"到"为什么"再到"怎么办"');
  parts.push('');
  
  // Visual Design
  parts.push('## 视觉设计');
  parts.push(`- 主色调: ${template.colors.primary}`);
  parts.push(`- 辅助色: ${template.colors.secondary}`);
  parts.push(`- 强调色: ${template.colors.accent}`);
  parts.push(`- 背景色: ${template.colors.background}`);
  parts.push(`- 深色背景: ${template.colors.backgroundAlt}`);
  parts.push(`- 文字颜色: ${template.colors.text}`);
  parts.push(`- 次要文字: ${template.colors.textSecondary}`);
  parts.push('');
  
  // Typography - Precise specifications
  parts.push('## 字体规范（精确参数）');
  parts.push(`- 标题字体: ${template.typography.headingFont}`);
  parts.push(`- 正文字体: ${template.typography.bodyFont}`);
  parts.push(`- 标题字号: ${template.typography.titleSize}pt`);
  parts.push(`- 副标题字号: ${template.typography.subtitleSize}pt`);
  parts.push(`- 一级标题: ${template.typography.heading1Size}pt`);
  parts.push(`- 二级标题: ${template.typography.heading2Size}pt`);
  parts.push(`- 正文字号: ${template.typography.bodySize}pt`);
  parts.push(`- 图表标签: ${template.typography.captionSize}pt`);
  parts.push(`- 脚注: ${template.typography.footnoteSize}pt`);
  parts.push(`- 标题行高: ${template.typography.titleLineHeight}`);
  parts.push(`- 正文行高: ${template.typography.bodyLineHeight}`);
  parts.push(`- 标题字重: ${template.typography.titleWeight}`);
  parts.push(`- 正文字重: ${template.typography.bodyWeight}`);
  parts.push('');
  
  // Layout - Precise measurements
  parts.push('## 版式规范（精确参数）');
  parts.push(`- 幻灯片比例: ${template.layout.slideRatio}`);
  parts.push(`- 上边距: ${template.layout.marginTop}pt`);
  parts.push(`- 下边距: ${template.layout.marginBottom}pt`);
  parts.push(`- 左边距: ${template.layout.marginLeft}pt`);
  parts.push(`- 右边距: ${template.layout.marginRight}pt`);
  parts.push(`- 段落间距: ${template.layout.paragraphSpacing}pt`);
  parts.push(`- 章节间距: ${template.layout.sectionSpacing}pt`);
  parts.push(`- 元素间距: ${template.layout.elementSpacing}pt`);
  parts.push('');
  
  // Bullet specifications
  parts.push('## 项目符号规范');
  parts.push(`- 符号样式: ${template.bullets.bulletStyle}`);
  parts.push(`- 符号颜色: ${template.bullets.bulletColor}`);
  parts.push(`- 一级缩进: ${template.bullets.firstLevelIndent}pt`);
  parts.push(`- 二级缩进: ${template.bullets.secondLevelIndent}pt`);
  parts.push(`- 三级缩进: ${template.bullets.thirdLevelIndent}pt`);
  parts.push(`- 项目间距: ${template.bullets.itemSpacing}pt`);
  parts.push(`- 一级字号: ${template.bullets.firstLevelSize}pt`);
  parts.push(`- 二级字号: ${template.bullets.secondLevelSize}pt`);
  parts.push(`- 三级字号: ${template.bullets.thirdLevelSize}pt`);
  parts.push('');
  
  // Content Structure
  parts.push('## 内容结构');
  const frameworkNames: Record<string, string> = {
    pyramid: '金字塔原理',
    scr: 'SCR框架（情境-挑战-解决方案）',
    mece: 'MECE原则（相互独立，完全穷尽）',
    standard: '标准结构',
  };
  parts.push(`- 框架: ${frameworkNames[template.structure.framework]}`);
  parts.push(`- 每页最多要点数: ${template.structure.maxBulletsPerSlide}`);
  parts.push(`- 每个要点最多字数: ${template.structure.maxWordsPerBullet}`);
  parts.push(`- 标题最多行数: ${template.structure.maxLinesPerTitle}`);
  parts.push(`- 使用行动标题: ${template.structure.actionTitles ? '是' : '否'}`);
  parts.push(`- 包含执行摘要: ${template.structure.executiveSummary ? '是' : '否'}`);
  parts.push(`- 包含目录: ${template.structure.tableOfContents ? '是' : '否'}`);
  parts.push(`- 包含附录: ${template.structure.appendix ? '是' : '否'}`);
  parts.push('');
  
  // Chart specifications
  parts.push('## 图表规范');
  parts.push(`- 图表区域占比: ${template.charts.chartAreaRatio * 100}%`);
  parts.push(`- 显示网格线: ${template.charts.showGridLines ? '是' : '否'}`);
  parts.push(`- 显示图例: ${template.charts.showLegend ? '是' : '否（优先使用直接标注）'}`);
  parts.push(`- 坐标轴标签字号: ${template.charts.axisLabelSize}pt`);
  parts.push(`- 数据标签字号: ${template.charts.dataLabelSize}pt`);
  parts.push(`- 启用标注: ${template.charts.calloutEnabled ? '是' : '否'}`);
  parts.push('');
  
  // Table specifications
  parts.push('## 表格规范');
  parts.push(`- 单元格上内边距: ${template.tables.cellPaddingTop}pt`);
  parts.push(`- 单元格下内边距: ${template.tables.cellPaddingBottom}pt`);
  parts.push(`- 单元格左内边距: ${template.tables.cellPaddingLeft}pt`);
  parts.push(`- 单元格右内边距: ${template.tables.cellPaddingRight}pt`);
  parts.push(`- 表头背景色: ${template.tables.headerBackground}`);
  parts.push(`- 表头字号: ${template.tables.headerFontSize}pt`);
  parts.push(`- 正文字号: ${template.tables.bodyFontSize}pt`);
  parts.push(`- 数字对齐: ${template.tables.numberAlignment === 'right' ? '右对齐' : '左对齐'}`);
  parts.push('');
  
  // Footer specifications
  parts.push('## 页脚规范');
  parts.push(`- 显示页脚: ${template.headerFooter.showFooter ? '是' : '否'}`);
  parts.push(`- 页脚字号: ${template.headerFooter.footerFontSize}pt`);
  parts.push(`- 显示页码: ${template.headerFooter.showPageNumber ? '是' : '否'}`);
  parts.push(`- 页码位置: ${template.headerFooter.pageNumberPosition === 'right' ? '右侧' : '左侧'}`);
  parts.push(`- 显示来源: ${template.headerFooter.showSource ? '是' : '否'}`);
  parts.push('');
  
  // Detailed design spec
  parts.push('## 详细设计规范');
  parts.push(template.designSpec);
  parts.push('');
  
  // User requirements
  if (userRequirements) {
    parts.push('## 用户特定要求');
    parts.push(userRequirements);
  }
  
  return parts.join('\n');
}

/**
 * Generate CSS variables from template for frontend styling
 */
export function generateCSSVariables(template: PPTTemplate): Record<string, string> {
  return {
    '--color-primary': template.colors.primary,
    '--color-secondary': template.colors.secondary,
    '--color-accent': template.colors.accent,
    '--color-background': template.colors.background,
    '--color-background-alt': template.colors.backgroundAlt,
    '--color-text': template.colors.text,
    '--color-text-secondary': template.colors.textSecondary,
    '--color-text-on-dark': template.colors.textOnDark,
    '--color-success': template.colors.success,
    '--color-warning': template.colors.warning,
    '--color-error': template.colors.error,
    '--font-heading': template.typography.headingFont,
    '--font-body': template.typography.bodyFont,
    '--font-mono': template.typography.monoFont,
    '--font-size-title': `${template.typography.titleSize}pt`,
    '--font-size-subtitle': `${template.typography.subtitleSize}pt`,
    '--font-size-h1': `${template.typography.heading1Size}pt`,
    '--font-size-h2': `${template.typography.heading2Size}pt`,
    '--font-size-body': `${template.typography.bodySize}pt`,
    '--font-size-caption': `${template.typography.captionSize}pt`,
    '--font-size-footnote': `${template.typography.footnoteSize}pt`,
    '--line-height-title': `${template.typography.titleLineHeight}`,
    '--line-height-body': `${template.typography.bodyLineHeight}`,
    '--spacing-paragraph': `${template.layout.paragraphSpacing}pt`,
    '--spacing-section': `${template.layout.sectionSpacing}pt`,
    '--spacing-element': `${template.layout.elementSpacing}pt`,
  };
}
