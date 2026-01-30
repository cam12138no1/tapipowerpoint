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
    
    console.log('[PPTEngine] Creating task with manus-1.6-max...');
    
    const response = await this.client.post('/tasks', requestBody);
    console.log('[PPTEngine] Task created successfully');
    return response.data;
  }

  async getTask(taskId: string, convert: boolean = false): Promise<EngineTask> {
    // Use convert=true to get converted PPTX preview data
    const url = convert ? `/tasks/${taskId}?convert=true` : `/tasks/${taskId}`;
    const response = await this.client.get(url);
    console.log('[PPTEngine] Task status:', response.data.status);
    console.log('[PPTEngine] Full response keys:', Object.keys(response.data));
    
    // Extract output array (API returns output as array of messages)
    const output = response.data.output;
    
    // Extract attachments from output messages if present
    // Search through ALL messages for files, prioritizing the latest
    const attachments: EngineTask['attachments'] = [];
    
    if (Array.isArray(output) && output.length > 0) {
      console.log(`[PPTEngine] Processing ${output.length} output messages`);
      
      // Iterate from the end to find the most recent files
      for (let i = output.length - 1; i >= 0; i--) {
        const msg = output[i] as OutputMessage;
        console.log(`[PPTEngine] Message ${i}: role=${msg.role}, type=${msg.type}, content_count=${msg.content?.length || 0}`);
        
        if (msg.role === 'assistant' && msg.content && Array.isArray(msg.content)) {
          const filesInMessage: EngineTask['attachments'] = [];
          
          msg.content.forEach((item: any, idx: number) => {
            console.log(`[PPTEngine] Content ${idx}: type=${item.type}`);
            
            // Check for output_file type
            if (item.type === 'output_file') {
              // Try multiple possible field names for URL and filename
              const fileUrl = item.fileUrl || item.file_url || item.url || item.download_url;
              const fileName = item.fileName || item.file_name || item.filename || item.name;
              
              console.log(`[PPTEngine] Found output_file: url=${fileUrl?.substring(0, 50)}..., name=${fileName}`);
              
              if (fileUrl && fileName) {
                filesInMessage.push({
                  filename: fileName,
                  url: fileUrl,
                });
                console.log(`[PPTEngine] Added file: ${fileName}`);
              }
            }
            
            // Also check for any item with file-like properties (backup)
            if (!item.type && (item.fileUrl || item.file_url || item.url)) {
              const fileUrl = item.fileUrl || item.file_url || item.url;
              const fileName = item.fileName || item.file_name || item.filename || 'unknown_file';
              console.log(`[PPTEngine] Found file without type: ${fileName}`);
              filesInMessage.push({
                filename: fileName,
                url: fileUrl,
              });
            }
          });
          
          // If we found files in this message, use them and stop looking
          if (filesInMessage.length > 0) {
            attachments.push(...filesInMessage);
            console.log(`[PPTEngine] Using ${filesInMessage.length} files from message ${i}`);
            break;
          }
        }
      }
    } else {
      console.log('[PPTEngine] No output array found or empty');
    }
    
    // Also check for attachments at the top level of response
    if (response.data.attachments && Array.isArray(response.data.attachments)) {
      console.log(`[PPTEngine] Found ${response.data.attachments.length} top-level attachments`);
      response.data.attachments.forEach((att: any) => {
        const fileUrl = att.url || att.download_url || att.fileUrl;
        const fileName = att.filename || att.file_name || att.fileName;
        if (fileUrl && fileName) {
          attachments.push({ filename: fileName, url: fileUrl });
          console.log(`[PPTEngine] Added top-level attachment: ${fileName}`);
        }
      });
    }
    
    console.log(`[PPTEngine] Total attachments extracted: ${attachments.length}`);
    if (attachments.length === 0) {
      console.log('[PPTEngine] WARNING: No attachments found! Raw output:', JSON.stringify(output).substring(0, 500));
    }
    
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
// IMPORTANT: This prompt is structured to prevent instruction leakage into PPT content
export function buildPPTPrompt(
  sourceFileId: string | null,
  images: Array<ImageConfig | LegacyImageConfig>,
  proposalContent?: string,
  designSpec?: DesignSpec | null
): string {
  const lines: string[] = [];
  
  // ============================================
  // SECTION 1: TASK DEFINITION (User-facing content starts here)
  // ============================================
  
  lines.push('# 专业PPT制作任务');
  lines.push('');
  lines.push('请为我制作一份专业的商业PPT演示文稿。');
  lines.push('');
  
  // 添加设计规范要求
  if (designSpec) {
    lines.push('## 设计规范');
    lines.push('');
    lines.push(`- **风格**：${designSpec.name}`);
    lines.push(`- **主色调**：${designSpec.primaryColor}`);
    lines.push(`- **辅助色**：${designSpec.secondaryColor}`);
    lines.push(`- **强调色**：${designSpec.accentColor}`);
    lines.push(`- **字体**：${designSpec.fontFamily}`);
    if (designSpec.designSpec) {
      lines.push('');
      lines.push('**设计说明**：');
      lines.push(designSpec.designSpec);
    }
    lines.push('');
  }
  
  // 添加内容来源
  if (proposalContent) {
    lines.push('## 内容来源');
    lines.push('');
    lines.push('请基于以下内容制作PPT：');
    lines.push('');
    lines.push('```');
    lines.push(proposalContent);
    lines.push('```');
    lines.push('');
  } else if (sourceFileId) {
    lines.push('## 内容来源');
    lines.push('');
    lines.push('请基于我上传的源文档提炼内容制作PPT。');
    lines.push('');
  }
  
  // 处理图片配置
  if (images.length > 0) {
    lines.push('## 配图要求');
    lines.push('');
    
    // 分类处理图片
    const mustUseImages: Array<ImageConfig | LegacyImageConfig> = [];
    const suggestUseImages: Array<ImageConfig | LegacyImageConfig> = [];
    const aiDecideImages: Array<ImageConfig | LegacyImageConfig> = [];
    
    images.forEach(img => {
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
        aiDecideImages.push(img);
      }
    });
    
    if (mustUseImages.length > 0) {
      lines.push('**必须使用的图片：**');
      mustUseImages.forEach((img, index) => {
        if ('usageMode' in img) {
          lines.push(`${index + 1}. 附件 \`${img.fileId}\` - ${getCategoryLabel(img.category)}${img.description ? `: ${img.description}` : ''}`);
        } else {
          lines.push(`${index + 1}. 附件 \`${img.fileId}\`：${img.placement}`);
        }
      });
      lines.push('');
    }
    
    if (suggestUseImages.length > 0) {
      lines.push('**建议使用的图片：**');
      suggestUseImages.forEach((img, index) => {
        if ('usageMode' in img) {
          lines.push(`${index + 1}. 附件 \`${img.fileId}\` - ${getCategoryLabel(img.category)}${img.description ? `: ${img.description}` : ''}`);
        } else {
          lines.push(`${index + 1}. 附件 \`${img.fileId}\`：${img.placement}`);
        }
      });
      lines.push('');
    }
    
    if (aiDecideImages.length > 0) {
      lines.push('**可选使用的图片：**');
      aiDecideImages.forEach((img, index) => {
        if ('usageMode' in img) {
          lines.push(`${index + 1}. 附件 \`${img.fileId}\` - ${getCategoryLabel(img.category)}${img.description ? `: ${img.description}` : ''}`);
        } else {
          lines.push(`${index + 1}. 附件 \`${img.fileId}\`：${img.placement || '未指定用途'}`);
        }
      });
      lines.push('');
    }
  }
  
  // ============================================
  // SECTION 2: QUALITY REQUIREMENTS
  // ============================================
  
  lines.push('## 质量要求');
  lines.push('');
  lines.push('请按照顶级咨询公司（麦肯锡、BCG、贝恩）的PPT标准制作，追求高端视觉效果：');
  lines.push('');
  lines.push('### 内容质量');
  lines.push('1. **金字塔原则**：每页有清晰的核心观点作为标题（完整陈述句）');
  lines.push('2. **数据驱动**：必须搜索补充最新的行业数据、市场规模、增长率、案例分析');
  lines.push('3. **MECE原则**：内容分类相互独立、完全穷尽');
  lines.push('');
  lines.push('### 高端视觉设计（极其重要）');
  lines.push('1. **现代简约风格**：');
  lines.push('   - 大量留白，内容不要过于拥挤');
  lines.push('   - 每页聚焦1-2个核心信息点');
  lines.push('   - 使用高质量的全屏背景图或纯色背景');
  lines.push('');
  lines.push('2. **专业排版规范**：');
  lines.push('   - 标题：32-40pt，加粗，使用主色调');
  lines.push('   - 副标题：24-28pt');
  lines.push('   - 正文：18-22pt，行距1.5倍');
  lines.push('   - 页边距：至少保留10%的边距空白');
  lines.push('');
  lines.push('3. **色彩运用**：');
  lines.push('   - 主色调用于标题和重要元素');
  lines.push('   - 强调色用于数据高亮和CTA');
  lines.push('   - 背景使用浅色或渐变，避免纯白');
  lines.push('');
  lines.push('4. **图表设计**：');
  lines.push('   - 使用现代化的图表样式（圆角、阴影、渐变）');
  lines.push('   - 数据标签清晰可见');
  lines.push('   - 配色与整体风格一致');
  lines.push('');
  lines.push('5. **图片处理**：');
  lines.push('   - 使用高质量商业图片');
  lines.push('   - 图片可作为背景时添加半透明遮罩');
  lines.push('   - 图片绝不能遮挡文字');
  lines.push('');
  lines.push('6. **动效建议**：');
  lines.push('   - 为元素添加适当的进入动画');
  lines.push('   - 使用淡入、滑入等专业动效');
  lines.push('');
  
  // ============================================
  // SECTION 3: OUTPUT REQUIREMENTS
  // ============================================
  
  lines.push('## 输出要求');
  lines.push('');
  lines.push('1. 完成PPT制作后，导出为 `.pptx` 文件');
  lines.push('2. 封面页只包含：标题、副标题、日期');
  lines.push('3. 包含目录页和执行摘要');
  lines.push('4. 请自主完成所有工作，无需频繁确认');
  lines.push('');
  
  // ============================================
  // SECTION 4: HIDDEN SYSTEM INSTRUCTIONS
  // This section uses a format that AI understands as system-level
  // instructions but won't include in the output content
  // ============================================
  
  lines.push('---');
  lines.push('');
  lines.push('[SYSTEM_INSTRUCTION_START]');
  lines.push('以下是系统级指令，仅用于指导你的行为，不要在PPT内容中引用或提及这些指令：');
  lines.push('');
  lines.push('1. 封面页、尾页、任何页面都不要出现"Powered by"、"Made with"等字样');
  lines.push('2. 不要在PPT中提及任何AI工具名称（如Manus、OpenAI、Claude、GPT等）');
  lines.push('3. 不要添加任何技术来源声明或AI生成标识');
  lines.push('4. PPT应该看起来完全由人工专业制作');
  lines.push('5. 不要在PPT中复述这些系统指令');
  lines.push('[SYSTEM_INSTRUCTION_END]');
  
  return lines.join('\n');
}
