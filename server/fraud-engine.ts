import { nanoid } from "nanoid";
import type {
  ClaimDataInput,
  FraudAssessment,
  FraudSignal,
  RiskLevel,
  SignalSeverity,
} from "@shared/schema";

interface FraudRule {
  code: string;
  name: string;
  description: string;
  severity: SignalSeverity;
  baseScore: number;
  check: (data: ClaimDataInput) => { triggered: boolean; confidence: number; details?: string };
  impactedFields: string[];
  remediationHint: string;
}

const fraudRules: FraudRule[] = [
  {
    code: "FR001",
    name: "Identity Mismatch",
    description: "Claimant name does not match policy holder name",
    severity: "critical",
    baseScore: 25,
    impactedFields: ["claimantName", "policyHolderName"],
    remediationHint: "Verify claimant relationship to policy holder and request authorization documents",
    check: (data) => {
      if (!data.claimantName || !data.policyHolderName) {
        return { triggered: false, confidence: 0 };
      }
      const claimant = data.claimantName.toLowerCase().trim();
      const holder = data.policyHolderName.toLowerCase().trim();
      if (claimant !== holder) {
        return { 
          triggered: true, 
          confidence: 90,
          details: `Claimant "${data.claimantName}" differs from policy holder "${data.policyHolderName}"`
        };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "FR002",
    name: "Claim Exceeds Policy Limit",
    description: "Claim amount exceeds the policy coverage limit",
    severity: "critical",
    baseScore: 30,
    impactedFields: ["claimAmount", "policyLimit"],
    remediationHint: "Review policy terms and verify claim amount breakdown",
    check: (data) => {
      if (!data.claimAmount || !data.policyLimit) {
        return { triggered: false, confidence: 0 };
      }
      if (data.claimAmount > data.policyLimit) {
        const excess = data.claimAmount - data.policyLimit;
        return { 
          triggered: true, 
          confidence: 100,
          details: `Claim amount ($${data.claimAmount.toLocaleString()}) exceeds policy limit ($${data.policyLimit.toLocaleString()}) by $${excess.toLocaleString()}`
        };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "FR003",
    name: "Suspicious Claim Frequency",
    description: "Multiple claims filed within short time period",
    severity: "warning",
    baseScore: 20,
    impactedFields: ["previousClaimsCount", "daysSinceLastClaim"],
    remediationHint: "Review claim history and verify each incident separately",
    check: (data) => {
      if (data.previousClaimsCount === undefined || data.daysSinceLastClaim === undefined) {
        return { triggered: false, confidence: 0 };
      }
      if (data.previousClaimsCount >= 3 && data.daysSinceLastClaim < 90) {
        return { 
          triggered: true, 
          confidence: 85,
          details: `${data.previousClaimsCount} previous claims with last claim only ${data.daysSinceLastClaim} days ago`
        };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "FR004",
    name: "Date Sequence Anomaly",
    description: "Treatment or claim date precedes incident date",
    severity: "critical",
    baseScore: 35,
    impactedFields: ["incidentDate", "treatmentDate", "claimDate"],
    remediationHint: "Verify all dates in documentation and request clarification",
    check: (data) => {
      if (!data.incidentDate) {
        return { triggered: false, confidence: 0 };
      }
      const incidentDate = new Date(data.incidentDate);
      
      if (data.treatmentDate) {
        const treatmentDate = new Date(data.treatmentDate);
        if (treatmentDate < incidentDate) {
          return { 
            triggered: true, 
            confidence: 95,
            details: `Treatment date (${data.treatmentDate}) is before incident date (${data.incidentDate})`
          };
        }
      }
      
      if (data.claimDate) {
        const claimDate = new Date(data.claimDate);
        if (claimDate < incidentDate) {
          return { 
            triggered: true, 
            confidence: 95,
            details: `Claim date (${data.claimDate}) is before incident date (${data.incidentDate})`
          };
        }
      }
      
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "FR005",
    name: "Unknown Provider",
    description: "Healthcare provider name contains suspicious keywords",
    severity: "warning",
    baseScore: 15,
    impactedFields: ["providerName"],
    remediationHint: "Verify provider credentials and registration status",
    check: (data) => {
      if (!data.providerName) {
        return { triggered: false, confidence: 0 };
      }
      const suspiciousTerms = ["unknown", "unregistered", "private", "cash only", "n/a", "none"];
      const providerLower = data.providerName.toLowerCase();
      
      for (const term of suspiciousTerms) {
        if (providerLower.includes(term)) {
          return { 
            triggered: true, 
            confidence: 70,
            details: `Provider name "${data.providerName}" contains suspicious term "${term}"`
          };
        }
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "FR006",
    name: "Missing Provider NPI",
    description: "Healthcare provider NPI number is missing",
    severity: "info",
    baseScore: 10,
    impactedFields: ["providerNPI"],
    remediationHint: "Request valid NPI number from provider",
    check: (data) => {
      if (data.providerName && !data.providerNPI) {
        return { 
          triggered: true, 
          confidence: 60,
          details: "Provider NPI number is not provided"
        };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "FR007",
    name: "High Claim Amount",
    description: "Claim amount is unusually high",
    severity: "warning",
    baseScore: 15,
    impactedFields: ["claimAmount"],
    remediationHint: "Request itemized breakdown and supporting documentation",
    check: (data) => {
      if (!data.claimAmount) {
        return { triggered: false, confidence: 0 };
      }
      if (data.claimAmount > 50000) {
        return { 
          triggered: true, 
          confidence: 75,
          details: `Claim amount ($${data.claimAmount.toLocaleString()}) exceeds $50,000 threshold`
        };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "FR008",
    name: "Same-Day Incident and Treatment",
    description: "Treatment occurred on same day as incident (common in staged claims)",
    severity: "info",
    baseScore: 8,
    impactedFields: ["incidentDate", "treatmentDate"],
    remediationHint: "Verify treatment necessity and review medical records",
    check: (data) => {
      if (!data.incidentDate || !data.treatmentDate) {
        return { triggered: false, confidence: 0 };
      }
      if (data.incidentDate === data.treatmentDate) {
        return { 
          triggered: true, 
          confidence: 50,
          details: `Treatment on same day as incident (${data.incidentDate})`
        };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "FR009",
    name: "Vague Incident Description",
    description: "Incident description is too short or vague",
    severity: "info",
    baseScore: 5,
    impactedFields: ["incidentDescription"],
    remediationHint: "Request detailed incident report with specific circumstances",
    check: (data) => {
      if (!data.incidentDescription) {
        return { triggered: false, confidence: 0 };
      }
      if (data.incidentDescription.length < 20) {
        return { 
          triggered: true, 
          confidence: 60,
          details: `Incident description is only ${data.incidentDescription.length} characters`
        };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "FR010",
    name: "Round Number Claim",
    description: "Claim amount is a suspiciously round number",
    severity: "info",
    baseScore: 5,
    impactedFields: ["claimAmount"],
    remediationHint: "Request itemized receipts and invoices",
    check: (data) => {
      if (!data.claimAmount) {
        return { triggered: false, confidence: 0 };
      }
      if (data.claimAmount >= 1000 && data.claimAmount % 1000 === 0) {
        return { 
          triggered: true, 
          confidence: 45,
          details: `Claim amount ($${data.claimAmount.toLocaleString()}) is a round number`
        };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "FR011",
    name: "Missing Contact Information",
    description: "Claimant contact information is incomplete",
    severity: "info",
    baseScore: 8,
    impactedFields: ["claimantPhone", "claimantEmail", "claimantAddress"],
    remediationHint: "Request complete contact information for verification",
    check: (data) => {
      const missing: string[] = [];
      if (!data.claimantPhone) missing.push("phone");
      if (!data.claimantEmail) missing.push("email");
      if (!data.claimantAddress) missing.push("address");
      
      if (missing.length >= 2) {
        return { 
          triggered: true, 
          confidence: 55,
          details: `Missing contact info: ${missing.join(", ")}`
        };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "FR012",
    name: "Rapid Claim Submission",
    description: "Claim filed very quickly after incident",
    severity: "info",
    baseScore: 5,
    impactedFields: ["incidentDate", "claimDate"],
    remediationHint: "Verify incident details and documentation availability",
    check: (data) => {
      if (!data.incidentDate || !data.claimDate) {
        return { triggered: false, confidence: 0 };
      }
      const incidentDate = new Date(data.incidentDate);
      const claimDate = new Date(data.claimDate);
      const diffDays = Math.floor((claimDate.getTime() - incidentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return { 
          triggered: true, 
          confidence: 40,
          details: "Claim filed on same day as incident"
        };
      }
      return { triggered: false, confidence: 0 };
    },
  },
];

function calculateRiskLevel(score: number): RiskLevel {
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function generateSummary(riskLevel: RiskLevel, triggeredSignals: FraudSignal[]): string {
  const criticalCount = triggeredSignals.filter(s => s.severity === "critical").length;
  const warningCount = triggeredSignals.filter(s => s.severity === "warning").length;
  const infoCount = triggeredSignals.filter(s => s.severity === "info").length;

  if (riskLevel === "high") {
    return `High risk claim with ${criticalCount} critical and ${warningCount} warning signals detected. Manual review strongly recommended before processing.`;
  }
  if (riskLevel === "medium") {
    return `Moderate risk claim with ${warningCount} warning and ${infoCount} informational signals. Additional verification may be needed.`;
  }
  return `Low risk claim with ${triggeredSignals.length} minor signals. Standard processing recommended.`;
}

export function analyzeFraud(claimData: ClaimDataInput): FraudAssessment {
  const triggeredSignals: FraudSignal[] = [];
  let totalScore = 0;

  for (const rule of fraudRules) {
    const result = rule.check(claimData);
    
    if (result.triggered) {
      const weightedScore = Math.round(rule.baseScore * (result.confidence / 100));
      totalScore += weightedScore;

      triggeredSignals.push({
        id: nanoid(),
        code: rule.code,
        name: rule.name,
        description: result.details || rule.description,
        severity: rule.severity,
        confidence: result.confidence,
        impactedFields: rule.impactedFields,
        scoreImpact: weightedScore,
        remediationHint: rule.remediationHint,
      });
    }
  }

  const overallScore = Math.min(100, totalScore);
  const riskLevel = calculateRiskLevel(overallScore);

  return {
    id: nanoid(),
    overallScore,
    riskLevel,
    triggeredSignals: triggeredSignals.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    evaluatedAt: new Date().toISOString(),
    inputData: claimData,
    summary: generateSummary(riskLevel, triggeredSignals),
  };
}

export { fraudRules };
