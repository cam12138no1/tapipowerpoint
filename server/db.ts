import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { Pool, PoolClient } from "pg";
import { InsertUser, users, projects, pptTasks, InsertProject, InsertPptTask, Project, PptTask } from "../drizzle/schema";
import * as pgSchema from "../drizzle/schema-pg";
import { ENV } from './_core/env';
import * as memStore from './memory-store';

let _db: any = null;
let _dbInitialized = false;
let _dbType: 'postgres' | 'mysql' | 'memory' = 'memory';
let _pool: Pool | null = null;
let _connectionHealthy = false;

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
    await pool.query(\`
      DO $$ BEGIN
          CREATE TYPE role AS ENUM ('user', 'admin');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    \`);
    
    await pool.query(\`
      DO $$ BEGIN
          CREATE TYPE status AS ENUM ('pending', 'uploading', 'running', 'ask', 'completed', 'failed');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    \`);
    
    // Create users table
    await pool.query(\`
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
    \`);
    
    // Create projects table
    await pool.query(\`
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
    \`);
    
    // Create ppt_tasks table
    await pool.query(\`
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
    \`);
    
    // Create indexes
    await pool.query(\`CREATE INDEX IF NOT EXISTS idx_users_open_id ON users(open_id);\`);
    await pool.query(\`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);\`);
    await pool.query(\`CREATE INDEX IF NOT EXISTS idx_ppt_tasks_user_id ON ppt_tasks(user_id);\`);
    await pool.query(\`CREATE INDEX IF NOT EXISTS idx_ppt_tasks_project_id ON ppt_tasks(project_id);\`);
    
    // Migrate existing table: make project_id nullable if it's not already
    try {
      await pool.query(\`ALTER TABLE ppt_tasks ALTER COLUMN project_id DROP NOT NULL;\`);
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

// Create a new pool with optimized settings for Render
function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,                        // Reduced max connections for Render free tier
    min: 0,                        // Allow pool to shrink to 0
    idleTimeoutMillis: 30000,      // Close idle connections after 30s
    connectionTimeoutMillis: 15000, // 15s connection timeout
    allowExitOnIdle: true,         // Allow process to exit when pool is idle
    keepAlive: true,               // Enable TCP keepalive
    keepAliveInitialDelayMillis: 10000, // Start keepalive after 10s
  });
}

// Helper function to retry database connection with exponential backoff
async function connectWithRetry(maxRetries: number = 5, initialDelayMs: number = 1000): Promise<Pool | null> {
  let delay = initialDelayMs;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(\`[Database] Connection attempt \${attempt}/\${maxRetries}...\`);
      
      const pool = createPool();
      
      // Test the connection with a simple query
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        console.log(\`[Database] Connection successful on attempt \${attempt}\`);
        _connectionHealthy = true;
        return pool;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.warn(\`[Database] Connection attempt \${attempt}/\${maxRetries} failed:\`, error.message);
      
      if (attempt < maxRetries) {
        console.log(\`[Database] Retrying in \${delay}ms...\`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 10000); // Exponential backoff, max 10s
      }
    }
  }
  
  console.error('[Database] All connection attempts failed');
  return null;
}

// Get a healthy connection, reconnecting if necessary
async function getHealthyPool(): Promise<Pool | null> {
  if (_pool && _connectionHealthy) {
    try {
      // Quick health check
      const client = await _pool.connect();
      await client.query('SELECT 1');
      client.release();
      return _pool;
    } catch (error) {
      console.warn('[Database] Connection health check failed, reconnecting...');
      _connectionHealthy = false;
      
      // Try to end the old pool gracefully
      try {
        await _pool.end();
      } catch (e) {
        // Ignore errors when closing old pool
      }
      _pool = null;
    }
  }
  
  // Reconnect
  _pool = await connectWithRetry(3, 2000);
  return _pool;
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
        _pool = await connectWithRetry(5, 2000);
        
        if (_pool) {
          // Listen for pool errors and attempt reconnection
          _pool.on('error', async (err) => {
            console.error('[Database] Pool error:', err.message);
            _connectionHealthy = false;
            
            // Attempt to reconnect in background
            setTimeout(async () => {
              try {
                const newPool = await connectWithRetry(3, 2000);
                if (newPool) {
                  const oldPool = _pool;
                  _pool = newPool;
                  _db = drizzlePg(_pool, { schema: pgSchema });
                  
                  // Close old pool
                  try {
                    await oldPool?.end();
                  } catch (e) {
                    // Ignore
                  }
                }
              } catch (e) {
                console.error('[Database] Background reconnection failed:', e);
              }
            }, 1000);
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

// Execute query with automatic retry on connection errors
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  fallback: () => T,
  maxRetries: number = 2
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const isConnectionError = 
        error.message?.includes('Connection terminated') ||
        error.message?.includes('connection') ||
        error.code === 'ECONNRESET' ||
        error.code === '57P01';
      
      if (isConnectionError && attempt < maxRetries) {
        console.warn(\`[Database] Connection error on attempt \${attempt}, retrying...\`);
        _connectionHealthy = false;
        
        // Try to get a healthy pool
        await getHealthyPool();
        continue;
      }
      
      console.error('[Database] Operation failed:', error.message);
      throw error;
    }
  }
  
  return fallback();
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
    await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          // PostgreSQL - use raw query for upsert with snake_case columns
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          
          const name = user.name ?? null;
          const email = user.email ?? null;
          const loginMethod = user.loginMethod ?? null;
          const role = user.role ?? (user.openId === ENV.ownerOpenId ? 'admin' : 'user');
          
          await pool.query(\`
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
          \`, [user.openId, name, email, loginMethod, role]);
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
      },
      () => {
        memStore.memoryUpsertUser(user);
      }
    );
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
    return await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          
          const result = await pool.query(\`
            SELECT id, open_id as "openId", name, email, login_method as "loginMethod", 
                   role, created_at as "createdAt", updated_at as "updatedAt", 
                   last_signed_in as "lastSignedIn"
            FROM users WHERE open_id = $1
          \`, [openId]);
          
          return result.rows[0] || null;
        } else {
          const [user] = await db.select().from(users).where(eq(users.openId, openId));
          return user || null;
        }
      },
      () => memStore.memoryGetUserByOpenId(openId)
    );
  } catch (error) {
    console.error("[Database] Failed to get user:", error);
    return memStore.memoryGetUserByOpenId(openId);
  }
}

export async function getAllUsers() {
  if (useMemoryStore()) {
    return memStore.memoryGetAllUsers();
  }

  const db = await getDb();
  if (!db) {
    return memStore.memoryGetAllUsers();
  }

  try {
    return await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          
          const result = await pool.query(\`
            SELECT id, open_id as "openId", name, email, login_method as "loginMethod", 
                   role, created_at as "createdAt", updated_at as "updatedAt", 
                   last_signed_in as "lastSignedIn"
            FROM users ORDER BY created_at DESC
          \`);
          
          return result.rows;
        } else {
          return db.select().from(users).orderBy(desc(users.createdAt));
        }
      },
      () => memStore.memoryGetAllUsers()
    );
  } catch (error) {
    console.error("[Database] Failed to get all users:", error);
    return memStore.memoryGetAllUsers();
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
    return await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          
          const result = await pool.query(\`
            INSERT INTO projects (user_id, name, engine_project_id, design_spec, primary_color, 
                                  secondary_color, accent_color, font_family, logo_url, logo_file_key)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, user_id as "userId", name, engine_project_id as "engineProjectId", 
                      design_spec as "designSpec", primary_color as "primaryColor", 
                      secondary_color as "secondaryColor", accent_color as "accentColor",
                      font_family as "fontFamily", logo_url as "logoUrl", logo_file_key as "logoFileKey",
                      created_at as "createdAt", updated_at as "updatedAt"
          \`, [
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
      },
      () => memStore.memoryCreateProject(data)
    );
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
    return await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          
          const result = await pool.query(\`
            SELECT id, user_id as "userId", name, engine_project_id as "engineProjectId", 
                   design_spec as "designSpec", primary_color as "primaryColor", 
                   secondary_color as "secondaryColor", accent_color as "accentColor",
                   font_family as "fontFamily", logo_url as "logoUrl", logo_file_key as "logoFileKey",
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM projects WHERE id = $1
          \`, [id]);
          
          return result.rows[0];
        } else {
          const [project] = await db.select().from(projects).where(eq(projects.id, id));
          return project;
        }
      },
      () => memStore.memoryGetProjectById(id)
    );
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
    return await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          
          const result = await pool.query(\`
            SELECT id, user_id as "userId", name, engine_project_id as "engineProjectId", 
                   design_spec as "designSpec", primary_color as "primaryColor", 
                   secondary_color as "secondaryColor", accent_color as "accentColor",
                   font_family as "fontFamily", logo_url as "logoUrl", logo_file_key as "logoFileKey",
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM projects WHERE user_id = $1 ORDER BY created_at DESC
          \`, [userId]);
          
          return result.rows;
        } else {
          return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt));
        }
      },
      () => memStore.memoryGetProjectsByUserId(userId)
    );
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
    return await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          
          // Build dynamic update query
          const updates: string[] = [];
          const values: any[] = [];
          let paramIndex = 1;
          
          if (data.name !== undefined) {
            updates.push(\`name = $\${paramIndex++}\`);
            values.push(data.name);
          }
          if (data.engineProjectId !== undefined) {
            updates.push(\`engine_project_id = $\${paramIndex++}\`);
            values.push(data.engineProjectId);
          }
          if (data.designSpec !== undefined) {
            updates.push(\`design_spec = $\${paramIndex++}\`);
            values.push(data.designSpec);
          }
          if (data.primaryColor !== undefined) {
            updates.push(\`primary_color = $\${paramIndex++}\`);
            values.push(data.primaryColor);
          }
          if (data.secondaryColor !== undefined) {
            updates.push(\`secondary_color = $\${paramIndex++}\`);
            values.push(data.secondaryColor);
          }
          if (data.accentColor !== undefined) {
            updates.push(\`accent_color = $\${paramIndex++}\`);
            values.push(data.accentColor);
          }
          if (data.fontFamily !== undefined) {
            updates.push(\`font_family = $\${paramIndex++}\`);
            values.push(data.fontFamily);
          }
          if (data.logoUrl !== undefined) {
            updates.push(\`logo_url = $\${paramIndex++}\`);
            values.push(data.logoUrl);
          }
          if (data.logoFileKey !== undefined) {
            updates.push(\`logo_file_key = $\${paramIndex++}\`);
            values.push(data.logoFileKey);
          }
          
          updates.push(\`updated_at = NOW()\`);
          values.push(id);
          
          await pool.query(\`
            UPDATE projects SET \${updates.join(', ')} WHERE id = $\${paramIndex}
          \`, values);
          
          return getProjectById(id);
        } else {
          await db.update(projects).set(data).where(eq(projects.id, id));
          const [project] = await db.select().from(projects).where(eq(projects.id, id));
          return project;
        }
      },
      () => memStore.memoryUpdateProject(id, data)
    );
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
    await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          await pool.query(\`DELETE FROM projects WHERE id = $1\`, [id]);
        } else {
          await db.delete(projects).where(eq(projects.id, id));
        }
      },
      () => {
        memStore.memoryDeleteProject(id);
      }
    );
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

    return await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          
          const result = await pool.query(\`
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
          \`, [
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
      },
      () => memStore.memoryCreatePptTask(data)
    );
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
    return await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          
          const result = await pool.query(\`
            SELECT id, user_id as "userId", project_id as "projectId", title, 
                   engine_task_id as "engineTaskId", status, current_step as "currentStep", progress,
                   source_file_name as "sourceFileName", source_file_id as "sourceFileId", 
                   source_file_url as "sourceFileUrl", proposal_content as "proposalContent",
                   image_attachments as "imageAttachments",
                   interaction_data as "interactionData", output_content as "outputContent",
                   share_url as "shareUrl", result_pptx_url as "resultPptxUrl", 
                   result_pdf_url as "resultPdfUrl", result_file_key as "resultFileKey",
                   error_message as "errorMessage", timeline_events as "timelineEvents",
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM ppt_tasks WHERE id = $1
          \`, [id]);
          
          return result.rows[0];
        } else {
          const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, id));
          return task;
        }
      },
      () => memStore.memoryGetPptTaskById(id)
    );
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
    return await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          
          const result = await pool.query(\`
            SELECT id, user_id as "userId", project_id as "projectId", title, 
                   engine_task_id as "engineTaskId", status, current_step as "currentStep", progress,
                   source_file_name as "sourceFileName", source_file_id as "sourceFileId", 
                   source_file_url as "sourceFileUrl", proposal_content as "proposalContent",
                   image_attachments as "imageAttachments",
                   interaction_data as "interactionData", output_content as "outputContent",
                   share_url as "shareUrl", result_pptx_url as "resultPptxUrl", 
                   result_pdf_url as "resultPdfUrl", result_file_key as "resultFileKey",
                   error_message as "errorMessage", timeline_events as "timelineEvents",
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM ppt_tasks WHERE user_id = $1 ORDER BY created_at DESC
          \`, [userId]);
          
          return result.rows;
        } else {
          return db.select().from(pptTasks).where(eq(pptTasks.userId, userId)).orderBy(desc(pptTasks.createdAt));
        }
      },
      () => memStore.memoryGetPptTasksByUserId(userId)
    );
  } catch (error) {
    console.error("[Database] Failed to get tasks:", error);
    return memStore.memoryGetPptTasksByUserId(userId);
  }
}

export async function getPptTaskWithProject(taskId: number): Promise<{ task: PptTask; project: Project | null } | undefined> {
  if (useMemoryStore()) {
    const task = memStore.memoryGetPptTaskById(taskId);
    if (!task) return undefined;
    const project = task.projectId ? memStore.memoryGetProjectById(task.projectId) : null;
    return { task, project: project || null };
  }

  const db = await getDb();
  if (!db) {
    const task = memStore.memoryGetPptTaskById(taskId);
    if (!task) return undefined;
    const project = task.projectId ? memStore.memoryGetProjectById(task.projectId) : null;
    return { task, project: project || null };
  }

  try {
    return await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          
          // Get task first
          const taskResult = await pool.query(\`
            SELECT id, user_id as "userId", project_id as "projectId", title, 
                   engine_task_id as "engineTaskId", status, current_step as "currentStep", progress,
                   source_file_name as "sourceFileName", source_file_id as "sourceFileId", 
                   source_file_url as "sourceFileUrl", proposal_content as "proposalContent",
                   image_attachments as "imageAttachments",
                   interaction_data as "interactionData", output_content as "outputContent",
                   share_url as "shareUrl", result_pptx_url as "resultPptxUrl", 
                   result_pdf_url as "resultPdfUrl", result_file_key as "resultFileKey",
                   error_message as "errorMessage", timeline_events as "timelineEvents",
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM ppt_tasks WHERE id = $1
          \`, [taskId]);
          
          const task = taskResult.rows[0];
          if (!task) return undefined;
          
          // Get project if projectId exists
          let project: Project | null = null;
          if (task.projectId) {
            const projectResult = await pool.query(\`
              SELECT id, user_id as "userId", name, engine_project_id as "engineProjectId", 
                     design_spec as "designSpec", primary_color as "primaryColor", 
                     secondary_color as "secondaryColor", accent_color as "accentColor",
                     font_family as "fontFamily", logo_url as "logoUrl", logo_file_key as "logoFileKey",
                     created_at as "createdAt", updated_at as "updatedAt"
              FROM projects WHERE id = $1
            \`, [task.projectId]);
            
            project = projectResult.rows[0] || null;
          }
          
          return { task, project };
        } else {
          const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, taskId));
          if (!task) return undefined;
          
          let project: Project | null = null;
          if (task.projectId) {
            const [p] = await db.select().from(projects).where(eq(projects.id, task.projectId));
            project = p || null;
          }
          
          return { task, project };
        }
      },
      () => {
        const task = memStore.memoryGetPptTaskById(taskId);
        if (!task) return undefined;
        const project = task.projectId ? memStore.memoryGetProjectById(task.projectId) : null;
        return { task, project: project || null };
      }
    );
  } catch (error) {
    console.error("[Database] Failed to get task with project:", error);
    const task = memStore.memoryGetPptTaskById(taskId);
    if (!task) return undefined;
    const project = task.projectId ? memStore.memoryGetProjectById(task.projectId) : null;
    return { task, project: project || null };
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
    return await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          
          // Build dynamic update query
          const updates: string[] = [];
          const values: any[] = [];
          let paramIndex = 1;
          
          if (data.title !== undefined) {
            updates.push(\`title = $\${paramIndex++}\`);
            values.push(data.title);
          }
          if (data.engineTaskId !== undefined) {
            updates.push(\`engine_task_id = $\${paramIndex++}\`);
            values.push(data.engineTaskId);
          }
          if (data.status !== undefined) {
            updates.push(\`status = $\${paramIndex++}\`);
            values.push(data.status);
          }
          if (data.currentStep !== undefined) {
            updates.push(\`current_step = $\${paramIndex++}\`);
            values.push(data.currentStep);
          }
          if (data.progress !== undefined) {
            updates.push(\`progress = $\${paramIndex++}\`);
            values.push(data.progress);
          }
          if (data.sourceFileName !== undefined) {
            updates.push(\`source_file_name = $\${paramIndex++}\`);
            values.push(data.sourceFileName);
          }
          if (data.sourceFileId !== undefined) {
            updates.push(\`source_file_id = $\${paramIndex++}\`);
            values.push(data.sourceFileId);
          }
          if (data.sourceFileUrl !== undefined) {
            updates.push(\`source_file_url = $\${paramIndex++}\`);
            values.push(data.sourceFileUrl);
          }
          if (data.proposalContent !== undefined) {
            updates.push(\`proposal_content = $\${paramIndex++}\`);
            values.push(data.proposalContent);
          }
          if (data.imageAttachments !== undefined) {
            updates.push(\`image_attachments = $\${paramIndex++}\`);
            values.push(data.imageAttachments);
          }
          if (data.interactionData !== undefined) {
            updates.push(\`interaction_data = $\${paramIndex++}\`);
            values.push(data.interactionData);
          }
          if (data.outputContent !== undefined) {
            updates.push(\`output_content = $\${paramIndex++}\`);
            values.push(data.outputContent);
          }
          if (data.shareUrl !== undefined) {
            updates.push(\`share_url = $\${paramIndex++}\`);
            values.push(data.shareUrl);
          }
          if (data.resultPptxUrl !== undefined) {
            updates.push(\`result_pptx_url = $\${paramIndex++}\`);
            values.push(data.resultPptxUrl);
          }
          if (data.resultPdfUrl !== undefined) {
            updates.push(\`result_pdf_url = $\${paramIndex++}\`);
            values.push(data.resultPdfUrl);
          }
          if (data.resultFileKey !== undefined) {
            updates.push(\`result_file_key = $\${paramIndex++}\`);
            values.push(data.resultFileKey);
          }
          if (data.errorMessage !== undefined) {
            updates.push(\`error_message = $\${paramIndex++}\`);
            values.push(data.errorMessage);
          }
          if (data.timelineEvents !== undefined) {
            updates.push(\`timeline_events = $\${paramIndex++}\`);
            values.push(data.timelineEvents);
          }
          
          if (updates.length === 0) {
            return getPptTaskById(id);
          }
          
          updates.push(\`updated_at = NOW()\`);
          values.push(id);
          
          await pool.query(\`
            UPDATE ppt_tasks SET \${updates.join(', ')} WHERE id = $\${paramIndex}
          \`, values);
          
          return getPptTaskById(id);
        } else {
          await db.update(pptTasks).set(data).where(eq(pptTasks.id, id));
          const [task] = await db.select().from(pptTasks).where(eq(pptTasks.id, id));
          return task;
        }
      },
      () => memStore.memoryUpdatePptTask(id, data)
    );
  } catch (error) {
    console.error("[Database] Failed to update task:", error);
    return memStore.memoryUpdatePptTask(id, data);
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
    await executeWithRetry(
      async () => {
        if (_dbType === 'postgres') {
          const pool = await getHealthyPool();
          if (!pool) throw new Error('Pool not available');
          await pool.query(\`DELETE FROM ppt_tasks WHERE id = $1\`, [id]);
        } else {
          await db.delete(pptTasks).where(eq(pptTasks.id, id));
        }
      },
      () => {
        memStore.memoryDeletePptTask(id);
      }
    );
  } catch (error) {
    console.error("[Database] Failed to delete task:", error);
    memStore.memoryDeletePptTask(id);
  }
}
