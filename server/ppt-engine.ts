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
    const attachments: EngineTask['attachments'] = [];
    if (Array.isArray(output)) {
      output.forEach((msg: OutputMessage) => {
        if (msg.content && Array.isArray(msg.content)) {
          msg.content.forEach((item: OutputContent) => {
            if (item.fileUrl && item.fileName) {
              attachments.push({
                filename: item.fileName,
                url: item.fileUrl,
              });
            }
          });
        }
      });
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

// Build PPT generation prompt - optimized for autonomous execution
export function buildPPTPrompt(
  sourceFileId: string | null,
  images: Array<{ fileId: string; placement: string }>,
  proposalContent?: string
): string {
  const lines = [
    '请根据我提供的资料和要求，制作一份专业的行业PPT。',
    '',
    '**重要执行原则**：',
    '- **自主决策**：请尽可能自主完成所有工作，不要频繁询问用户确认。',
    '- **高效执行**：遇到需要选择的情况时，请根据专业判断直接做出最优决策。',
    '- **仅在必要时询问**：只有在遇到无法自行判断的关键问题时才向用户提问。',
    '',
    '**任务要求**：',
    '',
    '1. **严格遵循项目指令**：你必须严格遵守本项目关联的PPT设计规范。',
    '',
  ];

  // 根据输入模式添加不同的内容生成指令
  if (proposalContent) {
    lines.push('2. **内容生成**：');
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
    lines.push('2. **内容生成**：');
    lines.push('   - 基于我提供的源文档，提炼核心内容');
    lines.push('   - 将内容组织成逻辑清晰的PPT页面结构');
    lines.push('   - 如有需要，可自动搜索补充相关数据和信息');
  } else {
    lines.push('2. **内容生成**：请根据项目设计规范和配图信息，生成一份专业的PPT。');
  }

  if (images.length > 0) {
    lines.push('');
    lines.push('3. **智能配图**（自动执行，无需确认）：');
    lines.push('   a. **优先使用指定图片**：我为部分页面指定了配图，请按要求使用：');
    images.forEach(({ fileId, placement }) => {
      lines.push(`      - ${placement}：使用附件 \`${fileId}\``);
    });
    lines.push('   b. **资料内部查找**：对于未指定配图的页面，请首先在源文档中寻找相关图表或图片。');
    lines.push('   c. **网络搜索补充**：如果资料中无可用图片，请自动搜索高质量、风格匹配的商业图片并直接使用。');
    lines.push('   d. **自主选择**：请根据专业判断直接选择最合适的图片，无需向用户确认。');
  } else {
    lines.push('');
    lines.push('3. **智能配图**（自动执行，无需确认）：');
    lines.push('   a. 请首先在源文档中寻找相关图表或图片。');
    lines.push('   b. 如果资料中无可用图片，请自动搜索高质量、风格匹配的商业图片。');
    lines.push('   c. 请根据专业判断直接选择最合适的图片，无需向用户确认。');
  }

  lines.push('');
  lines.push('4. **数据与信息补充**：');
  lines.push('   - 如果Proposal或文档中的数据不够完整，请自动搜索最新的行业数据进行补充');
  lines.push('   - 可以添加相关的市场趋势、统计数据、案例分析等内容');
  lines.push('   - 确保PPT内容专业、充实、有说服力');

  lines.push('');
  lines.push('5. **最终交付**：完成所有内容的撰写和配图后，将整个PPT打包成一个可下载的 `.pptx` 文件作为最终交付物。');
  
  lines.push('');
  lines.push('6. **品牌要求**：严禁在PPT中出现任何第三方平台的品牌标识、水印或广告信息。');

  lines.push('');
  lines.push('**再次强调**：请尽可能自主完成所有工作，只有在遇到真正无法判断的关键问题时才向用户提问。');

  return lines.join('\n');
}
