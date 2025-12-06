import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { extractFieldsFromDocument, bufferToBase64 } from "./gemini";
import { storage } from "./storage";
import { evaluateClaim } from "./rules-engine";
import { sendMissingDocumentsEmail } from "./email";
import { insertRuleSchema, ruleConditionSchema, extractedFieldSchema, createSubmissionRequestSchema, requiredDocumentTypes } from "@shared/schema";
import { z } from "zod";
import type { Document, ProcessDocumentResponse, InsertFieldDefinition, RequiredDocumentType } from "@shared/schema";

const updateRuleSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  conditions: z.array(ruleConditionSchema).min(1, "Rule must have at least one condition").optional(),
  logic: z.enum(["all", "any"]).optional(),
  action: z.enum(["fail", "pass"]).optional(),
  enabled: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: "At least one field must be provided" });

const evaluateFieldsSchema = z.object({
  fields: z.array(extractedFieldSchema).min(1, "At least one valid field is required"),
});

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

  // Rules management endpoints
  app.get("/api/rules", async (_req: Request, res: Response) => {
    try {
      const rules = await storage.getRules();
      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rules" });
    }
  });

  app.post("/api/rules", async (req: Request, res: Response) => {
    try {
      const parsed = insertRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }
      const rule = await storage.createRule(parsed.data);
      res.json(rule);
    } catch (error) {
      res.status(500).json({ error: "Failed to create rule" });
    }
  });

  app.patch("/api/rules/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const parsed = updateRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid update data" });
      }
      const rule = await storage.updateRule(id, parsed.data);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(rule);
    } catch (error) {
      res.status(500).json({ error: "Failed to update rule" });
    }
  });

  app.delete("/api/rules/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteRule(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete rule" });
    }
  });

  app.post("/api/rules/evaluate", async (req: Request, res: Response) => {
    try {
      const parsed = evaluateFieldsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid fields data" });
      }
      const enabledRules = await storage.getEnabledRules();
      const verdict = evaluateClaim(parsed.data.fields, enabledRules);
      res.json(verdict);
    } catch (error) {
      res.status(500).json({ error: "Failed to evaluate rules" });
    }
  });

  app.post("/api/submissions", async (req: Request, res: Response) => {
    try {
      const parsed = createSubmissionRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid submission data" });
      }
      const submission = await storage.createSubmission(parsed.data.patientInfo, parsed.data.providerEmail);
      res.json(submission);
    } catch (error) {
      res.status(500).json({ error: "Failed to create submission" });
    }
  });

  app.get("/api/submissions/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const submission = await storage.getSubmission(id);
      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }
      res.json(submission);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch submission" });
    }
  });

  app.post(
    "/api/submissions/:id/documents",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const documentType = req.body.documentType as RequiredDocumentType;
        const file = req.file;

        if (!file) {
          return res.status(400).json({ error: "No file provided" });
        }

        if (!documentType || !requiredDocumentTypes.includes(documentType)) {
          return res.status(400).json({ error: "Invalid document type" });
        }

        const submission = await storage.getSubmission(id);
        if (!submission) {
          return res.status(404).json({ error: "Submission not found" });
        }

        const base64Data = bufferToBase64(file.buffer);
        const updated = await storage.updateSubmissionDocument(id, documentType, {
          uploaded: true,
          filename: file.originalname,
          fileData: base64Data,
          fileType: file.mimetype,
          fileSize: file.size,
        });

        res.json(updated);
      } catch (error) {
        res.status(500).json({ error: "Failed to upload document" });
      }
    }
  );

  app.post("/api/submissions/:id/process", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const submission = await storage.getSubmission(id);

      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      if (!submission.isComplete) {
        return res.status(400).json({
          error: "Cannot process submission - missing documents",
          missingDocuments: submission.missingDocuments,
        });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      await storage.updateSubmissionStatus(id, "processing");

      const enabledFields = await storage.getEnabledFieldDefinitions();
      const allExtractedFields: Record<string, any> = {};

      for (const doc of submission.documentChecklist) {
        if (doc.uploaded && doc.fileData && doc.fileType) {
          const result = await extractFieldsFromDocument(doc.fileData, doc.fileType, enabledFields);
          if (result.fields) {
            result.fields.forEach(field => {
              allExtractedFields[field.label] = {
                value: field.value,
                confidence: field.confidence,
                source: doc.type,
              };
            });
          }
        }
      }

      const updated = await storage.setSubmissionExtractedData(id, allExtractedFields);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to process submission" });
    }
  });

  app.post("/api/submissions/:id/notify", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const submission = await storage.getSubmission(id);

      if (!submission) {
        return res.status(404).json({ error: "Submission not found" });
      }

      if (submission.isComplete) {
        return res.status(400).json({ error: "All documents already uploaded" });
      }

      if (!submission.providerEmail) {
        return res.status(400).json({ error: "No provider email configured" });
      }

      if (submission.notificationSentAt) {
        return res.status(400).json({ error: "Notification already sent", sentAt: submission.notificationSentAt });
      }

      const result = await sendMissingDocumentsEmail({
        providerEmail: submission.providerEmail,
        patientName: submission.patientInfo.name,
        patientEmail: submission.patientInfo.email,
        patientPhone: submission.patientInfo.phone,
        missingDocuments: submission.missingDocuments,
        submissionId: id,
      });

      if (!result.success) {
        return res.status(500).json({ error: result.error || "Failed to send email" });
      }

      const updated = await storage.setSubmissionNotified(id);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  return httpServer;
}
