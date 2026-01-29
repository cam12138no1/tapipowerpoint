import { eq, desc, and } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { Pool } from "pg";
import { InsertUser, users, projects, pptTasks, InsertProject, InsertPptTask, Project, PptTask } from "../drizzle/schema";
import { ENV } from './_core/env';
import * as memStore from './memory-store';

let _db: any = null;
let _dbInitialized = false;
let _dbType: 'postgres' | 'mysql' | 'memory' = 'memory';

// Check if we should use memory store
function useMemoryStore(): boolean {
  return !process.env.DATABASE_URL;
}

// Detect database type from URL
function detectDbType(url: string): 'postgres' | 'mysql' {
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'postgres';
  }
  return 'mysql';
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (_dbInitialized) return _db;
  
  _dbInitialized = true;
  
  if (process.env.DATABASE_URL) {
    try {
      _dbType = detectDbType(process.env.DATABASE_URL);
      
      if (_dbType === 'postgres') {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });
        _db = drizzlePg(pool);
        console.log("[Database] Connected to PostgreSQL database");
      } else {
        _db = drizzleMysql(process.env.DATABASE_URL);
        console.log("[Database] Connected to MySQL database");
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _dbType = 'memory';
    }
  } else {
    console.log("[Database] No DATABASE_URL configured, using in-memory storage");
    _db = null;
    _dbType = 'memory';
  }
  return _db;
}

// ============ User Operations ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  if (useMemoryStore()) {
    memStore.memoryUpsertUser(user);
    return;
  }

  const db = await getDb();
  if (!db) {
    memStore.memoryUpsertUser(user);
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    if (_dbType === 'postgres') {
      // PostgreSQL upsert
      const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
      if (existing.length > 0) {
        await db.update(users).set(updateSet).where(eq(users.openId, user.openId));
      } else {
        await db.insert(users).values(values);
      }
    } else {
      // MySQL upsert
      await db.insert(users).values(values).onDuplicateKeyUpdate({
        set: updateSet,
      });
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    // Fallback to memory store
    memStore.memoryUpsertUser(user);
  }
}

export async function getUserByOpenId(openId: string) {
  if (useMemoryStore()) {
    return memStore.memoryGetUserByOpenId(openId);
  }

  const db = await getDb();
  if (!db) {
    return memStore.memoryGetUserByOpenId(openId);
  }

  try {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get user:", error);
    return memStore.memoryGetUserByOpenId(openId);
  }
}

// Get or create user (for simple auth)
export async function getOrCreateUser(openId: string, name?: string) {
  if (useMemoryStore()) {
    return memStore.memoryGetOrCreateUser(openId, name);
  }

  const db = await getDb();
  if (!db) {
    return memStore.memoryGetOrCreateUser(openId, name);
  }

  try {
    let [user] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    if (!user) {
      if (_dbType === 'postgres') {
        await db.insert(users).values({
          openId,
          name: name || openId,
          loginMethod: 'simple',
          lastSignedIn: new Date(),
        }).returning();
        [user] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      } else {
        await db.insert(users).values({
          openId,
          name: name || openId,
          loginMethod: 'simple',
          lastSignedIn: new Date(),
        });
        [user] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      }
    }
    return user;
  } catch (error) {
    console.error("[Database] Failed to get/create user:", error);
    return memStore.memoryGetOrCreateUser(openId, name);
  }
}

// ============ Project Operations ============

export async function createProject(data: InsertProject): Promise<Project> {
  if (useMemoryStore()) {
    return memStore.memoryCreateProject(data);
  }

  const db = await getDb();
  if (!db) {
    return memStore.memoryCreateProject(data);
  }

  try {
    if (_dbType === 'postgres') {
      const [project] = await db.insert(projects).values(data).returning();
      return project;
    } else {
      const result = await db.insert(projects).values(data);
      const insertId = result[0].insertId;
      const [project] = await db.select().from(projects).where(eq(projects.id, insertId));
      return project;
    }
  } catch (error) {
    console.error("[Database] Failed to create project:", error);
    return memStore.memoryCreateProject(data);
  }
}

export async function getProjectById(id: number): Promise<Project | undefined> {
  if (useMemoryStore()) {
    return memStore.memoryGetProjectById(id);
  }

  const db = await getDb();
  if (!db) {
    return memStore.memoryGetProjectById(id);
  }

  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  } catch (error) {
    console.error("[Database] Failed to get project:", error);
    return memStore.memoryGetProjectById(id);
  }
}

export async function getProjectsByUserId(userId: number): Promise<Project[]> {
  if (useMemoryStore()) {
    return memStore.memoryGetProjectsByUserId(userId);
  }

  const db = await getDb();
  if (!db) {
    return memStore.memoryGetProjectsByUserId(userId);
  }

  try {
    return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get projects:", error);
    return memStore.memoryGetProjectsByUserId(userId);
  }
}

export async function updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
  if (useMemoryStore()) {
    return memStore.memoryUpdateProject(id, data);
  }

  const db = await getDb();
  if (!db) {
    return memStore.memoryUpdateProject(id, data);
  }

  try {
    await db.update(projects).set(data).where(eq(projects.id, id));
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  } catch (error) {
    console.error("[Database] Failed to update project:", error);
    return memStore.memoryUpdateProject(id, data);
  }
}

