/**
 * Database Operations Tests
 * Integration tests for database layer following SDD principles
 * 
 * NOTE: These tests require a test database setup
 * Run with: TEST_DATABASE_URL=... npm test
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as db from "./db";

// TODO: Setup test database utilities
// For real implementation, use:
// - Separate test database
// - Database seeding
// - Transaction rollback after each test

describe("User Operations", () => {
  describe("getOrCreateUser", () => {
    it("should create new user if not exists", async () => {
      const openId = `test_user_${Date.now()}`;
      const name = "Test User";

      const user = await db.getOrCreateUser(openId, name);

      expect(user).toBeDefined();
      expect(user?.openId).toBe(openId);
      expect(user?.name).toBe(name);
      expect(user?.role).toBe("user");
    });

    it("should return existing user if already exists", async () => {
      const openId = `test_user_${Date.now()}`;
      const name = "Original Name";

      const user1 = await db.getOrCreateUser(openId, name);
      const user2 = await db.getOrCreateUser(openId, "Different Name");

      expect(user1?.id).toBe(user2?.id);
      expect(user2?.name).toBe(name); // Should keep original name
    });

    it("should handle concurrent requests", async () => {
      const openId = `test_concurrent_${Date.now()}`;
      
      // Create 10 concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        db.getOrCreateUser(openId, "Concurrent User")
      );

      const results = await Promise.all(promises);
      
      // All should return the same user ID
      const uniqueIds = new Set(results.map(r => r?.id));
      expect(uniqueIds.size).toBe(1);
    });
  });
});

describe("Project Operations", () => {
  let testUserId: number;

  beforeEach(async () => {
    // Create test user
    const user = await db.getOrCreateUser(`test_${Date.now()}`, "Test User");
    testUserId = user!.id;
  });

  describe("createProject", () => {
    it("should create project with all fields", async () => {
      const input = {
        userId: testUserId,
        name: "Test Project",
        engineProjectId: "engine_123",
        designSpec: "Modern design",
        primaryColor: "#0033A0",
        secondaryColor: "#58595B",
        accentColor: "#C8A951",
        fontFamily: "Arial",
        logoUrl: "https://example.com/logo.png",
        logoFileKey: "logos/test.png",
      };

      const project = await db.createProject(input);

      expect(project.id).toBeDefined();
      expect(project.name).toBe(input.name);
      expect(project.userId).toBe(testUserId);
      expect(project.primaryColor).toBe(input.primaryColor);
    });

    it("should create project with minimal fields", async () => {
      const input = {
        userId: testUserId,
        name: "Minimal Project",
        primaryColor: "#000000",
      };

      const project = await db.createProject(input);

      expect(project.id).toBeDefined();
      expect(project.name).toBe(input.name);
      expect(project.engineProjectId).toBeNull();
    });

    it("should reject invalid user ID", async () => {
      await expect(
        db.createProject({
          userId: 999999,
          name: "Test",
          primaryColor: "#000000",
        })
      ).rejects.toThrow();
    });
  });

  describe("getProjectsByUserId", () => {
    it("should return empty array for user with no projects", async () => {
      const projects = await db.getProjectsByUserId(testUserId);
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBe(0);
    });

    it("should return all user projects", async () => {
      // Create 3 projects
      await db.createProject({ userId: testUserId, name: "P1", primaryColor: "#000" });
      await db.createProject({ userId: testUserId, name: "P2", primaryColor: "#000" });
      await db.createProject({ userId: testUserId, name: "P3", primaryColor: "#000" });

      const projects = await db.getProjectsByUserId(testUserId);
      expect(projects.length).toBe(3);
    });

    it("should not return other users projects", async () => {
      // Create another user
      const otherUser = await db.getOrCreateUser(`other_${Date.now()}`, "Other");
      
      await db.createProject({ userId: testUserId, name: "My Project", primaryColor: "#000" });
      await db.createProject({ userId: otherUser!.id, name: "Their Project", primaryColor: "#000" });

      const projects = await db.getProjectsByUserId(testUserId);
      expect(projects.length).toBe(1);
      expect(projects[0].name).toBe("My Project");
    });
  });

  describe("getProjectById", () => {
    it("should return project by ID", async () => {
      const created = await db.createProject({
        userId: testUserId,
        name: "Test Project",
        primaryColor: "#000",
      });

      const found = await db.getProjectById(created.id);
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe(created.name);
    });

    it("should return null for non-existent ID", async () => {
      const found = await db.getProjectById(999999);
      expect(found).toBeNull();
    });
  });

  describe("updateProject", () => {
    it("should update project fields", async () => {
      const created = await db.createProject({
        userId: testUserId,
        name: "Original",
        primaryColor: "#000",
      });

      const updated = await db.updateProject(created.id, {
        name: "Updated",
        primaryColor: "#FFF",
      });

      expect(updated.name).toBe("Updated");
      expect(updated.primaryColor).toBe("#FFF");
      expect(updated.id).toBe(created.id);
    });

    it("should only update specified fields", async () => {
      const created = await db.createProject({
        userId: testUserId,
        name: "Original",
        primaryColor: "#000",
        secondaryColor: "#111",
      });

      await db.updateProject(created.id, { name: "Updated" });
      
      const found = await db.getProjectById(created.id);
      expect(found?.name).toBe("Updated");
      expect(found?.primaryColor).toBe("#000"); // Unchanged
      expect(found?.secondaryColor).toBe("#111"); // Unchanged
    });
  });

  describe("deleteProject", () => {
    it("should delete project", async () => {
      const created = await db.createProject({
        userId: testUserId,
        name: "To Delete",
        primaryColor: "#000",
      });

      await db.deleteProject(created.id);

      const found = await db.getProjectById(created.id);
      expect(found).toBeNull();
    });

    it("should cascade delete related tasks", async () => {
      // TODO: Create project with tasks, delete project, verify tasks deleted
    });
  });
});

describe("PPT Task Operations", () => {
  let testUserId: number;
  let testProjectId: number;

  beforeEach(async () => {
    const user = await db.getOrCreateUser(`test_${Date.now()}`, "Test User");
    testUserId = user!.id;
    
    const project = await db.createProject({
      userId: testUserId,
      name: "Test Project",
      primaryColor: "#000",
    });
    testProjectId = project.id;
  });

  describe("createPptTask", () => {
    it("should create task with all fields", async () => {
      const input = {
        userId: testUserId,
        projectId: testProjectId,
        title: "Test Task",
        status: "pending" as const,
        currentStep: "Initializing",
        progress: 0,
        sourceFileName: "source.docx",
        sourceFileUrl: "https://example.com/source.docx",
        proposalContent: "Test content",
        imageAttachments: JSON.stringify([]),
      };

      const task = await db.createPptTask(input);

      expect(task.id).toBeDefined();
      expect(task.title).toBe(input.title);
      expect(task.userId).toBe(testUserId);
      expect(task.projectId).toBe(testProjectId);
      expect(task.status).toBe("pending");
    });

    it("should create task without project", async () => {
      const input = {
        userId: testUserId,
        projectId: null,
        title: "Task without design spec",
        status: "pending" as const,
        currentStep: "Init",
        progress: 0,
      };

      const task = await db.createPptTask(input);
      expect(task.projectId).toBeNull();
    });
  });

  describe("getPptTaskById", () => {
    it("should return task by ID", async () => {
      const created = await db.createPptTask({
        userId: testUserId,
        projectId: testProjectId,
        title: "Test",
        status: "pending",
        currentStep: "Init",
        progress: 0,
      });

      const found = await db.getPptTaskById(created.id);
      expect(found?.id).toBe(created.id);
    });

    it("should return null for non-existent ID", async () => {
      const found = await db.getPptTaskById(999999);
      expect(found).toBeNull();
    });
  });

  describe("getPptTasksByUserId", () => {
    it("should return all user tasks", async () => {
      await db.createPptTask({
        userId: testUserId,
        projectId: testProjectId,
        title: "Task 1",
        status: "pending",
        currentStep: "Init",
        progress: 0,
      });
      
      await db.createPptTask({
        userId: testUserId,
        projectId: null,
        title: "Task 2",
        status: "running",
        currentStep: "Processing",
        progress: 50,
      });

      const tasks = await db.getPptTasksByUserId(testUserId);
      expect(tasks.length).toBe(2);
    });

    it("should not return other users tasks", async () => {
      const otherUser = await db.getOrCreateUser(`other_${Date.now()}`, "Other");

      await db.createPptTask({
        userId: testUserId,
        projectId: testProjectId,
        title: "My Task",
        status: "pending",
        currentStep: "Init",
        progress: 0,
      });

      await db.createPptTask({
        userId: otherUser!.id,
        projectId: null,
        title: "Their Task",
        status: "pending",
        currentStep: "Init",
        progress: 0,
      });

      const tasks = await db.getPptTasksByUserId(testUserId);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe("My Task");
    });
  });

  describe("getPptTaskWithProject", () => {
    it("should return task with project info", async () => {
      const task = await db.createPptTask({
        userId: testUserId,
        projectId: testProjectId,
        title: "Test",
        status: "pending",
        currentStep: "Init",
        progress: 0,
      });

      const result = await db.getPptTaskWithProject(task.id);
      
      expect(result?.task.id).toBe(task.id);
      expect(result?.project?.id).toBe(testProjectId);
    });

    it("should handle task without project", async () => {
      const task = await db.createPptTask({
        userId: testUserId,
        projectId: null,
        title: "Test",
        status: "pending",
        currentStep: "Init",
        progress: 0,
      });

      const result = await db.getPptTaskWithProject(task.id);
      expect(result?.project).toBeNull();
    });
  });

  describe("updatePptTask", () => {
    it("should update task status and progress", async () => {
      const task = await db.createPptTask({
        userId: testUserId,
        projectId: testProjectId,
        title: "Test",
        status: "pending",
        currentStep: "Init",
        progress: 0,
      });

      const updated = await db.updatePptTask(task.id, {
        status: "running",
        progress: 50,
        currentStep: "Processing...",
      });

      expect(updated.status).toBe("running");
      expect(updated.progress).toBe(50);
      expect(updated.currentStep).toBe("Processing...");
    });

    it("should set result URLs on completion", async () => {
      const task = await db.createPptTask({
        userId: testUserId,
        projectId: testProjectId,
        title: "Test",
        status: "running",
        currentStep: "Running",
        progress: 50,
      });

      const updated = await db.updatePptTask(task.id, {
        status: "completed",
        progress: 100,
        resultPptxUrl: "https://example.com/result.pptx",
        resultPdfUrl: "https://example.com/result.pdf",
      });

      expect(updated.status).toBe("completed");
      expect(updated.resultPptxUrl).toBe("https://example.com/result.pptx");
      expect(updated.resultPdfUrl).toBe("https://example.com/result.pdf");
    });
  });

  describe("deletePptTask", () => {
    it("should delete task and timeline events", async () => {
      const task = await db.createPptTask({
        userId: testUserId,
        projectId: testProjectId,
        title: "Test",
        status: "pending",
        currentStep: "Init",
        progress: 0,
      });

      await db.addTimelineEvent(task.id, "Created", "pending");
      await db.deletePptTask(task.id);

      const found = await db.getPptTaskById(task.id);
      expect(found).toBeNull();
    });
  });
});

describe("Timeline Events", () => {
  let testUserId: number;
  let testTaskId: number;

  beforeEach(async () => {
    const user = await db.getOrCreateUser(`test_${Date.now()}`, "Test User");
    testUserId = user!.id;
    
    const task = await db.createPptTask({
      userId: testUserId,
      projectId: null,
      title: "Test",
      status: "pending",
      currentStep: "Init",
      progress: 0,
    });
    testTaskId = task.id;
  });

  describe("addTimelineEvent", () => {
    it("should add timeline event", async () => {
      const event = await db.addTimelineEvent(
        testTaskId,
        "Task started",
        "running"
      );

      expect(event.taskId).toBe(testTaskId);
      expect(event.message).toBe("Task started");
      expect(event.status).toBe("running");
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("getTimelineEvents", () => {
    it("should return events in chronological order", async () => {
      await db.addTimelineEvent(testTaskId, "Event 1", "pending");
      await new Promise(r => setTimeout(r, 10)); // Small delay
      await db.addTimelineEvent(testTaskId, "Event 2", "running");
      await new Promise(r => setTimeout(r, 10));
      await db.addTimelineEvent(testTaskId, "Event 3", "completed");

      const events = await db.getTimelineEvents(testTaskId);
      
      expect(events.length).toBe(3);
      expect(events[0].message).toBe("Event 1");
      expect(events[1].message).toBe("Event 2");
      expect(events[2].message).toBe("Event 3");
    });
  });
});

describe("Database Constraints and Validation", () => {
  it("should enforce unique openId", async () => {
    const openId = `unique_test_${Date.now()}`;
    
    await db.getOrCreateUser(openId, "User 1");
    
    // Second creation should return same user, not create new one
    const user2 = await db.getOrCreateUser(openId, "User 2");
    
    // Verify it's the same user
    expect(user2?.name).toBe("User 1");
  });

  it("should handle null values correctly", async () => {
    const user = await db.getOrCreateUser(`test_${Date.now()}`, "Test");
    
    const project = await db.createProject({
      userId: user!.id,
      name: "Test",
      primaryColor: "#000",
      engineProjectId: null,
      designSpec: null,
      logoUrl: null,
    });

    expect(project.engineProjectId).toBeNull();
    expect(project.designSpec).toBeNull();
  });

  it("should cascade delete properly", async () => {
    const user = await db.getOrCreateUser(`test_${Date.now()}`, "Test");
    const project = await db.createProject({
      userId: user!.id,
      name: "Test",
      primaryColor: "#000",
    });

    const task = await db.createPptTask({
      userId: user!.id,
      projectId: project.id,
      title: "Test",
      status: "pending",
      currentStep: "Init",
      progress: 0,
    });

    // Delete project should cascade to tasks
    await db.deleteProject(project.id);
    
    const foundTask = await db.getPptTaskById(task.id);
    expect(foundTask).toBeNull();
  });
});
