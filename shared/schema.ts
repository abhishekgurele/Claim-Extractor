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

// Custom field definition for extraction
export const fieldDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean().default(true),
});

export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;

export const insertFieldDefinitionSchema = fieldDefinitionSchema.omit({ id: true });
export type InsertFieldDefinition = z.infer<typeof insertFieldDefinitionSchema>;

// Default field definitions
export const defaultFieldDefinitions: FieldDefinition[] = [
  { id: "1", name: "policyNumber", description: "The insurance policy number", enabled: true },
  { id: "2", name: "claimNumber", description: "The claim reference number", enabled: true },
  { id: "3", name: "claimDate", description: "The date the claim was filed", enabled: true },
  { id: "4", name: "claimAmount", description: "The monetary amount being claimed", enabled: true },
  { id: "5", name: "claimantName", description: "The name of the person filing the claim", enabled: true },
  { id: "6", name: "claimantAddress", description: "The claimant's address", enabled: true },
  { id: "7", name: "claimantPhone", description: "The claimant's phone number", enabled: true },
  { id: "8", name: "claimantEmail", description: "The claimant's email address", enabled: true },
  { id: "9", name: "incidentDate", description: "The date of the incident", enabled: true },
  { id: "10", name: "incidentDescription", description: "Brief description of what happened", enabled: true },
  { id: "11", name: "incidentLocation", description: "Where the incident occurred", enabled: true },
  { id: "12", name: "vehicleInfo", description: "Vehicle details (make, model, VIN) if applicable", enabled: true },
  { id: "13", name: "diagnosisCode", description: "Medical diagnosis codes if applicable", enabled: true },
  { id: "14", name: "treatmentDate", description: "Date of medical treatment if applicable", enabled: true },
  { id: "15", name: "providerName", description: "Healthcare or service provider name", enabled: true },
  { id: "16", name: "providerNPI", description: "Provider NPI number if applicable", enabled: true },
];

// Rule engine schemas
export const ruleOperators = [
  "greaterThan",
  "lessThan",
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "greaterThanOrEqual",
  "lessThanOrEqual",
] as const;
export type RuleOperator = typeof ruleOperators[number];

export const ruleConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(ruleOperators),
  value: z.string(),
});
export type RuleCondition = z.infer<typeof ruleConditionSchema>;

export const ruleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  conditions: z.array(ruleConditionSchema),
  logic: z.enum(["all", "any"]),
  action: z.enum(["fail", "pass"]),
  enabled: z.boolean().default(true),
});
export type Rule = z.infer<typeof ruleSchema>;

export const insertRuleSchema = ruleSchema.omit({ id: true });
export type InsertRule = z.infer<typeof insertRuleSchema>;

export const ruleEvaluationResultSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  passed: z.boolean(),
  triggeredConditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    expectedValue: z.string(),
    actualValue: z.string(),
    matched: z.boolean(),
  })),
});
export type RuleEvaluationResult = z.infer<typeof ruleEvaluationResultSchema>;

export const claimVerdictSchema = z.object({
  verdict: z.enum(["pass", "fail", "pending"]),
  evaluatedRules: z.array(ruleEvaluationResultSchema),
  failedRules: z.array(z.string()),
  passedRules: z.array(z.string()),
});
export type ClaimVerdict = z.infer<typeof claimVerdictSchema>;

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

// Required document types for claim submission
export const requiredDocumentTypes = [
  "identityCard",
  "dischargeSummary",
  "bills",
  "investigations",
] as const;
export type RequiredDocumentType = typeof requiredDocumentTypes[number];

export const documentTypeLabels: Record<RequiredDocumentType, string> = {
  identityCard: "Identity Card",
  dischargeSummary: "Discharge Summary",
  bills: "Bills",
  investigations: "Investigations",
};

// Patient information schema
export const patientInfoSchema = z.object({
  name: z.string().min(1, "Patient name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Valid phone number is required"),
});
export type PatientInfo = z.infer<typeof patientInfoSchema>;

// Document checklist item
export const documentChecklistItemSchema = z.object({
  type: z.enum(requiredDocumentTypes),
  uploaded: z.boolean().default(false),
  filename: z.string().optional(),
  fileData: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().optional(),
});
export type DocumentChecklistItem = z.infer<typeof documentChecklistItemSchema>;

// Claim submission with patient info and documents
export const claimSubmissionSchema = z.object({
  id: z.string(),
  patientInfo: patientInfoSchema,
  documentChecklist: z.array(documentChecklistItemSchema),
  isComplete: z.boolean().default(false),
  missingDocuments: z.array(z.enum(requiredDocumentTypes)).default([]),
  createdAt: z.string(),
  status: z.enum(["draft", "pending_documents", "ready", "processing", "completed", "notified"]),
  providerEmail: z.string().email().optional(),
  notificationSentAt: z.string().optional(),
  extractedData: z.record(z.string(), z.any()).optional(),
});
export type ClaimSubmission = z.infer<typeof claimSubmissionSchema>;

export const insertClaimSubmissionSchema = claimSubmissionSchema.omit({ id: true, createdAt: true });
export type InsertClaimSubmission = z.infer<typeof insertClaimSubmissionSchema>;

// Request schema for creating a submission
export const createSubmissionRequestSchema = z.object({
  patientInfo: patientInfoSchema,
  providerEmail: z.string().email("Provider email is required"),
});
export type CreateSubmissionRequest = z.infer<typeof createSubmissionRequestSchema>;

