import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, projects, pptTasks, InsertProject, InsertPptTask, Project, PptTask } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ User Operations ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
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

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ Project Operations ============

export async function createProject(data: InsertProject): Promise<Project> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(projects).values(data);
  const insertId = result[0].insertId;
  
  const [project] = await db.select().from(projects).where(eq(projects.id, insertId));
  return project;
}

export async function getProjectById(id: number): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  return project;
}

export async function getProjectsByUserId(userId: number): Promise<Project[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt));
}

export async function updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(projects).set(data).where(eq(projects.id, id));
  const [project] = await db.select().from(projects).where(eq(projects.id, id));
  return project;
}

export async function deleteProject(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(projects).where(eq(projects.id, id));
}

// ============ PPT Task Operations ============

export async function createPptTask(data: InsertPptTask): Promise<PptTask> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Set default values for JSON fields
  const taskData = {
    ...data,
    imageAttachments: data.imageAttachments || '[]',
    timelineEvents: data.timelineEvents || JSON.stringify([
      { time: new Date().toISOString(), event: '任务已创建', status: 'completed' },
    ]),
  };

  const result = await db.insert(pptTasks).values(taskData);
  const insertId = result[0].insertId;
  
  const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, insertId));
  return task;
}

export async function getPptTaskById(id: number): Promise<PptTask | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, id));
  return task;
}

export async function getPptTasksByUserId(userId: number): Promise<PptTask[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(pptTasks).where(eq(pptTasks.userId, userId)).orderBy(desc(pptTasks.createdAt));
}

export async function getPptTaskWithProject(taskId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, taskId));
  if (!task) return undefined;

  const [project] = await db.select().from(projects).where(eq(projects.id, task.projectId));
  
  return { ...task, project };
}

export async function updatePptTask(id: number, data: Partial<InsertPptTask>): Promise<PptTask | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(pptTasks).set(data).where(eq(pptTasks.id, id));
  const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, id));
  return task;
}

export async function addTimelineEvent(taskId: number, event: string, status: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, taskId));
  if (!task) return;

  const events = JSON.parse(task.timelineEvents || '[]');
  events.push({ time: new Date().toISOString(), event, status });
  
  await db.update(pptTasks).set({ timelineEvents: JSON.stringify(events) }).where(eq(pptTasks.id, taskId));
}

export async function deletePptTask(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(pptTasks).where(eq(pptTasks.id, id));
}
