import type { DesignSpec } from '../drizzle/schema';

// Types for PPT engine
export interface ImageConfig {
  fileId: string;
  category: 'cover' | 'content' | 'chart' | 'background' | 'logo' | 'other';
  description?: string;
  usageMode: 'must_use' | 'suggest_use' | 'ai_decide';
}

export interface LegacyImageConfig {
  fileId: string;
  placement: string;
}

export interface PPTTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: {
    fileUrl: string;
    fileName: string;
  };
  error?: string;
}

// API Configuration
const PPT_API_BASE_URL = process.env.PPT_API_BASE_URL || 'https://api.manus.ai';
const PPT_API_KEY = process.env.PPT_API_KEY || '';
const API_TIMEOUT_MS = 60000; // 60 seconds timeout

// Helper function to get category label
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'cover': '封面图片',
    'content': '内容配图',
    'chart': '图表/数据图',
    'background': '背景图片',
    'logo': '品牌Logo',
    'other': '其他用途'
  };
  return labels[category] || '未分类';
}

// Create a new PPT task
export async function createPPTTask(
  prompt: string,
  attachments: string[] = []
): Promise<{ taskId: string }> {
  console.log('[PPTEngine] Creating task...');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  
  try {
    const response = await fetch(`${PPT_API_BASE_URL}/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PPT_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        attachments,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create task: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[PPTEngine] Task created successfully');
    return { taskId: data.task_id || data.id };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Poll task status
export async function pollTaskStatus(taskId: string): Promise<{
  status: string;
  progress: number;
  output?: string;
  error?: string;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  
  try {
    const response = await fetch(`${PPT_API_BASE_URL}/v1/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PPT_API_KEY}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to poll task: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Map API status to our status
    let status = data.status;
    if (status === 'running' || status === 'in_progress') {
      status = 'processing';
    } else if (status === 'succeeded' || status === 'success') {
      status = 'completed';
    }

    return {
      status,
      progress: data.progress || 0,
      output: data.output,
      error: data.error,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Extract PPTX file URL from task output
export function extractPPTXUrl(output: string): string | null {
  if (!output) return null;
  
  // Try to find PPTX URL in the output
  // Pattern 1: Direct URL ending with .pptx
  const pptxUrlMatch = output.match(/https?:\/\/[^\s<>"]+\.pptx/i);
  if (pptxUrlMatch) {
    return pptxUrlMatch[0];
  }
  
  // Pattern 2: Markdown link with .pptx
  const mdLinkMatch = output.match(/\[([^\]]+)\]\((https?:\/\/[^\s<>"]+\.pptx)\)/i);
  if (mdLinkMatch) {
    return mdLinkMatch[2];
  }
  
  // Pattern 3: URL in JSON format
  try {
    const jsonMatch = output.match(/\{[^}]*"url"\s*:\s*"([^"]+\.pptx)"[^}]*\}/i);
    if (jsonMatch) {
      return jsonMatch[1];
    }
  } catch {
    // Ignore JSON parsing errors
  }
  
  // Pattern 4: Any download URL
  const downloadMatch = output.match(/https?:\/\/[^\s<>"]+\/download[^\s<>"]*/i);
  if (downloadMatch) {
    return downloadMatch[0];
  }
  
  return null;
}

// Upload file to PPT API
export async function uploadFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  console.log(`[PPTEngine] Uploading file: ${fileName}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  
  try {
    // Create form data
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, fileName);

    const response = await fetch(`${PPT_API_BASE_URL}/v1/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PPT_API_KEY}`,
      },
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload file: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[PPTEngine] File uploaded successfully: ${data.file_id || data.id}`);
    return data.file_id || data.id;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Upload file from base64
export async function uploadFileFromBase64(
  base64Data: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  // Remove data URL prefix if present
  const base64Content = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');
  return uploadFile(buffer, fileName, mimeType);
}

// Upload file from URL
export async function uploadFileFromUrl(
  url: string,
  fileName: string
): Promise<string> {
  console.log(`[PPTEngine] Downloading file from URL: ${url}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    
    return uploadFile(buffer, fileName, mimeType);
  } finally {
    clearTimeout(timeoutId);
  }
}

// Get file info
export async function getFileInfo(fileId: string): Promise<{
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url?: string;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  
  try {
    const response = await fetch(`${PPT_API_BASE_URL}/v1/files/${fileId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PPT_API_KEY}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get file info: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      id: data.id || data.file_id,
      name: data.name || data.filename,
      size: data.size,
      mimeType: data.mime_type || data.mimeType,
      url: data.url,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Download file
export async function downloadFile(fileId: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  
  try {
    const response = await fetch(`${PPT_API_BASE_URL}/v1/files/${fileId}/content`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PPT_API_KEY}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to download file: ${response.status} - ${errorText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeoutId);
  }
}

// Build PPT generation prompt - optimized for autonomous execution with modular image config
export function buildPPTPrompt(
  sourceFileId: string | null,
  images: Array<ImageConfig | LegacyImageConfig>,
  proposalContent?: string,
  designSpec?: DesignSpec | null
): string {
  const lines = [
    '# PPT 制作任务',
    '',
    '## ⚠️ 最重要的规则（必须首先阅读并严格遵守）',
    '',
    '**品牌纯净要求 - 违反此规则将导致交付物被完全拒绝：**',
    '',
    '1. **严禁**在PPT的任何位置（尤其是封面页、首页、尾页）出现以下内容：',
    '   - "Powered by Manus"、"Made with Manus"、"由Manus提供支持"',
    '   - "Powered by AI"、"AI Generated"、"由AI生成"',
    '   - 任何AI平台名称：Manus、OpenAI、Claude、GPT、Anthropic等',
    '   - 任何"Powered by XXX"、"Built with XXX"格式的声明',
    '   - 任何暗示内容来源的水印、Logo或脚注',
    '',
    '2. **封面页要求**：',
    '   - 封面只能包含：PPT标题、副标题（如有）、日期（可选）、公司Logo（如用户提供）',
    '   - **绝对禁止**在封面添加任何技术来源、工具名称或"Powered by"声明',
    '   - 封面风格应像是由专业咨询顾问手工制作',
    '',
    '3. 这是面向大型企业客户的专业商务交付，必须看起来100%是人工专业制作',
    '',
    '---',
    '',
  ];

  lines.push('请根据我提供的资料和要求，制作一份专业的行业PPT。');
  lines.push('');
  lines.push('**重要执行原则**：');
  lines.push('- **自主决策**：请尽可能自主完成所有工作，不要频繁询问用户确认。');
  lines.push('- **高效执行**：遇到需要选择的情况时，请根据专业判断直接做出最优决策。');
  lines.push('- **仅在必要时询问**：只有在遇到无法自行判断的关键问题时才向用户提问。');
  lines.push('- **品牌纯净**：绝对不在PPT中添加任何AI工具或平台的品牌信息。');
  lines.push('');

  // 添加设计规范要求
  if (designSpec) {
    lines.push('**设计规范要求**（必须严格遵守）：');
    lines.push('');
    lines.push(`- **规范名称**：${designSpec.name}`);
    lines.push(`- **主色调**：${designSpec.primaryColor}（用于标题、重要元素、强调内容）`);
    lines.push(`- **辅助色**：${designSpec.secondaryColor}（用于正文、次要元素）`);
    lines.push(`- **强调色**：${designSpec.accentColor}（用于图表、按钮、高亮内容）`);
    lines.push(`- **字体**：${designSpec.fontFamily}（所有文字必须使用此字体）`);
    if (designSpec.logoUrl) {
      lines.push(`- **Logo**：请在封面和结尾页使用用户提供的品牌Logo（不是AI工具Logo）`);
    }
    if (designSpec.designSpec) {
      lines.push('');
      lines.push('**额外设计说明**：');
      lines.push(designSpec.designSpec);
    }
    lines.push('');
    lines.push('**重要**：以上配色和字体规范必须严格执行，确保整个PPT风格统一、专业。');
    lines.push('');
  } else {
    lines.push('**设计风格**：用户未指定设计规范，请根据内容主题自由发挥，选择最适合的专业商务风格。');
    lines.push('**注意**：即使自由发挥，也严禁在任何页面添加AI工具品牌信息。');
    lines.push('');
  }

  lines.push('**任务要求**：');
  lines.push('');

  // 根据输入模式添加不同的内容生成指令
  if (proposalContent) {
    lines.push('1. **内容生成**：');
    lines.push('   - 基于我提供的Proposal内容，提炼核心要点');
    lines.push('   - 将内容组织成逻辑清晰的PPT页面结构');
    lines.push('   - 如果内容不够详细，请自动搜索相关资料进行补充');
    lines.push('   - 确保每页PPT都有充实的内容和专业的表达');
    lines.push('   - ⚠️ 搜索补充资料时，不要在PPT中标注资料来源或AI工具名称');
    lines.push('');
    lines.push('**Proposal内容**：');
    lines.push('```');
    lines.push(proposalContent);
    lines.push('```');
  } else if (sourceFileId) {
    lines.push('1. **内容生成**：');
    lines.push('   - 基于我提供的源文档，提炼核心内容');
    lines.push('   - 将内容组织成逻辑清晰的PPT页面结构');
    lines.push('   - 如有需要，可自动搜索补充相关数据和信息');
    lines.push('   - ⚠️ 搜索补充资料时，不要在PPT中标注资料来源或AI工具名称');
  } else {
    lines.push('1. **内容生成**：请根据设计规范和配图信息，生成一份专业的PPT。');
    lines.push('   - ⚠️ 不要在PPT中添加任何AI工具或平台的品牌信息');
  }

  // 处理图片配置 - 支持新旧两种格式
  if (images.length > 0) {
    lines.push('');
    lines.push('2. **配图管理**（请严格按照以下要求处理用户提供的图片）：');
    lines.push('');
    
    // 分类处理图片
    const mustUseImages: Array<ImageConfig | LegacyImageConfig> = [];
    const suggestUseImages: Array<ImageConfig | LegacyImageConfig> = [];
    const aiDecideImages: Array<ImageConfig | LegacyImageConfig> = [];
    
    images.forEach(img => {
      // 检查是否是新格式
      if ('usageMode' in img) {
        switch (img.usageMode) {
          case 'must_use':
            mustUseImages.push(img);
            break;
          case 'suggest_use':
            suggestUseImages.push(img);
            break;
          case 'ai_decide':
          default:
            aiDecideImages.push(img);
            break;
        }
      } else {
        // 旧格式，默认为AI自行决定
        aiDecideImages.push(img);
      }
    });
    
    // 必须使用的图片
    if (mustUseImages.length > 0) {
      lines.push('   **【必须使用】以下图片必须在PPT中使用，不可忽略：**');
      mustUseImages.forEach((img, index) => {
        if ('usageMode' in img) {
          const categoryLabel = getCategoryLabel(img.category);
          lines.push(`   ${index + 1}. 附件 \`${img.fileId}\``);
          lines.push(`      - 用途：${categoryLabel}`);
          if (img.description) {
            lines.push(`      - 说明：${img.description}`);
          }
        } else {
          lines.push(`   ${index + 1}. 附件 \`${img.fileId}\`：${img.placement}`);
        }
      });
      lines.push('');
    }
    
    // 建议使用的图片
    if (suggestUseImages.length > 0) {
      lines.push('   **【建议使用】以下图片优先考虑使用，如果适合内容请使用：**');
      suggestUseImages.forEach((img, index) => {
        if ('usageMode' in img) {
          const categoryLabel = getCategoryLabel(img.category);
          lines.push(`   ${index + 1}. 附件 \`${img.fileId}\``);
          lines.push(`      - 用途：${categoryLabel}`);
          if (img.description) {
            lines.push(`      - 说明：${img.description}`);
          }
        } else {
          lines.push(`   ${index + 1}. 附件 \`${img.fileId}\`：${img.placement}`);
        }
      });
      lines.push('');
    }
    
    // AI自行决定的图片
    if (aiDecideImages.length > 0) {
      lines.push('   **【AI自行决定】以下图片由AI根据内容相关性决定是否使用：**');
      aiDecideImages.forEach((img, index) => {
        if ('usageMode' in img) {
          const categoryLabel = getCategoryLabel(img.category);
          lines.push(`   ${index + 1}. 附件 \`${img.fileId}\``);
          lines.push(`      - 用途：${categoryLabel}`);
          if (img.description) {
            lines.push(`      - 说明：${img.description}`);
          }
        } else {
          lines.push(`   ${index + 1}. 附件 \`${img.fileId}\`：${img.placement || '未指定用途'}`);
        }
      });
      lines.push('');
    }
    
    lines.push('   **其他配图处理**：');
    lines.push('   - 对于未指定配图的页面，请首先在源文档中寻找相关图表或图片');
    lines.push('   - 如果资料中无可用图片，请自动搜索高质量、风格匹配的商业图片');
    lines.push('   - 请根据专业判断直接选择最合适的图片，无需向用户确认');
    lines.push('   - ⚠️ 搜索配图时，不要选择带有AI工具水印或品牌标识的图片');
  } else {
    lines.push('');
    lines.push('2. **智能配图**（自动执行，无需确认）：');
    lines.push('   a. 请首先在源文档中寻找相关图表或图片。');
    lines.push('   b. 如果资料中无可用图片，请自动搜索高质量、风格匹配的商业图片。');
    lines.push('   c. 请根据专业判断直接选择最合适的图片，无需向用户确认。');
    lines.push('   d. ⚠️ 搜索配图时，不要选择带有AI工具水印或品牌标识的图片。');
  }

  lines.push('');
  lines.push('3. **数据与信息补充**：');
  lines.push('   - 如果Proposal或文档中的数据不够完整，请自动搜索最新的行业数据进行补充');
  lines.push('   - 可以添加相关的市场趋势、统计数据、案例分析等内容');
  lines.push('   - 确保PPT内容专业、充实、有说服力');
  lines.push('   - ⚠️ 补充数据时，不要标注数据来源为AI工具或平台');

  lines.push('');
  lines.push('4. **最终交付**：完成所有内容的撰写和配图后，将整个PPT打包成一个可下载的 `.pptx` 文件作为最终交付物。');
  
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## ⚠️ 再次强调品牌纯净要求（最终检查清单）');
  lines.push('');
  lines.push('在生成PPT之前，请确保：');
  lines.push('');
  lines.push('- [ ] 封面页没有"Powered by"、"Made with"等任何技术来源声明');
  lines.push('- [ ] 所有页面都没有Manus、OpenAI、Claude等AI平台名称');
  lines.push('- [ ] 没有任何水印、Logo暗示内容由AI生成');
  lines.push('- [ ] 尾页/致谢页没有技术致谢或工具声明');
  lines.push('- [ ] PPT看起来100%像是人工专业制作');
  lines.push('');
  lines.push('**违反以上任何一条，交付物将被拒绝。**');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('**请尽可能自主完成所有工作，只有在遇到真正无法判断的关键问题时才向用户提问。**');

  return lines.join('\n');
}
