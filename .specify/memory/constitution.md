# TapiPowerPoint 项目宪法

**版本**: 1.0  
**制定日期**: 2026年2月5日  
**基于**: GitHub Spec-Kit / Spec-Driven Development

本宪法定义 TapiPowerPoint 项目的核心架构原则和开发准则,是所有技术决策的基础。

---

## 序言

TapiPowerPoint 是一个基于 AI 的专业 PPT 生成平台。我们采用 Spec-Driven Development (SDD) 方法论,规范是代码的源头,而非相反。本宪法确保我们的开发过程保持一致性、简洁性和质量。

---

## 第一条: 库优先原则 (Library-First Principle)

### 条款 1.1: 强制库化

每个功能在实现时**必须**首先作为独立的、可重用的库模块:

```typescript
// ❌ 违规 - 直接在路由中实现业务逻辑
const taskRouter = router({
  create: protectedProcedure.mutation(async ({ input }) => {
    // 200 lines of business logic here...
  })
});

// ✅ 合规 - 业务逻辑在库中
// lib/ppt-generation/task-creator.ts
export function createPPTTask(params: CreateTaskParams): Promise<Task> {
  // Business logic
}

// server/routers/task.ts
const taskRouter = router({
  create: protectedProcedure.mutation(async ({ input }) => {
    return createPPTTask(input);
  })
});
```

### 条款 1.2: 库的特征

所有库必须:
- **独立**: 最小化外部依赖
- **可测试**: 纯函数优先,副作用隔离
- **可重用**: 不绑定特定框架或环境
- **文档化**: 清晰的接口定义和使用示例

### 条款 1.3: 允许的例外

以下情况可直接实现而非库化:
- 纯粹的 UI 展示组件 (无业务逻辑)
- 框架胶水代码 (路由定义、中间件配置)
- 一次性脚本

---

## 第二条: CLI 接口强制 (CLI Interface Mandate)

### 条款 2.1: 强制CLI暴露

所有核心业务功能**必须**提供命令行接口:

```typescript
// lib/ppt-generation/cli.ts
export async function main(args: string[]): Promise<void> {
  const input = JSON.parse(args[0]);
  const result = await generatePPT(input);
  console.log(JSON.stringify(result));
}

// 使用示例
// $ node dist/ppt-cli.js '{"title":"Test","content":"..."}'
```

### 条款 2.2: CLI 的标准

所有 CLI 接口必须:
- **标准输入**: 接受文本输入 (stdin, 参数, 文件)
- **标准输出**: 产生文本输出 (stdout)
- **JSON 格式**: 结构化数据使用 JSON
- **退出码**: 0=成功, 非0=失败
- **错误输出**: 错误信息输出到 stderr

### 条款 2.3: CLI 的好处

CLI 接口确保:
- **可观察性**: 功能可独立测试和调试
- **自动化**: 易于集成到脚本和 CI/CD
- **文档**: 自文档化的使用方式
- **版本控制**: 输入/输出可版本化

---

## 第三条: 测试驱动开发 (Test-Driven Development)

### 条款 3.1: 不可协商的 TDD

**这是不可协商的**: 所有实现代码**必须**在测试之后编写。

```typescript
// 1. RED - 先写测试 (失败)
describe('createPPTTask', () => {
  it('should create task with valid input', async () => {
    const task = await createPPTTask({ title: 'Test' });
    expect(task.id).toBeDefined();
    expect(task.status).toBe('pending');
  });
});

// 2. GREEN - 实现功能 (通过)
export async function createPPTTask(params: CreateTaskParams): Promise<Task> {
  return db.tasks.create({ data: params });
}

// 3. REFACTOR - 重构 (保持绿色)
export async function createPPTTask(params: CreateTaskParams): Promise<Task> {
  validateTaskParams(params);
  return db.tasks.create({ 
    data: normalizeTaskData(params) 
  });
}
```

### 条款 3.2: 测试创建顺序

测试必须按以下顺序创建:

1. **契约测试** (Contract Tests)
   - 定义接口和数据结构
   - 验证 API 契约
   
2. **集成测试** (Integration Tests)
   - 测试组件交互
   - 使用真实数据库和服务
   
3. **端到端测试** (E2E Tests)
   - 测试完整用户流程
   - 从 UI 到数据库
   
4. **单元测试** (Unit Tests)
   - 测试隔离的函数
   - 仅在需要时补充

### 条款 3.3: 测试验证流程

在实现任何代码之前:

