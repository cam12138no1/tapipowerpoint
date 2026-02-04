# TapiPowerPoint 项目审查报告

**审查日期**: 2026-02-04  
**审查方法**: 基于 Spec-Driven Development 原则的全面代码审查  
**审查范围**: 后端架构、前端组件、数据库设计、安全性、错误处理

---

## 执行摘要

该项目是一个 PPT 生成工具，使用 React + tRPC + Drizzle ORM 技术栈。经过审查，发现了 **23 个问题**，其中 **8 个为严重问题**，需要优先处理。

| 严重程度 | 问题数量 | 说明 |
|----------|---------|------|
| 🔴 严重 (CRITICAL) | 8 | 安全漏洞、数据丢失风险 |
| 🟠 高 (HIGH) | 7 | 可靠性问题、用户体验影响 |
| 🟡 中 (MEDIUM) | 5 | 代码质量、维护性问题 |
| 🟢 低 (LOW) | 3 | 优化建议 |

---

## 🔴 严重问题 (CRITICAL)

### C1. 不安全的身份认证机制

**位置**: `server/_core/context.ts`, `client/src/contexts/SimpleAuthContext.tsx`

**问题描述**:
- 身份认证完全依赖客户端发送的 HTTP 头 (`x-username`, `x-user-openid`)
- 服务端无任何验证，攻击者可以伪造任意用户身份
- openId 由客户端生成：`simple_${username.toLowerCase()}`，可预测

```typescript
// context.ts - 危险：完全信任客户端提供的身份信息
const username = rawUsername ? decodeURIComponent(rawUsername) : undefined;
const userOpenId = rawOpenId ? decodeURIComponent(rawOpenId) : undefined;

if (username && userOpenId) {
  const foundUser = await db.getOrCreateUser(userOpenId, username);
  // 无任何验证！
}
```

**影响**: 任何人都可以访问任意用户的数据和文件

**建议修复**:
1. 实现 JWT token 认证
2. 添加服务端 session 管理
3. 至少使用密码验证

---

### C2. 内存存储重试计数器会导致数据不一致

**位置**: `server/routers.ts:16`

**问题描述**:
```typescript
// 内存重试计数器 - 服务器重启后丢失
const completedNoFileRetryCount = new Map<number, number>();
```

服务器重启后，所有正在处理的任务重试计数将丢失，导致：
- 可能无限重试
- 已完成任务状态可能不正确

**建议修复**: 将重试计数存储到数据库中

---

### C3. 敏感信息泄露

**位置**: `server/_core/env.ts`

**问题描述**:
- 环境变量包含 API 密钥、数据库凭证等
- 没有 `.env.example` 文件指导正确配置
- 开发/生产环境未分离

```typescript
export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",  // 空字符串作为默认值！
  pptEngineApiKey: process.env.PPT_ENGINE_API_KEY ?? "",
  // ...
}
```

**影响**: 
- 如果 JWT_SECRET 为空，token 签名无效
- API 密钥泄露风险

---

### C4. SQL 注入风险（部分缓解但未完全解决）

**位置**: `server/db.ts`

**问题描述**: 虽然使用了参数化查询，但动态构建 SQL 的模式存在风险：

```typescript
// db.ts:672-718 动态构建 UPDATE 语句
const updates: string[] = [];
const values: any[] = [];
// ... 动态拼接 SQL
await pool.query(`UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);
```

**建议修复**: 使用 Drizzle ORM 的类型安全更新方法，而非原生 SQL

---

### C5. 无访问控制的文件下载

**位置**: `server/storage.ts`

**问题描述**:
- S3 签名 URL 有效期 7 天，过长
- 无法撤销已生成的访问链接
- 缺少文件级别的权限检查

```typescript
// 签名 URL 有效期 7 天
url = await getSignedUrl(client, command, { expiresIn: 604800 });
```

**建议修复**:
1. 缩短签名 URL 有效期至 1 小时
2. 添加服务端代理下载，验证权限

---

### C6. 数据库连接泄漏风险

**位置**: `server/db.ts`

**问题描述**:
```typescript
// 创建新连接池但可能未正确释放旧连接
_pool = await connectWithRetry(3, 2000);

