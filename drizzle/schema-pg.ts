import { integer, pgEnum, pgTable, text, timestamp, varchar, serial } from "drizzle-orm/pg-core";

/**
 * PostgreSQL Schema for TapiPowerPoint
 */

// Enums
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const statusEnum = pgEnum("status", ["pending", "uploading", "running", "ask", "completed", "failed"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Project table - stores PPT design specifications
 */
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  engineProjectId: varchar("engine_project_id", { length: 128 }),
  designSpec: text("design_spec"),
  primaryColor: varchar("primary_color", { length: 32 }).default("#0c87eb").notNull(),
  secondaryColor: varchar("secondary_color", { length: 32 }).default("#737373").notNull(),
  accentColor: varchar("accent_color", { length: 32 }).default("#10b981").notNull(),
  fontFamily: varchar("font_family", { length: 128 }).default("微软雅黑").notNull(),
  logoUrl: text("logo_url"),
  logoFileKey: varchar("logo_file_key", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * PPT Task table - tracks each PPT generation request
 */
export const pptTasks = pgTable("ppt_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  projectId: integer("project_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  engineTaskId: varchar("engine_task_id", { length: 128 }),
  status: statusEnum("status").default("pending").notNull(),
  currentStep: text("current_step"),
  progress: integer("progress").default(0).notNull(),
  sourceFileName: varchar("source_file_name", { length: 255 }),
  sourceFileId: varchar("source_file_id", { length: 128 }),
  sourceFileUrl: text("source_file_url"),
  imageAttachments: text("image_attachments"),
  interactionData: text("interaction_data"),
  outputContent: text("output_content"),
  shareUrl: text("share_url"),
  resultPptxUrl: text("result_pptx_url"),
  resultPdfUrl: text("result_pdf_url"),
  resultFileKey: varchar("result_file_key", { length: 255 }),
  errorMessage: text("error_message"),
  timelineEvents: text("timeline_events"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PptTask = typeof pptTasks.$inferSelect;
export type InsertPptTask = typeof pptTasks.$inferInsert;