// Request schema for uploading a document to a submission
export const uploadDocumentRequestSchema = z.object({
  submissionId: z.string(),
  documentType: z.enum(requiredDocumentTypes),
});
export type UploadDocumentRequest = z.infer<typeof uploadDocumentRequestSchema>;

// Email notification request
export const notifyProviderRequestSchema = z.object({
  submissionId: z.string(),
});
export type NotifyProviderRequest = z.infer<typeof notifyProviderRequestSchema>;

// ============================================
// FRAUD DETECTION ENGINE SCHEMAS
// ============================================

// Risk levels for fraud assessment
export const riskLevels = ["low", "medium", "high"] as const;
export type RiskLevel = typeof riskLevels[number];

// Fraud signal severity
export const signalSeverities = ["info", "warning", "critical"] as const;
export type SignalSeverity = typeof signalSeverities[number];

// Individual fraud signal detected
export const fraudSignalSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  severity: z.enum(signalSeverities),
  confidence: z.number().min(0).max(100),
  impactedFields: z.array(z.string()),
  scoreImpact: z.number(),
  remediationHint: z.string().optional(),
});
export type FraudSignal = z.infer<typeof fraudSignalSchema>;

// Claim data input for fraud analysis (standalone module)
export const claimDataInputSchema = z.object({
  claimantName: z.string().optional(),
  policyNumber: z.string().optional(),
  claimNumber: z.string().optional(),
  claimDate: z.string().optional(),
  claimAmount: z.number().optional(),
  incidentDate: z.string().optional(),
  incidentDescription: z.string().optional(),
  incidentLocation: z.string().optional(),
  treatmentDate: z.string().optional(),
  providerName: z.string().optional(),
  providerNPI: z.string().optional(),
  diagnosisCode: z.string().optional(),
  claimantAddress: z.string().optional(),
  claimantPhone: z.string().optional(),
  claimantEmail: z.string().optional(),
  vehicleInfo: z.string().optional(),
  policyHolderName: z.string().optional(),
  policyLimit: z.number().optional(),
  previousClaimsCount: z.number().optional(),
  daysSinceLastClaim: z.number().optional(),
});
export type ClaimDataInput = z.infer<typeof claimDataInputSchema>;

// Complete fraud assessment result
export const fraudAssessmentSchema = z.object({
  id: z.string(),
  submissionId: z.string().optional(),
  overallScore: z.number().min(0).max(100),
  riskLevel: z.enum(riskLevels),
  triggeredSignals: z.array(fraudSignalSchema),
  evaluatedAt: z.string(),
  inputData: claimDataInputSchema,
  summary: z.string(),
  analystNotes: z.string().optional(),
});
export type FraudAssessment = z.infer<typeof fraudAssessmentSchema>;

// Request schema for fraud analysis
export const analyzeFraudRequestSchema = z.object({
  claimData: claimDataInputSchema,
});
export type AnalyzeFraudRequest = z.infer<typeof analyzeFraudRequestSchema>;

// Sample/dummy claim data for testing
export const sampleClaimData: ClaimDataInput[] = [
  {
    claimantName: "John Smith",
    policyNumber: "POL-2024-00123",
    claimNumber: "CLM-2024-00456",
    claimDate: "2024-12-01",
    claimAmount: 15000,
    incidentDate: "2024-11-28",
    incidentDescription: "Vehicle collision at intersection",
    incidentLocation: "Main St & Oak Ave",
    treatmentDate: "2024-11-28",
    providerName: "City General Hospital",
    providerNPI: "1234567890",
    diagnosisCode: "S00.0",
    claimantAddress: "123 Main Street, Springfield",
    claimantPhone: "555-123-4567",
    claimantEmail: "john.smith@email.com",
    vehicleInfo: "2022 Toyota Camry, VIN: 1234567890ABCDEF",
    policyHolderName: "John Smith",
    policyLimit: 50000,
    previousClaimsCount: 1,
    daysSinceLastClaim: 365,
  },
  {
    claimantName: "Jane Doe",
    policyNumber: "POL-2024-00789",
    claimNumber: "CLM-2024-00999",
    claimDate: "2024-12-05",
    claimAmount: 75000,
    incidentDate: "2024-12-04",
    incidentDescription: "Medical procedure complications",
    incidentLocation: "Private Clinic",
    treatmentDate: "2024-12-04",
    providerName: "Unknown Provider",
    diagnosisCode: "Z99.9",
    claimantAddress: "456 Oak Street, Springfield",
    claimantPhone: "555-987-6543",
    claimantEmail: "jane.d@email.com",
    policyHolderName: "Robert Doe",
    policyLimit: 25000,
    previousClaimsCount: 5,
    daysSinceLastClaim: 30,
  },
  {
    claimantName: "Michael Johnson",
    policyNumber: "POL-2024-00555",
    claimNumber: "CLM-2024-00777",
    claimDate: "2024-12-03",
    claimAmount: 3500,
    incidentDate: "2024-12-01",
    incidentDescription: "Minor fender bender in parking lot",
    incidentLocation: "Walmart Parking Lot",
    treatmentDate: "2024-12-02",
    providerName: "QuickCare Clinic",
    providerNPI: "9876543210",
    diagnosisCode: "S13.4",
    claimantAddress: "789 Pine Ave, Springfield",
    claimantPhone: "555-456-7890",
    claimantEmail: "m.johnson@email.com",
    vehicleInfo: "2020 Honda Civic, VIN: ABCDEF1234567890",
    policyHolderName: "Michael Johnson",
    policyLimit: 30000,
    previousClaimsCount: 0,
    daysSinceLastClaim: 0,
  },
];
