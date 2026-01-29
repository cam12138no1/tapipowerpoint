/**
 * PPT Generation Engine Client
 * Internal API client for PPT generation services
 */

import axios, { AxiosInstance } from 'axios';

// Internal API types
export interface EngineProject {
  id: string;
  name: string;
  instruction: string;
  created_at: string;
}

export interface EngineFileUpload {
  file_id: string;
  upload_url: string;
}

export interface EngineTaskCreateResponse {
  task_id: string;
  task_title: string;
  task_url: string;
  share_url?: string;
}

// Output message content types from API
export interface OutputContent {
  type: 'output_text' | 'output_file' | 'output_image';
  text?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
}

// Output message from API
export interface OutputMessage {
  id: string;
  status: string;
  role: 'user' | 'assistant';
  type: string;
  content: OutputContent[];
}

export interface EngineTask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'ask' | 'stopped';
  title?: string;
  output?: OutputMessage[];  // Array of messages from API
  rawOutput?: any;  // Raw output for debugging
  attachments?: Array<{
    id?: string;
    file_id?: string;
    filename?: string;
    file_name?: string;
    url?: string;
    download_url?: string;
  }>;
  share_url?: string;
  task_url?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: {
    task_title?: string;
    task_url?: string;
  };
}

export interface CreateProjectRequest {
  name: string;
  instruction: string;
}

export interface CreateTaskRequest {
  prompt: string;
  agentProfile?: string;
  taskMode?: string;
  projectId?: string;
  attachments?: Array<{ fileId: string }>;
  createShareableLink?: boolean;
  interactiveMode?: boolean;
}

/**
 * PPT Generation Engine Client
 * Handles communication with the backend AI service
 */
class PPTEngineClient {
  private client: AxiosInstance;

  constructor() {
    // Use environment variables for API configuration
    const apiKey = process.env.PPT_ENGINE_API_KEY;
    const baseURL = process.env.PPT_ENGINE_API_URL || 'https://api.manus.im/v1';

    if (!apiKey) {
      console.warn('[PPTEngine] API key is not configured. API calls will fail.');
    }

    this.client = axios.create({
      baseURL,
      timeout: 60000, // 60秒超时
      headers: {
        'API_KEY': apiKey || '',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  // Projects API
  async createProject(data: CreateProjectRequest): Promise<EngineProject> {
    const response = await this.client.post('/projects', data);
    return response.data;
  }

  async getProject(projectId: string): Promise<EngineProject> {
    const response = await this.client.get(`/projects/${projectId}`);
    return response.data;
  }

  // Files API
  async createFileUpload(fileName: string): Promise<EngineFileUpload> {
    const response = await this.client.post('/files', {
      filename: fileName,
    });
    return {
      file_id: response.data.id,
      upload_url: response.data.upload_url,
    };
  }

  async uploadFileToUrl(uploadUrl: string, file: Buffer, contentType: string): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': contentType,
      },
    });
  }

  // Tasks API
  async createTask(data: CreateTaskRequest): Promise<EngineTaskCreateResponse> {
    const requestBody = {
      prompt: data.prompt,
      agent_profile: data.agentProfile || 'manus-1.6-max',
      task_mode: data.taskMode || 'agent',
      project_id: data.projectId,
      attachments: data.attachments,
      create_shareable_link: data.createShareableLink ?? true,
      interactive_mode: data.interactiveMode ?? true,
    };
    
    console.log('[PPTEngine] Creating task...');
    
    const response = await this.client.post('/tasks', requestBody);
    console.log('[PPTEngine] Task created successfully');
    return response.data;
  }

  async getTask(taskId: string, convert: boolean = false): Promise<EngineTask> {
    // Use convert=true to get converted PPTX preview data
    const url = convert ? `/tasks/${taskId}?convert=true` : `/tasks/${taskId}`;
    const response = await this.client.get(url);
    console.log('[PPTEngine] Task status:', response.data.status);
    
    // Extract output array (API returns output as array of messages)
    const output = response.data.output;
    
    // Extract attachments from output messages if present
    // IMPORTANT: Only extract from the LAST assistant message to get the latest files
    const attachments: EngineTask['attachments'] = [];
    if (Array.isArray(output) && output.length > 0) {
      // Find the last assistant message with file attachments
      // Iterate from the end to find the most recent files
      for (let i = output.length - 1; i >= 0; i--) {
        const msg = output[i] as OutputMessage;
        if (msg.role === 'assistant' && msg.content && Array.isArray(msg.content)) {
          const filesInMessage: EngineTask['attachments'] = [];
          msg.content.forEach((item: OutputContent) => {
            if (item.type === 'output_file' && item.fileUrl && item.fileName) {
              filesInMessage.push({
                filename: item.fileName,
                url: item.fileUrl,
              });
              console.log(`[PPTEngine] Found file in message ${i}: ${item.fileName}`);
            }
          });
          // If we found files in this message, use them and stop looking
          if (filesInMessage.length > 0) {
            attachments.push(...filesInMessage);
            console.log(`[PPTEngine] Using ${filesInMessage.length} files from message ${i} (latest with files)`);
            break;
          }
        }
      }
    }
    
    console.log(`[PPTEngine] Total attachments extracted: ${attachments.length}`);
    
    return {
      id: response.data.id || taskId,
      status: response.data.status,
      title: response.data.metadata?.task_title || response.data.title,
      output: Array.isArray(output) ? output : undefined,
      rawOutput: output,
      attachments: attachments.length > 0 ? attachments : undefined,
      share_url: response.data.metadata?.task_url,
      task_url: response.data.metadata?.task_url,
      created_at: response.data.created_at,
      updated_at: response.data.updated_at,
      metadata: response.data.metadata,
    };
  }

