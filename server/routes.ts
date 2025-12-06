import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { extractFieldsFromDocument, bufferToBase64 } from "./gemini";
import { storage } from "./storage";
import type { Document, ProcessDocumentResponse, InsertFieldDefinition } from "@shared/schema";

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF, PNG, and JPG are allowed."));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Process document endpoint
  app.post(
    "/api/documents/process",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const file = req.file;

        if (!file) {
          return res.status(400).json({
            success: false,
            error: "No file provided",
          } as ProcessDocumentResponse);
        }

        // Check for API key
        if (!process.env.GEMINI_API_KEY) {
          return res.status(500).json({
            success: false,
            error: "Gemini API key not configured. Please add GEMINI_API_KEY to your secrets.",
          } as ProcessDocumentResponse);
        }

        // Convert file to base64
        const base64Data = bufferToBase64(file.buffer);

        // Get enabled custom field definitions
        const enabledFields = await storage.getEnabledFieldDefinitions();

        // Extract fields using Gemini with custom field definitions
        const extractionResult = await extractFieldsFromDocument(
          base64Data,
          file.mimetype,
          enabledFields
        );

        if (extractionResult.error) {
          const isConfigError = extractionResult.error.includes("No extraction fields are enabled");
          return res.status(isConfigError ? 400 : 500).json({
            success: false,
            error: extractionResult.error,
          } as ProcessDocumentResponse);
        }

        // Create document object
        const document: Document = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          filename: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          status: "completed",
          extractedFields: extractionResult.fields,
          // For images, create a data URL for preview
          thumbnailUrl: file.mimetype.startsWith("image/")
            ? `data:${file.mimetype};base64,${base64Data}`
            : undefined,
        };

        return res.json({
          success: true,
          document,
        } as ProcessDocumentResponse);
      } catch (error) {
        console.error("Document processing error:", error);
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : "Failed to process document",
        } as ProcessDocumentResponse);
      }
    }
  );

  // Health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      hasApiKey: !!process.env.GEMINI_API_KEY,
    });
  });

  // Field definitions endpoints
  app.get("/api/fields", async (_req: Request, res: Response) => {
    try {
      const fields = await storage.getFieldDefinitions();
      res.json(fields);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch field definitions" });
    }
  });

  app.post("/api/fields", async (req: Request, res: Response) => {
    try {
      const { name, description, enabled } = req.body;
      if (!name || !description) {
        return res.status(400).json({ error: "Name and description are required" });
      }
      const field = await storage.createFieldDefinition({
        name,
        description,
        enabled: enabled ?? true,
      } as InsertFieldDefinition);
      res.json(field);
    } catch (error) {
      res.status(500).json({ error: "Failed to create field definition" });
    }
  });

  app.patch("/api/fields/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const field = await storage.updateFieldDefinition(id, updates);
      if (!field) {
        return res.status(404).json({ error: "Field not found" });
      }
      res.json(field);
    } catch (error) {
      res.status(500).json({ error: "Failed to update field definition" });
    }
  });

  app.delete("/api/fields/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteFieldDefinition(id);
      if (!deleted) {
        return res.status(404).json({ error: "Field not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete field definition" });
    }
  });

  app.post("/api/fields/reset", async (_req: Request, res: Response) => {
    try {
      const fields = await storage.resetFieldDefinitions();
      res.json(fields);
    } catch (error) {
      res.status(500).json({ error: "Failed to reset field definitions" });
    }
  });

  return httpServer;
}
