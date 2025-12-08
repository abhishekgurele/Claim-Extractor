import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  XCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Zap,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClaimDataInput, FraudAssessment, FraudSignal, RiskLevel } from "@shared/schema";

const defaultClaimData: ClaimDataInput = {
  claimantName: "",
  policyNumber: "",
  claimNumber: "",
  claimDate: "",
  claimAmount: undefined,
  incidentDate: "",
  incidentDescription: "",
  incidentLocation: "",
  treatmentDate: "",
  providerName: "",
  providerNPI: "",
  diagnosisCode: "",
  claimantAddress: "",
  claimantPhone: "",
  claimantEmail: "",
  vehicleInfo: "",
  policyHolderName: "",
  policyLimit: undefined,
  previousClaimsCount: undefined,
  daysSinceLastClaim: undefined,
};

function getRiskColor(level: RiskLevel) {
  switch (level) {
    case "high": return "text-red-600 dark:text-red-400";
    case "medium": return "text-amber-600 dark:text-amber-400";
    case "low": return "text-emerald-600 dark:text-emerald-400";
  }
}

function getRiskBgColor(level: RiskLevel) {
  switch (level) {
    case "high": return "bg-red-500";
    case "medium": return "bg-amber-500";
    case "low": return "bg-emerald-500";
  }
}

function getSeverityIcon(severity: FraudSignal["severity"]) {
  switch (severity) {
    case "critical": return <XCircle className="w-4 h-4 text-red-500" />;
    case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "info": return <Info className="w-4 h-4 text-blue-500" />;
  }
}

function getSeverityBadgeVariant(severity: FraudSignal["severity"]): "destructive" | "outline" | "secondary" {
  switch (severity) {
    case "critical": return "destructive";
    case "warning": return "outline";
    case "info": return "secondary";
  }
}

