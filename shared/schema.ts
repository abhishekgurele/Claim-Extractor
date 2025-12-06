import { z } from "zod";

// Confidence levels for extracted fields
export const confidenceLevels = ["high", "medium", "low"] as const;
export type ConfidenceLevel = typeof confidenceLevels[number];

// Extracted field from document
export const extractedFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  confidence: z.enum(confidenceLevels),
  isEdited: z.boolean().default(false),
});

export type ExtractedField = z.infer<typeof extractedFieldSchema>;

// Document processing status
export const processingStatuses = ["idle", "uploading", "processing", "completed", "error"] as const;
export type ProcessingStatus = typeof processingStatuses[number];

// Document being processed
export const documentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  uploadedAt: z.string(),
  status: z.enum(processingStatuses),
  extractedFields: z.array(extractedFieldSchema).optional(),
  errorMessage: z.string().optional(),
  thumbnailUrl: z.string().optional(),
});

export type Document = z.infer<typeof documentSchema>;

// Upload request schema
export const uploadRequestSchema = z.object({
  file: z.any(),
});

// Process document response
export const processDocumentResponseSchema = z.object({
  success: z.boolean(),
  document: documentSchema.optional(),
  error: z.string().optional(),
});

export type ProcessDocumentResponse = z.infer<typeof processDocumentResponseSchema>;

// Export format
export const exportDataSchema = z.object({
  documentId: z.string(),
  filename: z.string(),
  processedAt: z.string(),
  fields: z.record(z.string(), z.string()),
  metadata: z.object({
    originalFileType: z.string(),
    totalFields: z.number(),
    editedFields: z.number(),
  }),
});

export type ExportData = z.infer<typeof exportDataSchema>;

// Claims-specific field types that Gemini will extract
export const claimFieldTypes = [
  "policyNumber",
  "claimNumber",
  "claimDate",
  "claimAmount",
  "claimantName",
  "claimantAddress",
  "claimantPhone",
  "claimantEmail",
  "incidentDate",
  "incidentDescription",
  "incidentLocation",
  "vehicleInfo",
  "diagnosisCode",
  "treatmentDate",
  "providerName",
  "providerNPI",
] as const;

export type ClaimFieldType = typeof claimFieldTypes[number];

// User schema (keeping from template)
export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;

export type User = {
  id: string;
  username: string;
  password: string;
};
