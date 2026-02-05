# TapiPowerPoint 测试计划

基于 Spec-Driven Development 原则的完整测试策略。

---

## 测试原则 (基于 SDD)

### 1. 测试驱动开发 (TDD)
- ✅ 所有测试必须在实现之前编写
- ✅ 测试失败 (Red) → 实现 (Green) → 重构 (Refactor)
- ✅ 测试是规范的可执行文档

### 2. 集成优先测试
- ✅ 优先使用真实服务而非 Mock
- ✅ 使用真实测试数据库
- ✅ Mock 仅用于外部服务 (第三方 API)

### 3. 测试创建顺序
1. Contract Tests (契约测试)
2. Integration Tests (集成测试)
3. E2E Tests (端到端测试)
4. Unit Tests (单元测试)

---

## 测试覆盖目标

| 类型 | 当前覆盖率 | 目标覆盖率 | 状态 |
|------|-----------|-----------|------|
| 单元测试 | ~40% | 80% | 🟡 进行中 |
| 集成测试 | ~10% | 70% | 🔴 缺失 |
| E2E 测试 | 0% | 60% | 🔴 缺失 |
| 总体覆盖率 | ~25% | 75% | 🔴 不足 |

---

## I. 服务器端测试

### A. 单元测试 (Unit Tests)

#### ✅ 已完成

1. **Authentication** (`server/auth.test.ts`)
   - JWT 创建和验证
   - Token 提取
   - 密码哈希 (需要改进为 bcrypt)

2. **PPT Engine 工具函数** (`server/ppt-engine.test.ts`)
   - MIME 类型检测
   - Prompt 构建
   - 错误类型

3. **其他已有测试**
   - `auth.logout.test.ts`
   - `errors.test.ts`
   - `poll.test.ts`
   - `simple-auth.test.ts`
   - `storage.test.ts`
   - `template.test.ts`

#### 🔴 缺失 - 需要创建

1. **LLM 模块** (`server/_core/llm.ts`)
   ```typescript
   describe('LLM Module', () => {
     describe('invokeLLM', () => {
       it('should format messages correctly')
       it('should handle tool calls')
       it('should validate response format')
       it('should handle API errors gracefully')
       it('should respect timeout settings')
     });
     
     describe('normalizeMessage', () => {
       it('should handle text content')
       it('should handle image content')
       it('should handle file content')
       it('should handle tool responses')
     });
   });
   ```

2. **存储模块** (`server/storage.ts`)
   ```typescript
   describe('Storage Operations', () => {
     describe('storagePut', () => {
       it('should upload file to S3')
       it('should generate presigned URL')
       it('should handle large files')
       it('should validate content type')
     });
     
     describe('storageGet', () => {
       it('should retrieve file from S3')
       it('should handle non-existent files')
       it('should return presigned download URL')
     });
   });
   ```

3. **PPT Engine Client** (`server/ppt-engine.ts`)
   ```typescript
   describe('PPTEngineClient', () => {
     describe('createProject', () => {
       it('should create project with instruction')
       it('should handle API errors')
       it('should retry on network failure')
     });
     
     describe('uploadFile', () => {
       it('should upload file to engine')
       it('should handle file size limits')
       it('should validate file types')
     });
     
     describe('createTask', () => {
       it('should create generation task')
       it('should attach files correctly')
       it('should set interactive mode')
     });
     
     describe('getTask', () => {
       it('should fetch task status')
       it('should extract PPTX files from response')
       it('should extract PDF files from response')
       it('should handle various output formats')
     });
   });
   ```

### B. 集成测试 (Integration Tests)

#### ✅ 已创建骨架

1. **Router 集成测试** (`server/routers.test.ts`)
   - Auth Router
   - Project Router
   - Task Router
   - File Router
   - Template Router

2. **数据库集成测试** (`server/db.test.ts`)
   - User CRUD 操作
   - Project CRUD 操作
   - Task CRUD 操作
   - Timeline Events
   - 约束和验证

#### 🔴 需要实现

**测试环境设置**:
```typescript
// server/test-utils/db-setup.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export async function createTestDb() {
  const testDb = postgres(process.env.TEST_DATABASE_URL!);
  const db = drizzle(testDb);
  
  // Clean database before each test
  await db.execute(sql`TRUNCATE TABLE users, projects, ppt_tasks CASCADE`);
  
  return db;
}

export async function cleanupTestDb(db: any) {
  await db.execute(sql`TRUNCATE TABLE users, projects, ppt_tasks CASCADE`);
}
```

**实际运行集成测试**:
1. 设置测试数据库
2. 运行数据库迁移
3. 执行所有集成测试
4. 清理测试数据

### C. Manus API 集成测试