1. ✅ 测试编写完成
2. ✅ 测试被用户批准
3. ✅ 测试确认失败 (Red 阶段)
4. ✅ 然后且仅然后,编写实现代码

### 条款 3.4: 测试覆盖率要求

- 单元测试覆盖率: ≥ 80%
- 集成测试覆盖率: ≥ 70%
- E2E 测试覆盖率: ≥ 60%
- 关键路径覆盖率: 100%

---

## 第四条: 简洁性原则 (Simplicity Principle)

### 条款 4.1: 最小项目结构

初始实现**必须**使用 ≤ 3 个项目/模块:

```
✅ 合规结构:
- shared/      # 共享类型和工具
- server/      # 后端 API
- client/      # 前端 UI

❌ 违规结构:
- shared/
- server-core/
- server-auth/
- server-api/
- server-workers/
- client-admin/
- client-user/
- client-mobile/
```

### 条款 4.2: 复杂性证明

添加第4个模块需要:
- 书面说明添加的理由
- 记录在 `docs/architecture/complexity-tracking.md`
- 团队 review 批准

### 条款 4.3: 禁止未来证明

**绝对禁止**:
- "可能需要" 的功能
- "以防万一" 的抽象
- "为了扩展性" 的过度设计

```typescript
// ❌ 违规 - 未来证明
interface DataAccessLayer {
  getById(id: string): Promise<any>;
  query(options: QueryOptions): Promise<any[]>;
  // 30 more methods "just in case"
}

// ✅ 合规 - 只实现当前需要的
const user = await db.users.findUnique({ where: { id } });
```

### 条款 4.4: YAGNI 原则

You Aren't Gonna Need It - 只实现当前明确需要的功能。

---

## 第五条: 反抽象原则 (Anti-Abstraction Principle)

### 条款 5.1: 直接使用框架

**必须**直接使用框架特性,而非包装它们:

```typescript
// ❌ 违规 - 不必要的抽象
class DatabaseAdapter {
  async find(table: string, id: string) {
    return this.orm.table(table).where('id', id).first();
  }
}
const user = await dbAdapter.find('users', userId);

// ✅ 合规 - 直接使用 ORM
const user = await db.users.findUnique({ where: { id: userId } });
```

### 条款 5.2: 单一模型表示

每个领域概念**只有一个**数据模型:

```typescript
// ❌ 违规 - 多重表示
interface UserEntity { /* 数据库模型 */ }
interface UserDTO { /* API 模型 */ }
interface UserViewModel { /* UI 模型 */ }

// ✅ 合规 - 单一模型
interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
}
// 在整个应用中使用相同的 User 类型
```

### 条款 5.3: 抽象的证明

创建抽象层需要:
- 至少 3 个实际的不同实现
- 书面说明抽象的价值
- 性能测试证明无性能损失

---

## 第六条: 集成优先测试 (Integration-First Testing)

### 条款 6.1: 真实服务优先

测试**必须**使用真实环境:

```typescript
// ❌ 违规 - 过度 Mock
const mockDb = {
  users: { create: vi.fn(), findMany: vi.fn() },
  projects: { create: vi.fn(), findMany: vi.fn() },
};

// ✅ 合规 - 真实测试数据库
describe('User operations', () => {
  let testDb: Database;
  
  beforeEach(async () => {
    testDb = await createTestDatabase();
    await testDb.migrate();
  });
  
  afterEach(async () => {
    await testDb.cleanup();
  });
  
  it('should create user', async () => {
    const user = await createUser(testDb, { name: 'Test' });
    const found = await testDb.users.findUnique({ where: { id: user.id } });
    expect(found).toBeDefined();
  });
});
```

### 条款 6.2: Mock 的限制

只能 Mock:
- 外部第三方 API (Stripe, AWS, etc.)
- 慢速或昂贵的操作 (仅在必要时)
- 不稳定的服务 (仅在 CI 中)

**不能** Mock:
- 自己的代码
- 数据库
- 内部服务

### 条款 6.3: 契约测试强制

在实现之前**必须**编写契约测试:

```typescript
// 1. 定义契约
describe('PPT Generation API Contract', () => {
  it('should accept valid task creation request', () => {
    const schema = z.object({
      title: z.string().min(1),
      content: z.string().optional(),
      projectId: z.number().optional(),
    });
    
    expect(() => schema.parse({
      title: 'Test',
    })).not.toThrow();
  });
  
  it('should return task with required fields', () => {
    const schema = z.object({
      id: z.number(),
      status: z.enum(['pending', 'running', 'completed', 'failed']),
      progress: z.number().min(0).max(100),
    });
    
    // Implementation will be validated against this
  });
});
```

