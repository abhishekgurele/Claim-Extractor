import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { extractFieldsFromDocument, bufferToBase64 } from "./gemini";
import { storage } from "./storage";
import { evaluateClaim } from "./rules-engine";
import { sendMissingDocumentsEmail } from "./email";
import { insertRuleSchema, ruleConditionSchema, extractedFieldSchema, createSubmissionRequestSchema, requiredDocumentTypes, analyzeFraudRequestSchema, sampleClaimData, generateBulkClaims, claimDataInputSchema, analyzeUnderwritingRequestSchema, generateBulkUnderwritingApplications, sampleIndividualApplication, sampleCompanyApplication, underwritingApplicationInputSchema } from "@shared/schema";
import type { BulkAnalysisResult, ClaimDataInput, BulkUnderwritingResult, UnderwritingApplicationInput } from "@shared/schema";
import { analyzeFraud } from "./fraud-engine";
import { analyzeUnderwriting } from "./underwriting-engine";
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

  // ============================================
  // FRAUD DETECTION ENDPOINTS
  // ============================================

  app.post("/api/fraud/analyze", async (req: Request, res: Response) => {
    try {
      const parsed = analyzeFraudRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid claim data" });
      }
      const assessment = analyzeFraud(parsed.data.claimData);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ error: "Failed to analyze fraud" });
    }
  });

  app.get("/api/fraud/sample-data", async (_req: Request, res: Response) => {
    try {
      res.json(sampleClaimData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sample data" });
    }
  });

  app.get("/api/fraud/generate-bulk", async (req: Request, res: Response) => {
    try {
      const count = Math.min(parseInt(req.query.count as string) || 100, 500);
      const claims = generateBulkClaims(count);
      res.json(claims);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate bulk claims" });
    }
  });

  app.post("/api/fraud/analyze-bulk", async (req: Request, res: Response) => {
    try {
      const claimsSchema = z.object({
        claims: z.array(claimDataInputSchema).min(1).max(500),
      });
      const parsed = claimsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid claims data" });
      }
      
      const results = parsed.data.claims.map(claim => analyzeFraud(claim));
      
      const highRisk = results.filter(r => r.riskLevel === "high").length;
      const mediumRisk = results.filter(r => r.riskLevel === "medium").length;
      const lowRisk = results.filter(r => r.riskLevel === "low").length;
      const averageScore = Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length);
      
      const bulkResult: BulkAnalysisResult = {
        totalClaims: results.length,
        analyzedAt: new Date().toISOString(),
        summary: {
          highRisk,
          mediumRisk,
          lowRisk,
          averageScore,
        },
        results,
      };
      
      res.json(bulkResult);
    } catch (error) {
      res.status(500).json({ error: "Failed to analyze bulk claims" });
    }
  });

  app.post("/api/fraud/parse-csv", async (req: Request, res: Response) => {
    try {
      const { csvContent } = req.body;
      if (!csvContent || typeof csvContent !== "string") {
        return res.status(400).json({ error: "CSV content is required" });
      }
      
      const lines = csvContent.trim().split("\n");
      if (lines.length < 2) {
        return res.status(400).json({ error: "CSV must have header row and at least one data row" });
      }
      
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const claims: ClaimDataInput[] = [];
      
      const headerMap: Record<string, keyof ClaimDataInput> = {
        "claimant name": "claimantName",
        "claimantname": "claimantName",
        "policy number": "policyNumber",
        "policynumber": "policyNumber",
        "claim number": "claimNumber",
        "claimnumber": "claimNumber",
        "claim date": "claimDate",
        "claimdate": "claimDate",
        "claim amount": "claimAmount",
        "claimamount": "claimAmount",
        "incident date": "incidentDate",
        "incidentdate": "incidentDate",
        "incident description": "incidentDescription",
        "incidentdescription": "incidentDescription",
        "incident location": "incidentLocation",
        "incidentlocation": "incidentLocation",
        "treatment date": "treatmentDate",
        "treatmentdate": "treatmentDate",
        "provider name": "providerName",
        "providername": "providerName",
        "provider npi": "providerNPI",
        "providernpi": "providerNPI",
        "diagnosis code": "diagnosisCode",
        "diagnosiscode": "diagnosisCode",
        "claimant address": "claimantAddress",
        "claimantaddress": "claimantAddress",
        "claimant phone": "claimantPhone",
        "claimantphone": "claimantPhone",
        "claimant email": "claimantEmail",
        "claimantemail": "claimantEmail",
        "vehicle info": "vehicleInfo",
        "vehicleinfo": "vehicleInfo",
        "policy holder name": "policyHolderName",
        "policyholdername": "policyHolderName",
        "policy limit": "policyLimit",
        "policylimit": "policyLimit",
        "previous claims count": "previousClaimsCount",
        "previousclaimscount": "previousClaimsCount",
        "days since last claim": "daysSinceLastClaim",
        "dayssincelastclaim": "daysSinceLastClaim",
      };
      
      for (let i = 1; i < lines.length && claims.length < 500; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        const claim: ClaimDataInput = {};
        
        headers.forEach((header, idx) => {
          const field = headerMap[header];
          if (field && values[idx]) {
            const value = values[idx];
            if (field === "claimAmount" || field === "policyLimit" || field === "previousClaimsCount" || field === "daysSinceLastClaim") {
              const num = parseFloat(value);
              if (!isNaN(num)) {
                (claim as any)[field] = num;
              }
            } else {
              (claim as any)[field] = value;
            }
          }
        });
        
        if (Object.keys(claim).length > 0) {
          claims.push(claim);
        }
      }
      
      res.json({ claims, count: claims.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to parse CSV" });
    }
  });

  // ============================================
  // UNDERWRITING ENGINE ENDPOINTS
  // ============================================

  app.post("/api/underwriting/analyze", async (req: Request, res: Response) => {
    try {
      const parsed = analyzeUnderwritingRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request data", details: parsed.error.flatten() });
      }
      const assessment = analyzeUnderwriting(parsed.data.applicationData);
      res.json(assessment);
    } catch (error) {
      res.status(500).json({ error: "Failed to analyze underwriting application" });
    }
  });

  app.get("/api/underwriting/sample-data", async (req: Request, res: Response) => {
    try {
      const type = req.query.type as string;
      if (type === "individual") {
        res.json(sampleIndividualApplication);
      } else if (type === "company") {
        res.json(sampleCompanyApplication);
      } else {
        res.json({ individual: sampleIndividualApplication, company: sampleCompanyApplication });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to get sample data" });
    }
  });

  app.get("/api/underwriting/generate-bulk", async (req: Request, res: Response) => {
    try {
      const count = Math.min(500, parseInt(req.query.count as string) || 100);
      const type = req.query.type as "individual" | "company" | undefined;
      const applications = generateBulkUnderwritingApplications(count, type);
      res.json({ applications, count: applications.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate bulk applications" });
    }
  });

  app.post("/api/underwriting/analyze-bulk", async (req: Request, res: Response) => {
    try {
      const { applications } = req.body as { applications: UnderwritingApplicationInput[] };
      
      if (!applications || !Array.isArray(applications) || applications.length === 0) {
        return res.status(400).json({ error: "No applications provided" });
      }

      const results = applications.map(app => {
        const parsed = underwritingApplicationInputSchema.safeParse(app);
        if (!parsed.success) {
          return null;
        }
        return analyzeUnderwriting(parsed.data);
      }).filter(Boolean);

      const validResults = results.filter(r => r !== null) as NonNullable<typeof results[number]>[];

      const summary = {
        preferred: validResults.filter(r => r.riskTier === "preferred").length,
        standard: validResults.filter(r => r.riskTier === "standard").length,
        substandard: validResults.filter(r => r.riskTier === "substandard").length,
        declined: validResults.filter(r => r.riskTier === "decline").length,
        averageRiskScore: validResults.length > 0 
          ? validResults.reduce((sum, r) => sum + r.overallRiskScore, 0) / validResults.length 
          : 0,
        averagePremiumAdjustment: validResults.length > 0
          ? validResults.reduce((sum, r) => sum + r.adjustmentPercentage, 0) / validResults.length
          : 0,
        totalPremiumValue: validResults.reduce((sum, r) => sum + r.recommendedPremium, 0),
      };

      const bulkResult: BulkUnderwritingResult = {
        totalApplications: validResults.length,
        analyzedAt: new Date().toISOString(),
        summary,
        results: validResults,
      };

      res.json(bulkResult);
    } catch (error) {
      res.status(500).json({ error: "Failed to analyze bulk applications" });
    }
  });

  return httpServer;
}
