import type { ExtractedField, Rule, RuleCondition, RuleEvaluationResult, ClaimVerdict, RuleOperator } from "@shared/schema";

function parseNumericValue(value: string): number | null {
  const cleaned = value.replace(/[,$%]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function evaluateCondition(
  condition: RuleCondition,
  fields: ExtractedField[]
): { matched: boolean; actualValue: string } {
  const field = fields.find(f => 
    f.label.toLowerCase() === condition.field.toLowerCase()
  );
  
  const actualValue = field?.value || "";
  const expectedValue = condition.value;
  
  if (!field) {
    return { matched: false, actualValue: "N/A" };
  }

  const actualNum = parseNumericValue(actualValue);
  const expectedNum = parseNumericValue(expectedValue);
  
  switch (condition.operator as RuleOperator) {
    case "greaterThan":
      if (actualNum !== null && expectedNum !== null) {
        return { matched: actualNum > expectedNum, actualValue };
      }
      return { matched: actualValue > expectedValue, actualValue };
      
    case "lessThan":
      if (actualNum !== null && expectedNum !== null) {
        return { matched: actualNum < expectedNum, actualValue };
      }
      return { matched: actualValue < expectedValue, actualValue };
      
    case "greaterThanOrEqual":
      if (actualNum !== null && expectedNum !== null) {
        return { matched: actualNum >= expectedNum, actualValue };
      }
      return { matched: actualValue >= expectedValue, actualValue };
      
    case "lessThanOrEqual":
      if (actualNum !== null && expectedNum !== null) {
        return { matched: actualNum <= expectedNum, actualValue };
      }
      return { matched: actualValue <= expectedValue, actualValue };
      
    case "equals":
      if (actualNum !== null && expectedNum !== null) {
        return { matched: actualNum === expectedNum, actualValue };
      }
      return { matched: actualValue.toLowerCase() === expectedValue.toLowerCase(), actualValue };
      
    case "notEquals":
      if (actualNum !== null && expectedNum !== null) {
        return { matched: actualNum !== expectedNum, actualValue };
      }
      return { matched: actualValue.toLowerCase() !== expectedValue.toLowerCase(), actualValue };
      
    case "contains":
      return { 
        matched: actualValue.toLowerCase().includes(expectedValue.toLowerCase()), 
        actualValue 
      };
      
    case "notContains":
      return { 
        matched: !actualValue.toLowerCase().includes(expectedValue.toLowerCase()), 
        actualValue 
      };
      
    default:
      return { matched: false, actualValue };
  }
}

function evaluateRule(rule: Rule, fields: ExtractedField[]): RuleEvaluationResult {
  const triggeredConditions = rule.conditions.map(condition => {
    const { matched, actualValue } = evaluateCondition(condition, fields);
    return {
      field: condition.field,
      operator: condition.operator,
      expectedValue: condition.value,
      actualValue,
      matched,
    };
  });

  let rulePassed: boolean;
  
  if (rule.logic === "all") {
    const allConditionsMet = triggeredConditions.every(c => c.matched);
    rulePassed = rule.action === "pass" ? allConditionsMet : !allConditionsMet;
  } else {
    const anyConditionMet = triggeredConditions.some(c => c.matched);
    rulePassed = rule.action === "pass" ? anyConditionMet : !anyConditionMet;
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    passed: rulePassed,
    triggeredConditions,
  };
}

export function evaluateClaim(fields: ExtractedField[], rules: Rule[]): ClaimVerdict {
  if (rules.length === 0) {
    return {
      verdict: "pending",
      evaluatedRules: [],
      failedRules: [],
      passedRules: [],
    };
  }

  const evaluatedRules = rules.map(rule => evaluateRule(rule, fields));
  const failedRules = evaluatedRules.filter(r => !r.passed).map(r => r.ruleName);
  const passedRules = evaluatedRules.filter(r => r.passed).map(r => r.ruleName);

  const verdict = failedRules.length > 0 ? "fail" : "pass";

  return {
    verdict,
    evaluatedRules,
    failedRules,
    passedRules,
  };
}
