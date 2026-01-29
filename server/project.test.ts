import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getProjectsByUserId: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      name: "Test Project",
      manusProjectId: "manus-123",
      primaryColor: "#0c87eb",
      secondaryColor: "#737373",
      accentColor: "#10b981",
      fontFamily: "微软雅黑",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getProjectById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) {
      return Promise.resolve({
        id: 1,
        userId: 1,
        name: "Test Project",
        manusProjectId: "manus-123",
        primaryColor: "#0c87eb",
        secondaryColor: "#737373",
        accentColor: "#10b981",
        fontFamily: "微软雅黑",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return Promise.resolve(undefined);
  }),
  createProject: vi.fn().mockImplementation((data) => {
    return Promise.resolve({
      id: 2,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }),
  updateProject: vi.fn().mockImplementation((id, data) => {
    return Promise.resolve({
      id,
      userId: 1,
      name: data.name || "Test Project",
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  getPptTasksByUserId: vi.fn().mockResolvedValue([]),
  getPptTaskById: vi.fn().mockResolvedValue(undefined),
  createPptTask: vi.fn().mockResolvedValue({ id: 1 }),
}));

// Mock the manus client
vi.mock("./manus-client", () => ({
  manusClient: {
    createProject: vi.fn().mockResolvedValue({ id: "manus-new-123" }),
    createTask: vi.fn().mockResolvedValue({ task_id: "task-123" }),
    getTask: vi.fn().mockResolvedValue({ status: "running" }),
    uploadFile: vi.fn().mockResolvedValue("file-123"),
  },
  getMimeType: vi.fn().mockReturnValue("application/pdf"),
  buildPPTPrompt: vi.fn().mockReturnValue("Generate PPT"),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("project router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists user projects", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.list();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test Project");
  });

  it("gets a project by id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.get({ id: 1 });

    expect(result).toBeDefined();
    expect(result.name).toBe("Test Project");
  });

  it("throws NOT_FOUND for non-existent project", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.project.get({ id: 999 })).rejects.toThrow("Project not found");
  });

  it("creates a new project", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.project.create({
      name: "New Project",
      primaryColor: "#ff0000",
      secondaryColor: "#00ff00",
      accentColor: "#0000ff",
      fontFamily: "Arial",
    });

    expect(result).toBeDefined();
    expect(result.name).toBe("New Project");
  });
});

describe("task router", () => {
  it("lists user tasks", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.task.list();

    expect(result).toEqual([]);
  });
});
