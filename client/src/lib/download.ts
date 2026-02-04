/**
 * 文件下载工具函数
 * 实现真实的文件下载，支持进度显示、错误重试和代理下载
 */

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * 下载文件到本地
 * 首先尝试直接下载，失败后使用服务器代理
 * @param url 文件URL
 * @param filename 保存的文件名
 * @param onProgress 下载进度回调
 */
export async function downloadFile(
  url: string,
  filename: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  // 策略1: 直接下载
  try {
    await directDownload(url, filename, onProgress);
    return;
  } catch (directError: any) {
    console.warn('直接下载失败，尝试代理下载:', directError.message);
  }
  
  // 策略2: 使用服务器代理下载（解决CORS问题）
  try {
    await proxyDownload(url, filename, onProgress);
    return;
  } catch (proxyError: any) {
    console.warn('代理下载也失败:', proxyError.message);
  }
  
  // 策略3: 直接打开链接（最后备用方案）
  console.log('使用备用方案：直接打开链接');
  window.open(url, '_blank');
  throw new Error('自动下载失败，已在新窗口打开链接');
}

/**
 * 直接下载（无代理）
 */
async function directDownload(
  url: string,
  filename: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应体');
      }

      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        received += value.length;
        
        if (onProgress && total > 0) {
          onProgress(Math.round((received / total) * 100));
        }
      }

      if (received === 0) {
        throw new Error('下载的文件为空');
      }

      const blob = new Blob(chunks);
      triggerDownload(blob, filename);
      return;
      
    } catch (error: any) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      await new Promise(r => setTimeout(r, RETRY_DELAY * attempt));
    }
  }
}

/**
 * 通过服务器代理下载（解决CORS问题）
 */
async function proxyDownload(
  url: string,
  filename: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
  
  const response = await fetch(proxyUrl);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `代理下载失败: ${response.status}`);
  }
  
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法读取响应体');
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    chunks.push(value);
    received += value.length;
    
    if (onProgress && total > 0) {
      onProgress(Math.round((received / total) * 100));
    }
  }

  if (received === 0) {
    throw new Error('下载的文件为空');
  }

  const blob = new Blob(chunks);
  triggerDownload(blob, filename);
}

/**
 * 触发浏览器下载
 */
function triggerDownload(blob: Blob, filename: string): void {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // 延迟清理URL对象
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

/**
 * 简单下载 - 直接打开链接（备用方案）
 */
export function simpleDownload(url: string, filename?: string): void {
  const link = document.createElement('a');
  link.href = url;
  if (filename) {
    link.download = filename;
  }
  link.target = '_blank';
  link.click();
}

/**
 * 批量下载多个文件
 */
export async function downloadMultipleFiles(
  files: Array<{ url: string; filename: string }>
): Promise<void> {
  for (const file of files) {
    await downloadFile(file.url, file.filename);
    // 稍微延迟，避免浏览器阻止多个下载
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * 从URL中提取文件扩展名
 */
export function getFileExtension(url: string): string {
  const pathname = new URL(url).pathname;
  const lastDot = pathname.lastIndexOf('.');
  if (lastDot === -1) return '';
  return pathname.substring(lastDot);
}

/**
 * 确保文件名有正确的扩展名
 */
export function ensureFileExtension(filename: string, url: string): string {
  const urlExt = getFileExtension(url);
  if (!filename.includes('.') && urlExt) {
    return filename + urlExt;
  }
  return filename;
}
