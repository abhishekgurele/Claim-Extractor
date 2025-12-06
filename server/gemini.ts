import { GoogleGenAI } from "@google/genai";
import type { ExtractedField, ConfidenceLevel, FieldDefinition } from "@shared/schema";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or "gemini-2.5-pro"
// - do not change this unless explicitly requested by the user

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Build dynamic extraction prompt based on custom field definitions
function buildExtractionPrompt(fields: FieldDefinition[]): string {
  const fieldList = fields
    .map(f => `- ${f.name}: ${f.description}`)
    .join("\n");

  return `You are an expert document analyzer specializing in insurance claims processing. 
Analyze the uploaded document (which may be a PDF or image) and extract all relevant claims-related information.

For each field you extract, provide:
1. The field label (use camelCase, e.g., "policyNumber", "claimAmount")
2. The extracted value
3. Your confidence level: "high", "medium", or "low"

Focus on extracting these fields if present in the document:
${fieldList}

Only include fields that are actually present in the document. Do not invent data.

Respond with a JSON array of objects in this exact format:
[
  {"label": "fieldName", "value": "extracted value", "confidence": "high|medium|low"},
  ...
]

If you cannot extract any useful information from the document, respond with an empty array: []`;
}

export interface GeminiExtractionResult {
  fields: ExtractedField[];
  error?: string;
}

export async function extractFieldsFromDocument(
  base64Data: string,
  mimeType: string,
  customFields?: FieldDefinition[]
): Promise<GeminiExtractionResult> {
  try {
    // If no fields are enabled, return error
    if (!customFields || customFields.length === 0) {
      return {
        fields: [],
        error: "No extraction fields are enabled. Please enable at least one field in Settings.",
      };
    }

    // Build prompt based on custom fields
    const prompt = buildExtractionPrompt(customFields);

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
            text: prompt,
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
