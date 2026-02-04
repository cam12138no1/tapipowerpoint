/**
 * PPT Generation Engine Client
 * Robust API client for Manus PPT generation services
 * 
 * API Reference: https://open.manus.im/docs/quickstart
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// ============ Types ============

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
  task_title?: string;
  task_url?: string;
  share_url?: string;
}

export interface OutputContent {
  type: 'output_text' | 'output_file' | 'output_image';
  text?: string;
  fileUrl?: string;
  file_url?: string;
  fileName?: string;
  file_name?: string;
  mimeType?: string;
}

export interface OutputMessage {
  id: string;
  status: string;
  role: 'user' | 'assistant';
  type: string;
  content: OutputContent[];
}

export interface FileAttachment {
  id?: string;
  file_id?: string;
  filename?: string;
  file_name?: string;
  url?: string;
  download_url?: string;
  fileUrl?: string;
}

export interface EngineTask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'ask' | 'stopped';
  title?: string;
  output?: OutputMessage[];
  rawOutput?: any;
  attachments?: FileAttachment[];
  pptxFile?: { url: string; filename: string } | null;
  pdfFile?: { url: string; filename: string } | null;
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

export interface DesignSpec {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  designSpec?: string;
  logoUrl?: string;
}

export type ImageUsageMode = 'must_use' | 'suggest_use' | 'ai_decide';
export type ImageCategory = 'cover' | 'content' | 'chart' | 'logo' | 'background' | 'other';

export interface ImageConfig {
  fileId: string;
  usageMode?: ImageUsageMode;
  category?: ImageCategory;
  description?: string;
  placement?: string; // Legacy support
}

// ============ Error Classes ============

export class PPTEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'PPTEngineError';
  }
}

// ============ Utility Functions ============

function extractFileUrl(item: any): string | null {
  return item.fileUrl || item.file_url || item.url || item.download_url || null;
}

function extractFileName(item: any): string | null {
  return item.fileName || item.file_name || item.filename || item.name || null;
}

function isPptxFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pptx');
}

function isPdfFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf');
}

// ============ PPT Engine Client ============

class PPTEngineClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.PPT_ENGINE_API_KEY || '';
    const baseURL = process.env.PPT_ENGINE_API_URL || 'https://api.manus.ai/v1';

    if (!this.apiKey) {
      console.warn('[PPTEngine] API key is not configured. API calls will fail.');
    }

    this.client = axios.create({
      baseURL,
      timeout: 120000, // 2 minutes timeout
      headers: {
        'API_KEY': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add response interceptor for better error handling
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        const status = error.response?.status;
        const message = this.extractErrorMessage(error);
        
        // Determine if error is retryable
        const retryable = status === 429 || status === 502 || status === 503 || status === 504 || error.code === 'ECONNRESET';
        
        throw new PPTEngineError(message, error.code || 'UNKNOWN', status, retryable);
      }
    );
  }

  private extractErrorMessage(error: AxiosError): string {
    if (error.response?.data) {
      const data = error.response.data as any;
      return data.message || data.error || JSON.stringify(data);
    }
    return error.message || 'Unknown API error';
  }

  // ============ Projects API ============

  async createProject(data: CreateProjectRequest): Promise<EngineProject> {
    const response = await this.client.post('/projects', data);
    return response.data;
  }

  async getProject(projectId: string): Promise<EngineProject> {
    const response = await this.client.get(`/projects/${projectId}`);
    return response.data;
  }

  // ============ Files API ============

  async createFileUpload(fileName: string): Promise<EngineFileUpload> {
    const response = await this.client.post('/files', { filename: fileName });
    return {
      file_id: response.data.id,
      upload_url: response.data.upload_url,
    };
  }

  async uploadFileToUrl(uploadUrl: string, file: Buffer, contentType: string): Promise<void> {
    const fileSizeMB = file.length / (1024 * 1024);
    const timeout = Math.max(120000, 60000 + fileSizeMB * 30000);
    
    console.log(`[PPTEngine] Uploading file, size: ${fileSizeMB.toFixed(2)}MB, timeout: ${timeout/1000}s`);
    
    await axios.put(uploadUrl, file, {
      headers: { 'Content-Type': contentType },
      timeout,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    
    console.log('[PPTEngine] File upload completed');
  }

  async uploadFile(fileName: string, fileBuffer: Buffer, contentType: string): Promise<string> {
    const { file_id, upload_url } = await this.createFileUpload(fileName);
    await this.uploadFileToUrl(upload_url, fileBuffer, contentType);
    return file_id;
  }

  // ============ Tasks API ============

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
    console.log('[PPTEngine] Task created:', response.data.task_id);
    
    return response.data;
  }

  async getTask(taskId: string): Promise<EngineTask> {
    const response = await this.client.get(`/tasks/${taskId}`);
    const data = response.data;
    
    console.log(`[PPTEngine] Task ${taskId} status: ${data.status}`);
    
    // Extract files from all possible locations
    const files = this.extractFilesFromResponse(data);
    
    return {
      id: data.id || taskId,
      status: data.status,
      title: data.metadata?.task_title || data.title,
      output: Array.isArray(data.output) ? data.output : undefined,
      rawOutput: data.output,
      attachments: files.attachments,
      pptxFile: files.pptxFile,
      pdfFile: files.pdfFile,
      share_url: data.metadata?.task_url || data.share_url,
      task_url: data.metadata?.task_url,
      created_at: data.created_at,
      updated_at: data.updated_at,
      metadata: data.metadata,
    };
  }

  /**
   * Extract PPTX and PDF files from API response
   * This handles all the various formats the API might return
   */
  private extractFilesFromResponse(data: any): {
    attachments: FileAttachment[];
    pptxFile: { url: string; filename: string } | null;
    pdfFile: { url: string; filename: string } | null;
  } {
    const attachments: FileAttachment[] = [];
    let pptxFile: { url: string; filename: string } | null = null;
    let pdfFile: { url: string; filename: string } | null = null;

    // Method 1: Check top-level attachments
    if (Array.isArray(data.attachments)) {
      for (const att of data.attachments) {
        const url = extractFileUrl(att);
        const filename = extractFileName(att);
        if (url && filename) {
          attachments.push({ filename, url });
          if (isPptxFile(filename) && !pptxFile) {
            pptxFile = { url, filename };
          }
          if (isPdfFile(filename) && !pdfFile) {
            pdfFile = { url, filename };
          }
        }
      }
    }

    // Method 2: Search in output messages (reverse order for latest first)
    if (Array.isArray(data.output)) {
      for (let i = data.output.length - 1; i >= 0; i--) {
        const msg = data.output[i];
        if (msg.role !== 'assistant' || !Array.isArray(msg.content)) continue;

        for (const item of msg.content) {
          if (item.type === 'output_file') {
            const url = extractFileUrl(item);
            const filename = extractFileName(item);
            if (url && filename) {
              attachments.push({ filename, url });
              if (isPptxFile(filename) && !pptxFile) {
                pptxFile = { url, filename };
                console.log(`[PPTEngine] Found PPTX in output: ${filename}`);
              }
              if (isPdfFile(filename) && !pdfFile) {
                pdfFile = { url, filename };
                console.log(`[PPTEngine] Found PDF in output: ${filename}`);
              }
            }
          }
        }
        
        // Stop searching once we found files
        if (pptxFile) break;
      }
    }

    // Method 3: Search raw output string for URLs (last resort)
    if (!pptxFile && data.output) {
      const rawStr = JSON.stringify(data.output);
      
      // Look for PPTX URLs
      const pptxMatch = rawStr.match(/(https?:\/\/[^"\s]+\.pptx[^"\s]*)/i);
      if (pptxMatch) {
        console.log('[PPTEngine] Found PPTX URL in raw output');
        pptxFile = { url: pptxMatch[1], filename: 'presentation.pptx' };
      }
      
      // Look for PDF URLs
      if (!pdfFile) {
        const pdfMatch = rawStr.match(/(https?:\/\/[^"\s]+\.pdf[^"\s]*)/i);
        if (pdfMatch) {
          console.log('[PPTEngine] Found PDF URL in raw output');
          pdfFile = { url: pdfMatch[1], filename: 'presentation.pdf' };
        }
      }
    }

    return { attachments, pptxFile, pdfFile };
  }

  async continueTask(taskId: string, userInput: string): Promise<EngineTaskCreateResponse> {
    const response = await this.client.post('/tasks', {
      prompt: userInput,
      task_id: taskId,
    });
    return response.data;
  }
}