---

## 第七条: 错误处理标准 (Error Handling Standards)

### 条款 7.1: 显式错误处理

所有错误**必须**显式处理:

```typescript
// ❌ 违规 - 吞掉错误
try {
  await processData();
} catch (e) {
  console.log('error');
}

// ✅ 合规 - 完整的错误处理
try {
  await processData();
} catch (error) {
  logger.error('Failed to process data', {
    error: error instanceof Error ? error.message : 'Unknown',
    context: { userId, dataId },
    timestamp: new Date().toISOString(),
  });
  
  throw new DataProcessingError('Unable to process data', {
    cause: error,
    userId,
    dataId,
  });
}
```

### 条款 7.2: 自定义错误类型

创建领域特定的错误类型:

```typescript
// lib/errors/ppt-generation-errors.ts
export class PPTGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'PPTGenerationError';
  }
}

export class TaskNotFoundError extends PPTGenerationError {
  constructor(taskId: number) {
    super(
      `Task ${taskId} not found`,
      'TASK_NOT_FOUND',
      { taskId }
    );
  }
}
```

### 条款 7.3: 错误日志标准

所有错误日志必须包含:
- 错误消息
- 错误上下文 (相关 ID、参数)
- 时间戳
- 堆栈跟踪 (开发环境)

---

## 第八条: 类型安全 (Type Safety)

### 条款 8.1: 严格 TypeScript

必须启用严格模式:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 条款 8.2: 禁止 any

**严格禁止**使用 `any`:

```typescript
// ❌ 违规
function processData(data: any) {
  return data.value;
}

// ✅ 合规
interface DataInput {
  value: string;
}

function processData(data: DataInput): string {
  return data.value;
}

// ✅ 允许 unknown (需要类型收窄)
function processUnknown(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String(data.value);
  }
  throw new TypeError('Invalid data structure');
}
```

### 条款 8.3: 运行时验证

使用 Zod 进行运行时类型验证:

```typescript
const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
  projectId: z.number().positive().optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export async function createTask(input: unknown): Promise<Task> {
  const validated = CreateTaskSchema.parse(input);
  // validated 现在是类型安全的
  return db.tasks.create({ data: validated });
}
```

---

## 第九条: 性能原则 (Performance Principles)

### 条款 9.1: 测量优先

**禁止**未经测量的优化:

```typescript
// ✅ 正确流程:
// 1. 实现功能
// 2. 编写性能测试
// 3. 测量性能
// 4. 如果性能不足,优化
// 5. 验证优化效果

describe('Performance Tests', () => {
  it('should load projects in <500ms', async () => {
    const start = Date.now();
    await getProjects(userId);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(500);
  });
});
```

### 条款 9.2: N+1 查询禁令

**严格禁止** N+1 查询:

```typescript
// ❌ 违规 - N+1 查询
const tasks = await db.tasks.findMany({ where: { userId } });
for (const task of tasks) {
  const project = await db.projects.findUnique({ 
    where: { id: task.projectId } 
  });
  task.project = project;
}

// ✅ 合规 - 使用 JOIN
const tasks = await db.tasks.findMany({
  where: { userId },
  include: { project: true },
});
```

### 条款 9.3: 缓存策略

使用缓存需要:
- 书面说明缓存必要性
- 定义缓存失效策略
- 性能测试证明改进

---

## 第十条: 安全标准 (Security Standards)

### 条款 10.1: 输入验证

所有用户输入**必须**验证:

```typescript
// ✅ 合规
const input = CreateProjectSchema.parse(req.body);

// ❌ 违规 - 直接使用未验证输入
const project = await db.projects.create({ data: req.body });
```

### 条款 10.2: 密码处理

**严格禁止**:
- 明文存储密码
- 自定义哈希算法
- 弱哈希算法 (MD5, SHA1)

**必须使用**:
- bcrypt (≥ 10 rounds)
- 或 Argon2

```typescript
// ✅ 合规
import bcrypt from 'bcrypt';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(
  password: string, 
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

### 条款 10.3: JWT Secret

生产环境**必须**设置强 JWT secret:

```typescript
if (ENV.isProduction && !ENV.cookieSecret) {
  throw new Error('JWT_SECRET is required in production');
}

