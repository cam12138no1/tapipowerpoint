// Unified schema - exports based on database type
// For now, we use MySQL schema as the primary and map to PostgreSQL at runtime

import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Project table - stores PPT design specifications
 * Each project contains brand colors, fonts, logo, and engine project reference
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  // Engine project reference (internal API)
  engineProjectId: varchar("engineProjectId", { length: 128 }),
  
  // Design specifications stored as JSON string
  designSpec: text("designSpec"),
  
  // Color palette
  primaryColor: varchar("primaryColor", { length: 32 }).default("#0c87eb").notNull(),
  secondaryColor: varchar("secondaryColor", { length: 32 }).default("#737373").notNull(),
  accentColor: varchar("accentColor", { length: 32 }).default("#10b981").notNull(),
  
  // Typography
  fontFamily: varchar("fontFamily", { length: 128 }).default("微软雅黑").notNull(),
  
  // Logo file
  logoUrl: text("logoUrl"),
  logoFileKey: varchar("logoFileKey", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * PPT Task table - tracks each PPT generation request
 */
export const pptTasks = mysqlTable("pptTasks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId"),  // nullable - task can exist without a project
  
  title: varchar("title", { length: 255 }).notNull(),
  // Engine task reference (internal API)
  engineTaskId: varchar("engineTaskId", { length: 128 }),
  
  // Task status: pending, uploading, running, ask, completed, failed
  status: mysqlEnum("status", ["pending", "uploading", "running", "ask", "completed", "failed"]).default("pending").notNull(),
  
  // Progress tracking
  currentStep: text("currentStep"),
  progress: int("progress").default(0).notNull(),
  
  // Source document info
  sourceFileName: varchar("sourceFileName", { length: 255 }),
  sourceFileId: varchar("sourceFileId", { length: 128 }),
  sourceFileUrl: text("sourceFileUrl"),
  
  // Proposal content (alternative to file upload)
  proposalContent: text("proposalContent"),
  
  // Image attachments stored as JSON array string
  // [{fileName, fileId, fileUrl, placement}]
  imageAttachments: text("imageAttachments"),
  
  // Task interaction data (for "ask" state)
  interactionData: text("interactionData"),
  
  // Output content from AI (for real-time display)
  // Stores the full output array from API as JSON string
  outputContent: text("outputContent"),
  
  // Share URL for online preview
  shareUrl: text("shareUrl"),
  
  // Result data
  resultPptxUrl: text("resultPptxUrl"),
  resultPdfUrl: text("resultPdfUrl"),
  resultFileKey: varchar("resultFileKey", { length: 255 }),
  
  // Error tracking
  errorMessage: text("errorMessage"),
  
  // Timeline events stored as JSON string
  timelineEvents: text("timelineEvents"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PptTask = typeof pptTasks.$inferSelect;
export type InsertPptTask = typeof pptTasks.$inferInsert;