// 错误处理时只是忽略
try {
  await _pool.end();
} catch (e) {
  // Ignore errors when closing old pool
}
```

在高并发或频繁重连场景下，可能导致连接耗尽。

---

### C7. 竞态条件 - 任务状态更新

**位置**: `server/routers.ts`

**问题描述**: 任务轮询和状态更新之间存在竞态条件：

```typescript
// poll mutation 可能同时被多个客户端调用
// 没有使用锁或乐观锁
const task = await db.getPptTaskById(input.taskId);
// ... 处理
await db.updatePptTask(input.taskId, { ... });
```

**影响**: 可能导致任务状态不一致或重复处理

---

### C8. 无限制的文件上传

**位置**: `server/routers.ts:786-858`

**问题描述**:
- 虽然有 50MB 大小限制，但未限制上传频率
- 未验证文件内容类型（只检查声明的 contentType）
- Base64 编码的文件会使内存占用加倍

```typescript
// 接受任意 base64 数据，无内容验证
const buffer = Buffer.from(input.base64Data, "base64");
```

---

## 🟠 高优先级问题 (HIGH)

### H1. 错误处理不一致

**位置**: 多处

**问题描述**:
- 某些错误被静默吞掉
- 用户看到的错误信息不一致（中英文混合）

```typescript
// 有时返回 null
catch (error) {
  console.error("[Auth] Error in simple auth:", error);
  user = null;  // 静默失败
}

// 有时抛出异常
throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "生成服务调用失败" });
```

---

### H2. 内存存储回退机制可能导致数据丢失

**位置**: `server/db.ts`

**问题描述**: 数据库操作失败时回退到内存存储，但：
- 用户不知道数据在内存中
- 服务重启后内存数据丢失
- 后续请求可能从数据库读取旧数据

```typescript
catch (error) {
  console.error("[Database] Failed to upsert user:", error);
  memStore.memoryUpsertUser(user);  // 数据只在内存中！
}
```

---

### H3. 前端缺少请求超时和重试机制

**位置**: `client/src/pages/TaskDetail.tsx`

**问题描述**:
- 轮询失败不会显示给用户
- 没有指数退避
- 没有最大重试次数

```typescript
const interval = setInterval(() => {
  pollMutation.mutate({ taskId });  // 无错误处理
}, 2000);
```

---

### H4. 未处理的 Promise 拒绝

**位置**: `server/routers.ts`

**问题描述**:
```typescript
// downloadFile 调用后未等待完成
setTimeout(async () => {
  try {
    const newPool = await connectWithRetry(3, 2000);
    // 这个 Promise 拒绝不会被捕获
  } catch (e) {
    console.error('[Database] Background reconnection failed:', e);
  }
}, 1000);
```

---

### H5. 硬编码的默认值

**位置**: 多处

**问题描述**:
```typescript
// 硬编码的中文字体，可能在某些系统上不可用
fontFamily: varchar("fontFamily", { length: 128 }).default("微软雅黑").notNull(),

// 硬编码的 API URL
pptEngineApiUrl: process.env.PPT_ENGINE_API_URL ?? "https://api.manus.im/v1",
```

---

### H6. ErrorBoundary 不够完善

**位置**: `client/src/components/ErrorBoundary.tsx`

**问题描述**:
- 没有错误上报功能
- 没有重试选项（只能刷新整个页面）
- 堆栈信息直接展示给用户（生产环境不应如此）

```typescript
<pre className="text-sm text-muted-foreground whitespace-break-spaces">
  {this.state.error?.stack}  // 生产环境不应展示
