import { relations } from "drizzle-orm";
import { users, projects, pptTasks } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  tasks: many(pptTasks),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  tasks: many(pptTasks),
}));

export const pptTasksRelations = relations(pptTasks, ({ one }) => ({
  user: one(users, { fields: [pptTasks.userId], references: [users.id] }),
  project: one(projects, { fields: [pptTasks.projectId], references: [projects.id] }),
}));
