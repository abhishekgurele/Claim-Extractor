import { nanoid } from "nanoid";
import type { UnderwritingAssessment, FraudAssessment } from "@shared/schema";

export interface VoiceCallRequest {
  phoneNumber: string;
  applicantName: string;
  callReason: "missing_info" | "clarification" | "follow_up";
  context: {
    assessmentType: "underwriting" | "fraud";
    assessmentId: string;
    triggeredSignals: string[];
    missingFields?: string[];
    clarificationNeeded?: string;
  };
}

export interface VoiceCallResponse {
  success: boolean;
  callId?: string;
  conversationId?: string;
  message: string;
  error?: string;
}

export interface VoiceCallLog {
  id: string;
  callId: string;
  phoneNumber: string;
  applicantName: string;
  callReason: string;
  assessmentType: string;
  assessmentId: string;
  status: "initiated" | "in_progress" | "completed" | "failed" | "no_answer";
  initiatedAt: string;
  completedAt?: string;
  duration?: number;
  transcript?: string;
  outcome?: string;
}

const callLogs: Map<string, VoiceCallLog> = new Map();

function buildAgentPrompt(request: VoiceCallRequest): string {
  const { applicantName, callReason, context } = request;
  
  let prompt = `You are a professional insurance claims analyst calling ${applicantName}. `;
  
  if (callReason === "missing_info") {
    prompt += `The purpose of this call is to collect missing information needed to process their ${context.assessmentType === "underwriting" ? "insurance application" : "claim"}.

Missing information needed:
${context.missingFields?.map(f => `- ${f}`).join("\n") || "Various fields"}

Be polite, professional, and explain why this information is needed. Ask one question at a time and confirm the response before moving to the next item.`;
  } else if (callReason === "clarification") {
    prompt += `The purpose of this call is to clarify some information in their ${context.assessmentType === "underwriting" ? "insurance application" : "claim"}.

Clarification needed for:
${context.clarificationNeeded || "Various details that need verification"}

Triggered signals that need clarification:
${context.triggeredSignals.slice(0, 3).join(", ")}

Be polite and non-accusatory. Frame questions as routine verification.`;
  } else {
    prompt += `This is a follow-up call regarding their ${context.assessmentType === "underwriting" ? "insurance application" : "claim"}.

Provide a status update and ask if they have any questions or additional information to provide.`;
  }
  
  prompt += `

Guidelines:
- Keep the conversation professional and concise
- Confirm all information provided
- Thank them for their time at the end
- If they ask to be called back, note the preferred time
- If they decline to provide information, acknowledge politely`;

  return prompt;
}