export async function deleteProject(id: number): Promise<void> {
  if (useMemoryStore()) {
    memStore.memoryDeleteProject(id);
    return;
  }

  const db = await getDb();
  if (!db) {
    memStore.memoryDeleteProject(id);
    return;
  }

  try {
    await db.delete(projects).where(eq(projects.id, id));
  } catch (error) {
    console.error("[Database] Failed to delete project:", error);
    memStore.memoryDeleteProject(id);
  }
}

// ============ PPT Task Operations ============

export async function createPptTask(data: InsertPptTask): Promise<PptTask> {
  if (useMemoryStore()) {
    return memStore.memoryCreatePptTask(data);
  }

  const db = await getDb();
  if (!db) {
    return memStore.memoryCreatePptTask(data);
  }

  try {
    // Set default values for JSON fields
    const taskData = {
      ...data,
      imageAttachments: data.imageAttachments || '[]',
      timelineEvents: data.timelineEvents || JSON.stringify([
        { time: new Date().toISOString(), event: '任务已创建', status: 'completed' },
      ]),
    };

    if (_dbType === 'postgres') {
      const [task] = await db.insert(pptTasks).values(taskData).returning();
      return task;
    } else {
      const result = await db.insert(pptTasks).values(taskData);
      const insertId = result[0].insertId;
      const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, insertId));
      return task;
    }
  } catch (error) {
    console.error("[Database] Failed to create task:", error);
    return memStore.memoryCreatePptTask(data);
  }
}

export async function getPptTaskById(id: number): Promise<PptTask | undefined> {
  if (useMemoryStore()) {
    return memStore.memoryGetPptTaskById(id);
  }

  const db = await getDb();
  if (!db) {
    return memStore.memoryGetPptTaskById(id);
  }

  try {
    const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, id));
    return task;
  } catch (error) {
    console.error("[Database] Failed to get task:", error);
    return memStore.memoryGetPptTaskById(id);
  }
}

export async function getPptTasksByUserId(userId: number): Promise<PptTask[]> {
  if (useMemoryStore()) {
    return memStore.memoryGetPptTasksByUserId(userId);
  }

  const db = await getDb();
  if (!db) {
    return memStore.memoryGetPptTasksByUserId(userId);
  }

  try {
    return db.select().from(pptTasks).where(eq(pptTasks.userId, userId)).orderBy(desc(pptTasks.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get tasks:", error);
    return memStore.memoryGetPptTasksByUserId(userId);
  }
}

export async function getPptTaskWithProject(taskId: number) {
  if (useMemoryStore()) {
    return memStore.memoryGetPptTaskWithProject(taskId);
  }

  const db = await getDb();
  if (!db) {
    return memStore.memoryGetPptTaskWithProject(taskId);
  }

  try {
    const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, taskId));
    if (!task) return undefined;

    const [project] = await db.select().from(projects).where(eq(projects.id, task.projectId));
    
    return { ...task, project };
  } catch (error) {
    console.error("[Database] Failed to get task with project:", error);
    return memStore.memoryGetPptTaskWithProject(taskId);
  }
}

export async function updatePptTask(id: number, data: Partial<InsertPptTask>): Promise<PptTask | undefined> {
  if (useMemoryStore()) {
    return memStore.memoryUpdatePptTask(id, data);
  }

  const db = await getDb();
  if (!db) {
    return memStore.memoryUpdatePptTask(id, data);
  }

  try {
    await db.update(pptTasks).set(data).where(eq(pptTasks.id, id));
    const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, id));
    return task;
  } catch (error) {
    console.error("[Database] Failed to update task:", error);
    return memStore.memoryUpdatePptTask(id, data);
  }
}

export async function addTimelineEvent(taskId: number, event: string, status: string): Promise<void> {
  if (useMemoryStore()) {
    memStore.memoryAddTimelineEvent(taskId, event, status);
    return;
  }

  const db = await getDb();
  if (!db) {
    memStore.memoryAddTimelineEvent(taskId, event, status);
    return;
  }

  try {
    const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, taskId));
    if (!task) return;

    const events = JSON.parse(task.timelineEvents || '[]');
    events.push({ time: new Date().toISOString(), event, status });
    
    await db.update(pptTasks).set({ timelineEvents: JSON.stringify(events) }).where(eq(pptTasks.id, taskId));
  } catch (error) {
    console.error("[Database] Failed to add timeline event:", error);
    memStore.memoryAddTimelineEvent(taskId, event, status);
  }
}

export async function deletePptTask(id: number): Promise<void> {
  if (useMemoryStore()) {
    memStore.memoryDeletePptTask(id);
    return;
  }

  const db = await getDb();
  if (!db) {
    memStore.memoryDeletePptTask(id);
    return;
  }

  try {
    await db.delete(pptTasks).where(eq(pptTasks.id, id));
  } catch (error) {
    console.error("[Database] Failed to delete task:", error);
    memStore.memoryDeletePptTask(id);
  }
}