  async continueTask(taskId: string, userInput: string): Promise<EngineTaskCreateResponse> {
    const response = await this.client.post('/tasks', {
      prompt: userInput,
      task_id: taskId,
    });
    return response.data;
  }

  // Helper: Upload a file completely (two-step process)
  async uploadFile(fileName: string, fileBuffer: Buffer, contentType: string): Promise<string> {
    // Step 1: Get file_id and upload_url
    const { file_id, upload_url } = await this.createFileUpload(fileName);
    
    // Step 2: Upload file content to the presigned URL
    await this.uploadFileToUrl(upload_url, fileBuffer, contentType);
    
    return file_id;
  }
}

// Export singleton instance
export const pptEngine = new PPTEngineClient();

// Export class for testing
export { PPTEngineClient };

// Helper function to get MIME type from filename
export function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    md: 'text/markdown',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

// Design specification interface
export interface DesignSpec {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  designSpec?: string; // Additional design instructions
  logoUrl?: string;
}

// Image usage mode type
export type ImageUsageMode = 'must_use' | 'suggest_use' | 'ai_decide';

// Image category type
export type ImageCategory = 'cover' | 'content' | 'chart' | 'logo' | 'background' | 'other';

// Enhanced image configuration interface
export interface ImageConfig {
  fileId: string;
  usageMode: ImageUsageMode;
  category: ImageCategory;
  description: string;
}

// Legacy image format (for backward compatibility)
export interface LegacyImageConfig {
  fileId: string;
  placement: string;
}

// Helper function to get usage mode label in Chinese
function getUsageModeLabel(mode: ImageUsageMode): string {
  const labels: Record<ImageUsageMode, string> = {
    must_use: '必须使用',
    suggest_use: '建议使用',
    ai_decide: 'AI自行决定',
  };
  return labels[mode] || 'AI自行决定';
}

// Helper function to get category label in Chinese
function getCategoryLabel(category: ImageCategory): string {
  const labels: Record<ImageCategory, string> = {
    cover: '封面/封底',
    content: '内容配图',
    chart: '数据图表',
    logo: 'Logo/品牌标识',
    background: '背景图片',
    other: '其他用途',
  };
  return labels[category] || '其他用途';
}

