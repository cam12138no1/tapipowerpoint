# TapiPowerPoint 实施路线图

基于代码审查报告和 Spec-Driven Development 原则的改进计划。

---

## 执行摘要

**当前状态**: 7.2/10  
**目标状态**: 9.0/10  
**预计时间**: 8-10 周  
**优先级**: 安全 > 测试 > 规范 > 重构 > 优化

---

## 阶段 0: 准备工作 (第 1 周)

### 任务 0.1: 环境设置
- [ ] 设置测试数据库
- [ ] 配置 CI/CD 测试流程
- [ ] 安装测试依赖包
- [ ] 配置代码覆盖率工具

**负责人**: DevOps 团队  
**完成标准**: 所有开发者可以运行完整测试套件

### 任务 0.2: 团队培训
- [ ] Spec-Driven Development 方法论培训
- [ ] TDD 工作坊
- [ ] 代码审查标准培训

**负责人**: 技术负责人  
**完成标准**: 团队理解并认同 SDD 原则

---

## 阶段 1: 关键安全修复 (第 2 周)

### 🔴 P0: 密码哈希安全

**问题**: 使用不安全的 `simpleHash` 函数

**任务**:
1. [ ] 安装 bcrypt 依赖
2. [ ] 创建新的密码哈希模块
3. [ ] 编写测试 (先于实现)
4. [ ] 实现 bcrypt 哈希
5. [ ] 迁移现有用户密码
6. [ ] 删除 `simpleHash` 函数

**代码变更**:
```typescript
// lib/auth/password.ts
import bcrypt from 'bcrypt';

/**
 * Hash password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify password against hash
 * @param password - Plain text password
 * @param hash - Bcrypt hash
 * @returns True if password matches
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**测试**:
```typescript
// lib/auth/password.test.ts (写在实现之前)
describe('Password Security', () => {
  it('should hash password with bcrypt', async () => {
    const hash = await hashPassword('test123');
    expect(hash).not.toBe('test123');
    expect(hash.startsWith('$2b$')).toBe(true);
  });
  
  it('should verify correct password', async () => {
    const hash = await hashPassword('test123');
    const valid = await verifyPassword('test123', hash);
    expect(valid).toBe(true);
  });
  
  it('should reject incorrect password', async () => {
    const hash = await hashPassword('test123');
    const valid = await verifyPassword('wrong', hash);
    expect(valid).toBe(false);
  });
});
```

**预计时间**: 4 小时  
**优先级**: P0 (关键)

### 🔴 P0: JWT Secret 强制

**问题**: 生产环境仅警告,未强制 JWT secret

**任务**:
1. [ ] 修改 `getSecretKey` 函数
2. [ ] 添加 secret 长度验证
3. [ ] 更新环境配置文档
4. [ ] 更新部署检查清单

**代码变更**:
```typescript
// server/_core/auth.ts
function getSecretKey(): Uint8Array {
  const secret = ENV.cookieSecret;
  
  // 生产环境强制要求 secret
  if (ENV.isProduction && !secret) {
    throw new Error(
      'JWT_SECRET environment variable must be set in production'
    );
  }
  
  // 验证 secret 长度
  if (secret && secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters long'
    );
  }
  
  const effectiveSecret = secret || 'dev-secret-only-for-local';
  return new TextEncoder().encode(effectiveSecret);
}
```

**预计时间**: 2 小时  
**优先级**: P0 (关键)

### 🔴 P0: 文件上传验证

**问题**: 缺少文件类型验证和安全检查

**任务**:
1. [ ] 定义允许的文件类型白名单
2. [ ] 添加 MIME 类型验证
3. [ ] 添加文件内容验证
4. [ ] 更新文件大小限制为环境变量

**代码变更**:
```typescript
// lib/file-validation/index.ts
const ALLOWED_MIME_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
} as const;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate uploaded file
 */
export function validateFile(
  filename: string,
  contentType: string,
  buffer: Buffer
): FileValidationResult {
  // Check MIME type
  if (!(contentType in ALLOWED_MIME_TYPES)) {
    return {
      valid: false,
      error: `File type ${contentType} is not allowed`,
    };
  }
  
  // Check file extension
  const ext = filename.toLowerCase().split('.').pop();
  const allowedExts = ALLOWED_MIME_TYPES[contentType as keyof typeof ALLOWED_MIME_TYPES];
  if (!allowedExts.includes(`.${ext}`)) {
    return {
      valid: false,
      error: `File extension .${ext} does not match content type`,
    };
  }
  
  // Check file size
  const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '50');
  const sizeMB = buffer.length / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `File size ${sizeMB.toFixed(1)}MB exceeds limit of ${maxSizeMB}MB`,
    };
  }
  
  // TODO: Add magic number validation
  // TODO: Add virus scanning in production
  
  return { valid: true };
}
```

**预计时间**: 6 小时  
**优先级**: P0 (关键)

---

## 阶段 2: 测试基础设施 (第 3-4 周)

### 任务 2.1: 测试数据库设置

**任务**:
1. [ ] 创建测试数据库配置
2. [ ] 编写数据库清理工具
3. [ ] 创建测试 fixtures
4. [ ] 编写种子数据生成器

**代码**:
```typescript
// server/test-utils/database.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