#### ✅ 已有骨架
`server/manus-api.test.ts`

#### 🔴 需要完善
```typescript
describe('Manus API Integration', () => {
  describe('Project Management', () => {
    it('should create project via API')
    it('should retrieve project details')
    it('should handle invalid credentials')
  });
  
  describe('File Upload', () => {
    it('should upload file and get file ID')
    it('should handle large files')
    it('should reject invalid file types')
  });
  
  describe('Task Execution', () => {
    it('should create and monitor task')
    it('should handle task completion')
    it('should handle task failure')
    it('should handle ask status')
  });
  
  describe('Error Handling', () => {
    it('should retry on 429 rate limit')
    it('should fail gracefully on 500 errors')
    it('should handle network timeouts')
  });
});
```

---

## II. 客户端测试

### A. 组件单元测试

#### ✅ 已创建示例

1. **PPTPreview Component** (`client/src/components/__tests__/PPTPreview.test.tsx`)
   - 渲染测试
   - 下载操作
   - 状态显示
   - 可访问性
   - 边界情况

#### 🔴 需要创建

1. **核心组件**
   ```typescript
   // AIChatBox.test.tsx
   describe('AIChatBox', () => {
     it('should render chat interface')
     it('should send message on submit')
     it('should display message history')
     it('should show typing indicator')
     it('should handle long messages')
   });
   
   // AuthDialog.test.tsx
   describe('AuthDialog', () => {
     it('should show login form')
     it('should validate username input')
     it('should submit login on Enter key')
     it('should show error message on failure')
     it('should close on successful login')
   });
   
   // DashboardLayout.test.tsx
   describe('DashboardLayout', () => {
     it('should render navigation')
     it('should highlight active route')
     it('should show user info')
     it('should handle logout')
     it('should be responsive')
   });
   
   // RealProgressBar.test.tsx
   describe('RealProgressBar', () => {
     it('should show progress percentage')
     it('should animate progress changes')
     it('should display current step')
     it('should handle 0% and 100%')
   });
   
   // EmbeddedPPTViewer.test.tsx
   describe('EmbeddedPPTViewer', () => {
     it('should embed PDF iframe')
     it('should show loading state')
     it('should handle embed errors')
     it('should support fullscreen')
   });
   ```

2. **UI 组件库**
   - 对于 `client/src/components/ui/` 下的所有组件
   - 至少测试基本渲染和交互
   - 验证可访问性 (ARIA 属性)

### B. Hook 测试

#### ✅ 已创建示例

1. **useAuth Hook** (`client/src/hooks/__tests__/useAuth.test.ts`)
   - 初始状态
   - 登录功能
   - 登出功能
   - 权限检查
   - 边界情况

#### 🔴 需要创建

```typescript
// useComposition.test.ts
describe('useComposition', () => {
  it('should track composition state')
  it('should handle IME input')
  it('should prevent action during composition')
});

// useMobile.test.tsx
describe('useMobile', () => {
  it('should detect mobile viewport')
  it('should update on window resize')
  it('should handle orientation change')
});

// usePersistFn.test.ts
describe('usePersistFn', () => {
  it('should maintain function reference')
  it('should always call latest function')
  it('should handle async functions')
});
```

### C. Context 测试

```typescript
// SimpleAuthContext.test.tsx
describe('SimpleAuthContext', () => {
  it('should provide auth state')
  it('should update on login')
  it('should clear on logout')
  it('should persist across page reloads')
});

// ThemeContext.test.tsx
describe('ThemeContext', () => {
  it('should provide theme state')
  it('should toggle theme')
  it('should persist theme preference')
  it('should apply system theme')
});
```

### D. Page 测试

```typescript
// Home.test.tsx
describe('Home Page', () => {
  it('should render landing page')
  it('should show features')
  it('should navigate to login')
});

// Projects.test.tsx
describe('Projects Page', () => {
  it('should list user projects')
  it('should create new project')
  it('should navigate to project detail')
  it('should delete project')
});

// Tasks.test.tsx
describe('Tasks Page', () => {
  it('should list user tasks')
  it('should filter by status')
  it('should create new task')
  it('should show task details')
});

// TaskDetail.test.tsx
describe('TaskDetail Page', () => {
  it('should show task information')
  it('should poll for updates')
  it('should download results')
  it('should retry failed tasks')
  it('should respond to ask status')
});
```

---

## III. 端到端测试 (E2E)

### A. 测试工具选择

推荐使用 **Playwright** 或 **Cypress**:
- Playwright: 更现代,支持多浏览器
- Cypress: 更成熟,易于调试

### B. 关键用户流程

