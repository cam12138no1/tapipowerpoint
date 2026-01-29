/**
 * 文件下载工具函数
 * 实现真实的文件下载，而非跳转到新页面
 */

/**
 * 下载文件到本地
 * @param url 文件URL
 * @param filename 保存的文件名
 * @param onProgress 下载进度回调
 */
export async function downloadFile(
  url: string,
  filename: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
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

    // 合并所有chunks
    const blob = new Blob(chunks);
    
    // 创建下载链接
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 清理URL对象
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
  } catch (error) {
    console.error('下载文件失败:', error);
    throw error;
  }
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
