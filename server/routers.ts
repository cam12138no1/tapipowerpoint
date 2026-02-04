import { COOKIE_NAME } from "@shared/const";
import { PPT_TEMPLATES, getTemplateById, buildPromptFromTemplate } from "@shared/templates";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { pptEngine, getMimeType, buildPPTPrompt, DesignSpec, PPTEngineError } from "./ppt-engine";
import { storagePut, storageGet } from "./storage";
import { nanoid } from "nanoid";

// ============ Configuration ============
const CONFIG = {
  MAX_POLL_RETRIES: 10,           // Max retries when engine says completed but no file
  FILE_DOWNLOAD_TIMEOUT: 30000,   // 30 seconds for file download
  POLL_INTERVAL_MS: 2000,         // Client should poll every 2 seconds
};

// ============ Helper Functions ============

/**
 * Download file with timeout and retry
 */
async function downloadFileWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.FILE_DOWNLOAD_TIMEOUT);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return Buffer.from(await response.arrayBuffer());
    } catch (error: any) {
      console.warn(`[Download] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt === maxRetries) return null;
      await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
    }
  }
  return null;
}

/**
 * Store file to S3 and return URL
 */
async function storeFileToS3(
  buffer: Buffer,
  userId: number,
  taskId: number,
  title: string,
  extension: string,
  contentType: string
): Promise<string> {
  const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50);
  const timestamp = Date.now();
  const fileKey = `results/${userId}/${taskId}/${safeTitle}_${timestamp}.${extension}`;
  
  const { url } = await storagePut(fileKey, buffer, contentType);
  console.log(`[Storage] Stored file: ${fileKey}`);
  return url;
}

// ============ Project Router ============
const projectRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getProjectsByUserId(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.id);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      return project;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      designSpec: z.string().optional(),
      primaryColor: z.string().default("#0c87eb"),
      secondaryColor: z.string().default("#737373"),
      accentColor: z.string().default("#10b981"),
      fontFamily: z.string().default("微软雅黑"),
      logoUrl: z.string().optional(),
      logoFileKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Build design specification instruction
      const designInstruction = buildDesignInstruction(input);
      
      // Create engine project first
      let engineProjectId: string | undefined;
      try {
        const engineProject = await pptEngine.createProject({
          name: input.name,
          instruction: designInstruction,
        });
        engineProjectId = engineProject.id;
        console.log("[Project] Created engine project:", engineProjectId);
      } catch (error) {
        console.error("[Project] Failed to create engine project:", error);
        // Continue without engine project - can be retried later
      }

      return db.createProject({
        userId: ctx.user.id,
        name: input.name,
        engineProjectId,
        designSpec: input.designSpec,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        accentColor: input.accentColor,
        fontFamily: input.fontFamily,
        logoUrl: input.logoUrl,
        logoFileKey: input.logoFileKey,
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      designSpec: z.string().optional(),
      primaryColor: z.string().optional(),
      secondaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      fontFamily: z.string().optional(),
      logoUrl: z.string().optional(),
      logoFileKey: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.id);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      const { id, ...updateData } = input;
      return db.updateProject(id, updateData);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const project = await db.getProjectById(input.id);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      await db.deleteProject(input.id);
      return { success: true };
    }),
});

// ============ PPT Task Router ============
const taskRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const tasks = await db.getPptTasksByUserId(ctx.user.id);
    // Enrich with project info
    const enrichedTasks = await Promise.all(
      tasks.map(async (task) => {
        const project = await db.getProjectById(task.projectId);
        return { ...task, project };
      })
    );
    return enrichedTasks;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const taskWithProject = await db.getPptTaskWithProject(input.id);
      if (!taskWithProject || taskWithProject.task.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }
      // Return flattened structure: { ...task, project } for frontend compatibility
      return { ...taskWithProject.task, project: taskWithProject.project };
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      projectId: z.number().optional(), // 设计规范现在是可选的
      sourceFileName: z.string().optional(),
      sourceFileUrl: z.string().optional(),
      proposalContent: z.string().optional(),
      imageAttachments: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify project exists and belongs to user (if projectId is provided)
      let project = null;
      if (input.projectId) {
        project = await db.getProjectById(input.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
      }

      // Create task in pending state
      const task = await db.createPptTask({
        userId: ctx.user.id,
        projectId: input.projectId || null, // 可以为null
        title: input.title,
        status: "pending",
        currentStep: "正在初始化...",
        progress: 0,
        sourceFileName: input.sourceFileName,
        sourceFileUrl: input.sourceFileUrl,
        proposalContent: input.proposalContent,
        imageAttachments: input.imageAttachments || "[]",
      });

      return task;
    }),

  // Start task processing (called after files are uploaded)
  start: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      sourceFileId: z.string().optional(),
      proposalContent: z.string().optional(),
      imageFileIds: z.array(z.object({
        fileId: z.string(),
        usageMode: z.enum(['must_use', 'suggest_use', 'ai_decide']).optional(),
        category: z.enum(['cover', 'content', 'chart', 'logo', 'background', 'other']).optional(),
        description: z.string().optional(),
        placement: z.string().optional(), // Legacy support
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await db.getPptTaskById(input.taskId);
      if (!task || task.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      // Project is optional now - only fetch if projectId exists
      let project = null;
      if (task.projectId) {
        project = await db.getProjectById(task.projectId);
        // Project not found is not an error - user may not have selected a design spec
      }

      // Update task with file IDs
      await db.updatePptTask(input.taskId, {
        sourceFileId: input.sourceFileId,
        imageAttachments: JSON.stringify(input.imageFileIds || []),
        status: "running",
        currentStep: "正在创建生成任务...",
        progress: 50,
      });

      await db.addTimelineEvent(input.taskId, "开始生成PPT", "running");

      // Build design spec for prompt
      const designSpec: DesignSpec | null = project ? {
        name: project.name,
        primaryColor: project.primaryColor || '#0033A0',
        secondaryColor: project.secondaryColor || '#58595B',
        accentColor: project.accentColor || '#C8A951',
        fontFamily: project.fontFamily || '微软雅黑',
        designSpec: project.designSpec || undefined,
        logoUrl: project.logoUrl || undefined,
      } : null;

      // Build prompt with design spec
      const prompt = buildPPTPrompt(input.sourceFileId || null, input.imageFileIds || [], input.proposalContent, designSpec);

      // Prepare attachments
      const attachments: Array<{ fileId: string }> = [];
      if (input.sourceFileId) {
        attachments.push({ fileId: input.sourceFileId });
      }
      if (input.imageFileIds) {
        input.imageFileIds.forEach(img => attachments.push({ fileId: img.fileId }));
      }

      try {
        // Create engine task
        const engineTask = await pptEngine.createTask({
          prompt,
          projectId: project?.engineProjectId || undefined,
          attachments,
          createShareableLink: true,
          interactiveMode: true,
        });

        await db.updatePptTask(input.taskId, {
          engineTaskId: engineTask.task_id,
          currentStep: "AI正在分析文档内容...",
          progress: 60,
          // Don't expose shareUrl to frontend - keep internal for debugging
        });

        return { success: true, engineTaskId: engineTask.task_id };
      } catch (error) {
        console.error("[Task] Failed to create engine task:", error);
        await db.updatePptTask(input.taskId, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "生成服务调用失败",
          currentStep: "生成服务调用失败",
        });
        await db.addTimelineEvent(input.taskId, "生成服务调用失败", "failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "生成服务调用失败" });
      }
    }),

  // Poll task status - simplified and robust version
  poll: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const task = await db.getPptTaskById(input.taskId);
      if (!task || task.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      if (!task.engineTaskId) {
        return task;
      }

      // Only poll if task is in active state
      if (!["running", "uploading", "pending"].includes(task.status)) {
        return task;
      }

      try {
        const engineTask = await pptEngine.getTask(task.engineTaskId);
        
        // Update output content for real-time display
        const outputContent = engineTask.output 
          ? JSON.stringify(engineTask.output) 
          : task.outputContent;

        // Handle different statuses
        switch (engineTask.status) {
          case "completed": {
            console.log(`[Task ${input.taskId}] Engine completed, processing files...`);
            
            let resultPptxUrl: string | undefined;
            let resultPdfUrl: string | undefined;
            
            // Use the improved file extraction from ppt-engine
            if (engineTask.pptxFile?.url) {
              console.log(`[Task ${input.taskId}] Found PPTX file: ${engineTask.pptxFile.filename}`);
              const buffer = await downloadFileWithRetry(engineTask.pptxFile.url);
              if (buffer) {
                resultPptxUrl = await storeFileToS3(
                  buffer,
                  ctx.user.id,
                  task.id,
                  task.title,
                  'pptx',
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                );
              } else {
                // Fall back to direct URL if download fails
                console.warn(`[Task ${input.taskId}] Using direct URL for PPTX`);
                resultPptxUrl = engineTask.pptxFile.url;
              }
            }
            
            if (engineTask.pdfFile?.url) {
              console.log(`[Task ${input.taskId}] Found PDF file: ${engineTask.pdfFile.filename}`);
              const buffer = await downloadFileWithRetry(engineTask.pdfFile.url);
              if (buffer) {
                resultPdfUrl = await storeFileToS3(
                  buffer,
                  ctx.user.id,
                  task.id,
                  task.title,
                  'pdf',
                  'application/pdf'
                );
              } else {
                resultPdfUrl = engineTask.pdfFile.url;
              }
            }
            
            if (resultPptxUrl) {
              console.log(`[Task ${input.taskId}] Success! PPTX URL: ${resultPptxUrl.substring(0, 80)}...`);
              await db.updatePptTask(input.taskId, {
                status: "completed",
                currentStep: "生成完成！",
                progress: 100,
                resultPptxUrl,
                resultPdfUrl,
                outputContent,
              });
              await db.addTimelineEvent(input.taskId, "PPT生成完成", "completed");
            } else {
              // Completed but no file - use retry counter from database
              const retryData = JSON.parse(task.interactionData || '{"retryCount":0}');
              const currentRetry = (retryData.retryCount || 0) + 1;
              
              console.warn(`[Task ${input.taskId}] No PPTX found, retry ${currentRetry}/${CONFIG.MAX_POLL_RETRIES}`);
              
              if (currentRetry >= CONFIG.MAX_POLL_RETRIES) {
                await db.updatePptTask(input.taskId, {
                  status: "failed",
                  currentStep: "生成失败",
                  errorMessage: "AI完成任务但未能导出PPT文件，请点击重试按钮",
                  outputContent,
                  interactionData: null,
                });
                await db.addTimelineEvent(input.taskId, "生成失败 - 未找到PPT文件", "failed");
              } else {
                await db.updatePptTask(input.taskId, {
                  currentStep: `正在导出PPT文件... (${currentRetry}/${CONFIG.MAX_POLL_RETRIES})`,
                  progress: 95 + Math.min(currentRetry, 4),
                  outputContent,
                  interactionData: JSON.stringify({ retryCount: currentRetry }),
                });
              }
            }
            break;
          }
          
          case "failed":
          case "stopped": {
            await db.updatePptTask(input.taskId, {
              status: "failed",
              currentStep: "生成失败",
              errorMessage: engineTask.status === "stopped" ? "任务已被停止" : "生成过程中出错",
              outputContent,
            });
            await db.addTimelineEvent(input.taskId, "生成失败", "failed");
            break;
          }
          
          case "ask": {
            await db.updatePptTask(input.taskId, {
              status: "ask",
              currentStep: "需要您的确认",
              interactionData: JSON.stringify(engineTask.output),
              outputContent,
            });
            await db.addTimelineEvent(input.taskId, "等待用户确认", "ask");
            break;
          }
          
          default: {
            // Still running - calculate progress
            let progress = task.progress || 60;
            let currentStep = "AI正在处理中...";
            
            if (engineTask.output && Array.isArray(engineTask.output)) {
              // More messages = more progress (cap at 94%)
              progress = Math.min(60 + engineTask.output.length * 2, 94);
              
              // Get latest step from output
              const lastMsg = engineTask.output[engineTask.output.length - 1];
              if (lastMsg?.content) {
                const textItem = lastMsg.content.find((c: any) => c.type === 'output_text');
                if (textItem?.text) {
                  const firstLine = textItem.text.split('\n')[0].trim();
                  if (firstLine.length > 5 && firstLine.length < 100) {
                    currentStep = firstLine;
                  }
                }
              }
            }
            
            await db.updatePptTask(input.taskId, {
              progress,
              currentStep,
              outputContent,
            });
          }
        }
      } catch (error) {
        if (error instanceof PPTEngineError && error.retryable) {
          console.warn(`[Task ${input.taskId}] Retryable error:`, error.message);
          // Don't update task status for retryable errors
        } else {
          console.error(`[Task ${input.taskId}] Poll error:`, error);
        }
      }

      return db.getPptTaskById(input.taskId);
    }),

  // Continue task (respond to AI question)
  continue: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      userResponse: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await db.getPptTaskById(input.taskId);
      if (!task || task.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      if (task.status !== "ask" || !task.engineTaskId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Task is not waiting for input" });
      }

      try {
        await pptEngine.continueTask(task.engineTaskId, input.userResponse);
        
        await db.updatePptTask(input.taskId, {
          status: "running",
          currentStep: "继续生成中...",
          interactionData: null,
        });
        await db.addTimelineEvent(input.taskId, "用户已确认，继续生成", "running");

        return { success: true };
      } catch (error) {
        console.error("[Task] Failed to continue task:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "继续任务失败" });
      }
    }),

  // Retry failed task
  retry: protectedProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const task = await db.getPptTaskById(input.taskId);
      if (!task || task.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      if (task.status !== "failed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只能重试失败的任务" });
      }

      // Project is optional now - only fetch if projectId exists
      let project = null;
      if (task.projectId) {
        project = await db.getProjectById(task.projectId);
        // Project not found is not an error - user may not have selected a design spec
      }

      // Reset task state but keep original configuration
      await db.updatePptTask(input.taskId, {
        status: "running",
        currentStep: "正在重试生成任务...",
        progress: 50,
        errorMessage: null,
        engineTaskId: null,
        interactionData: null,
        outputContent: null,
      });
      await db.addTimelineEvent(input.taskId, "重试任务", "running");

      // Parse existing attachments (preserved from original task)
      const imageAttachments = JSON.parse(task.imageAttachments || "[]");

      // Build design spec for prompt
      const designSpec: DesignSpec | null = project ? {
        name: project.name,
        primaryColor: project.primaryColor || '#0033A0',
        secondaryColor: project.secondaryColor || '#58595B',
        accentColor: project.accentColor || '#C8A951',
        fontFamily: project.fontFamily || '微软雅黑',
        designSpec: project.designSpec || undefined,
        logoUrl: project.logoUrl || undefined,
      } : null;

      // Build prompt using preserved configuration with design spec
      const prompt = buildPPTPrompt(task.sourceFileId || null, imageAttachments, task.proposalContent || undefined, designSpec);

      // Prepare attachments using preserved file IDs
      const attachments: Array<{ fileId: string }> = [];
      if (task.sourceFileId) {
        attachments.push({ fileId: task.sourceFileId });
      }
      if (imageAttachments.length > 0) {
        imageAttachments.forEach((img: { fileId: string }) => attachments.push({ fileId: img.fileId }));
      }

      try {
        // Create new engine task with preserved configuration
        const engineTask = await pptEngine.createTask({
          prompt,
          projectId: project?.engineProjectId || undefined,
          attachments,
          createShareableLink: true,
          interactiveMode: true,
        });

        await db.updatePptTask(input.taskId, {
          engineTaskId: engineTask.task_id,
          currentStep: "AI正在分析文档内容...",
          progress: 60,
          // Don't expose shareUrl to frontend - keep internal for debugging
        });

        return { success: true, engineTaskId: engineTask.task_id };
      } catch (error) {
        console.error("[Task] Failed to retry task:", error);
        await db.updatePptTask(input.taskId, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "重试失败",
          currentStep: "重试失败",
        });
        await db.addTimelineEvent(input.taskId, "重试失败", "failed");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "重试失败" });
      }
    }),

  // Regenerate a specific slide
  regenerateSlide: protectedProcedure
    .input(z.object({
      taskId: z.number(),
      slideIndex: z.number(),
      instruction: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const task = await db.getPptTaskById(input.taskId);
      if (!task || task.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      if (task.status !== "completed" || !task.engineTaskId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只能对已完成的任务重新生成幻灯片" });
      }

      try {
        // Build regeneration prompt
        const regeneratePrompt = `请重新生成第 ${input.slideIndex + 1} 页幻灯片，根据以下要求修改：\n\n${input.instruction}\n\n请保持其他页面不变，只修改指定的页面，并重新生成完整的PPTX文件。`;

        // Continue the task with regeneration instruction
        await pptEngine.continueTask(task.engineTaskId, regeneratePrompt);
        
        await db.updatePptTask(input.taskId, {
          status: "running",
          currentStep: `正在重新生成第 ${input.slideIndex + 1} 页...`,
          progress: 80,
        });
        await db.addTimelineEvent(input.taskId, `重新生成第 ${input.slideIndex + 1} 页`, "running");

        return { success: true };
      } catch (error) {
        console.error("[Task] Failed to regenerate slide:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "重新生成失败" });
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const task = await db.getPptTaskById(input.id);
      if (!task || task.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      await db.deletePptTask(input.id);
      return { success: true };
    }),
});

// ============ Template Router ============
const templateRouter = router({
  list: publicProcedure.query(() => {
    return PPT_TEMPLATES.map(t => ({
      id: t.id,
      name: t.name,
      nameEn: t.nameEn,
      description: t.description,
      category: t.category,
      colors: t.colors,
      typography: t.typography,
      layout: t.layout,
      structure: t.structure,
      bullets: t.bullets,
      charts: t.charts,
      tables: t.tables,
      headerFooter: t.headerFooter,
    }));
  }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const template = getTemplateById(input.id);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      return template;
    }),

  // Apply template to create a new project
  applyToProject: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      projectName: z.string().min(1),
      additionalRequirements: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const template = getTemplateById(input.templateId);
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      // Build full design spec from template
      const designSpec = buildPromptFromTemplate(template, input.additionalRequirements);

      // Create engine project with template settings
      let engineProjectId: string | undefined;
      try {
        const engineProject = await pptEngine.createProject({
          name: input.projectName,
          instruction: designSpec,
        });
        engineProjectId = engineProject.id;
        console.log("[Template] Created engine project from template:", engineProjectId);
      } catch (error) {
        console.error("[Template] Failed to create engine project:", error);
      }

      // Create project in database
      return db.createProject({
        userId: ctx.user.id,
        name: input.projectName,
        engineProjectId,
        designSpec,
        primaryColor: template.colors.primary,
        secondaryColor: template.colors.secondary,
        accentColor: template.colors.accent,
        fontFamily: template.typography.headingFont,
      });
    }),
});

// ============ File Upload Router ============
const fileRouter = router({
  // Get presigned upload URL for S3
  getUploadUrl: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      contentType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const fileKey = `uploads/${ctx.user.id}/${nanoid()}-${input.fileName}`;
      // For now, we'll handle uploads directly in the upload mutation
      return { fileKey, uploadUrl: `/api/upload?key=${encodeURIComponent(fileKey)}` };
    }),

  // Upload file to S3 and optionally to engine
  upload: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      contentType: z.string(),
      base64Data: z.string(),
      uploadToEngine: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      const fileSizeMB = buffer.length / (1024 * 1024);
      
      console.log(`[File] Uploading file: ${input.fileName}, size: ${fileSizeMB.toFixed(2)}MB`);
      
      // Check file size limit (50MB max for engine upload)
      const MAX_FILE_SIZE_MB = 50;
      if (fileSizeMB > MAX_FILE_SIZE_MB) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `文件太大（${fileSizeMB.toFixed(1)}MB），最大支持${MAX_FILE_SIZE_MB}MB`,
        });
      }
      
      const fileKey = `uploads/${ctx.user.id}/${nanoid()}-${input.fileName}`;
      
      // Upload to S3
      let s3Url: string;
      try {
        const { url } = await storagePut(fileKey, buffer, input.contentType);
        s3Url = url;
        console.log(`[File] Uploaded to S3: ${fileKey}`);
      } catch (error: any) {
        console.error("[File] S3 upload failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `文件上传失败: ${error.message || '未知错误'}`,
        });
      }
      
      // Optionally upload to engine
      let engineFileId: string | undefined;
      if (input.uploadToEngine) {
        try {
          console.log(`[File] Uploading to engine: ${input.fileName}`);
          engineFileId = await pptEngine.uploadFile(input.fileName, buffer, input.contentType);
          console.log(`[File] Engine file ID: ${engineFileId}`);
        } catch (error: any) {
          console.error("[File] Failed to upload to engine:", error);
          // Extract meaningful error message
          let errorMessage = '文件上传到AI服务失败';
          if (error.response) {
            // API returned an error response
            const status = error.response.status;
            const data = error.response.data;
            if (status === 413) {
              errorMessage = '文件太大，请压缩后重试';
            } else if (status === 408 || status === 504) {
              errorMessage = '上传超时，请稍后重试';
            } else if (typeof data === 'string') {
              errorMessage = data.substring(0, 100);
            } else if (data?.message) {
              errorMessage = data.message;
            } else if (data?.error) {
              errorMessage = data.error;
            }
          } else if (error.code === 'ECONNABORTED') {
            errorMessage = '上传超时，请检查网络连接';
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: errorMessage,
          });
        }
      }

      return { url: s3Url, fileKey, engineFileId };
    }),
});

// Helper function to build design instruction for engine project
function buildDesignInstruction(config: {
  name: string;
  designSpec?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoUrl?: string;
}): string {
  const lines = [
    `# ${config.name} PPT设计规范`,
    "",
    "## 色彩规范",
    `- 主色调：${config.primaryColor}`,
    `- 辅助色：${config.secondaryColor}`,
    `- 强调色：${config.accentColor}`,
    "",
    "## 字体规范",
    `- 主字体：${config.fontFamily}`,
    "- 标题字号：32-44pt",
    "- 正文字号：18-24pt",
    "",
    "## 设计原则",
    "1. 保持简洁专业的视觉风格",
    "2. 每页内容不宜过多，突出重点",
    "3. 图文搭配合理，留白适当",
    "4. 色彩使用统一，符合品牌调性",
  ];

  if (config.logoUrl) {
    lines.push("");
    lines.push("## Logo使用");
    lines.push(`- Logo地址：${config.logoUrl}`);
    lines.push("- 在封面和每页页脚使用Logo");
  }

  if (config.designSpec) {
    lines.push("");
    lines.push("## 额外设计要求");
    lines.push(config.designSpec);
  }

  return lines.join("\n");
}

// ============ Auth Router ============
import { createToken } from "./_core/auth";

const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  
  // Login endpoint - creates JWT token
  login: publicProcedure
    .input(z.object({
      username: z.string().min(1, "用户名不能为空"),
    }))
    .mutation(async ({ ctx, input }) => {
      const username = input.username.trim();
      
      // Generate a stable openId from username
      const openId = `user_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      
      // Get or create user
      const user = await db.getOrCreateUser(openId, username);
      if (!user) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建用户失败" });
      }
      
      // Generate JWT token
      const { token, expiresAt } = await createToken({
        userId: user.id,
        openId: user.openId,
        name: user.name || username,
        role: user.role as 'user' | 'admin',
      });
      
      // Set cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie('auth_token', token, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      
      return { 
        success: true,
        user: {
          id: user.id,
          name: user.name,
          openId: user.openId,
          role: user.role,
        },
        token,
        expiresAt,
      };
    }),
  
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    ctx.res.clearCookie('auth_token', { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  project: projectRouter,
  task: taskRouter,
  file: fileRouter,
  template: templateRouter,
});

export type AppRouter = typeof appRouter;