export default function FraudDetection() {
  const [claimData, setClaimData] = useState<ClaimDataInput>(defaultClaimData);
  const [assessment, setAssessment] = useState<FraudAssessment | null>(null);
  const [expandedSignals, setExpandedSignals] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: sampleDataList = [] } = useQuery<ClaimDataInput[]>({
    queryKey: ["/api/fraud/sample-data"],
  });

  const analyzeMutation = useMutation({
    mutationFn: async (data: ClaimDataInput) => {
      const response = await apiRequest("POST", "/api/fraud/analyze", {
        claimData: data,
      });
      return response.json();
    },
    onSuccess: (result: FraudAssessment) => {
      setAssessment(result);
      toast({
        title: "Analysis Complete",
        description: `Risk Level: ${result.riskLevel.toUpperCase()} (Score: ${result.overallScore})`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleInputChange = useCallback((field: keyof ClaimDataInput, value: string | number | undefined) => {
    setClaimData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleLoadSample = useCallback((index: string) => {
    const idx = parseInt(index, 10);
    if (sampleDataList[idx]) {
      setClaimData(sampleDataList[idx]);
      setAssessment(null);
      toast({
        title: "Sample Data Loaded",
        description: `Loaded sample claim for ${sampleDataList[idx].claimantName}`,
      });
    }
  }, [sampleDataList, toast]);

  const handleAnalyze = useCallback(() => {
    analyzeMutation.mutate(claimData);
  }, [claimData, analyzeMutation]);

  const handleReset = useCallback(() => {
    setClaimData(defaultClaimData);
    setAssessment(null);
    setExpandedSignals(new Set());
  }, []);

  const toggleSignal = useCallback((signalId: string) => {
    setExpandedSignals(prev => {
      const next = new Set(prev);
      if (next.has(signalId)) {
        next.delete(signalId);
      } else {
        next.add(signalId);
      }
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-home">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="p-2 rounded-md bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-page-title">Fraud Detection Engine</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Analyze claims for fraud indicators</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" data-testid="link-claims-processing">
                <FileText className="w-4 h-4 mr-2" />
                Claims Processing
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Claim Data Input
                </CardTitle>
                <CardDescription>
                  Enter claim details manually or load sample data for testing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <Label className="w-32">Load Sample</Label>
                  <Select onValueChange={handleLoadSample}>
                    <SelectTrigger className="flex-1" data-testid="select-sample-data">
                      <SelectValue placeholder="Select sample claim..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sampleDataList.map((sample, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {sample.claimantName} - ${sample.claimAmount?.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">CLAIMANT INFORMATION</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="claimantName">Claimant Name</Label>
                      <Input
                        id="claimantName"
                        value={claimData.claimantName || ""}
                        onChange={(e) => handleInputChange("claimantName", e.target.value)}
                        placeholder="John Smith"
                        data-testid="input-claimant-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="policyHolderName">Policy Holder Name</Label>
                      <Input
                        id="policyHolderName"
                        value={claimData.policyHolderName || ""}
                        onChange={(e) => handleInputChange("policyHolderName", e.target.value)}
                        placeholder="John Smith"
                        data-testid="input-policy-holder-name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="claimantEmail">Email</Label>
                      <Input
                        id="claimantEmail"
                        type="email"
                        value={claimData.claimantEmail || ""}
                        onChange={(e) => handleInputChange("claimantEmail", e.target.value)}
                        placeholder="john@email.com"
                        data-testid="input-claimant-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="claimantPhone">Phone</Label>
                      <Input
                        id="claimantPhone"
                        value={claimData.claimantPhone || ""}
                        onChange={(e) => handleInputChange("claimantPhone", e.target.value)}
                        placeholder="555-123-4567"
                        data-testid="input-claimant-phone"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="claimantAddress">Address</Label>
                    <Input
                      id="claimantAddress"
                      value={claimData.claimantAddress || ""}
                      onChange={(e) => handleInputChange("claimantAddress", e.target.value)}
                      placeholder="123 Main Street, City, State"
                      data-testid="input-claimant-address"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">POLICY & CLAIM DETAILS</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="policyNumber">Policy Number</Label>
                      <Input
                        id="policyNumber"
                        value={claimData.policyNumber || ""}
                        onChange={(e) => handleInputChange("policyNumber", e.target.value)}
                        placeholder="POL-2024-00123"
                        data-testid="input-policy-number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="claimNumber">Claim Number</Label>
                      <Input
                        id="claimNumber"
                        value={claimData.claimNumber || ""}
                        onChange={(e) => handleInputChange("claimNumber", e.target.value)}
                        placeholder="CLM-2024-00456"
                        data-testid="input-claim-number"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="claimAmount">Claim Amount ($)</Label>
                      <Input
                        id="claimAmount"
                        type="number"
                        value={claimData.claimAmount || ""}
                        onChange={(e) => handleInputChange("claimAmount", e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="15000"
                        data-testid="input-claim-amount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="policyLimit">Policy Limit ($)</Label>
                      <Input
                        id="policyLimit"
                        type="number"
                        value={claimData.policyLimit || ""}
                        onChange={(e) => handleInputChange("policyLimit", e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="50000"
                        data-testid="input-policy-limit"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">INCIDENT DETAILS</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="incidentDate">Incident Date</Label>
                      <Input
                        id="incidentDate"
                        type="date"
                        value={claimData.incidentDate || ""}
                        onChange={(e) => handleInputChange("incidentDate", e.target.value)}
                        data-testid="input-incident-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="treatmentDate">Treatment Date</Label>
                      <Input
                        id="treatmentDate"
                        type="date"
                        value={claimData.treatmentDate || ""}
                        onChange={(e) => handleInputChange("treatmentDate", e.target.value)}
                        data-testid="input-treatment-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="claimDate">Claim Date</Label>
                      <Input
                        id="claimDate"
                        type="date"
                        value={claimData.claimDate || ""}
                        onChange={(e) => handleInputChange("claimDate", e.target.value)}
                        data-testid="input-claim-date"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="incidentLocation">Incident Location</Label>
                    <Input
                      id="incidentLocation"
                      value={claimData.incidentLocation || ""}
                      onChange={(e) => handleInputChange("incidentLocation", e.target.value)}
                      placeholder="Main St & Oak Ave"
                      data-testid="input-incident-location"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="incidentDescription">Incident Description</Label>
                    <Textarea
                      id="incidentDescription"
                      value={claimData.incidentDescription || ""}
                      onChange={(e) => handleInputChange("incidentDescription", e.target.value)}
                      placeholder="Describe what happened..."
                      rows={3}
                      data-testid="input-incident-description"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">PROVIDER & MEDICAL</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="providerName">Provider Name</Label>
                      <Input
                        id="providerName"
                        value={claimData.providerName || ""}
                        onChange={(e) => handleInputChange("providerName", e.target.value)}
                        placeholder="City General Hospital"
                        data-testid="input-provider-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="providerNPI">Provider NPI</Label>
                      <Input
                        id="providerNPI"
                        value={claimData.providerNPI || ""}
                        onChange={(e) => handleInputChange("providerNPI", e.target.value)}
                        placeholder="1234567890"
                        data-testid="input-provider-npi"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="diagnosisCode">Diagnosis Code</Label>
                    <Input
                      id="diagnosisCode"
                      value={claimData.diagnosisCode || ""}
                      onChange={(e) => handleInputChange("diagnosisCode", e.target.value)}
                      placeholder="S00.0"
                      data-testid="input-diagnosis-code"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">CLAIM HISTORY</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="previousClaimsCount">Previous Claims Count</Label>
                      <Input
                        id="previousClaimsCount"
                        type="number"
                        value={claimData.previousClaimsCount ?? ""}
                        onChange={(e) => handleInputChange("previousClaimsCount", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                        placeholder="0"
                        data-testid="input-previous-claims"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="daysSinceLastClaim">Days Since Last Claim</Label>
                      <Input
                        id="daysSinceLastClaim"
                        type="number"
                        value={claimData.daysSinceLastClaim ?? ""}
                        onChange={(e) => handleInputChange("daysSinceLastClaim", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                        placeholder="365"
                        data-testid="input-days-since-claim"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button 
                    onClick={handleAnalyze} 
                    className="flex-1"
                    disabled={analyzeMutation.isPending}
                    data-testid="button-analyze"
                  >
                    {analyzeMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Analyze for Fraud
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleReset}
                    data-testid="button-reset"
                  >
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {assessment ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Fraud Assessment
                      </span>
                      <Badge 
                        variant={assessment.riskLevel === "high" ? "destructive" : assessment.riskLevel === "medium" ? "outline" : "secondary"}
                        className="text-sm"
                        data-testid="badge-risk-level"
                      >
                        {assessment.riskLevel.toUpperCase()} RISK
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Risk Score</span>
                        <span className={`text-2xl font-bold ${getRiskColor(assessment.riskLevel)}`} data-testid="text-risk-score">
                          {assessment.overallScore}
                        </span>
                      </div>
                      <Progress 
                        value={assessment.overallScore} 
                        className="h-3"
                        data-testid="progress-risk-score"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Low Risk</span>
                        <span>High Risk</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-md bg-muted/50">
                      <p className="text-sm" data-testid="text-assessment-summary">{assessment.summary}</p>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Evaluated at: {new Date(assessment.evaluatedAt).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Triggered Signals ({assessment.triggeredSignals.length})
                    </CardTitle>
                    <CardDescription>
                      Click on each signal for details and recommended actions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {assessment.triggeredSignals.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                        <p>No fraud signals detected</p>
                      </div>
                    ) : (
                      assessment.triggeredSignals.map((signal) => (
                        <Collapsible
                          key={signal.id}
                          open={expandedSignals.has(signal.id)}
                          onOpenChange={() => toggleSignal(signal.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <div 
                              className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover-elevate"
                              data-testid={`signal-${signal.code}`}
                            >
                              {getSeverityIcon(signal.severity)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{signal.name}</span>
                                  <Badge variant={getSeverityBadgeVariant(signal.severity)} className="text-xs">
                                    {signal.severity}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{signal.code}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  +{signal.scoreImpact}
                                </Badge>
                                {expandedSignals.has(signal.id) ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-3 pb-3">
                            <div className="mt-2 p-3 rounded-md bg-muted/50 space-y-3">
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">DESCRIPTION</span>
                                <p className="text-sm">{signal.description}</p>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">CONFIDENCE</span>
                                <div className="flex items-center gap-2">
                                  <Progress value={signal.confidence} className="h-2 flex-1" />
                                  <span className="text-sm">{signal.confidence}%</span>
                                </div>
                              </div>
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">IMPACTED FIELDS</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {signal.impactedFields.map((field) => (
                                    <Badge key={field} variant="secondary" className="text-xs">
                                      {field}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              {signal.remediationHint && (
                                <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">RECOMMENDED ACTION</span>
                                  <p className="text-sm text-blue-900 dark:text-blue-100">{signal.remediationHint}</p>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="lg:h-[600px] flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-lg font-medium mb-2">No Analysis Yet</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Enter claim data or load a sample, then click "Analyze for Fraud" to see the risk assessment
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