// ============ Singleton Export ============

export const pptEngine = new PPTEngineClient();
export { PPTEngineClient };

// ============ Helper Functions ============

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

/**
 * Build PPT generation prompt
 * Optimized for autonomous execution
 */
export function buildPPTPrompt(
  sourceFileId: string | null,
  images: ImageConfig[],
  proposalContent?: string,
  designSpec?: DesignSpec | null
): string {
  const lines: string[] = [];
  
  lines.push('# 专业PPT制作任务');
  lines.push('');
  lines.push('请为我制作一份专业的商业PPT演示文稿。');
  lines.push('');
  
  // Design specifications
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
  
  // Content source
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
  
  // Image handling
  if (images.length > 0) {
    lines.push('## 配图要求');
    lines.push('');
    
    const mustUse = images.filter(img => img.usageMode === 'must_use');
    const suggest = images.filter(img => img.usageMode === 'suggest_use');
    const optional = images.filter(img => !img.usageMode || img.usageMode === 'ai_decide');
    
    if (mustUse.length > 0) {
      lines.push('**必须使用的图片：**');
      mustUse.forEach((img, i) => {
        const cat = img.category ? getCategoryLabel(img.category) : '';
        const desc = img.description ? `: ${img.description}` : '';
        lines.push(`${i + 1}. 附件 \`${img.fileId}\` - ${cat}${desc}`);
      });
      lines.push('');
    }
    
    if (suggest.length > 0) {
      lines.push('**建议使用的图片：**');
      suggest.forEach((img, i) => {
        const cat = img.category ? getCategoryLabel(img.category) : '';
        const desc = img.description ? `: ${img.description}` : '';
        lines.push(`${i + 1}. 附件 \`${img.fileId}\` - ${cat}${desc}`);
      });
      lines.push('');
    }
    
    if (optional.length > 0) {
      lines.push('**可选使用的图片：**');
      optional.forEach((img, i) => {
        const cat = img.category ? getCategoryLabel(img.category) : '';
        const desc = img.description || img.placement || '未指定用途';
        lines.push(`${i + 1}. 附件 \`${img.fileId}\` - ${cat}: ${desc}`);
      });
      lines.push('');
    }
  }
  
  // Quality requirements
  lines.push('## 质量要求');
  lines.push('');
  lines.push('请按照顶级咨询公司（麦肯锡、BCG、贝恩）的PPT标准制作：');
  lines.push('');
  lines.push('1. **金字塔原则**：每页有清晰的核心观点');
  lines.push('2. **数据驱动**：补充最新的行业数据和案例');
  lines.push('3. **现代简约**：大量留白，每页聚焦1-2个核心信息');
  lines.push('4. **专业排版**：标题32-40pt，正文18-22pt');
  lines.push('5. **高质量图片**：使用商业图片，图片不遮挡文字');
  lines.push('');
  
  // Output requirements
  lines.push('## 输出要求');
  lines.push('');
  lines.push('1. 完成后导出为 `.pptx` 文件');
  lines.push('2. 包含封面、目录、执行摘要');
  lines.push('3. 请自主完成所有工作，无需频繁确认');
  lines.push('4. 封面只包含：标题、副标题、日期');
  lines.push('');
  
  return lines.join('\n');
}
