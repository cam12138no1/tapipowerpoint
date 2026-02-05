# 🚀 Render 部署指南

**适用于**: Render.com 托管环境  
**版本**: v1.1.0  
**预计时间**: 10 分钟

---

## ⚡ 快速部署（3 步）

### 步骤 1: 推送代码

```bash
# 在本地项目目录
git add .
git commit -m "fix: 修复PPT文件提取和安全问题 v1.1.0

- 增强 PPT 文件提取（5 种方法）
- 移除 share_url 暴露（保护产品体验）
- JWT Secret 强制验证
- 文件上传安全验证
- 创建密码库（未来使用）
- 新增 54 个单元测试"

git push origin master
```

Render 会自动检测到推送并开始部署 🎉

### 步骤 2: 配置 JWT_SECRET

1. 打开 **Render Dashboard**
2. 选择您的服务
3. 进入 **Environment** 标签
4. 点击 **Add Environment Variable**
5. 添加:
   ```
   Key: JWT_SECRET
   Value: [点击 Generate 按钮]
   ```
6. 点击 **Save Changes**

**重要**: 确保生成的值长度 ≥ 32 字符！

### 步骤 3: 等待部署完成

- Render 会自动重新构建和部署
- 查看 **Logs** 标签监控进度
- 看到 "Server started" 表示成功

**验证**:
```bash
curl https://your-app.onrender.com/health
# 预期: {"status":"healthy","timestamp":"2026-02-05T..."}
```

完成！🎊

---

## 📋 详细部署步骤

### 前置检查

#### 1. 本地测试

```bash
# 运行所有测试
npm test

# 预期结果
# ✓ 234 tests passed
# ✓ No lint errors
```

#### 2. 构建验证

```bash
# 本地构建测试
npm run build

# 检查产物
ls -lh dist/
# 应该看到:
# - index.js (服务器)
# - client/ (前端静态文件)
```

---

### 部署流程

#### 阶段 1: 代码推送

```bash
# 查看改动
git status
git diff

# 提交
git add .
git commit -m "fix: v1.1.0 安全和功能修复"

# 推送（触发 Render 部署）
git push origin master
```

#### 阶段 2: Render 自动部署

**Render 会自动执行**:
1. 检测到 git push
2. 拉取最新代码
3. 运行 `npm install`（安装 bcrypt 等新依赖）
4. 运行 `npm run build`
5. 启动新版本
6. 健康检查通过后切换流量

**监控进度**:
- Dashboard → **Logs** 标签
- 实时查看构建和启动日志

**预期日志**:
```
==> Cloning from https://github.com/...
==> Running 'npm install'
==> Installing bcrypt...
==> Running 'npm run build'
==> Build successful
==> Starting service
==> Server started on port 3000
```

#### 阶段 3: 环境变量配置

**必需变量**（如果还没设置）:

| 变量名 | 值 | 说明 |
|--------|---|------|
| `NODE_ENV` | `production` | 生产环境标识 |
| `JWT_SECRET` | [Generate] | ≥32 字符（**新增**） |
| `DATABASE_URL` | 自动设置 | Render Postgres |
| `PPT_ENGINE_API_KEY` | 您的 key | Manus API |
| `AWS_ACCESS_KEY_ID` | 您的 key | S3 存储 |
| `AWS_SECRET_ACCESS_KEY` | 您的 secret | S3 存储 |
| `AWS_REGION` | `us-east-1` | S3 区域 |
| `S3_BUCKET` | 您的 bucket | S3 存储桶 |

**可选变量**:

| 变量名 | 默认值 | 说明 |
|--------|-------|------|
| `MAX_FILE_SIZE_MB` | `50` | 文件大小限制 |
| `COOKIE_SECRET` | 使用 JWT_SECRET | Cookie 加密 |

**配置方法**:
1. Dashboard → Environment
2. 每个变量点击 **Add Environment Variable**
3. 填写 Key 和 Value
4. 点击 **Save Changes**

**生成安全的 JWT_SECRET**:
```bash
# 方式 1: 使用 Render 的 Generate 按钮
# 点击 Value 输入框旁边的 Generate 按钮

# 方式 2: 本地生成后复制
openssl rand -base64 32
# 复制输出结果粘贴到 Render
```

---

## ✅ 部署验证

### 1. 健康检查

```bash
curl https://your-app.onrender.com/health
```