// Secret 长度 ≥ 32 字符
if (ENV.cookieSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
```

---

## 第十一条: 文档要求 (Documentation Requirements)

### 条款 11.1: 代码自文档化

优先使用清晰的命名而非注释:

```typescript
// ❌ 需要注释
// Get user by ID
function gubi(i: number) {
  return db.u.funi({ w: { i } });
}

// ✅ 自文档化
function getUserById(userId: number): Promise<User | null> {
  return db.users.findUnique({ where: { id: userId } });
}
```

### 条款 11.2: 函数文档

公共 API 必须有 JSDoc:

```typescript
/**
 * Creates a new PPT generation task
 * 
 * @param params - Task creation parameters
 * @param params.title - Title of the presentation
 * @param params.content - Optional content text
 * @param params.projectId - Optional design spec project ID
 * @returns Created task with pending status
 * @throws {TaskCreationError} If task creation fails
 * 
 * @example
 * const task = await createPPTTask({
 *   title: 'Q4 Report',
 *   content: '...',
 *   projectId: 123,
 * });
 */
export async function createPPTTask(
  params: CreateTaskParams
): Promise<Task> {
  // Implementation
}
```

### 条款 11.3: 规范优先

功能必须有规范文档 (specs/):
- WHAT 和 WHY (不是 HOW)
- 用户故事
- 验收标准
- 非功能需求

---

## 第十二条: 代码审查标准 (Code Review Standards)

### 条款 12.1: 审查清单

每个 PR 必须检查:
- [ ] 规范存在且完整
- [ ] 测试在实现之前编写
- [ ] 所有测试通过
- [ ] 代码覆盖率未降低
- [ ] 遵循库优先原则
- [ ] 没有违反简洁性原则
- [ ] 错误处理完整
- [ ] 类型安全
- [ ] 性能测试通过

### 条款 12.2: 阻断条件

以下问题**必须**在合并前修复:
- 测试失败
- 覆盖率降低
- 安全漏洞
- 违反宪法原则

### 条款 12.3: 审查响应时间

- P0 (关键bug): 2 小时内
- P1 (重要功能): 24 小时内
- P2 (改进): 48 小时内

---

## 第十三条: 部署和运维 (Deployment & Operations)

### 条款 13.1: 环境配置

所有环境配置通过环境变量:

```typescript
// ✅ 合规
const config = {
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  apiKey: process.env.API_KEY!,
};

// ❌ 违规 - 硬编码
const config = {
  databaseUrl: 'postgresql://localhost:5432/db',
  jwtSecret: 'secret123',
};
```

### 条款 13.2: 健康检查

所有服务必须提供健康检查端点:

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
  });
});

app.get('/health/ready', async (req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready' });
  }
});
```

### 条款 13.3: 日志标准

使用结构化日志:

```typescript
logger.info('User logged in', {
  userId: user.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString(),
});
```

---

## 第十四条: 持续改进 (Continuous Improvement)

### 条款 14.1: 宪法修订

宪法可以修订,但需要:
- 书面提案说明修改理由
- 团队讨论和投票
- 记录修改历史

### 条款 14.2: 技术债务追踪

所有技术债务记录在 `docs/tech-debt.md`:

```markdown
## TD-001: 密码哈希改进
**当前**: 使用 simpleHash (不安全)
**目标**: 迁移到 bcrypt
**优先级**: P0
**预计工作量**: 4 小时
**负责人**: @username
```

### 条款 14.3: 定期审查

每季度审查:
- 代码质量指标
- 测试覆盖率
- 性能指标
- 安全扫描结果
- 宪法合规性

---

## 第十五条: 团队文化 (Team Culture)

### 条款 15.1: 代码所有权

代码归团队所有,不是个人:
- 任何人可以修改任何代码
- 质量是集体责任
- 知识必须共享

### 条款 15.2: 尊重和协作

- 批评代码,不是人
- 假设良好意图
- 尊重不同观点
- 帮助他人成长

### 条款 15.3: 学习文化

- 鼓励实验和创新
- 从失败中学习
- 分享知识和经验
- 持续学习新技术

---

## 结语

本宪法是 TapiPowerPoint 项目的基石。遵循这些原则,我们能够构建:
- 高质量、可维护的代码
- 可靠、可测试的系统
- 高效、愉快的开发体验

**宪法的精神**比字面更重要。当面对不确定时,优先选择:
- 简洁胜过复杂
- 测试胜过文档
- 真实胜过模拟
- 质量胜过速度

---

**签署人**: AI Code Reviewer (代表团队)  
**日期**: 2026年2月5日  
**版本**: 1.0

**修订历史**:
- 2026-02-05: 初始版本,基于 GitHub Spec-Kit 规范
