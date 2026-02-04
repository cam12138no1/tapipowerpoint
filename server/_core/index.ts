import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { localStorageRead, localStorageExists } from "../local-storage";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// MIME type mapping
const mimeTypes: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // Local storage file serving endpoint
  app.get("/api/storage/*", (req, res) => {
    const fileKey = req.params[0];
    
    if (!fileKey) {
      return res.status(400).json({ error: "File key required" });
    }
    
    if (!localStorageExists(fileKey)) {
      return res.status(404).json({ error: "File not found" });
    }
    
    const fileData = localStorageRead(fileKey);
    if (!fileData) {
      return res.status(500).json({ error: "Failed to read file" });
    }
    
    const mimeType = getMimeType(fileKey);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(fileKey)}"`);
    res.send(fileData);
  });
  
  // File download proxy endpoint - helps with CORS issues
  app.get("/api/download", async (req, res) => {
    const { url, filename } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "URL parameter required" });
    }
    
    try {
      // Validate URL
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: "Invalid URL protocol" });
      }
      
      console.log(`[Download Proxy] Fetching: ${url.substring(0, 100)}...`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TapiPowerPoint/1.0',
        },
      });
      
      if (!response.ok) {
        console.error(`[Download Proxy] Failed: ${response.status} ${response.statusText}`);
        return res.status(response.status).json({ 
          error: `Remote server returned ${response.status}` 
        });
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const downloadName = typeof filename === 'string' ? filename : 'download';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.send(buffer);
      
      console.log(`[Download Proxy] Success: ${buffer.length} bytes`);
    } catch (error: any) {
      console.error('[Download Proxy] Error:', error.message);
      res.status(500).json({ error: error.message || 'Download failed' });
    }
  });
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  process.exit(1);
});

startServer().catch(console.error);