**预期响应**:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T03:20:00.000Z",
  "version": "1.0.0"
}
```

### 2. 认证测试

```bash
# 测试登录
curl -X POST https://your-app.onrender.com/api/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser"}' | jq .
```

**预期响应**:
```json
{
  "result": {
    "data": {
      "success": true,
      "user": {
        "id": 1,
        "name": "testuser",
        "openId": "user_testuser",
        "role": "user"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresAt": "2026-02-12T03:20:00.000Z"
    }
  }
}
```

### 3. PPT 生成测试

**在浏览器中**:
1. 访问 https://your-app.onrender.com
2. 登录系统
3. 创建一个测试任务
4. 等待完成（约 2-3 分钟）
5. 验证可以下载 PPTX

**在 Render Logs 中观察**:
```
[PPTEngine] Extracting files from response...
[PPTEngine] ✓ Found PPTX in output: presentation.pptx
[Task 123] ✓ SUCCESS! PPTX URL: https://...
```

### 4. 验证 share_url 不暴露

**检查前端**:
- 打开浏览器开发者工具 (F12)
- Network 标签
- 查看 API 响应
- 搜索 "manus.ai" 或 "share"
- **应该找不到任何 Manus 相关 URL** ✅

**检查错误消息**:
- 故意让一个任务失败
- 查看错误提示
- **不应该包含任何 app.manus.ai 链接** ✅

---

## 🔧 Render 特定配置

### 构建配置

**确认 `package.json` 包含正确的构建命令**:
```json
{
  "scripts": {
    "build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js"
  }
}
```

### 启动命令

**Render Dashboard** → **Settings**:

- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### 健康检查

**Render Dashboard** → **Settings** → **Health Check**:

- **Health Check Path**: `/health`
- **Expected Status**: `200`

---

## 🐛 常见问题

### 问题 1: 构建失败 - bcrypt 安装错误

**症状**:
```
gyp ERR! build error
Error: `make` failed with exit code: 2
```

**原因**: bcrypt 需要编译原生模块

**解决**: Render 通常会自动处理，如果失败：

1. 检查 Node 版本（应该是 18 或 20）
2. 在 Dashboard → Settings 中设置:
   ```
   Node Version: 20.x
   ```

### 问题 2: JWT_SECRET 错误

**症状**: 启动日志显示
```
Error: JWT_SECRET environment variable must be set in production
```

**解决**:
1. Dashboard → Environment
2. 添加 `JWT_SECRET` 变量
3. 使用 Generate 按钮生成值
4. Save Changes
5. Render 会自动重启

### 问题 3: 数据库连接失败

**症状**:
```
Error: connect ECONNREFUSED
```

**检查**:
1. Dashboard → Database
2. 确认数据库正在运行
3. 确认 `DATABASE_URL` 环境变量已设置
4. Render 会自动设置内部数据库连接

### 问题 4: PPT 生成仍然失败

**首先查看日志**:
```
Dashboard → Logs → 搜索 "PPTEngine"
```

**如果看到**:
```
[PPTEngine] ERROR: No PPTX file found
[PPTEngine] Response keys: [...]
```

**行动**:
1. 复制完整的日志（包括 `Response keys` 和 `Output type`）
2. 记录失败任务的 ID
3. 联系技术支持并提供日志
4. 技术支持会更新文件提取逻辑

**临时解决** (作为产品负责人):
- 告诉用户点击重试
- 系统会自动重试 10 次
- 大多数情况下重试会成功

---

## 📊 监控建议

### Render Dashboard 监控

1. **Metrics 标签**:
   - CPU 使用率（应该 < 70%）
   - Memory 使用（应该 < 512MB）
   - Response Time（应该 < 2s）

2. **Logs 标签**:
   - 实时日志流
   - 搜索 "ERROR" 或 "FAIL"
   - 设置日志告警

### 设置告警

**Render 原生告警**:
- Dashboard → Notifications
- 设置 Email 或 Slack 通知
- 触发条件:
  - Service Down
  - High Error Rate
  - Deployment Failed

### 应用级监控

**在代码中添加**:
```typescript
// 记录关键指标
logger.info('PPT generation', {
  taskId,
  status,
  duration: Date.now() - startTime,
  success: status === 'completed',
});
```

---

## 🔄 回滚方案

### 如果新版本有问题

#### 方式 1: Render Dashboard 回滚

1. Dashboard → **Deploys** 标签
2. 找到上一个成功的部署
3. 点击右侧的 **Rollback** 按钮
4. 确认回滚

#### 方式 2: Git 回滚

```bash
# 查看历史
git log --oneline

# 回滚到上一个版本
git revert HEAD

# 或回到特定提交
git reset --hard <commit-hash>

# 强制推送
git push --force origin master
```

#### 方式 3: 环境变量回滚

如果只是 JWT_SECRET 的问题:
1. 临时移除 JWT_SECRET
2. 让系统使用默认值（仅开发环境）
3. 修复后重新添加

**注意**: 生产环境应该始终有 JWT_SECRET！

---

## 🎯 验证清单

部署后必须验证：

- [ ] 服务正常启动（Render Status = Live）
- [ ] 健康检查通过 (`/health` 返回 200)
- [ ] 用户可以登录
- [ ] 可以创建项目
- [ ] 可以上传文件
- [ ] 可以创建 PPT 任务
- [ ] 任务可以正常完成
- [ ] 可以下载 PPTX 文件
- [ ] **用户看不到任何 Manus URL** ✅
- [ ] 错误消息友好且有指导性

---

## 🔍 调试技巧

### 查看实时日志

**Render Dashboard**:
1. 选择服务
2. **Logs** 标签
3. 实时流动显示

**过滤日志**:
- 搜索 "ERROR"
- 搜索 "PPTEngine"
- 搜索特定任务 ID: "Task 123"

### Shell 访问

**Render Shell**:
1. Dashboard → **Shell** 标签
2. 点击 **Connect**
3. 连接到运行中的容器

**可以执行**:
```bash
# 查看环境变量
echo $JWT_SECRET | wc -c
# 应该 ≥ 32

# 检查文件
ls -lh dist/

# 查看进程
ps aux | grep node

# 数据库连接
psql $DATABASE_URL
\dt  # 列出表
```

### 数据库访问

**从本地连接**:
1. Dashboard → Database → Connection String
2. 复制 External Database URL
3. 在本地:
   ```bash
   psql "postgresql://user:pass@host/db"
   ```

**查询示例**:
```sql
-- 查看最近失败的任务
SELECT id, title, status, error_message, created_at
FROM ppt_tasks
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- 查看成功率
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM ppt_tasks
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

---

## 📈 性能优化

### Render 免费计划

- ⏰ 15 分钟无活动后休眠
- 🐌 首次访问需要 1-2 分钟唤醒
- 💾 512MB 内存限制

**优化建议**:
1. 使用 **Starter** 或更高计划（不休眠）
2. 设置定时 ping 保持唤醒
3. 优化内存使用

### 定时 Ping（防休眠）

**外部服务**:
- https://uptimerobot.com (免费)
- https://cron-job.org (免费)

**配置**:
- URL: `https://your-app.onrender.com/health`
- 频率: 每 10 分钟
- 方法: GET

### 数据库连接池

**检查当前配置** (`server/db.ts`):
```typescript
const queryClient = postgres(process.env.DATABASE_URL!, {
  max: 10,  // 最大连接数
  idle_timeout: 20,  // 空闲超时
});
```

**Render Postgres 限制**:
- 免费计划: 最多 25 个连接
- 建议: max = 5-10

---

## 🎛️ Render 高级配置

### 自定义域名

1. Dashboard → **Settings** → **Custom Domain**
2. 添加您的域名
3. 配置 DNS:
   ```
   Type: CNAME
   Name: www
   Value: your-app.onrender.com
   ```

### HTTPS

- ✅ Render 自动提供免费 SSL
- ✅ 强制 HTTPS 重定向
- ✅ 无需配置

### 环境分离

**建议结构**:
- `main` 分支 → 生产环境
- `develop` 分支 → 测试环境

**在 Render 创建两个服务**:
1. `tapippt-prod` (main 分支)
2. `tapippt-dev` (develop 分支)

---

## 🔐 安全最佳实践

### 1. 环境变量安全

- ✅ 使用 Render 的 Environment Variables（加密存储）
- ❌ 不要在代码中硬编码
- ❌ 不要提交 `.env` 到 git

### 2. 数据库安全

- ✅ 使用 Render 内部数据库（已加密）
- ✅ 定期备份（Render 自动）
- ✅ 限制外部访问

### 3. API Key 保护

- ✅ Manus API Key 在环境变量中
- ✅ 永远不发送到前端
- ✅ 服务器端独占使用

### 4. 防止信息泄露

- ✅ **share_url 不暴露给用户** ✅
- ✅ 错误消息经过清理
- ✅ 使用 task sanitizer 过滤敏感信息
- ✅ 内部调试 URL 仅在服务器日志

---

## 📝 部署后检查

### 第一次部署后（30 分钟内）

- [ ] 健康检查正常
- [ ] 用户可以登录
- [ ] 可以创建项目
- [ ] 可以上传文件
- [ ] 可以生成 PPT
- [ ] 日志中看到详细的 `[PPTEngine]` 输出
- [ ] **确认用户界面无 Manus URL** ✅
- [ ] 错误消息友好且有指导

### 第一天

- [ ] 监控错误率（应该 < 5%）
- [ ] PPT 生成成功率（应该 > 85%）
- [ ] 响应时间正常（< 2s）
- [ ] 无严重错误日志
- [ ] 用户反馈正面

### 第一周

- [ ] 收集 PPT 提取日志数据
- [ ] 分析失败原因
- [ ] 优化提取逻辑（如需要）
- [ ] 调整重试策略

---

## 💡 技术支持访问调试信息

### 当用户报告问题时

**步骤 1: 获取任务信息**

```bash
# 连接到 Render Postgres
psql $DATABASE_URL

# 查询失败任务
SELECT 
  id, 
  title, 
  error_message,
  interaction_data
FROM ppt_tasks
WHERE user_id = <用户ID>
  AND status = 'failed'
ORDER BY created_at DESC
LIMIT 1;
```

**步骤 2: 提取内部调试 URL** (仅技术支持)

```typescript
// 在服务器端代码中（或 Node REPL）
import { extractInternalDebugUrl } from './server/lib/task-sanitizer';

const task = await db.getPptTaskById(taskId);
const debugUrl = extractInternalDebugUrl(task);

console.log('Internal debug URL:', debugUrl);
// => https://app.manus.ai/tasks/abc123

// ⚠️  这个 URL 仅供技术人员内部使用
// ❌ 永远不要发给用户！
```

**步骤 3: 诊断**

1. 访问 debugUrl（技术人员在 Manus 控制台）
2. 查看完整的生成过程
3. 识别问题原因
4. 更新代码修复

**步骤 4: 回复用户**

**❌ 错误的回复**:
> "请访问这个链接查看: https://app.manus.ai/tasks/abc"

**✅ 正确的回复**:
> "我们已经诊断出问题，正在修复。请点击重试按钮，或者我们会为您重新生成一份。"

---

## 🎓 最佳实践

### 部署频率

- **Bug 修复**: 立即部署
- **新功能**: 每周一次
- **大版本**: 每月一次

### 版本标签

```bash
# 创建版本标签
git tag -a v1.1.0 -m "修复PPT提取和安全问题"
git push origin v1.1.0
```

### 回归测试

每次部署后运行基础测试：
1. 用户登录
2. 创建项目
3. 生成 PPT
4. 下载结果

自动化脚本: `scripts/verify-deployment.sh`（可创建）

---

## 🆘 需要帮助？

### Render 官方支持

- 文档: https://render.com/docs
- 社区: https://community.render.com
- 支持: support@render.com

### 项目特定问题

- GitHub Issues: https://github.com/cam12138no1/tapipowerpoint/issues
- 查看: `HOW_TO_DEBUG_PPT_EXTRACTION.md`
- 查看: `FIXES_APPLIED.md`

---

## ✅ 部署确认

完成以下确认后可标记部署成功：

- [x] 代码已推送到 GitHub
- [ ] Render 构建成功
- [ ] `JWT_SECRET` 已配置
- [ ] 健康检查通过
- [ ] 登录功能正常
- [ ] PPT 生成功能正常
- [ ] 用户界面无 Manus URL ✅
- [ ] 错误消息友好
- [ ] 日志中有详细调试信息
- [ ] 团队已通知

---

## 🎉 总结

### Render 部署优势

- ✅ 自动检测 git push
- ✅ 自动构建和部署
- ✅ 零停机部署
- ✅ 自动 HTTPS
- ✅ 集成数据库
- ✅ 简单的环境变量管理

### 此次更新的 Render 注意事项

1. **新依赖**: bcrypt（原生模块，Render 会处理）
2. **新环境变量**: `JWT_SECRET`（必须设置）
3. **构建时间**: 首次可能稍长（+1-2 分钟）
4. **内存使用**: 无明显增加
5. **功能兼容**: 100% 向后兼容

### 关键保护

- 🔒 **share_url 永不暴露给用户**
- 🔒 **内部调试信息自动过滤**
- 🔒 **JWT Secret 强制验证**
- 🔒 **文件上传安全检查**

**您的产品体验完全独立，用户永远不会看到 Manus 界面！** ✅

---

**准备好了吗？执行 `git push`，Render 会处理剩下的！** 🚀

---

**文档版本**: 1.0  
**适用平台**: Render.com  
**最后更新**: 2026-02-05
