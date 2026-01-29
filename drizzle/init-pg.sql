-- PostgreSQL Schema for TapiPowerPoint
-- Run this script to initialize the database tables

-- Create enums
DO $$ BEGIN
    CREATE TYPE role AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status AS ENUM ('pending', 'uploading', 'running', 'ask', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create users table
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

-- Create projects table
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

-- Create ppt_tasks table
CREATE TABLE IF NOT EXISTS ppt_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    project_id INTEGER,  -- 允许为空，任务可以不关联项目
    title VARCHAR(255) NOT NULL,
    engine_task_id VARCHAR(128),
    status status DEFAULT 'pending' NOT NULL,
    current_step TEXT,
    progress INTEGER DEFAULT 0 NOT NULL,
    source_file_name VARCHAR(255),
    source_file_id VARCHAR(128),
    source_file_url TEXT,
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_open_id ON users(open_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_ppt_tasks_user_id ON ppt_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_ppt_tasks_project_id ON ppt_tasks(project_id);