export async function initiateVoiceCall(request: VoiceCallRequest): Promise<VoiceCallResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;

  if (!apiKey) {
    return {
      success: false,
      message: "ElevenLabs API key not configured",
      error: "ELEVENLABS_API_KEY environment variable is not set. Please add your ElevenLabs API key.",
    };
  }

  if (!agentId) {
    return {
      success: false,
      message: "ElevenLabs Agent ID not configured",
      error: "ELEVENLABS_AGENT_ID environment variable is not set. Create an agent at elevenlabs.io and add its ID.",
    };
  }

  if (!phoneNumberId) {
    return {
      success: false,
      message: "ElevenLabs Phone Number ID not configured",
      error: "ELEVENLABS_PHONE_NUMBER_ID environment variable is not set. Configure a phone number in ElevenLabs.",
    };
  }

  const callLogId = nanoid();
  const callLog: VoiceCallLog = {
    id: callLogId,
    callId: "",
    phoneNumber: request.phoneNumber,
    applicantName: request.applicantName,
    callReason: request.callReason,
    assessmentType: request.context.assessmentType,
    assessmentId: request.context.assessmentId,
    status: "initiated",
    initiatedAt: new Date().toISOString(),
  };

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: phoneNumberId,
        to_number: request.phoneNumber,
        conversation_initiation_client_data: {
          applicant_name: request.applicantName,
          call_reason: request.callReason,
          assessment_type: request.context.assessmentType,
          assessment_id: request.context.assessmentId,
          triggered_signals: request.context.triggeredSignals.join(", "),
          missing_fields: request.context.missingFields?.join(", ") || "",
          clarification_needed: request.context.clarificationNeeded || "",
          agent_prompt: buildAgentPrompt(request),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      callLog.status = "failed";
      callLogs.set(callLogId, callLog);
      
      return {
        success: false,
        message: `Failed to initiate call: ${response.status}`,
        error: errorText,
      };
    }

    const result = await response.json();
    
    callLog.callId = result.callSid || result.call_id || nanoid();
    callLog.status = "in_progress";
    callLogs.set(callLogId, callLog);

    return {
      success: true,
      callId: callLog.callId,
      conversationId: result.conversation_id,
      message: `Call initiated to ${request.phoneNumber}`,
    };
  } catch (error) {
    callLog.status = "failed";
    callLogs.set(callLogId, callLog);

    return {
      success: false,
      message: "Failed to initiate call",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export function getCallLogs(): VoiceCallLog[] {
  return Array.from(callLogs.values()).sort(
    (a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime()
  );
}

export function getCallLog(id: string): VoiceCallLog | undefined {
  return callLogs.get(id);
}

export function determineCallNeeded(assessment: UnderwritingAssessment | FraudAssessment): {
  shouldCall: boolean;
  reason: "missing_info" | "clarification" | "follow_up" | null;
  missingFields?: string[];
  clarificationNeeded?: string;
} {
  const isUnderwriting = "riskTier" in assessment;
  const signals = assessment.triggeredSignals;
  
  if (isUnderwriting) {
    const uw = assessment as UnderwritingAssessment;
    
    const missingFields: string[] = [];
    const input = uw.inputData;
    
    if (input.applicantType === "individual") {
      if (!input.age && !input.dateOfBirth) missingFields.push("Date of Birth or Age");
      if (!input.annualIncome) missingFields.push("Annual Income");
      if (!input.creditScore) missingFields.push("Credit Score");
      if (input.smokingStatus === undefined) missingFields.push("Smoking Status");
    } else {
      if (!input.yearsInBusiness) missingFields.push("Years in Business");
      if (!input.employeeCount) missingFields.push("Employee Count");
      if (!input.annualRevenue) missingFields.push("Annual Revenue");
    }
    
    if (missingFields.length > 0) {
      return {
        shouldCall: true,
        reason: "missing_info",
        missingFields,
      };
    }
    
    const criticalSignals = signals.filter(s => s.severity === "critical");
    if (criticalSignals.length > 0 && uw.riskTier === "substandard") {
      return {
        shouldCall: true,
        reason: "clarification",
        clarificationNeeded: `Critical signals detected: ${criticalSignals.map(s => s.name).join(", ")}. Need to verify details before proceeding.`,
      };
    }
    
    return { shouldCall: false, reason: null };
  } else {
    const fraud = assessment as FraudAssessment;
    
    const missingFields: string[] = [];
    const input = fraud.inputData;
    
    if (!input.claimantPhone) missingFields.push("Contact Phone Number");
    if (!input.incidentDescription) missingFields.push("Incident Description");
    if (!input.providerNPI) missingFields.push("Provider NPI Number");
    
    if (missingFields.length > 0) {
      return {
        shouldCall: true,
        reason: "missing_info",
        missingFields,
      };
    }
    
    if (fraud.riskLevel === "high") {
      const topSignals = fraud.triggeredSignals.slice(0, 3);
      return {
        shouldCall: true,
        reason: "clarification",
        clarificationNeeded: `High-risk indicators detected: ${topSignals.map(s => s.name).join(", ")}. Need to verify claim details.`,
      };
    }
    
    return { shouldCall: false, reason: null };
  }
}