#### 1. 用户认证流程
```typescript
describe('User Authentication Flow', () => {
  it('should complete full login flow', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.click('[data-testid="submit-login"]');
    
    // Verify redirected to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-name"]'))
      .toContainText('testuser');
  });
  
  it('should logout successfully', async ({ page }) => {
    // Login first
    await loginAsUser(page, 'testuser');
    
    // Logout
    await page.click('[data-testid="logout-button"]');
    
    // Verify redirected to home
    await expect(page).toHaveURL('/');
  });
});
```

#### 2. PPT 生成完整流程
```typescript
describe('PPT Generation Flow', () => {
  it('should generate PPT from text input', async ({ page }) => {
    await loginAsUser(page, 'testuser');
    
    // Navigate to create task
    await page.click('[data-testid="new-task-button"]');
    
    // Fill in task details
    await page.fill('[data-testid="task-title"]', 'Test Presentation');
    await page.fill('[data-testid="proposal-content"]', 
      'This is a test presentation about AI technology');
    
    // Submit
    await page.click('[data-testid="create-task-button"]');
    
    // Wait for task completion (with timeout)
    await page.waitForSelector('[data-testid="download-pptx"]', {
      timeout: 120000, // 2 minutes
    });
    
    // Verify results available
    const downloadBtn = page.locator('[data-testid="download-pptx"]');
    await expect(downloadBtn).toBeEnabled();
  });
  
  it('should handle file upload', async ({ page }) => {
    await loginAsUser(page, 'testuser');
    
    // Upload file
    const fileInput = page.locator('[data-testid="file-input"]');
    await fileInput.setInputFiles('test-files/sample.docx');
    
    // Verify upload success
    await expect(page.locator('[data-testid="file-uploaded"]'))
      .toBeVisible();
    
    // Create task with uploaded file
    await page.click('[data-testid="create-task-button"]');
    
    // Verify task created
    await expect(page.locator('[data-testid="task-status"]'))
      .toContainText('running');
  });
});
```

#### 3. 项目管理流程
```typescript
describe('Project Management Flow', () => {
  it('should create and manage design spec project', async ({ page }) => {
    await loginAsUser(page, 'testuser');
    
    // Create project
    await page.click('[data-testid="new-project-button"]');
    await page.fill('[data-testid="project-name"]', 'Corporate Blue');
    await page.fill('[data-testid="primary-color"]', '#0033A0');
    await page.click('[data-testid="create-project"]');
    
    // Verify project created
    await expect(page.locator('[data-testid="project-list"]'))
      .toContainText('Corporate Blue');
    
    // Edit project
    await page.click('[data-testid="edit-project"]');
    await page.fill('[data-testid="project-name"]', 'Updated Blue');
    await page.click('[data-testid="save-project"]');
    
    // Verify update
    await expect(page.locator('[data-testid="project-name"]'))
      .toContainText('Updated Blue');
    
    // Delete project
    await page.click('[data-testid="delete-project"]');
    await page.click('[data-testid="confirm-delete"]');
    
    // Verify deleted
    await expect(page.locator('[data-testid="project-list"]'))
      .not.toContainText('Updated Blue');
  });
});
```

#### 4. 错误处理流程
```typescript
describe('Error Handling Flows', () => {
  it('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline
    await page.context().setOffline(true);
    
    await loginAsUser(page, 'testuser');
    await page.click('[data-testid="new-task-button"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="error-message"]'))
      .toContainText('network error');
  });
  
  it('should retry failed tasks', async ({ page }) => {
    await loginAsUser(page, 'testuser');
    
    // Find failed task
    await page.click('[data-testid="failed-task"]');
    
    // Click retry
    await page.click('[data-testid="retry-button"]');
    
    // Verify task restarted
    await expect(page.locator('[data-testid="task-status"]'))
      .toContainText('running');
  });
});
```

---

## IV. 性能测试

### A. 负载测试
```typescript
// tests/performance/load.test.ts
import { test } from '@playwright/test';

test('should handle 100 concurrent users', async () => {
  // Use k6 or artillery for load testing
  const results = await runLoadTest({
    users: 100,
    duration: '5m',
    endpoints: [
      { path: '/api/trpc/project.list', method: 'GET' },
      { path: '/api/trpc/task.create', method: 'POST' },
    ],
  });
  
  expect(results.p95ResponseTime).toBeLessThan(2000); // < 2s
  expect(results.errorRate).toBeLessThan(0.01); // < 1%
});
```

### B. 文件上传性能
```typescript
test('should handle large file uploads', async ({ page }) => {
  const start = Date.now();
  
  // Upload 45MB file (near limit)
  await page.setInputFiles('[data-testid="file-input"]', 'test-files/large-45mb.pdf');
  
  await page.waitForSelector('[data-testid="upload-success"]');
  const duration = Date.now() - start;
  
  expect(duration).toBeLessThan(60000); // < 60s
});
```

