import { GoogleGenAI } from "@google/genai";
import type { ExtractedField, ConfidenceLevel } from "@shared/schema";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or "gemini-2.5-pro"
// - do not change this unless explicitly requested by the user

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Prompt for extracting claims data from documents
const EXTRACTION_PROMPT = `You are an expert document analyzer specializing in insurance claims processing. 
Analyze the uploaded document (which may be a PDF or image) and extract all relevant claims-related information.

For each field you extract, provide:
1. The field label (use camelCase, e.g., "policyNumber", "claimAmount")
2. The extracted value
3. Your confidence level: "high", "medium", or "low"

Focus on extracting these common claims fields if present:
- policyNumber: The insurance policy number
- claimNumber: The claim reference number
- claimDate: The date the claim was filed
- claimAmount: The monetary amount being claimed
- claimantName: The name of the person filing the claim
- claimantAddress: The claimant's address
- claimantPhone: The claimant's phone number
- claimantEmail: The claimant's email address
- incidentDate: The date of the incident
- incidentDescription: Brief description of what happened
- incidentLocation: Where the incident occurred
- vehicleInfo: Vehicle details (make, model, VIN) if applicable
- diagnosisCode: Medical diagnosis codes if applicable
- treatmentDate: Date of medical treatment if applicable
- providerName: Healthcare or service provider name
- providerNPI: Provider NPI number if applicable

Only include fields that are actually present in the document. Do not invent data.

Respond with a JSON array of objects in this exact format:
[
  {"label": "fieldName", "value": "extracted value", "confidence": "high|medium|low"},
  ...
]

If you cannot extract any useful information from the document, respond with an empty array: []`;

export interface GeminiExtractionResult {
  fields: ExtractedField[];
  error?: string;
}

export async function extractFieldsFromDocument(
  base64Data: string,
  mimeType: string
): Promise<GeminiExtractionResult> {
  try {
    // Construct the request with proper Gemini SDK format
    const contents = [
      {
        role: "user" as const,
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
    });

    const responseText = response.text || "";
    
    // Parse the JSON response
    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    } else {
      // Try to find array directly
      const arrayMatch = responseText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }
    }

    const parsedFields = JSON.parse(jsonStr);
    
    if (!Array.isArray(parsedFields)) {
      throw new Error("Response is not an array");
    }

    // Map to ExtractedField with unique IDs
    const fields: ExtractedField[] = parsedFields.map((field: {
      label: string;
      value: string;
      confidence: string;
    }, index: number) => ({
      id: `field-${index}-${Date.now()}`,
      label: field.label || `field${index}`,
      value: field.value || "",
      confidence: validateConfidence(field.confidence),
      isEdited: false,
    }));

    return { fields };
  } catch (error) {
    console.error("Gemini extraction error:", error);
    
    // Provide more helpful error messages
    let errorMessage = "Failed to extract fields from document";
    if (error instanceof Error) {
      if (error.message.includes("INVALID_ARGUMENT")) {
        errorMessage = "The document could not be processed. Please ensure it's a valid PDF or image with readable content.";
      } else if (error.message.includes("API_KEY")) {
        errorMessage = "API key issue. Please check your Gemini API key configuration.";
      } else if (error.message.includes("QUOTA")) {
        errorMessage = "API quota exceeded. Please try again later.";
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      fields: [],
      error: errorMessage,
    };
  }
}

function validateConfidence(confidence: string): ConfidenceLevel {
  const normalized = confidence?.toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "medium"; // Default to medium if invalid
}

// Convert file buffer to base64
export function bufferToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}
