import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ClaimVerdict, RuleEvaluationResult } from "@shared/schema";

interface VerdictBannerProps {
  verdict: ClaimVerdict | null;
  isLoading?: boolean;
}

function RuleResultDetails({ result }: { result: RuleEvaluationResult }) {
  return (
    <div className="p-3 rounded-md bg-muted/30 space-y-2" data-testid={`rule-result-${result.ruleId}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {result.passed ? (
          <CheckCircle className="w-4 h-4 text-primary shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-destructive shrink-0" />
        )}
        <span className="font-medium text-sm">{result.ruleName}</span>
        <Badge variant={result.passed ? "secondary" : "destructive"} className="text-xs">
          {result.passed ? "Passed" : "Failed"}
        </Badge>
      </div>
      
      {result.triggeredConditions.length > 0 && (
        <div className="ml-6 space-y-1">
          {result.triggeredConditions.map((cond, idx) => (
            <div key={idx} className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap" data-testid={`condition-result-${result.ruleId}-${idx}`}>
              <span className="font-medium">{cond.field}</span>
              <span>{cond.operator}</span>
              <span className="text-foreground">{cond.expectedValue}</span>
              <span className="text-muted-foreground">
                (actual: <span className={cond.matched ? "text-primary" : "text-destructive"}>{cond.actualValue}</span>)
              </span>
              {cond.matched ? (
                <CheckCircle className="w-3 h-3 text-primary" />
              ) : (
                <XCircle className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function VerdictBanner({ verdict, isLoading }: VerdictBannerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="w-6 h-6 bg-muted animate-pulse rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-3 w-48 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!verdict) {
    return null;
  }

  const getVerdictStyles = () => {
    switch (verdict.verdict) {
      case "pass":
        return {
          borderColor: "border-primary/50",
          bgColor: "bg-primary/5",
          icon: <CheckCircle className="w-6 h-6 text-primary" />,
          title: "Claim Passed",
          titleColor: "text-primary",
        };
      case "fail":
        return {
          borderColor: "border-destructive/50",
          bgColor: "bg-destructive/5",
          icon: <XCircle className="w-6 h-6 text-destructive" />,
          title: "Claim Failed",
          titleColor: "text-destructive",
        };
      case "pending":
      default:
        return {
          borderColor: "border-muted-foreground/30",
          bgColor: "bg-muted/30",
          icon: <Clock className="w-6 h-6 text-muted-foreground" />,
          title: "Pending Review",
          titleColor: "text-muted-foreground",
        };
    }
  };

  const styles = getVerdictStyles();
  const hasRules = verdict.evaluatedRules.length > 0;

  return (
    <Card className={`mb-6 ${styles.borderColor} ${styles.bgColor}`} data-testid="verdict-banner">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            {styles.icon}
            <div className="flex-1">
              <p className={`font-medium ${styles.titleColor}`} data-testid="text-verdict-title">
                {styles.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {verdict.verdict === "pending" ? (
                  "No validation rules are configured."
                ) : verdict.verdict === "pass" ? (
                  `All ${verdict.passedRules.length} rule${verdict.passedRules.length !== 1 ? "s" : ""} passed.`
                ) : (
                  `${verdict.failedRules.length} rule${verdict.failedRules.length !== 1 ? "s" : ""} failed: ${verdict.failedRules.join(", ")}`
                )}
              </p>
            </div>
            
            {hasRules && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="button-toggle-verdict-details">
                  {isOpen ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      View Details
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
          
          <CollapsibleContent>
            {hasRules && (
              <div className="mt-4 space-y-2">
                {verdict.evaluatedRules.map((result) => (
                  <RuleResultDetails key={result.ruleId} result={result} />
                ))}
              </div>
            )}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
