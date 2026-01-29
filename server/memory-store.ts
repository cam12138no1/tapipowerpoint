// In-memory storage fallback when database is not available
// This allows the application to work without a database for demo/testing purposes

import { InsertUser, InsertProject, InsertPptTask, Project, PptTask } from "../drizzle/schema";

// In-memory storage
const memoryStore = {
  users: new Map<string, any>(),
  projects: new Map<number, Project>(),
  pptTasks: new Map<number, PptTask>(),
  projectIdCounter: 1,
  taskIdCounter: 1,
  userIdCounter: 1,
};

// ============ User Operations ============

export function memoryUpsertUser(user: InsertUser): any {
  const existing = memoryStore.users.get(user.openId);
  if (existing) {
    const updated = { ...existing, ...user, lastSignedIn: new Date() };
    memoryStore.users.set(user.openId, updated);
    return updated;
  } else {
    const newUser = {
      id: memoryStore.userIdCounter++,
      openId: user.openId,
      name: user.name || null,
      email: user.email || null,
      loginMethod: user.loginMethod || 'simple',
      role: user.role || 'user',
      lastSignedIn: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.users.set(user.openId, newUser);
    return newUser;
  }
}

export function memoryGetUserByOpenId(openId: string): any | undefined {
  return memoryStore.users.get(openId);
}

export function memoryGetOrCreateUser(openId: string, name?: string): any {
  let user = memoryStore.users.get(openId);
  if (!user) {
    user = {
      id: memoryStore.userIdCounter++,
      openId,
      name: name || openId,
      email: null,
      loginMethod: 'simple',
      role: 'user',
      lastSignedIn: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryStore.users.set(openId, user);
  }
  return user;
}

export function memoryGetAllUsers(): any[] {
  return Array.from(memoryStore.users.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ============ Project Operations ============

export function memoryCreateProject(data: InsertProject): Project {
  const id = memoryStore.projectIdCounter++;
  const project: Project = {
    id,
    userId: data.userId,
    name: data.name,
    engineProjectId: data.engineProjectId || null,
    designSpec: data.designSpec || null,
    primaryColor: data.primaryColor || '#0c87eb',
    secondaryColor: data.secondaryColor || '#737373',
    accentColor: data.accentColor || '#10b981',
    fontFamily: data.fontFamily || '微软雅黑',
    logoUrl: data.logoUrl || null,
    logoFileKey: data.logoFileKey || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryStore.projects.set(id, project);
  return project;
}

export function memoryGetProjectById(id: number): Project | undefined {
  return memoryStore.projects.get(id);
}

export function memoryGetProjectsByUserId(userId: number): Project[] {
  return Array.from(memoryStore.projects.values())
    .filter(p => p.userId === userId)
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
}

export function memoryUpdateProject(id: number, data: Partial<InsertProject>): Project | undefined {
  const project = memoryStore.projects.get(id);
  if (!project) return undefined;
  
  const updated = { ...project, ...data, updatedAt: new Date() };
  memoryStore.projects.set(id, updated);
  return updated;
}

export function memoryDeleteProject(id: number): void {
  memoryStore.projects.delete(id);
}

// ============ PPT Task Operations ============

export function memoryCreatePptTask(data: InsertPptTask): PptTask {
  const id = memoryStore.taskIdCounter++;
  const task: PptTask = {
    id,
    userId: data.userId,
    projectId: data.projectId,
    title: data.title,
    engineTaskId: data.engineTaskId || null,
    status: data.status || 'pending',
    currentStep: data.currentStep || null,
    progress: data.progress || 0,
    sourceFileName: data.sourceFileName || null,
    sourceFileId: data.sourceFileId || null,
    sourceFileUrl: data.sourceFileUrl || null,
    proposalContent: data.proposalContent || null,
    imageAttachments: data.imageAttachments || '[]',
    interactionData: data.interactionData || null,
    outputContent: data.outputContent || null,
    shareUrl: data.shareUrl || null,
    resultPptxUrl: data.resultPptxUrl || null,
    resultPdfUrl: data.resultPdfUrl || null,
    resultFileKey: data.resultFileKey || null,
    errorMessage: data.errorMessage || null,
    timelineEvents: data.timelineEvents || JSON.stringify([
      { time: new Date().toISOString(), event: '任务已创建', status: 'completed' },
    ]),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryStore.pptTasks.set(id, task);
  return task;
}

export function memoryGetPptTaskById(id: number): PptTask | undefined {
  return memoryStore.pptTasks.get(id);
}

export function memoryGetPptTasksByUserId(userId: number): PptTask[] {
  return Array.from(memoryStore.pptTasks.values())
    .filter(t => t.userId === userId)
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
}

export function memoryGetPptTaskWithProject(taskId: number): any | undefined {
  const task = memoryStore.pptTasks.get(taskId);
  if (!task) return undefined;
  
  const project = task.projectId ? memoryStore.projects.get(task.projectId) : null;
  return { ...task, project };
}

export function memoryUpdatePptTask(id: number, data: Partial<InsertPptTask>): PptTask | undefined {
  const task = memoryStore.pptTasks.get(id);
  if (!task) return undefined;
  
  const updated = { ...task, ...data, updatedAt: new Date() };
  memoryStore.pptTasks.set(id, updated as PptTask);
  return updated as PptTask;
}

export function memoryAddTimelineEvent(taskId: number, event: string, status: string): void {
  const task = memoryStore.pptTasks.get(taskId);
  if (!task) return;
  
  const events = JSON.parse(task.timelineEvents || '[]');
  events.push({ time: new Date().toISOString(), event, status });
  task.timelineEvents = JSON.stringify(events);
  memoryStore.pptTasks.set(taskId, task);
}

export function memoryDeletePptTask(id: number): void {
  memoryStore.pptTasks.delete(id);
}

// Check if memory store is being used
export function isUsingMemoryStore(): boolean {
  return !process.env.DATABASE_URL;
}

// Clear all data (for testing)
export function memoryClearAll(): void {
  memoryStore.users.clear();
  memoryStore.projects.clear();
  memoryStore.pptTasks.clear();
  memoryStore.projectIdCounter = 1;
  memoryStore.taskIdCounter = 1;
  memoryStore.userIdCounter = 1;
}