export async function createTestDatabase() {
  const connection = postgres(process.env.TEST_DATABASE_URL!);
  const db = drizzle(connection);
  
  // Clean all tables
  await db.execute(sql`
    TRUNCATE TABLE 
      users, 
      projects, 
      ppt_tasks, 
      timeline_events 
    CASCADE
  `);
  
  return { db, connection };
}

export async function closeTestDatabase(connection: any) {
  await connection.end();
}

// server/test-utils/fixtures.ts
export const testUsers = {
  admin: {
    openId: 'test_admin_001',
    name: 'Admin User',
    role: 'admin' as const,
  },
  regularUser: {
    openId: 'test_user_001',
    name: 'Regular User',
    role: 'user' as const,
  },
};

export const testProjects = {
  corporateBlue: {
    name: 'Corporate Blue',
    primaryColor: '#0033A0',
    secondaryColor: '#58595B',
    accentColor: '#C8A951',
    fontFamily: 'Arial',
  },
};
```

**预计时间**: 12 小时  
**优先级**: P1 (高)

### 任务 2.2: Router 集成测试实现

**任务**:
1. [ ] 实现 Auth Router 测试
2. [ ] 实现 Project Router 测试
3. [ ] 实现 Task Router 测试
4. [ ] 实现 File Router 测试
5. [ ] 实现 Template Router 测试

**参考**: 已创建的 `server/routers.test.ts` 骨架

**预计时间**: 16 小时  
**优先级**: P1 (高)

### 任务 2.3: 数据库集成测试

**任务**:
1. [ ] 实现 User CRUD 测试
2. [ ] 实现 Project CRUD 测试
3. [ ] 实现 Task CRUD 测试
4. [ ] 实现关系和约束测试
5. [ ] 实现事务测试

**参考**: 已创建的 `server/db.test.ts` 骨架

**预计时间**: 16 小时  
**优先级**: P1 (高)

### 任务 2.4: 前端测试设置

**任务**:
1. [ ] 安装 @testing-library/react
2. [ ] 配置 Vitest for React
3. [ ] 创建测试工具函数
4. [ ] 编写示例组件测试

**代码**:
```typescript
// client/src/test-utils/index.tsx
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRPCProvider } from '@/lib/trpc';

export function renderWithProviders(
  ui: React.ReactElement,
  options?: RenderOptions
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProvider>
          {children}
        </TRPCProvider>
      </QueryClientProvider>
    );
  }
  
  return render(ui, { wrapper: Wrapper, ...options });
}
```

**预计时间**: 8 小时  
**优先级**: P1 (高)

---

## 阶段 3: 功能规范文档 (第 5 周)

### 任务 3.1: 创建规范目录结构

**任务**:
1. [ ] 创建 `.specify/specs/` 目录
2. [ ] 创建规范模板文件
3. [ ] 设置规范验证脚本

**目录结构**:
```
.specify/
├── memory/
│   └── constitution.md (已创建)
├── specs/
│   ├── 001-ppt-generation/
│   │   ├── spec.md
│   │   ├── plan.md
│   │   ├── tasks.md
│   │   ├── data-model.md
│   │   └── contracts/
│   ├── 002-design-specs/
│   └── 003-file-upload/
└── templates/
    ├── spec-template.md
    ├── plan-template.md
    └── tasks-template.md
```

**预计时间**: 4 小时  
**优先级**: P1 (高)

### 任务 3.2: 编写核心功能规范

**任务**:
1. [ ] PPT 生成功能规范
   - 用户故事
   - 验收标准
   - 非功能需求
   
2. [ ] 设计规范管理功能规范
3. [ ] 文件上传功能规范

**规范示例** (001-ppt-generation/spec.md):
```markdown
# PPT 生成功能规范

## 概述
用户可以通过上传文档或输入文本,使用 AI 生成专业的 PPT 演示文稿。

## 用户故事

### US-1.1: 创建生成任务
**作为** 用户  
**我想要** 创建一个 PPT 生成任务  
**以便** 我可以基于我的内容生成演示文稿

**验收标准**:
- [ ] 用户可以输入任务标题
- [ ] 用户可以选择设计规范 (可选)
- [ ] 用户可以上传源文档 (可选)
- [ ] 用户可以输入提案内容 (可选)
- [ ] 用户可以上传图片附件 (可选)
- [ ] 任务创建后状态为 "pending"

