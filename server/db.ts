import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { Pool } from "pg";
import { InsertUser, users, projects, pptTasks, InsertProject, InsertPptTask, Project, PptTask } from "../drizzle/schema";
import * as pgSchema from "../drizzle/schema-pg";
import { ENV } from './_core/env';
import * as memStore from './memory-store';

let _db: any = null;
let _dbInitialized = false;
let _dbType: 'postgres' | 'mysql' | 'memory' = 'memory';
let _pool: Pool | null = null;

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

// Initialize PostgreSQL tables
async function initPostgresTables(pool: Pool): Promise<void> {
  console.log("[Database] Initializing PostgreSQL tables...");
  
  try {
    // Create enums
    await pool.query(`
      DO $$ BEGIN
          CREATE TYPE role AS ENUM ('user', 'admin');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await pool.query(`
      DO $$ BEGIN
          CREATE TYPE status AS ENUM ('pending', 'uploading', 'running', 'ask', 'completed', 'failed');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);
    
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          open_id VARCHAR(64) NOT NULL UNIQUE,
          name TEXT,
          email VARCHAR(320),
          login_method VARCHAR(64),
          role role DEFAULT 'user' NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
          last_signed_in TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    
    // Create projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          name VARCHAR(255) NOT NULL,
          engine_project_id VARCHAR(128),
          design_spec TEXT,
          primary_color VARCHAR(32) DEFAULT '#0c87eb' NOT NULL,
          secondary_color VARCHAR(32) DEFAULT '#737373' NOT NULL,
          accent_color VARCHAR(32) DEFAULT '#10b981' NOT NULL,
          font_family VARCHAR(128) DEFAULT '微软雅黑' NOT NULL,
          logo_url TEXT,
          logo_file_key VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    
    // Create ppt_tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ppt_tasks (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          project_id INTEGER,  -- 可以为NULL，设计规范是可选的
          title VARCHAR(255) NOT NULL,
          engine_task_id VARCHAR(128),
          status status DEFAULT 'pending' NOT NULL,
          current_step TEXT,
          progress INTEGER DEFAULT 0 NOT NULL,
          source_file_name VARCHAR(255),
          source_file_id VARCHAR(128),
          source_file_url TEXT,
          proposal_content TEXT,
          image_attachments TEXT,
          interaction_data TEXT,
          output_content TEXT,
          share_url TEXT,
          result_pptx_url TEXT,
          result_pdf_url TEXT,
          result_file_key VARCHAR(255),
          error_message TEXT,
          timeline_events TEXT,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    
    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_open_id ON users(open_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ppt_tasks_user_id ON ppt_tasks(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_ppt_tasks_project_id ON ppt_tasks(project_id);`);
    
    // Migrate existing table: make project_id nullable if it's not already
    try {
      await pool.query(`ALTER TABLE ppt_tasks ALTER COLUMN project_id DROP NOT NULL;`);
      console.log("[Database] Made project_id nullable");
    } catch (e) {
      // Column might already be nullable, ignore error
    }
    
    console.log("[Database] PostgreSQL tables initialized successfully");
  } catch (error) {
    console.error("[Database] Failed to initialize tables:", error);
    throw error;
  }
}

// Helper function to retry database connection
async function connectWithRetry(maxRetries: number = 3, delayMs: number = 2000): Promise<Pool | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 5,
        min: 1,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 30000,
        allowExitOnIdle: false,
      });
      
      // Test the connection
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      console.log(`[Database] Connection successful on attempt ${attempt}`);
      return pool;
    } catch (error: any) {
      console.warn(`[Database] Connection attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt < maxRetries) {
        console.log(`[Database] Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  return null;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (_dbInitialized) return _db;
  
  _dbInitialized = true;
  
  if (process.env.DATABASE_URL) {
    try {
      _dbType = detectDbType(process.env.DATABASE_URL);
      
      if (_dbType === 'postgres') {
        // Use retry mechanism for PostgreSQL connection
        _pool = await connectWithRetry(3, 3000);
        
        if (_pool) {
          // Listen for pool errors
          _pool.on('error', (err) => {
            console.error('[Database] Pool error:', err.message);
          });
          
          // Initialize tables
          await initPostgresTables(_pool);
          
          _db = drizzlePg(_pool, { schema: pgSchema });
          console.log("[Database] Connected to PostgreSQL database");
        } else {
          throw new Error('Failed to connect after retries');
        }
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

// Get raw pool for direct queries (PostgreSQL only)
export function getPool(): Pool | null {
  return _pool;
}

// Get database type
export function getDbType(): 'postgres' | 'mysql' | 'memory' {
  return _dbType;
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
    if (_dbType === 'postgres') {
      // PostgreSQL - use raw query for upsert with snake_case columns
      const pool = getPool();
      if (!pool) throw new Error('Pool not available');
      
      const name = user.name ?? null;
      const email = user.email ?? null;
      const loginMethod = user.loginMethod ?? null;
      const role = user.role ?? (user.openId === ENV.ownerOpenId ? 'admin' : 'user');
      
      await pool.query(`
        INSERT INTO users (open_id, name, email, login_method, role, last_signed_in)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (open_id) 
        DO UPDATE SET 
          name = COALESCE($2, users.name),
          email = COALESCE($3, users.email),
          login_method = COALESCE($4, users.login_method),
          role = COALESCE($5, users.role),
          last_signed_in = NOW(),
          updated_at = NOW()
      `, [user.openId, name, email, loginMethod, role]);
    } else {
      // MySQL upsert
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
    if (_dbType === 'postgres') {
      const pool = getPool();
      if (!pool) throw new Error('Pool not available');
      
      const result = await pool.query(`
        SELECT id, open_id as "openId", name, email, login_method as "loginMethod", 
               role, created_at as "createdAt", updated_at as "updatedAt", 
               last_signed_in as "lastSignedIn"
        FROM users WHERE open_id = $1 LIMIT 1
      `, [openId]);
      
      return result.rows.length > 0 ? result.rows[0] : undefined;
    } else {
      const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      return result.length > 0 ? result[0] : undefined;
    }
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
    if (_dbType === 'postgres') {
      const pool = getPool();
      if (!pool) throw new Error('Pool not available');
      
      // Try to get existing user
      let result = await pool.query(`
        SELECT id, open_id as "openId", name, email, login_method as "loginMethod", 
               role, created_at as "createdAt", updated_at as "updatedAt", 
               last_signed_in as "lastSignedIn"
        FROM users WHERE open_id = $1 LIMIT 1
      `, [openId]);
      
      if (result.rows.length === 0) {
        // Create new user
        await pool.query(`
          INSERT INTO users (open_id, name, login_method, last_signed_in)
          VALUES ($1, $2, 'simple', NOW())
        `, [openId, name || openId]);
        
        result = await pool.query(`
          SELECT id, open_id as "openId", name, email, login_method as "loginMethod", 
                 role, created_at as "createdAt", updated_at as "updatedAt", 
                 last_signed_in as "lastSignedIn"
          FROM users WHERE open_id = $1 LIMIT 1
        `, [openId]);
      }
      
      return result.rows[0];
    } else {
      let [user] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      if (!user) {
        await db.insert(users).values({
          openId,
          name: name || openId,
          loginMethod: 'simple',
          lastSignedIn: new Date(),
        });
        [user] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
      }
      return user;
    }
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
      const pool = getPool();
      if (!pool) throw new Error('Pool not available');
      
      const result = await pool.query(`
        INSERT INTO projects (user_id, name, engine_project_id, design_spec, primary_color, secondary_color, accent_color, font_family, logo_url, logo_file_key)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, user_id as "userId", name, engine_project_id as "engineProjectId", 
                  design_spec as "designSpec", primary_color as "primaryColor", 
                  secondary_color as "secondaryColor", accent_color as "accentColor",
                  font_family as "fontFamily", logo_url as "logoUrl", logo_file_key as "logoFileKey",
                  created_at as "createdAt", updated_at as "updatedAt"
      `, [
        data.userId,
        data.name,
        data.engineProjectId || null,
        data.designSpec || null,
        data.primaryColor || '#0c87eb',
        data.secondaryColor || '#737373',
        data.accentColor || '#10b981',
        data.fontFamily || '微软雅黑',
        data.logoUrl || null,
        data.logoFileKey || null
      ]);
      
      return result.rows[0];
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
    if (_dbType === 'postgres') {
      const pool = getPool();
      if (!pool) throw new Error('Pool not available');
      
      const result = await pool.query(`
        SELECT id, user_id as "userId", name, engine_project_id as "engineProjectId", 
               design_spec as "designSpec", primary_color as "primaryColor", 
               secondary_color as "secondaryColor", accent_color as "accentColor",
               font_family as "fontFamily", logo_url as "logoUrl", logo_file_key as "logoFileKey",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM projects WHERE id = $1 LIMIT 1
      `, [id]);
      
      return result.rows[0];
    } else {
      const [project] = await db.select().from(projects).where(eq(projects.id, id));
      return project;
    }
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
    if (_dbType === 'postgres') {
      const pool = getPool();
      if (!pool) throw new Error('Pool not available');
      
      const result = await pool.query(`
        SELECT id, user_id as "userId", name, engine_project_id as "engineProjectId", 
               design_spec as "designSpec", primary_color as "primaryColor", 
               secondary_color as "secondaryColor", accent_color as "accentColor",
               font_family as "fontFamily", logo_url as "logoUrl", logo_file_key as "logoFileKey",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM projects WHERE user_id = $1 ORDER BY created_at DESC
      `, [userId]);
      
      return result.rows;
    } else {
      return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt));
    }
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
    if (_dbType === 'postgres') {
      const pool = getPool();
      if (!pool) throw new Error('Pool not available');
      
      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }
      if (data.engineProjectId !== undefined) {
        updates.push(`engine_project_id = $${paramIndex++}`);
        values.push(data.engineProjectId);
      }
      if (data.designSpec !== undefined) {
        updates.push(`design_spec = $${paramIndex++}`);
        values.push(data.designSpec);
      }
      if (data.primaryColor !== undefined) {
        updates.push(`primary_color = $${paramIndex++}`);
        values.push(data.primaryColor);
      }
      if (data.secondaryColor !== undefined) {
        updates.push(`secondary_color = $${paramIndex++}`);
        values.push(data.secondaryColor);
      }
      if (data.accentColor !== undefined) {
        updates.push(`accent_color = $${paramIndex++}`);
        values.push(data.accentColor);
      }
      if (data.fontFamily !== undefined) {
        updates.push(`font_family = $${paramIndex++}`);
        values.push(data.fontFamily);
      }
      if (data.logoUrl !== undefined) {
        updates.push(`logo_url = $${paramIndex++}`);
        values.push(data.logoUrl);
      }
      if (data.logoFileKey !== undefined) {
        updates.push(`logo_file_key = $${paramIndex++}`);
        values.push(data.logoFileKey);
      }
      
      updates.push(`updated_at = NOW()`);
      values.push(id);
      
      await pool.query(`
        UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex}
      `, values);
      
      return getProjectById(id);
    } else {
      await db.update(projects).set(data).where(eq(projects.id, id));
      const [project] = await db.select().from(projects).where(eq(projects.id, id));
      return project;
    }
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
    if (_dbType === 'postgres') {
      const pool = getPool();
      if (!pool) throw new Error('Pool not available');
      await pool.query(`DELETE FROM projects WHERE id = $1`, [id]);
    } else {
      await db.delete(projects).where(eq(projects.id, id));
    }
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
    const imageAttachments = data.imageAttachments || '[]';
    const timelineEvents = data.timelineEvents || JSON.stringify([
      { time: new Date().toISOString(), event: '任务已创建', status: 'completed' },
    ]);

    if (_dbType === 'postgres') {
      const pool = getPool();
      if (!pool) throw new Error('Pool not available');
      
      const result = await pool.query(`
        INSERT INTO ppt_tasks (user_id, project_id, title, engine_task_id, status, current_step, progress, 
                               source_file_name, source_file_id, source_file_url, image_attachments,
                               interaction_data, output_content, share_url, result_pptx_url, result_pdf_url,
                               result_file_key, error_message, timeline_events)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING id, user_id as "userId", project_id as "projectId", title, 
                  engine_task_id as "engineTaskId", status, current_step as "currentStep", progress,
                  source_file_name as "sourceFileName", source_file_id as "sourceFileId", 
                  source_file_url as "sourceFileUrl", image_attachments as "imageAttachments",
                  interaction_data as "interactionData", output_content as "outputContent",
                  share_url as "shareUrl", result_pptx_url as "resultPptxUrl", 
                  result_pdf_url as "resultPdfUrl", result_file_key as "resultFileKey",
                  error_message as "errorMessage", timeline_events as "timelineEvents",
                  created_at as "createdAt", updated_at as "updatedAt"
      `, [
        data.userId,
        data.projectId,
        data.title,
        data.engineTaskId || null,
        data.status || 'pending',
        data.currentStep || null,
        data.progress || 0,
        data.sourceFileName || null,
        data.sourceFileId || null,
        data.sourceFileUrl || null,
        imageAttachments,
        data.interactionData || null,
        data.outputContent || null,
        data.shareUrl || null,
        data.resultPptxUrl || null,
        data.resultPdfUrl || null,
        data.resultFileKey || null,
        data.errorMessage || null,
        timelineEvents
      ]);
      
      return result.rows[0];
    } else {
      const taskData = {
        ...data,
        imageAttachments,
        timelineEvents,
      };
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
    if (_dbType === 'postgres') {
      const pool = getPool();
      if (!pool) throw new Error('Pool not available');
      
      const result = await pool.query(`
        SELECT id, user_id as "userId", project_id as "projectId", title, 
               engine_task_id as "engineTaskId", status, current_step as "currentStep", progress,
               source_file_name as "sourceFileName", source_file_id as "sourceFileId", 
               source_file_url as "sourceFileUrl", image_attachments as "imageAttachments",
               interaction_data as "interactionData", output_content as "outputContent",
               share_url as "shareUrl", result_pptx_url as "resultPptxUrl", 
               result_pdf_url as "resultPdfUrl", result_file_key as "resultFileKey",
               error_message as "errorMessage", timeline_events as "timelineEvents",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM ppt_tasks WHERE id = $1 LIMIT 1
      `, [id]);
      
      return result.rows[0];
    } else {
      const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, id));
      return task;
    }
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
    if (_dbType === 'postgres') {
      const pool = getPool();
      if (!pool) throw new Error('Pool not available');
      
      const result = await pool.query(`
        SELECT id, user_id as "userId", project_id as "projectId", title, 
               engine_task_id as "engineTaskId", status, current_step as "currentStep", progress,
               source_file_name as "sourceFileName", source_file_id as "sourceFileId", 
               source_file_url as "sourceFileUrl", image_attachments as "imageAttachments",
               interaction_data as "interactionData", output_content as "outputContent",
               share_url as "shareUrl", result_pptx_url as "resultPptxUrl", 
               result_pdf_url as "resultPdfUrl", result_file_key as "resultFileKey",
               error_message as "errorMessage", timeline_events as "timelineEvents",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM ppt_tasks WHERE user_id = $1 ORDER BY created_at DESC
      `, [userId]);
      
      return result.rows;
    } else {
      return db.select().from(pptTasks).where(eq(pptTasks.userId, userId)).orderBy(desc(pptTasks.createdAt));
    }
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
    const task = await getPptTaskById(taskId);
    if (!task) return undefined;

    // projectId可能为null（设计规范是可选的）
    let project = null;
    if (task.projectId) {
      project = await getProjectById(task.projectId);
    }
    
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
    if (_dbType === 'postgres') {
      const pool = getPool();
      if (!pool) throw new Error('Pool not available');
      
      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      const fieldMap: Record<string, string> = {
        engineTaskId: 'engine_task_id',
        status: 'status',
        currentStep: 'current_step',
        progress: 'progress',
        sourceFileName: 'source_file_name',
        sourceFileId: 'source_file_id',
        sourceFileUrl: 'source_file_url',
        imageAttachments: 'image_attachments',
        interactionData: 'interaction_data',
        outputContent: 'output_content',
        shareUrl: 'share_url',
        resultPptxUrl: 'result_pptx_url',
        resultPdfUrl: 'result_pdf_url',
        resultFileKey: 'result_file_key',
        errorMessage: 'error_message',
        timelineEvents: 'timeline_events',
      };
      
      for (const [key, column] of Object.entries(fieldMap)) {
        if ((data as any)[key] !== undefined) {
          updates.push(`${column} = $${paramIndex++}`);
          values.push((data as any)[key]);
        }
      }
      
      if (updates.length === 0) {
        return getPptTaskById(id);
      }
      
      updates.push(`updated_at = NOW()`);
      values.push(id);
      
      await pool.query(`
        UPDATE ppt_tasks SET ${updates.join(', ')} WHERE id = $${paramIndex}
      `, values);
      
      return getPptTaskById(id);
    } else {
      await db.update(pptTasks).set(data).where(eq(pptTasks.id, id));
      const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, id));
      return task;
    }
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
    const task = await getPptTaskById(taskId);
    if (!task) return;

    const events = JSON.parse(task.timelineEvents || '[]');
    events.push({ time: new Date().toISOString(), event, status });
    
    await updatePptTask(taskId, { timelineEvents: JSON.stringify(events) });
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
    if (_dbType === 'postgres') {
      const pool = getPool();
      if (!pool) throw new Error('Pool not available');
      await pool.query(`DELETE FROM ppt_tasks WHERE id = $1`, [id]);
    } else {
      await db.delete(pptTasks).where(eq(pptTasks.id, id));
    }
  } catch (error) {
    console.error("[Database] Failed to delete task:", error);
    memStore.memoryDeletePptTask(id);
  }
}
