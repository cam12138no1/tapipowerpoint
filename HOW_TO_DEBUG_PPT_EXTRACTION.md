# PPT 文件提取问题调试指南

如果您遇到"未找到 PPT 文件"错误，请按照此指南进行诊断和解决。

---

## 🔍 快速诊断

### 步骤 1: 查看服务器日志

```bash
# 查看最近的任务日志
tail -f logs/server.log | grep -E "(PPTEngine|Task.*completed)"

# 或者查看特定任务
grep "Task 123" logs/server.log
```

**期望看到的成功日志**:
```
[PPTEngine] Extracting files from response...
[PPTEngine] Method 1: Checking 1 top-level attachments
[PPTEngine] ✓ Found PPTX in top-level: presentation.pptx
[Task 123] Found PPTX file: presentation.pptx
[Task 123] Successfully downloaded PPTX, size: 2.34MB
[Task 123] Stored to S3: https://s3.amazonaws.com/...
[Task 123] ✓ SUCCESS! PPTX URL: https://...
```

**失败时的日志**:
```
[PPTEngine] Extracting files from response...
[PPTEngine] Method 1: Checking 0 top-level attachments
[PPTEngine] Method 2: Searching in 5 output messages
[PPTEngine] ERROR: No PPTX file found in response
[PPTEngine] Response keys: ['id', 'status', 'output', 'metadata']
[Task 123] ⚠️ No PPTX found, retry 1/10
```

---

## 🛠️ 详细诊断步骤

### 步骤 2: 检查 API 响应结构

从日志中找到 `Raw engine task data`:

```json
{
  "id": "task_abc123",
  "status": "completed",
  "pptxFile": null,
  "attachmentsCount": 0,
  "outputType": "array",
  "outputLength": 5
}
```

**分析**:
- `pptxFile: null` → 第一层提取失败
- `attachmentsCount: 0` → 没有顶层附件
- `outputLength: 5` → 有 5 条输出消息，需要检查

### 步骤 3: 手动获取任务详情

```bash
# 从日志中获取 engineTaskId
ENGINE_TASK_ID="从日志中找到的 task_id"

# 调用 Manus API
curl -H "API_KEY: $PPT_ENGINE_API_KEY" \
     https://api.manus.ai/v1/tasks/$ENGINE_TASK_ID \
     > task_response.json

# 格式化查看
cat task_response.json | jq .
```

### 步骤 4: 检查文件位置

在 `task_response.json` 中查找文件：

**位置 1: 顶层 attachments**
```json
{
  "attachments": [
    {
      "id": "file_123",
      "filename": "presentation.pptx",
      "url": "https://storage.manus.ai/..."
    }
  ]
}
```

**位置 2: output messages**
```json
{
  "output": [
    {
      "role": "assistant",
      "content": [
        {
          "type": "output_file",
          "file_name": "presentation.pptx",
          "file_url": "https://storage.manus.ai/..."
        }
      ]
    }
  ]
}
```

**位置 3: 根层 files** (新增支持)
```json
{
  "files": [
    {
      "filename": "presentation.pptx",
      "url": "https://storage.manus.ai/..."
    }
  ]
}
```

**位置 4: URL 字符串**
```json
{
  "output": "... https://storage.manus.ai/files/abc.pptx ..."
}
```

---

## 🔧 常见问题解决

### 问题 A: API 返回新格式

**症状**: 日志显示 `ERROR: No PPTX file found`，但 API 确实有文件

**原因**: Manus API 添加了新的响应格式

**解决**: 更新 `server/ppt-engine.ts` 中的 `extractFilesFromResponse`

**示例**:
```typescript
// 如果文件在 data.results.files
if (!pptxFile && data.results?.files) {
  for (const file of data.results.files) {
    const url = extractFileUrl(file);
    const filename = extractFileName(file);
    if (url && filename && isPptxFile(filename)) {
      pptxFile = { url, filename };
      console.log(`[PPTEngine] ✓ Found PPTX in results: ${filename}`);
      break;
    }
  }
}
```

### 问题 B: 文件下载失败

**症状**: 找到了文件 URL，但下载失败