### US-1.2: 监控生成进度
**作为** 用户  
**我想要** 实时查看 PPT 生成进度  
**以便** 我知道任务什么时候完成

**验收标准**:
- [ ] 显示任务状态 (pending/running/completed/failed/ask)
- [ ] 显示进度百分比 (0-100%)
- [ ] 显示当前步骤描述
- [ ] 自动轮询更新 (每 2 秒)
- [ ] 显示时间线事件

### US-1.3: 下载生成结果
**作为** 用户  
**我想要** 下载生成的 PPT 文件  
**以便** 我可以使用它进行演示

**验收标准**:
- [ ] 任务完成后显示下载按钮
- [ ] 提供 PPTX 格式下载
- [ ] 提供 PDF 格式下载 (如果可用)
- [ ] 下载链接有效期 ≥ 24 小时

## 非功能需求

### 性能
- 任务创建响应时间 < 500ms
- 文件上传 (10MB) < 30s
- PPT 生成时间 < 3 分钟 (P95)

### 可靠性
- 任务失败率 < 5%
- 自动重试机制 (最多 3 次)
- 文件存储可靠性 99.9%

### 可用性
- 用户界面直观易用
- 错误消息清晰友好
- 移动端适配

## 约束条件
- 文件大小限制: 50MB
- 支持文件类型: PDF, DOCX, TXT, PNG, JPG
- 并发任务限制: 10 个/用户
```

**预计时间**: 12 小时  
**优先级**: P1 (高)

---

## 阶段 4: 代码重构 (第 6-7 周)

### 任务 4.1: 提取辅助函数为库

**问题**: `server/routers.ts` 中的辅助函数应该是独立库

**任务**:
1. [ ] 创建 `lib/file-operations/` 模块
2. [ ] 提取 `downloadFileWithRetry`
3. [ ] 提取 `storeFileToS3`
4. [ ] 编写单元测试
5. [ ] 更新路由使用新库

**目标结构**:
```
lib/
├── file-operations/
│   ├── download.ts
│   ├── upload.ts
│   ├── download.test.ts
│   └── upload.test.ts
```

**代码示例**:
```typescript
// lib/file-operations/download.ts
export interface DownloadOptions {
  url: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Download file with retry and timeout
 * @returns Buffer or null if all retries failed
 */
export async function downloadFile(
  options: DownloadOptions
): Promise<Buffer | null> {
  const { url, timeout = 30000, maxRetries = 3 } = options;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === maxRetries) return null;
      // Exponential backoff
      await delay(1000 * attempt);
    }
  }
  
  return null;
}
```

**预计时间**: 8 小时  
**优先级**: P2 (中)

### 任务 4.2: 拆分大函数

**问题**: `poll` mutation 172 行,`buildPPTPrompt` 109 行

**任务**:
1. [ ] 拆分 `poll` mutation:
   - `handleCompletedTask`
   - `handleFailedTask`
   - `handleAskStatus`
   - `updateRunningProgress`
   
2. [ ] 拆分 `buildPPTPrompt`:
   - `buildDesignSection`
   - `buildContentSection`
   - `buildImageSection`
   - `buildQualitySection`

**预计时间**: 12 小时  
**优先级**: P2 (中)

### 任务 4.3: 优化 N+1 查询

**问题**: `server/routers.ts` 第 169-176 行

**任务**:
1. [ ] 识别所有 N+1 查询
2. [ ] 使用 Drizzle 的 `include` 或 `with`
3. [ ] 编写性能测试
4. [ ] 验证改进效果

**代码变更**:
```typescript
// ❌ Before
const tasks = await db.getPptTasksByUserId(ctx.user.id);
const enrichedTasks = await Promise.all(
  tasks.map(async (task) => {
    const project = await db.getProjectById(task.projectId);
    return { ...task, project };
  })
);

// ✅ After
const tasks = await db.query.pptTasks.findMany({
  where: eq(pptTasks.userId, ctx.user.id),
  with: { project: true },
});
```

**预计时间**: 6 小时  
**优先级**: P2 (中)

### 任务 4.4: 添加 CLI 接口

**问题**: 核心功能缺少 CLI 接口

**任务**:
1. [ ] 创建 `cli/` 目录
2. [ ] 实现 PPT 生成 CLI
3. [ ] 实现项目管理 CLI
4. [ ] 添加使用文档

**代码示例**:
```typescript
// cli/ppt-generate.ts
import { pptEngine } from '../server/ppt-engine';