---

## V. 测试数据管理

### A. 测试夹具 (Fixtures)

```typescript
// tests/fixtures/users.ts
export const testUsers = {
  admin: {
    openId: 'test_admin',
    name: 'Admin User',
    role: 'admin',
  },
  regularUser: {
    openId: 'test_user',
    name: 'Regular User',
    role: 'user',
  },
};

// tests/fixtures/projects.ts
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

### B. 测试数据库种子

```typescript
// tests/setup/seed.ts
export async function seedTestData(db: Database) {
  // Create test users
  for (const user of Object.values(testUsers)) {
    await db.createUser(user);
  }
  
  // Create test projects
  for (const project of Object.values(testProjects)) {
    await db.createProject({
      userId: testUsers.regularUser.id,
      ...project,
    });
  }
}
```

---

## VI. 测试执行计划

### A. 本地开发

```bash
# 运行单元测试
npm test

# 运行特定测试文件
npm test server/auth.test.ts

# 监听模式
npm test -- --watch

# 覆盖率报告
npm test -- --coverage
```

### B. CI/CD 流程

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
      
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:integration
      
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npx playwright install
      - run: npm run test:e2e
```

---

## VII. 质量门槛

### A. 合并要求

Pull Request 必须满足:
- ✅ 所有单元测试通过
- ✅ 代码覆盖率 ≥ 当前覆盖率 (不降低)
- ✅ 新功能必须有测试
- ✅ 关键 E2E 流程测试通过

### B. 发布要求

Release 必须满足:
- ✅ 所有测试通过 (单元 + 集成 + E2E)
- ✅ 代码覆盖率 ≥ 75%
- ✅ 性能测试通过
- ✅ 无已知 P0/P1 bug

---

## VIII. 优先级和时间线

### 阶段 1: 基础测试 (2 周)
- ✅ 完成所有单元测试
- ✅ 设置测试数据库
- ✅ 实现 Router 集成测试

### 阶段 2: 前端测试 (2 周)
- ✅ 完成所有组件测试
- ✅ 完成所有 Hook 测试
- ✅ 添加 Context 测试

### 阶段 3: E2E 测试 (2 周)
- ✅ 设置 Playwright
- ✅ 实现关键流程测试
- ✅ 添加错误场景测试

### 阶段 4: 性能和优化 (1 周)
- ✅ 负载测试
- ✅ 性能基准
- ✅ 优化慢速测试

---

## IX. 测试最佳实践

### A. 测试命名
```typescript
// ✅ GOOD - Descriptive names
it('should return 404 for non-existent project')
it('should validate color format before saving')

// ❌ BAD - Vague names
it('works')
it('test project')
```

### B. 测试结构 (AAA)
```typescript
it('should create user with valid data', async () => {
  // Arrange - Setup test data
  const userData = { name: 'Test', email: 'test@example.com' };
  
  // Act - Execute the test
  const user = await createUser(userData);
  
  // Assert - Verify results
  expect(user.id).toBeDefined();
  expect(user.name).toBe('Test');
});
```

### C. 避免测试脆弱性
```typescript
// ❌ BAD - Brittle test
expect(result).toEqual({ 
  id: 1, 
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01' 
});

// ✅ GOOD - Flexible test
expect(result).toMatchObject({ id: expect.any(Number) });
expect(result.createdAt).toBeInstanceOf(Date);
```

### D. 独立测试
```typescript
// Each test should be independent
beforeEach(async () => {
  // Clean database
  await db.cleanup();
  // Seed fresh data
  await seedTestData();
});

afterEach(async () => {
  // Clean up
  await db.cleanup();
});
```

---

## X. 资源和工具

### A. 测试库
- **Vitest**: 单元测试框架
- **@testing-library/react**: React 组件测试
- **@testing-library/user-event**: 用户交互模拟
- **Playwright**: E2E 测试
- **MSW**: API Mocking

### B. 测试数据
- **Faker.js**: 生成测试数据
- **test-data-bot**: 测试数据构建器

### C. 质量工具
- **Istanbul/c8**: 代码覆盖率
- **Lighthouse**: 性能测试
- **axe-core**: 可访问性测试

---

## 总结

这个测试计划遵循 Spec-Driven Development 原则,强调:
1. 测试驱动开发 (Test-First)
2. 集成优先测试 (Integration-First)
3. 真实环境测试 (Real Services)
4. 完整的测试覆盖 (Comprehensive Coverage)

完成这个测试计划将显著提高项目质量、可维护性和信心。

**预计总工作量**: 约 7 周  
**当前进度**: ~15% 完成  
**下一步**: 开始阶段 1 - 基础测试
