// This is the updated poll method for routers.ts
// Replace the existing poll method with this implementation

/*
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
        
        // Update output content if available
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
            // More output messages = more progress
            newProgress = Math.min(60 + Math.floor(outputLength * 3), 95);
            
            // Extract current step from latest output
            const latestOutput = engineTask.output[engineTask.output.length - 1];
            if (latestOutput && latestOutput.content) {
              const textContent = latestOutput.content.find((c: any) => c.type === 'output_text');
              if (textContent && textContent.text) {
                // Extract first line as current step
                const firstLine = textContent.text.split('\n')[0].substring(0, 100);
                if (firstLine) {
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
*/
