import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function initDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('[Init] No DATABASE_URL configured, skipping database initialization');
    return;
  }

  console.log('[Init] Initializing PostgreSQL database...');
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../drizzle/init-pg.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    
    // Execute the SQL
    await pool.query(sql);
    
    console.log('[Init] Database tables created successfully');
    
    // Verify tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    console.log('[Init] Created tables:', result.rows.map(r => r.table_name).join(', '));
    
  } catch (error) {
    console.error('[Init] Failed to initialize database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
initDatabase().catch(console.error);

export { initDatabase };
