import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { checkDatabaseHealth } from "../db";
import { ENV } from "./env";

export const systemRouter = router({
  // Enhanced health check with more details
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative").optional(),
        verbose: z.boolean().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const dbHealth = await checkDatabaseHealth();
      
      const baseResponse = {
        ok: dbHealth.healthy,
        status: dbHealth.healthy ? 'ok' : 'degraded',
        database: dbHealth,
        timestamp: new Date().toISOString(),
      };
      
      // Include more details if verbose mode
      if (input?.verbose) {
        return {
          ...baseResponse,
          config: {
            hasApiKey: !!ENV.pptEngineApiKey,
            hasDatabase: !!ENV.databaseUrl,
            hasR2Storage: !!(ENV.r2AccountId && ENV.r2AccessKeyId),
            isProduction: ENV.isProduction,
          },
          version: process.env.npm_package_version || '1.0.0',
        };
      }
      
      return baseResponse;
    }),

  // Debug endpoint for checking configuration (admin only)
  debug: adminProcedure.query(async () => {
    const dbHealth = await checkDatabaseHealth();
    
    return {
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasJwtSecret: !!ENV.cookieSecret,
        hasApiKey: !!ENV.pptEngineApiKey,
        apiUrl: ENV.pptEngineApiUrl,
      },
      storage: {
        hasR2: !!(ENV.r2AccountId && ENV.r2AccessKeyId && ENV.r2BucketName),
        hasForge: !!(ENV.forgeApiUrl && ENV.forgeApiKey),
        r2Bucket: ENV.r2BucketName ? `${ENV.r2BucketName.substring(0, 5)}...` : null,
      },
      database: {
        healthy: dbHealth.healthy,
        type: dbHealth.type,
        latency: dbHealth.latencyMs,
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
