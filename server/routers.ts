import { COOKIE_NAME } from "@shared/const";
import { PPT_TEMPLATES, getTemplateById, buildPromptFromTemplate } from "@shared/templates";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { pptEngine, getMimeType, buildPPTPrompt, DesignSpec } from "./ppt-engine";
import { storagePut, storageGet } from "./storage";
import { nanoid } from "nanoid";

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
      if (!taskWithProject || taskWithProject.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }
      return taskWithProject;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      projectId: z.number(),
      sourceFileName: z.string().optional(),
      sourceFileUrl: z.string().optional(),
      proposalContent: z.string().optional(),
      imageAttachments: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify project exists and belongs to user
      const project = await db.getProjectById(input.projectId);
      if (!project || project.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      // Create task in pending state
      const task = await db.createPptTask({
        userId: ctx.user.id,
        projectId: input.projectId,
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

      const project = await db.getProjectById(task.projectId);
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
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
          projectId: project.engineProjectId || undefined,
          attachments,
          createShareableLink: true,
          interactiveMode: true,
        });

        await db.updatePptTask(input.taskId, {
          engineTaskId: engineTask.task_id,
          currentStep: "AI正在分析文档内容...",
          progress: 60,
          shareUrl: engineTask.share_url || engineTask.task_url,
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

  // Poll task status - extracts real output content from API
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
      if (!["running", "uploading"].includes(task.status)) {
        return task;
      }

      try {
        const engineTask = await pptEngine.getTask(task.engineTaskId);
        
        // Extract and store output content for real-time display
        let outputContent = task.outputContent;
        let shareUrl = task.shareUrl;
        
        // Update output content if available (API returns array of messages)
        if (engineTask.output && Array.isArray(engineTask.output)) {
          outputContent = JSON.stringify(engineTask.output);
        }
        
        // Update share URL if available
        if (engineTask.share_url) {
          shareUrl = engineTask.share_url;
        }
        
        if (engineTask.status === "completed") {
          // Extract result files from attachments
          let resultPptxUrl: string | undefined;
          let resultPdfUrl: string | undefined;
          
          // Check attachments from the parsed output
          if (engineTask.attachments && engineTask.attachments.length > 0) {
            for (const att of engineTask.attachments) {
              const filename = att.filename || att.file_name || "";
              const url = att.url || att.download_url;
              
              if (filename.toLowerCase().endsWith(".pptx") && url) {
                // Download and store in S3 for permanent access
                try {
                  const response = await fetch(url);
                  const buffer = Buffer.from(await response.arrayBuffer());
                  const fileKey = `results/${ctx.user.id}/${task.id}/${nanoid()}.pptx`;
                  const { url: s3Url } = await storagePut(fileKey, buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
                  resultPptxUrl = s3Url;
                } catch (e) {
                  console.error("[Task] Failed to store PPTX:", e);
                  resultPptxUrl = url;
                }
              }
              
              if (filename.toLowerCase().endsWith(".pdf") && url) {
                try {
                  const response = await fetch(url);
                  const buffer = Buffer.from(await response.arrayBuffer());
                  const fileKey = `results/${ctx.user.id}/${task.id}/${nanoid()}.pdf`;
                  const { url: s3Url } = await storagePut(fileKey, buffer, "application/pdf");
                  resultPdfUrl = s3Url;
                } catch (e) {
                  console.error("[Task] Failed to store PDF:", e);
                  resultPdfUrl = url;
                }
              }
            }
          }

          await db.updatePptTask(input.taskId, {
            status: "completed",
            currentStep: "生成完成！",
            progress: 100,
            resultPptxUrl,
            resultPdfUrl,
            outputContent,
            shareUrl,
          });
          await db.addTimelineEvent(input.taskId, "PPT生成完成", "completed");
          
        } else if (engineTask.status === "failed" || engineTask.status === "stopped") {
          await db.updatePptTask(input.taskId, {
            status: "failed",
            currentStep: "生成失败",
            errorMessage: "生成任务失败或已停止",
            outputContent,
          });
          await db.addTimelineEvent(input.taskId, "生成失败", "failed");
          
        } else if (engineTask.status === "ask") {
          await db.updatePptTask(input.taskId, {
            status: "ask",
            currentStep: "需要您的确认",
            interactionData: JSON.stringify(engineTask.output),
            outputContent,
            shareUrl,
          });
          await db.addTimelineEvent(input.taskId, "等待用户确认", "ask");
          
        } else {
          // Still running, calculate progress based on output content
          let newProgress = task.progress || 60;
          let currentStep = task.currentStep || "AI正在处理中...";
          
          // Analyze output content to determine actual progress
          if (engineTask.output && Array.isArray(engineTask.output)) {
            const outputLength = engineTask.output.length;
            // More output messages = more progress (cap at 95%)
            newProgress = Math.min(60 + Math.floor(outputLength * 3), 95);
            
            // Extract current step from latest output
            const latestOutput = engineTask.output[engineTask.output.length - 1];
            if (latestOutput && latestOutput.content) {
              const textContent = latestOutput.content.find((c: any) => c.type === 'output_text');
              if (textContent && textContent.text) {
                // Extract first line as current step (max 100 chars)
                const firstLine = textContent.text.split('\n')[0].substring(0, 100);
                if (firstLine && firstLine.length > 5) {
                  currentStep = firstLine;
                }
              }
            }
          }
          
          await db.updatePptTask(input.taskId, {
            progress: newProgress,
            currentStep,
            outputContent,
            shareUrl,
          });
        }
      } catch (error) {
        console.error("[Task] Error polling engine task:", error);
        // Don't fail the task on polling error, just log it
      }

      // Return updated task
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

      const project = await db.getProjectById(task.projectId);
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
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
          projectId: project.engineProjectId || undefined,
          attachments,
          createShareableLink: true,
          interactiveMode: true,
        });

        await db.updatePptTask(input.taskId, {
          engineTaskId: engineTask.task_id,
          currentStep: "AI正在分析文档内容...",
          progress: 60,
          shareUrl: engineTask.share_url || engineTask.task_url,
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
      const fileKey = `uploads/${ctx.user.id}/${nanoid()}-${input.fileName}`;
      
      // Upload to S3
      const { url } = await storagePut(fileKey, buffer, input.contentType);
      
      // Optionally upload to engine
      let engineFileId: string | undefined;
      if (input.uploadToEngine) {
        try {
          engineFileId = await pptEngine.uploadFile(input.fileName, buffer, input.contentType);
        } catch (error) {
          console.error("[File] Failed to upload to engine:", error);
        }
      }

      return { url, fileKey, engineFileId };
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

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  project: projectRouter,
  task: taskRouter,
  file: fileRouter,
  template: templateRouter,
});

export type AppRouter = typeof appRouter;