**日志**:
```
[Task 123] Found PPTX file: presentation.pptx
[FileOps] Attempt 1/3
[FileOps] Attempt 1/3 failed: HTTP 403
[FileOps] Attempt 2/3
[FileOps] Attempt 2/3 failed: HTTP 403
```

**原因**: 
1. URL 已过期（签名 URL 有效期）
2. 没有访问权限
3. 网络问题

**解决**:
```typescript
// 使用直接 URL 而不下载
if (!buffer) {
  console.warn(`[Task ${taskId}] Using direct URL`);
  resultPptxUrl = engineTask.pptxFile.url;
}
```

### 问题 C: 重试次数耗尽

**症状**: 任务标记为失败，重试 10/10

**原因**: 
1. API 格式确实改变了
2. 文件在不支持的位置
3. API 没有返回文件

**解决**:

1. **检查 share_url**:
```javascript
// 从错误信息中的 interactionData 获取
const errorData = JSON.parse(task.interactionData);
console.log('Share URL:', errorData.shareUrl);
```

2. **手动访问**:
- 打开 share_url 在浏览器
- 手动下载 PPTX
- 报告给技术团队

3. **联系支持**:
- 提供 task ID
- 提供 share_url
- 附上错误日志

---

## 🔬 高级调试

### 启用详细日志

```bash
# 设置日志级别
export LOG_LEVEL=debug

# 启动服务器
npm run dev
```

### 添加临时调试代码

```typescript
// 在 server/ppt-engine.ts extractFilesFromResponse 中
private extractFilesFromResponse(data: any) {
  // 输出完整响应（小心敏感信息！）
  console.log('[DEBUG] Full API response:', JSON.stringify(data, null, 2));
  
  // ... 现有逻辑 ...
}
```

### 使用 API 调试工具

**Postman 测试**:
```
GET https://api.manus.ai/v1/tasks/{{TASK_ID}}
Headers:
  API_KEY: {{YOUR_API_KEY}}
```

**curl 测试**:
```bash
curl -v \
  -H "API_KEY: $PPT_ENGINE_API_KEY" \
  https://api.manus.ai/v1/tasks/$TASK_ID \
  2>&1 | tee api_response.log
```

---

## 📊 统计和监控

### 成功率监控

```sql
-- 最近 24 小时的任务成功率
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM ppt_tasks
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

**期望结果**:
- completed: 85-95%
- failed: 5-10%
- running: <5%

### 失败原因分析

```sql
-- 失败原因统计
SELECT 
  error_message,
  COUNT(*) as count
FROM ppt_tasks
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY error_message
ORDER BY count DESC;
```

---

## 🚑 紧急修复

### 如果大量任务失败

1. **立即回滚** (如果是新部署导致)
```bash
git revert HEAD
npm run build
pm2 restart all
```

2. **检查 API 状态**
```bash
curl https://api.manus.ai/v1/health
```

3. **检查配置**
```bash
echo $PPT_ENGINE_API_KEY | wc -c  # 应该 > 20
echo $JWT_SECRET | wc -c  # 应该 >= 32
```

4. **联系 Manus 支持**
- 报告 API 格式变化
- 请求响应格式文档
- 获取 schema 更新

---

## 📝 反馈收集

如果您遇到问题，请提供：

1. **任务 ID**: `task.id` (数据库 ID)
2. **Engine Task ID**: `task.engineTaskId` 
3. **Share URL**: 从错误信息中获取
4. **相关日志**: 
   ```bash
   grep "Task $TASK_ID" logs/server.log > task_debug.log
   ```
5. **API 响应**: 
   ```bash
   curl -H "API_KEY: $KEY" \
        https://api.manus.ai/v1/tasks/$ENGINE_TASK_ID \
        > api_response.json
   ```

**提交问题**: 
- GitHub Issues
- 或发送到技术支持邮箱
- 附上上述所有信息

---

## ✨ 改进历史

### v1.1.0 (2026-02-05)
- ✅ 增强文件提取逻辑（5 种方法）
- ✅ 添加详细调试日志
- ✅ 改进错误消息
- ✅ 提供 share_url 后备方案

### v1.0.0 (初始版本)
- 基础文件提取
- 简单错误处理

---

**文档维护者**: AI Code Reviewer  
**最后更新**: 2026-02-05  
**反馈**: 如有改进建议，欢迎提交 PR
