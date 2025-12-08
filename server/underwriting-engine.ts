import { nanoid } from "nanoid";
import type {
  UnderwritingApplicationInput,
  IndividualApplicantInput,
  CompanyApplicantInput,
  UnderwritingAssessment,
  UnderwritingSignal,
  RiskTier,
  SignalSeverity,
  SignalDimension,
} from "@shared/schema";

interface UnderwritingRule {
  code: string;
  name: string;
  description: string;
  severity: SignalSeverity;
  dimension: SignalDimension;
  basePremiumImpact: number;
  applicantTypes: ("individual" | "company")[];
  check: (data: UnderwritingApplicationInput) => { triggered: boolean; confidence: number; details?: string };
  impactedFields: string[];
  recommendation: string;
}

const underwritingRules: UnderwritingRule[] = [
  // ============================================
  // INDIVIDUAL APPLICANT RULES
  // ============================================
  {
    code: "UW001",
    name: "Advanced Age Risk",
    description: "Applicant age significantly increases mortality/morbidity risk",
    severity: "warning",
    dimension: "risk",
    basePremiumImpact: 15,
    applicantTypes: ["individual"],
    impactedFields: ["age"],
    recommendation: "Consider age-adjusted premium or reduced coverage term",
    check: (data) => {
      if (data.applicantType !== "individual" || !data.age) return { triggered: false, confidence: 0 };
      if (data.age >= 60) {
        return { triggered: true, confidence: 90, details: `Applicant age (${data.age}) is in high-risk bracket` };
      }
      if (data.age >= 50) {
        return { triggered: true, confidence: 70, details: `Applicant age (${data.age}) is in elevated-risk bracket` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW002",
    name: "Current Smoker",
    description: "Active tobacco use significantly increases health risks",
    severity: "critical",
    dimension: "risk",
    basePremiumImpact: 25,
    applicantTypes: ["individual"],
    impactedFields: ["smokingStatus"],
    recommendation: "Apply smoker rates or require cessation program enrollment",
    check: (data) => {
      if (data.applicantType !== "individual") return { triggered: false, confidence: 0 };
      if (data.smokingStatus === "current") {
        return { triggered: true, confidence: 100, details: "Applicant is a current tobacco user" };
      }
      if (data.smokingStatus === "former") {
        return { triggered: true, confidence: 50, details: "Applicant is a former tobacco user" };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW003",
    name: "Pre-existing Health Conditions",
    description: "Chronic health conditions increase expected claims",
    severity: "warning",
    dimension: "risk",
    basePremiumImpact: 20,
    applicantTypes: ["individual"],
    impactedFields: ["hasChronicConditions", "chronicConditions"],
    recommendation: "Request detailed medical records and apply condition-specific loading",
    check: (data) => {
      if (data.applicantType !== "individual") return { triggered: false, confidence: 0 };
      if (data.hasChronicConditions && data.chronicConditions && data.chronicConditions.length > 0) {
        const conditions = data.chronicConditions.join(", ");
        return { triggered: true, confidence: 85, details: `Pre-existing conditions: ${conditions}` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW004",
    name: "High BMI",
    description: "Elevated BMI indicates increased health risks",
    severity: "info",
    dimension: "risk",
    basePremiumImpact: 10,
    applicantTypes: ["individual"],
    impactedFields: ["bmi"],
    recommendation: "Consider health improvement incentive program",
    check: (data) => {
      if (data.applicantType !== "individual" || !data.bmi) return { triggered: false, confidence: 0 };
      if (data.bmi >= 35) {
        return { triggered: true, confidence: 90, details: `BMI of ${data.bmi} indicates Class II obesity or higher` };
      }
      if (data.bmi >= 30) {
        return { triggered: true, confidence: 75, details: `BMI of ${data.bmi} indicates obesity` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW005",
    name: "Hazardous Occupation",
    description: "Occupation involves elevated injury/mortality risk",
    severity: "warning",
    dimension: "risk",
    basePremiumImpact: 15,
    applicantTypes: ["individual"],
    impactedFields: ["occupation"],
    recommendation: "Apply occupational hazard loading factor",
    check: (data) => {
      if (data.applicantType !== "individual" || !data.occupation) return { triggered: false, confidence: 0 };
      const hazardousOccupations = ["Construction Worker", "Electrician", "Firefighter", "Police Officer", "Pilot", "Miner", "Logger", "Roofer"];
      if (hazardousOccupations.some(o => data.occupation?.toLowerCase().includes(o.toLowerCase()))) {
        return { triggered: true, confidence: 85, details: `Occupation "${data.occupation}" classified as hazardous` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW006",
    name: "Hazardous Hobbies",
    description: "Recreational activities with elevated risk exposure",
    severity: "warning",
    dimension: "risk",
    basePremiumImpact: 12,
    applicantTypes: ["individual"],
    impactedFields: ["hazardousHobbies"],
    recommendation: "Apply avocation exclusion or additional premium loading",
    check: (data) => {
      if (data.applicantType !== "individual") return { triggered: false, confidence: 0 };
      if (data.hazardousHobbies && data.hazardousHobbies.length > 0) {
        return { triggered: true, confidence: 80, details: `Hazardous activities: ${data.hazardousHobbies.join(", ")}` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW007",
    name: "Poor Credit Score",
    description: "Low credit score correlates with higher claim frequency",
    severity: "info",
    dimension: "profitability",
    basePremiumImpact: 10,
    applicantTypes: ["individual"],
    impactedFields: ["creditScore"],
    recommendation: "Apply credit-based insurance score adjustment",
    check: (data) => {
      if (data.applicantType !== "individual" || !data.creditScore) return { triggered: false, confidence: 0 };
      if (data.creditScore < 580) {
        return { triggered: true, confidence: 90, details: `Credit score of ${data.creditScore} is poor (below 580)` };
      }
      if (data.creditScore < 670) {
        return { triggered: true, confidence: 65, details: `Credit score of ${data.creditScore} is fair (below 670)` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW008",
    name: "Excessive Coverage Request",
    description: "Coverage amount disproportionate to income/net worth",
    severity: "critical",
    dimension: "profitability",
    basePremiumImpact: 20,
    applicantTypes: ["individual"],
    impactedFields: ["requestedCoverageAmount", "annualIncome"],
    recommendation: "Request financial justification or reduce coverage amount",
    check: (data) => {
      if (data.applicantType !== "individual" || !data.annualIncome) return { triggered: false, confidence: 0 };
      const ratio = data.requestedCoverageAmount / data.annualIncome;
      if (ratio > 15) {
        return { triggered: true, confidence: 95, details: `Coverage (${ratio.toFixed(1)}x income) exceeds 15x income threshold` };
      }
      if (ratio > 10) {
        return { triggered: true, confidence: 70, details: `Coverage (${ratio.toFixed(1)}x income) exceeds 10x income guideline` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW009",
    name: "Frequent Prior Claims",
    description: "History of multiple claims indicates higher future claim probability",
    severity: "warning",
    dimension: "risk",
    basePremiumImpact: 18,
    applicantTypes: ["individual"],
    impactedFields: ["previousClaimsCount", "previousClaimsAmount"],
    recommendation: "Apply claims surcharge or exclude prior conditions",
    check: (data) => {
      if (data.applicantType !== "individual") return { triggered: false, confidence: 0 };
      if (data.previousClaimsCount && data.previousClaimsCount >= 3) {
        return { triggered: true, confidence: 85, details: `${data.previousClaimsCount} prior claims totaling $${(data.previousClaimsAmount || 0).toLocaleString()}` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW010",
    name: "No Prior Coverage",
    description: "Lack of insurance history may indicate adverse selection",
    severity: "info",
    dimension: "profitability",
    basePremiumImpact: 8,
    applicantTypes: ["individual"],
    impactedFields: ["yearsWithPriorCoverage"],
    recommendation: "Consider waiting period for pre-existing conditions",
    check: (data) => {
      if (data.applicantType !== "individual") return { triggered: false, confidence: 0 };
      if (data.yearsWithPriorCoverage === 0) {
        return { triggered: true, confidence: 70, details: "Applicant has no prior insurance coverage history" };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  // Positive factors for individuals (premium discounts)
  {
    code: "UW011",
    name: "Excellent Credit",
    description: "High credit score indicates lower claim risk",
    severity: "info",
    dimension: "profitability",
    basePremiumImpact: -8,
    applicantTypes: ["individual"],
    impactedFields: ["creditScore"],
    recommendation: "Apply preferred rate discount",
    check: (data) => {
      if (data.applicantType !== "individual" || !data.creditScore) return { triggered: false, confidence: 0 };
      if (data.creditScore >= 750) {
        return { triggered: true, confidence: 90, details: `Excellent credit score of ${data.creditScore}` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW012",
    name: "Healthy Lifestyle",
    description: "Non-smoker with healthy BMI indicates lower risk",
    severity: "info",
    dimension: "risk",
    basePremiumImpact: -10,
    applicantTypes: ["individual"],
    impactedFields: ["smokingStatus", "bmi"],
    recommendation: "Apply healthy lifestyle discount",
    check: (data) => {
      if (data.applicantType !== "individual") return { triggered: false, confidence: 0 };
      const isNonSmoker = data.smokingStatus === "never";
      const hasHealthyBMI = data.bmi && data.bmi >= 18.5 && data.bmi <= 25;
      if (isNonSmoker && hasHealthyBMI) {
        return { triggered: true, confidence: 85, details: "Non-smoker with healthy BMI qualifies for wellness discount" };
      }
      return { triggered: false, confidence: 0 };
    },
  },

  // ============================================
  // COMPANY APPLICANT RULES
  // ============================================
  {
    code: "UW101",
    name: "High-Risk Industry",
    description: "Industry classification indicates elevated loss exposure",
    severity: "critical",
    dimension: "risk",
    basePremiumImpact: 25,
    applicantTypes: ["company"],
    impactedFields: ["industry"],
    recommendation: "Apply industry hazard class loading and require safety protocols",
    check: (data) => {
      if (data.applicantType !== "company") return { triggered: false, confidence: 0 };
      const highRiskIndustries = ["Construction", "Mining", "Oil & Gas", "Manufacturing", "Transportation", "Agriculture"];
      if (highRiskIndustries.includes(data.industry)) {
        return { triggered: true, confidence: 95, details: `Industry "${data.industry}" classified as high-risk` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW102",
    name: "New Business",
    description: "Limited operating history increases uncertainty",
    severity: "warning",
    dimension: "profitability",
    basePremiumImpact: 15,
    applicantTypes: ["company"],
    impactedFields: ["yearsInBusiness"],
    recommendation: "Require personal guarantees or higher deductibles",
    check: (data) => {
      if (data.applicantType !== "company") return { triggered: false, confidence: 0 };
      if (data.yearsInBusiness !== undefined && data.yearsInBusiness < 3) {
        return { triggered: true, confidence: 85, details: `Only ${data.yearsInBusiness} years in business` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW103",
    name: "Poor Loss Ratio History",
    description: "Historical loss ratio exceeds acceptable threshold",
    severity: "critical",
    dimension: "profitability",
    basePremiumImpact: 30,
    applicantTypes: ["company"],
    impactedFields: ["priorLossRatio"],
    recommendation: "Require loss control measures or increase premium significantly",
    check: (data) => {
      if (data.applicantType !== "company" || data.priorLossRatio === undefined) return { triggered: false, confidence: 0 };
      if (data.priorLossRatio > 75) {
        return { triggered: true, confidence: 95, details: `Prior loss ratio of ${data.priorLossRatio.toFixed(1)}% exceeds 75% threshold` };
      }
      if (data.priorLossRatio > 60) {
        return { triggered: true, confidence: 75, details: `Prior loss ratio of ${data.priorLossRatio.toFixed(1)}% is elevated` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW104",
    name: "OSHA Incidents",
    description: "Workplace safety incidents indicate poor risk management",
    severity: "critical",
    dimension: "risk",
    basePremiumImpact: 20,
    applicantTypes: ["company"],
    impactedFields: ["oshaIncidents"],
    recommendation: "Require safety audit and corrective action plan",
    check: (data) => {
      if (data.applicantType !== "company") return { triggered: false, confidence: 0 };
      if (data.oshaIncidents && data.oshaIncidents >= 3) {
        return { triggered: true, confidence: 95, details: `${data.oshaIncidents} OSHA recordable incidents` };
      }
      if (data.oshaIncidents && data.oshaIncidents >= 1) {
        return { triggered: true, confidence: 70, details: `${data.oshaIncidents} OSHA recordable incident(s)` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW105",
    name: "High Geographic Concentration",
    description: "Business concentrated in single geographic area increases CAT exposure",
    severity: "warning",
    dimension: "risk",
    basePremiumImpact: 12,
    applicantTypes: ["company"],
    impactedFields: ["geographicConcentration"],
    recommendation: "Consider geographic diversification requirements or CAT sublimits",
    check: (data) => {
      if (data.applicantType !== "company" || data.geographicConcentration === undefined) return { triggered: false, confidence: 0 };
      if (data.geographicConcentration > 80) {
        return { triggered: true, confidence: 85, details: `${data.geographicConcentration.toFixed(0)}% of operations concentrated in single area` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW106",
    name: "Low Liquidity",
    description: "Poor liquidity may indicate inability to self-insure minor losses",
    severity: "warning",
    dimension: "profitability",
    basePremiumImpact: 10,
    applicantTypes: ["company"],
    impactedFields: ["liquidityRatio"],
    recommendation: "Consider higher deductibles or require financial covenants",
    check: (data) => {
      if (data.applicantType !== "company" || data.liquidityRatio === undefined) return { triggered: false, confidence: 0 };
      if (data.liquidityRatio < 1.0) {
        return { triggered: true, confidence: 90, details: `Liquidity ratio of ${data.liquidityRatio.toFixed(2)} is below 1.0` };
      }
      if (data.liquidityRatio < 1.5) {
        return { triggered: true, confidence: 65, details: `Liquidity ratio of ${data.liquidityRatio.toFixed(2)} is marginal` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW107",
    name: "Large Workforce Risk",
    description: "High employee count increases workers comp exposure",
    severity: "info",
    dimension: "risk",
    basePremiumImpact: 8,
    applicantTypes: ["company"],
    impactedFields: ["employeeCount"],
    recommendation: "Verify workers compensation coverage and safety programs",
    check: (data) => {
      if (data.applicantType !== "company" || !data.employeeCount) return { triggered: false, confidence: 0 };
      if (data.employeeCount > 200) {
        return { triggered: true, confidence: 80, details: `${data.employeeCount} employees increases aggregate exposure` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW108",
    name: "Frequent Prior Claims",
    description: "History of multiple claims indicates higher future claim probability",
    severity: "warning",
    dimension: "profitability",
    basePremiumImpact: 18,
    applicantTypes: ["company"],
    impactedFields: ["previousClaimsCount", "previousClaimsAmount"],
    recommendation: "Require detailed loss runs and implement retention program",
    check: (data) => {
      if (data.applicantType !== "company") return { triggered: false, confidence: 0 };
      if (data.previousClaimsCount && data.previousClaimsCount >= 5) {
        return { triggered: true, confidence: 90, details: `${data.previousClaimsCount} prior claims totaling $${(data.previousClaimsAmount || 0).toLocaleString()}` };
      }
      if (data.previousClaimsCount && data.previousClaimsCount >= 3) {
        return { triggered: true, confidence: 70, details: `${data.previousClaimsCount} prior claims` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  // Positive factors for companies (premium discounts)
  {
    code: "UW109",
    name: "Safety Certifications",
    description: "Industry safety certifications indicate proactive risk management",
    severity: "info",
    dimension: "risk",
    basePremiumImpact: -12,
    applicantTypes: ["company"],
    impactedFields: ["hasSafetyCertifications", "safetyCertifications"],
    recommendation: "Apply safety certification discount",
    check: (data) => {
      if (data.applicantType !== "company") return { triggered: false, confidence: 0 };
      if (data.hasSafetyCertifications && data.safetyCertifications && data.safetyCertifications.length > 0) {
        return { triggered: true, confidence: 90, details: `Holds certifications: ${data.safetyCertifications.join(", ")}` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW110",
    name: "Risk Management Program",
    description: "Formal risk management program reduces loss frequency",
    severity: "info",
    dimension: "risk",
    basePremiumImpact: -10,
    applicantTypes: ["company"],
    impactedFields: ["hasRiskManagementProgram"],
    recommendation: "Apply risk management discount",
    check: (data) => {
      if (data.applicantType !== "company") return { triggered: false, confidence: 0 };
      if (data.hasRiskManagementProgram) {
        return { triggered: true, confidence: 85, details: "Has formal risk management program in place" };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW111",
    name: "Established Business",
    description: "Long operating history indicates stability and predictability",
    severity: "info",
    dimension: "profitability",
    basePremiumImpact: -8,
    applicantTypes: ["company"],
    impactedFields: ["yearsInBusiness"],
    recommendation: "Apply longevity discount",
    check: (data) => {
      if (data.applicantType !== "company") return { triggered: false, confidence: 0 };
      if (data.yearsInBusiness && data.yearsInBusiness >= 10) {
        return { triggered: true, confidence: 85, details: `${data.yearsInBusiness} years in business provides stability` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
  {
    code: "UW112",
    name: "Low-Risk Industry",
    description: "Industry classification indicates lower loss exposure",
    severity: "info",
    dimension: "risk",
    basePremiumImpact: -10,
    applicantTypes: ["company"],
    impactedFields: ["industry"],
    recommendation: "Apply preferred industry discount",
    check: (data) => {
      if (data.applicantType !== "company") return { triggered: false, confidence: 0 };
      const lowRiskIndustries = ["Technology", "Professional Services", "Finance", "Education", "Telecommunications"];
      if (lowRiskIndustries.includes(data.industry)) {
        return { triggered: true, confidence: 90, details: `Industry "${data.industry}" classified as low-risk` };
      }
      return { triggered: false, confidence: 0 };
    },
  },
];

function calculateRiskTier(score: number): RiskTier {
  if (score >= 70) return "decline";
  if (score >= 50) return "substandard";
  if (score >= 25) return "standard";
  return "preferred";
}

function calculateBasePremium(data: UnderwritingApplicationInput): number {
  const baseRate = 0.005;
  if (data.applicantType === "individual") {
    const coverageAmount = data.requestedCoverageAmount;
    let ageFactor = 1.0;
    if (data.age) {
      if (data.age < 30) ageFactor = 0.7;
      else if (data.age < 40) ageFactor = 0.9;
      else if (data.age < 50) ageFactor = 1.1;
      else if (data.age < 60) ageFactor = 1.4;
      else ageFactor = 2.0;
    }
    return Math.round(coverageAmount * baseRate * ageFactor);
  } else {
    const coverageAmount = data.requestedCoverageAmount;
    const employeeFactor = data.employeeCount ? Math.max(1, data.employeeCount / 50) : 1;
    return Math.round(coverageAmount * baseRate * 0.8 * employeeFactor);
  }
}

function generateSummary(assessment: Partial<UnderwritingAssessment>, signals: UnderwritingSignal[]): string {
  const riskSignals = signals.filter(s => s.dimension === "risk" && s.premiumImpact > 0);
  const profitSignals = signals.filter(s => s.dimension === "profitability" && s.premiumImpact > 0);
  const positiveSignals = signals.filter(s => s.premiumImpact < 0);

  if (assessment.riskTier === "decline") {
    return `Application declined due to ${riskSignals.length} critical risk factors. Total risk score of ${assessment.overallRiskScore} exceeds acceptable threshold. Manual underwriting review required for any exceptions.`;
  }
  if (assessment.riskTier === "substandard") {
    return `Substandard risk classification with ${assessment.adjustmentPercentage?.toFixed(1)}% premium adjustment. ${riskSignals.length} risk factors and ${profitSignals.length} profitability concerns identified. Recommended premium: $${assessment.recommendedPremium?.toLocaleString()}.`;
  }
  if (assessment.riskTier === "standard") {
    return `Standard risk classification with ${assessment.adjustmentPercentage?.toFixed(1)}% adjustment. ${positiveSignals.length} favorable factors identified. Recommended premium: $${assessment.recommendedPremium?.toLocaleString()}.`;
  }
  return `Preferred risk classification with ${Math.abs(assessment.adjustmentPercentage || 0).toFixed(1)}% discount. ${positiveSignals.length} favorable factors qualify applicant for best rates. Recommended premium: $${assessment.recommendedPremium?.toLocaleString()}.`;
}

export function analyzeUnderwriting(applicationData: UnderwritingApplicationInput): UnderwritingAssessment {
  const triggeredSignals: UnderwritingSignal[] = [];
  let riskScore = 0;
  let profitabilityScore = 0;
  let totalAdjustment = 0;

  for (const rule of underwritingRules) {
    if (!rule.applicantTypes.includes(applicationData.applicantType)) continue;
    
    const result = rule.check(applicationData);
    
    if (result.triggered) {
      const weightedImpact = Math.round(rule.basePremiumImpact * (result.confidence / 100));
      totalAdjustment += weightedImpact;

      if (rule.dimension === "risk" && rule.basePremiumImpact > 0) {
        riskScore += Math.abs(weightedImpact);
      } else if (rule.dimension === "profitability" && rule.basePremiumImpact > 0) {
        profitabilityScore += Math.abs(weightedImpact);
      }

      triggeredSignals.push({
        id: nanoid(),
        code: rule.code,
        name: rule.name,
        description: result.details || rule.description,
        severity: rule.severity,
        dimension: rule.dimension,
        confidence: result.confidence,
        impactedFields: rule.impactedFields,
        premiumImpact: weightedImpact,
        recommendation: rule.recommendation,
      });
    }
  }

  const cappedAdjustment = Math.max(-40, Math.min(40, totalAdjustment));
  const overallRiskScore = Math.min(100, riskScore + profitabilityScore);
  const riskTier = calculateRiskTier(overallRiskScore);
  const basePremium = calculateBasePremium(applicationData);
  const recommendedPremium = Math.round(basePremium * (1 + cappedAdjustment / 100));
  const projectedLossRatio = riskTier === "decline" ? 100 : riskTier === "substandard" ? 70 : riskTier === "standard" ? 55 : 40;

  const applicantName = applicationData.applicantType === "individual" 
    ? applicationData.fullName 
    : applicationData.companyName;

  const assessment: UnderwritingAssessment = {
    id: nanoid(),
    applicantType: applicationData.applicantType,
    applicantName,
    overallRiskScore,
    profitabilityScore: Math.min(100, profitabilityScore),
    riskTier,
    basePremium,
    adjustmentPercentage: cappedAdjustment,
    recommendedPremium,
    projectedLossRatio,
    triggeredSignals: triggeredSignals.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    evaluatedAt: new Date().toISOString(),
    inputData: applicationData,
    summary: "",
    isApproved: riskTier !== "decline",
    declineReason: riskTier === "decline" ? "Risk score exceeds acceptable threshold" : undefined,
  };

  assessment.summary = generateSummary(assessment, triggeredSignals);

  return assessment;
}

export { underwritingRules };
