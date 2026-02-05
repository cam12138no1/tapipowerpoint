# 🚀 快速参考卡片

**版本**: v1.1.0 | **日期**: 2026-02-05 | **状态**: ✅ 已修复

---

## ⚡ 3 分钟了解所有修复

### 问题 1: PPT 文件提取失败 ❌ → ✅

**症状**: "AI完成任务但未能导出PPT文件"

**修复**: 
- 增强了 5 种文件提取方法
- 添加详细调试日志
- 提供 share_url 后备

**现在怎么办**:
1. 重试任务（自动会有更多日志）
2. 查看服务器日志获取详细信息
3. 如果还失败，使用错误消息中的 share_url 手动下载

---

### 问题 2: JWT Secret 不安全 ❌ → ✅

**风险**: 生产环境可能使用弱 secret

**修复**: 强制验证 + 最小长度 32 字符

**现在必须做**:
```bash
# 生成强 secret
export JWT_SECRET=$(openssl rand -base64 32)

# 添加到 .env 或环境变量
echo "JWT_SECRET=$JWT_SECRET" >> .env
```

---

### 问题 3: 密码哈希不安全 ❌ → ✅

**风险**: 使用不安全的 simpleHash

**修复**: 创建 bcrypt 密码库

**现在可以用**:
```typescript
import { hashPassword, verifyPassword } from './server/lib/password';

// 哈希
const hash = await hashPassword('user123');

// 验证
const valid = await verifyPassword('user123', hash);
```

**注意**: 当前系统用 username 登录，无密码。如需密码功能，使用新库。

---

### 问题 4: 文件上传无验证 ❌ → ✅

**风险**: 可能上传恶意文件

**修复**: 类型白名单 + 内容验证

**现在会验证**:
- ✅ MIME 类型必须在白名单中
- ✅ 文件内容与类型匹配（魔数检查）
- ✅ 文件大小限制
- ✅ 文件名格式

---

## 📂 重要文件位置

### 文档

| 文件 | 说明 | 何时查看 |
|------|------|---------|
| `README.md` | 项目说明 | 开始使用 |
| `FIXES_APPLIED.md` | 修复详情 | 部署前必读 |
| `DEPLOYMENT_CHECKLIST.md` | 部署清单 | 部署时 |
| `HOW_TO_DEBUG_PPT_EXTRACTION.md` | 调试指南 | 遇到问题时 |
| `CODE_REVIEW_REPORT.md` | 审查报告 | 了解技术债 |
| `修复完成总结.md` | 总览 | 快速了解 |

### 代码

| 文件 | 说明 | 何时使用 |
|------|------|---------|
| `server/lib/password.ts` | 密码安全库 | 添加密码功能 |
| `server/lib/file-operations.ts` | 文件操作库 | 下载/验证文件 |
| `server/ppt-engine.ts` | PPT 引擎客户端 | 已增强 |
| `server/routers.ts` | API 路由 | 已增强验证 |
| `.specify/memory/constitution.md` | 项目宪法 | 开发任何功能前 |

### 配置

| 文件 | 说明 | 何时使用 |
|------|------|---------|
| `.cursor/rules/` | Cursor 规则 | Cursor 会自动应用 |
| `.env.example` | 环境变量模板 | 配置环境 |
| `vitest.config.ts` | 测试配置 | 运行测试 |

---

## 🔧 常用命令

### 开发

```bash
npm run dev          # 启动开发服务器
npm test            # 运行所有测试
npm test -- --watch # 监听模式
npm run check       # 类型检查
npm run format      # 格式化代码
```

### 测试

```bash
npm test server/lib/password.test.ts     # 密码模块
npm test server/lib/file-operations.test.ts  # 文件模块
npm test server/ppt-engine.test.ts      # PPT 引擎
npm test -- --coverage                   # 覆盖率报告
```

### 部署

```bash
npm install --production   # 生产依赖
npm run build             # 构建
npm start                 # 生产启动
```

---

## 🐛 快速诊断

### PPT 生成失败？

```bash
# 1. 查看日志
tail -f logs/server.log | grep -E "(PPTEngine|Task)"

# 2. 查找这些关键词
"✓ Found PPTX"      # 成功
"ERROR: No PPTX"    # 失败
"Share URL"         # 后备方案
```

### 登录失败？

```bash
# 检查 JWT Secret
echo $JWT_SECRET | wc -c
# 应该 ≥ 32

# 查看日志
grep "Auth.*WARNING" logs/server.log
```

### 文件上传失败？

**错误消息告诉你原因**:
- "不支持的文件类型" → 检查 MIME 类型
- "文件太大" → 减小文件或调整 `MAX_FILE_SIZE_MB`
- "文件验证失败" → 文件可能损坏

---

## 📞 需要帮助？

### 按优先级

1. **紧急**: 生产环境故障
   - 查看 [部署清单](./DEPLOYMENT_CHECKLIST.md) 回滚部分
   - 联系技术支持

2. **重要**: 功能不工作
   - 查看 [调试指南](./HOW_TO_DEBUG_PPT_EXTRACTION.md)
   - 提交详细的 Issue

3. **一般**: 改进建议
   - 查看 [路线图](./IMPLEMENTATION_ROADMAP.md)
   - 提交 PR 或 Feature Request

---

## ✅ 验收标准

部署前确认：

- [x] 代码已更新
- [x] 测试全部通过
- [x] 文档已创建
- [ ] 环境变量已配置
- [ ] 在测试环境验证
- [ ] 生产环境准备就绪

---

## 🎯 核心目标

**短期**: 稳定可靠地生成 PPT  
**中期**: 完整的测试覆盖和文档  
**长期**: 完全符合 SDD 的高质量代码库

---

**当前状态**: ✅ 代码已修复，测试通过，可以部署  
**下一步**: 按照 [部署检查清单](./DEPLOYMENT_CHECKLIST.md) 部署到测试环境

---

**快速链接**:
- 📖 [README](./README.md)
- 🐛 [修复说明](./FIXES_APPLIED.md)
- 🔍 [调试指南](./HOW_TO_DEBUG_PPT_EXTRACTION.md)
- 📋 [部署清单](./DEPLOYMENT_CHECKLIST.md)
- 🗺️ [路线图](./IMPLEMENTATION_ROADMAP.md)
