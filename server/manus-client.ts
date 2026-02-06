import axios, { AxiosInstance } from 'axios';
import { ENV } from './_core/env';
import { BRAND_PURITY_RULES } from './ppt-engine';

// Manus API types
export interface ManusProject {
  id: string;
  name: string;
  instruction: string;
  created_at: string;
}

export interface ManusFileUpload {
  file_id: string;
  upload_url: string;
}

export interface ManusTaskCreateResponse {
  task_id: string;
  task_title: string;
  task_url: string;
  share_url?: string;
}

export interface ManusTask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'ask' | 'stopped';
  title?: string;
  output?: {
    content?: string;
    attachments?: Array<{
      id?: string;
      file_id?: string;
      filename?: string;
      file_name?: string;
      url?: string;
      download_url?: string;
    }>;
  };
  share_url?: string;
  task_url?: string;
  created_at?: string;
  updated_at?: string;
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

class ManusClient {
  private client: AxiosInstance;

  constructor() {
    // Use environment variables for API configuration
    const apiKey = process.env.MANUS_API_KEY;
    const baseURL = process.env.MANUS_API_BASE_URL || 'https://api.manus.ai/v1';

    if (!apiKey) {
      console.warn('[ManusClient] MANUS_API_KEY is not set. API calls will fail.');
    }

    this.client = axios.create({
      baseURL,
      headers: {
        'API_KEY': apiKey || '',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  // Projects API
  async createProject(data: CreateProjectRequest): Promise<ManusProject> {
    const response = await this.client.post('/projects', data);
    return response.data;
  }

  async getProject(projectId: string): Promise<ManusProject> {
    const response = await this.client.get(`/projects/${projectId}`);
    return response.data;
  }

  // Files API
  async createFileUpload(fileName: string): Promise<ManusFileUpload> {
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
  async createTask(data: CreateTaskRequest): Promise<ManusTaskCreateResponse> {
    const requestBody = {
      prompt: data.prompt,
      agentProfile: data.agentProfile || 'manus-1.6-max',
      taskMode: data.taskMode || 'agent',
      projectId: data.projectId,
      attachments: data.attachments,
      createShareableLink: data.createShareableLink ?? true,
      interactiveMode: data.interactiveMode ?? true,
    };
    
    console.log('[ManusClient] Creating task with body:', JSON.stringify(requestBody, null, 2));
    
    const response = await this.client.post('/tasks', requestBody);
    console.log('[ManusClient] Task created:', JSON.stringify(response.data, null, 2));
    return response.data;
  }

  async getTask(taskId: string): Promise<ManusTask> {
    const response = await this.client.get(`/tasks/${taskId}`);
    console.log('[ManusClient] Get task status:', response.data.status);
    return {
      id: response.data.id || taskId,
      status: response.data.status,
      title: response.data.title,
      output: response.data.output,
      share_url: response.data.share_url,
      task_url: response.data.task_url,
      created_at: response.data.created_at,
      updated_at: response.data.updated_at,
    };
  }

  async continueTask(taskId: string, userInput: string): Promise<ManusTaskCreateResponse> {
    const response = await this.client.post('/tasks', {
      prompt: userInput,
      taskId: taskId,
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
export const manusClient = new ManusClient();

// Export class for testing
export { ManusClient };

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

// Build PPT generation prompt
export function buildPPTPrompt(
  sourceFileId: string | null,
  images: Array<{ fileId: string; placement: string }>
): string {
  const lines = [
    BRAND_PURITY_RULES,
    '',
    '请根据我提供的资料和要求，制作一份专业的行业PPT。',
    '',
    '**任务要求**：',
    '',
    '1. **严格遵循项目指令**：你必须严格遵守本项目关联的PPT设计规范。',
    '',
    '2. **内容生成**：基于我提供的源文档，提炼核心内容，并将其组织成逻辑清晰的PPT页面结构。',
  ];

  if (images.length > 0) {
    lines.push('');
    lines.push('3. **智能配图**：');
    lines.push('   a. **优先使用指定图片**：我为部分页面指定了配图，请按要求使用：');
    images.forEach(({ fileId, placement }) => {
      lines.push(`      - ${placement}：使用附件 \`${fileId}\``);
    });
    lines.push('   b. **资料内部查找**：对于未指定配图的页面，请首先在源文档中寻找是否有相关的图表或图片可以使用。');
    lines.push('   c. **网络搜索补充**：如果资料中也无可用图片，请根据该页面的内容主题，在网络上搜索一张高质量、风格匹配、无版权风险的商业图片。');
    lines.push('   d. **图片审查**：对于所有从网络搜索到的图片，**必须在最终定稿前，通过向我提问（ask）的方式，将图片展示给我进行确认。** 只有在我确认后，才能将图片放入PPT。');
  } else {
    lines.push('');
    lines.push('3. **智能配图**：');
    lines.push('   a. 请首先在源文档中寻找是否有相关的图表或图片可以使用。');
    lines.push('   b. 如果资料中无可用图片，请根据页面内容主题，在网络上搜索高质量、风格匹配的商业图片。');
    lines.push('   c. 对于网络搜索到的图片，请通过提问方式让我确认后再使用。');
  }

  lines.push('');
  lines.push('4. **最终交付**：完成所有内容的撰写和配图后，将整个PPT打包成一个可下载的 `.pptx` 文件作为最终交付物。');
  lines.push('');
  lines.push('5. **⛔ 品牌纯净（再次强调）**：在导出PPTX之前，请逐页检查，确保没有任何邮箱地址、网站URL、"Powered by"、"Made by"、作者署名、AI工具名称或任何第三方标识。结尾页只允许简单感谢语，不得有任何联系信息。违反此规则的交付物将被完全拒绝。');

  return lines.join('\n');
}