async function main() {
  if (process.argv.length < 3) {
    console.error('Usage: node ppt-generate.js <config.json>');
    process.exit(1);
  }
  
  const configPath = process.argv[2];
  const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
  
  try {
    const task = await pptEngine.createTask(config);
    console.log(JSON.stringify({ taskId: task.task_id }));
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

main().catch(console.error);
```

**使用示例**:
```bash
# 创建配置文件
cat > task-config.json <<EOF
{
  "prompt": "Create a presentation about AI",
  "projectId": "project_123"
}
EOF

# 运行 CLI
node dist/cli/ppt-generate.js task-config.json
```

**预计时间**: 12 小时  
**优先级**: P2 (中)

---

## 阶段 5: 前端组件测试 (第 8 周)

### 任务 5.1: 核心组件测试

**任务**:
1. [ ] PPTPreview (已创建骨架)
2. [ ] AIChatBox
3. [ ] AuthDialog
4. [ ] DashboardLayout
5. [ ] RealProgressBar
6. [ ] EmbeddedPPTViewer

**每个组件测试应包含**:
- 渲染测试
- 交互测试
- 边界情况测试
- 可访问性测试

**预计时间**: 20 小时  
**优先级**: P1 (高)

### 任务 5.2: Hooks 测试

**任务**:
1. [ ] useAuth (已创建骨架)
2. [ ] useComposition
3. [ ] useMobile
4. [ ] usePersistFn

**预计时间**: 8 小时  
**优先级**: P1 (高)

### 任务 5.3: Context 测试

**任务**:
1. [ ] SimpleAuthContext
2. [ ] ThemeContext

**预计时间**: 4 小时  
**优先级**: P1 (高)

---

## 阶段 6: E2E 测试 (第 9 周)

### 任务 6.1: Playwright 设置

**任务**:
1. [ ] 安装 Playwright
2. [ ] 配置测试环境
3. [ ] 编写测试辅助函数
4. [ ] 创建测试数据种子

**代码**:
```typescript
// e2e/setup.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  // Authenticated user fixture
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.click('[data-testid="submit-login"]');
    await page.waitForURL('/dashboard');
    await use(page);
  },
});
```

**预计时间**: 8 小时  
**优先级**: P1 (高)

### 任务 6.2: 关键流程测试

**任务**:
1. [ ] 用户认证流程
2. [ ] PPT 生成完整流程
3. [ ] 项目管理流程
4. [ ] 错误处理流程

**预计时间**: 16 小时  
**优先级**: P1 (高)

---

## 阶段 7: 性能优化 (第 10 周)

### 任务 7.1: 性能测试

**任务**:
1. [ ] 编写负载测试
2. [ ] 编写性能基准测试
3. [ ] 识别瓶颈
4. [ ] 制定优化方案

**预计时间**: 12 小时  
**优先级**: P2 (中)

### 任务 7.2: 添加缓存层

**任务**:
1. [ ] 评估缓存需求
2. [ ] 选择缓存方案 (Redis / In-memory)
3. [ ] 实现缓存层
4. [ ] 验证性能改进

**预计时间**: 16 小时  
**优先级**: P2 (中)

---

## 进度追踪

### 每周检查点

**每周五**进行进度评审:
- 完成任务清单
- 阻塞问题
- 下周计划
- 质量指标

### 质量指标

**追踪指标**:
| 指标 | 当前 | 目标 | 状态 |
|------|------|------|------|
| 单元测试覆盖率 | 40% | 80% | 🔴 |
| 集成测试覆盖率 | 10% | 70% | 🔴 |
| E2E 测试覆盖率 | 0% | 60% | 🔴 |
| SDD 合规项 | 20% | 90% | 🔴 |
| P0/P1 安全问题 | 3 | 0 | 🔴 |
| 代码质量分 | 7.2 | 9.0 | 🟡 |

### 风险管理

**识别的风险**:
1. **测试数据库设置复杂**: 预留额外时间
2. **团队对 TDD 不熟悉**: 安排配对编程
3. **现有代码重构影响功能**: 小步快走,频繁测试
4. **时间估算不准确**: 20% 缓冲时间

---

## 成功标准

项目被认为成功完成当:
- ✅ 所有 P0 安全问题修复
- ✅ 测试覆盖率达标
- ✅ SDD 合规性 ≥ 90%
- ✅ 所有关键 E2E 测试通过
- ✅ 代码质量分 ≥ 9.0
- ✅ 团队能够独立遵循 SDD 流程

---

## 附录

### A. 资源需求
- **开发人员**: 2-3 人
- **测试工程师**: 1 人
- **技术负责人**: 0.5 人 (指导和审查)

### B. 工具和环境
- Vitest (单元测试)
- Playwright (E2E 测试)
- PostgreSQL (测试数据库)
- GitHub Actions (CI/CD)

### C. 培训材料
- Spec-Driven Development 指南
- TDD 实践教程
- 代码审查检查清单

---

**路线图版本**: 1.0  
**创建日期**: 2026年2月5日  
**负责人**: 技术团队  
**审查周期**: 每周