// Build PPT generation prompt - optimized for autonomous execution with modular image config
export function buildPPTPrompt(
  sourceFileId: string | null,
  images: Array<ImageConfig | LegacyImageConfig>,
  proposalContent?: string,
  designSpec?: DesignSpec | null
): string {
  const lines = [
    '# PPT 制作任务 - 咨询级专业标准',
    '',
    '## ⚠️ 最重要的规则（必须首先阅读并严格遵守）',
    '',
    '**品牌纯净要求 - 违反此规则将导致交付物被完全拒绝：**',
    '',
    '1. **严禁**在PPT的任何位置（尤其是封面页、首页、尾页）出现以下内容：',
    '   - "Powered by Manus"、"Made with Manus"、"由Manus提供支持"',
    '   - "Powered by AI"、"AI Generated"、"由AI生成"',
    '   - "Powered by XXX"或任何类似的技术来源声明',
    '   - Manus、OpenAI、Claude、GPT、Gemini等任何AI平台或模型名称',
    '   - 任何暗示内容由AI生成的水印、Logo或标注',
    '',
    '2. **封面页特别要求**：',
    '   - 封面页只能包含：标题、副标题、日期、公司名称（如用户提供）',
    '   - 封面页**绝对禁止**出现任何"Powered by"、"Made with"等字样',
    '   - 封面页**绝对禁止**出现任何AI工具的Logo或名称',
    '',
    '3. **这是面向大型企业客户的专业交付**，必须确保PPT看起来100%是人工专业制作。',
    '',
    '---',
    '',
    '## 📋 咨询级PPT质量标准',
    '',
    '请按照**麦肯锡、BCG、贝恩**等顶级咨询公司的PPT标准制作，具体要求：',
    '',
    '### 内容质量要求',
    '',
    '1. **金字塔原则**：',
    '   - 每页PPT必须有一个清晰的核心观点（放在页面顶部作为标题）',
    '   - 标题必须是完整的陈述句，能够独立传达关键信息',
    '   - 正文内容用于支撑和论证标题观点',
    '',
    '2. **MECE原则**：',
    '   - 内容分类必须相互独立、完全穷尽',
    '   - 避免重复和遗漏',
    '   - 每个要点之间逻辑清晰',
    '',
    '3. **内容深度**：',
    '   - 每页PPT必须有实质性内容，避免空洞的口号',
    '   - 使用具体数据、案例、对比来支撑观点',
    '   - 提供可操作的洞察和建议',
    '',
    '### 视觉设计标准',
    '',
    '1. **排版规范**：',
    '   - 标题字号：28-32pt，加粗',
    '   - 正文字号：18-22pt',
    '   - 注释/来源：10-12pt',
    '   - 行距：1.2-1.5倍',
    '   - 页边距：保持一致的留白',
    '',
    '2. **视觉层次**：',
    '   - 使用颜色和字体大小区分信息层级',
    '   - 重要信息使用强调色突出',
    '   - 保持视觉重心平衡',
    '',
    '3. **图表设计**：',
    '   - 图表必须有清晰的标题和数据标签',
    '   - 使用与主题色一致的配色方案',
    '   - 数据可视化要直观易懂',
    '   - 复杂数据优先使用图表而非表格',
    '',
    '### 结构框架',
    '',
    '1. **封面页**：标题、副标题、日期、公司名称',
    '2. **目录页**：清晰的章节结构',
    '3. **执行摘要**：核心发现和建议的概述（1-2页）',
    '4. **正文内容**：按逻辑顺序展开',
    '5. **结论/建议**：总结和下一步行动',
    '6. **附录**（如需要）：详细数据和参考资料',
    '',
    '---',
    '',
    '**重要执行原则**：',
    '- **自主决策**：请尽可能自主完成所有工作，不要频繁询问用户确认。',
    '- **高效执行**：遇到需要选择的情况时，请根据专业判断直接做出最优决策。',
    '- **仅在必要时询问**：只有在遇到无法自行判断的关键问题时才向用户提问。',
    '- ⚠️ **品牌纯净**：在任何页面都不要添加AI工具品牌信息。',
    '',
  ];

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
      lines.push(`- **Logo**：请在封面和结尾页使用品牌Logo`);
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
  } else {
    lines.push('1. **内容生成**：请根据设计规范和配图信息，生成一份专业的PPT。');
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
  } else {
    lines.push('');
    lines.push('2. **智能配图**（自动执行，无需确认）：');
    lines.push('   a. 请首先在源文档中寻找相关图表或图片。');
    lines.push('   b. 如果资料中无可用图片，请自动搜索高质量、风格匹配的商业图片。');
    lines.push('   c. 请根据专业判断直接选择最合适的图片，无需向用户确认。');
  }

  lines.push('');
  lines.push('3. **数据与信息补充**（提升内容质量的关键）：');
  lines.push('   - 如果Proposal或文档中的数据不够完整，**必须**自动搜索最新的行业数据进行补充');
  lines.push('   - 搜索并添加以下类型的支撑材料：');
  lines.push('     * 最新的市场规模和增长率数据');
  lines.push('     * 行业趋势和预测报告');
  lines.push('     * 竞争格局和市场份额分析');
  lines.push('     * 成功案例和标杆企业实践');
  lines.push('     * 权威机构的研究报告引用');
  lines.push('   - 所有数据必须标注来源，增强可信度');
  lines.push('   - 确保PPT内容专业、充实、有说服力，达到咨询报告的质量标准');

  lines.push('');
  lines.push('4. **图片布局规范**（极其重要，必须严格遵守）：');
  lines.push('   - **绝对禁止**图片遮挡文字内容，这是最基本的PPT设计规则');
  lines.push('   - 图片必须放置在专门的图片区域，不得与文字重叠');
  lines.push('   - 如果页面空间有限，应该减小图片尺寸或调整布局，而不是让图片遮挡文字');
  lines.push('   - 常见布局方式：');
  lines.push('     * 左文右图：文字在左侧，图片在右侧，互不重叠');
  lines.push('     * 上文下图：标题和文字在上方，图片在下方');
  lines.push('     * 全屏背景：图片作为背景时，必须添加半透明遮罩确保文字可读');
  lines.push('   - 每页PPT完成后请检查：所有文字是否完全可见，没有被图片遮挡');
  lines.push('   - 这是专业交付的基本要求，图片遮挡文字是不可接受的错误');

  lines.push('');
  lines.push('5. **最终交付前的质量检查**：');
  lines.push('   在生成最终PPTX文件之前，请确保：');
  lines.push('   - [ ] 每页都有明确的核心观点作为标题');
  lines.push('   - [ ] 内容逻辑清晰，符合金字塔原则');
  lines.push('   - [ ] 关键数据都有来源标注');
  lines.push('   - [ ] 图表清晰易懂，有标题和数据标签');
  lines.push('   - [ ] 所有文字完全可见，没有被图片遮挡');
  lines.push('   - [ ] 配色和字体符合设计规范');
  lines.push('   - [ ] 没有任何AI工具品牌信息');
  lines.push('');
  lines.push('6. **最终交付**：完成所有内容的撰写和配图后，将整个PPT打包成一个可下载的 `.pptx` 文件作为最终交付物。');
  
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