</pre>
```

---

### H7. API 响应未验证

**位置**: `server/ppt-engine.ts`

**问题描述**: 来自外部 API 的响应未经验证直接使用：

```typescript
async getTask(taskId: string): Promise<EngineTask> {
  const response = await this.client.get(url);
  // 直接使用 response.data，无 schema 验证
  return {
    id: response.data.id || taskId,
    status: response.data.status,
    // ...
  };
}
```

---

## 🟡 中等问题 (MEDIUM)

### M1. 重复的数据库代码

**位置**: `server/db.ts`

**问题描述**: PostgreSQL 和 MySQL 的代码大量重复，维护困难。例如 `updatePptTask` 函数有超过 100 行几乎相同的代码。

---

### M2. 缺少数据验证层

**问题描述**: Zod schema 只用于 API 输入，内部数据流缺少验证。

---

### M3. 日志记录不规范

**问题描述**:
- 使用 `console.log/warn/error` 而非结构化日志
- 缺少请求 ID 追踪
- 敏感信息可能被记录

```typescript
console.log('[PPTEngine] Task created successfully');
console.log('[PPTEngine] Full response keys:', Object.keys(response.data));  // 可能泄露结构
```

---

### M4. 缺少单元测试覆盖

**位置**: `server/*.test.ts`

**问题描述**: 测试文件存在但覆盖率低：
- 只有认证和少量 API 测试
- 缺少数据库操作测试
- 缺少前端组件测试

---

### M5. TypeScript 类型使用不一致

**问题描述**:
```typescript
// 有时使用 any
const output = response.data.output;
msg.content.forEach((item: any, idx: number) => {

// 有时类型正确定义
interface TimelineEvent {
  time: string;
  event: string;
  status: string;
}
```

---

## 🟢 低优先级问题 (LOW)

### L1. 魔法数字和字符串

```typescript
const maxRetries = 5;
const MAX_FILE_SIZE_MB = 50;
const timeout = Math.max(60000, 60000 + fileSizeMB * 30000);
```

建议提取为配置常量。

---

### L2. 未优化的数据库查询

`task.list` 查询中为每个任务单独获取项目：

```typescript
const enrichedTasks = await Promise.all(
  tasks.map(async (task) => {
    const project = await db.getProjectById(task.projectId);  // N+1 问题
    return { ...task, project };
  })
);
```

---

### L3. 前端状态管理可优化

使用多个 `useState` 而非 reducer 或状态机，导致状态同步复杂。

---

## 修复优先级建议

### 第一优先级（立即修复）
1. C1 - 身份认证安全
2. C5 - 文件访问控制
3. C8 - 文件上传验证

### 第二优先级（1周内）
4. C2 - 持久化重试计数
5. C3 - 环境变量管理
6. H1 - 统一错误处理
7. H2 - 改进回退机制

### 第三优先级（2周内）
8. C4 - SQL 注入风险
9. C6 - 连接池管理
10. C7 - 竞态条件
11. H3-H7 其他高优先级问题

### 第四优先级（持续改进）
12. 中/低优先级问题
13. 测试覆盖率
14. 代码重构

---

## 架构改进建议

### 1. 认证系统重构

```typescript
// 建议的认证流程
interface AuthConfig {
  type: 'jwt' | 'session';
  secret: string;
  expiresIn: string;
}

// 服务端生成 token
async function login(username: string, password: string): Promise<string> {
  const user = await verifyCredentials(username, password);
  return signJWT({ userId: user.id, role: user.role });
}

// 中间件验证
function requireAuth(ctx: Context): asserts ctx is AuthenticatedContext {
  const token = extractToken(ctx.req);
  ctx.user = verifyJWT(token);
}
```

### 2. 错误处理统一

```typescript
// 统一的错误类
class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
  }
}

// 错误处理中间件
function errorHandler(err: Error, ctx: Context) {
  if (err instanceof AppError && err.isOperational) {
    return { code: err.code, message: err.message };
  }
  // 记录并返回通用错误
  logger.error('Unexpected error', { error: err });
  return { code: 'INTERNAL_ERROR', message: '系统错误，请稍后重试' };
}
```

### 3. 数据库抽象层

```typescript
// 使用 Repository 模式
interface TaskRepository {
  findById(id: number): Promise<Task | null>;
  findByUserId(userId: number): Promise<Task[]>;
  create(data: CreateTaskInput): Promise<Task>;
  update(id: number, data: UpdateTaskInput): Promise<Task>;
  delete(id: number): Promise<void>;
}

// 统一实现，避免重复代码
class DrizzleTaskRepository implements TaskRepository {
  // 使用 Drizzle ORM 的类型安全方法
}
```

---

## 总结

该项目功能相对完整，但存在多个严重的安全和可靠性问题，在投入生产使用前必须解决。最紧迫的问题是身份认证系统，其次是文件访问控制和输入验证。

建议按照优先级逐步修复，同时建立持续集成流程以防止新问题引入。
