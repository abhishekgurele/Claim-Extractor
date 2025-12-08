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
  RefreshCw,
  Users,
  Building2,
  User,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { 
  IndividualApplicantInput, 
  CompanyApplicantInput, 
  UnderwritingAssessment, 
  UnderwritingSignal, 
  RiskTier,
  BulkUnderwritingResult,
  UnderwritingApplicationInput,
  SignalSeverity
} from "@shared/schema";

const defaultIndividualData: IndividualApplicantInput = {
  applicantType: "individual",
  fullName: "",
  age: undefined,
  gender: undefined,
  occupation: "",
  annualIncome: undefined,
  netWorth: undefined,
  creditScore: undefined,
  smokingStatus: undefined,
  hasChronicConditions: false,
  chronicConditions: [],
  bmi: undefined,
  hazardousHobbies: [],
  previousClaimsCount: undefined,
  previousClaimsAmount: undefined,
  yearsWithPriorCoverage: undefined,
  requestedCoverageAmount: 0,
  coverageType: "",
  policyTerm: undefined,
};

const defaultCompanyData: CompanyApplicantInput = {
  applicantType: "company",
  companyName: "",
  industry: "",
  industryCode: "",
  yearsInBusiness: undefined,
  employeeCount: undefined,
  annualRevenue: undefined,
  annualPayroll: undefined,
  netWorth: undefined,
  previousClaimsCount: undefined,
  previousClaimsAmount: undefined,
  priorLossRatio: undefined,
  oshaIncidents: undefined,
  hasSafetyCertifications: false,
  safetyCertifications: [],
  hasRiskManagementProgram: false,
  geographicConcentration: undefined,
  liquidityRatio: undefined,
  requestedCoverageAmount: 0,
  coverageType: "",
  policyTerm: undefined,
};

function getTierColor(tier: RiskTier) {
  switch (tier) {
    case "preferred": return "text-emerald-600 dark:text-emerald-400";
    case "standard": return "text-blue-600 dark:text-blue-400";
    case "substandard": return "text-amber-600 dark:text-amber-400";
    case "decline": return "text-red-600 dark:text-red-400";
  }
}

function getTierBgColor(tier: RiskTier) {
  switch (tier) {
    case "preferred": return "bg-emerald-500";
    case "standard": return "bg-blue-500";
    case "substandard": return "bg-amber-500";
    case "decline": return "bg-red-500";
  }
}

function getTierBadgeVariant(tier: RiskTier): "destructive" | "outline" | "secondary" {
  switch (tier) {
    case "preferred": return "secondary";
    case "standard": return "outline";
    case "substandard": return "outline";
    case "decline": return "destructive";
  }
}

function getSeverityIcon(severity: SignalSeverity) {
  switch (severity) {
    case "critical": return <XCircle className="w-4 h-4 text-red-500" />;
    case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case "info": return <Info className="w-4 h-4 text-blue-500" />;
  }
}

function getSeverityBadgeVariant(severity: SignalSeverity): "destructive" | "outline" | "secondary" {
  switch (severity) {
    case "critical": return "destructive";
    case "warning": return "outline";
    case "info": return "secondary";
  }
}

export default function Underwriting() {
  const [applicantType, setApplicantType] = useState<"individual" | "company">("individual");
  const [individualData, setIndividualData] = useState<IndividualApplicantInput>(defaultIndividualData);
  const [companyData, setCompanyData] = useState<CompanyApplicantInput>(defaultCompanyData);
  const [assessment, setAssessment] = useState<UnderwritingAssessment | null>(null);
  const [expandedSignals, setExpandedSignals] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("single");
  const [bulkApplications, setBulkApplications] = useState<UnderwritingApplicationInput[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkUnderwritingResult | null>(null);
  const [selectedBulkAssessment, setSelectedBulkAssessment] = useState<UnderwritingAssessment | null>(null);
  const [bulkType, setBulkType] = useState<"individual" | "company" | "mixed">("mixed");
  const { toast } = useToast();

  const { data: sampleData } = useQuery<{ individual: IndividualApplicantInput; company: CompanyApplicantInput }>({
    queryKey: ["/api/underwriting/sample-data"],
  });

  const analyzeMutation = useMutation({
    mutationFn: async (data: UnderwritingApplicationInput) => {
      const response = await apiRequest("POST", "/api/underwriting/analyze", {
        applicationData: data,
      });
      return response.json();
    },
    onSuccess: (result: UnderwritingAssessment) => {
      setAssessment(result);
      toast({
        title: "Assessment Complete",
        description: `Risk Tier: ${result.riskTier.toUpperCase()} - Premium: $${result.recommendedPremium.toLocaleString()}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Assessment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateBulkMutation = useMutation({
    mutationFn: async ({ count, type }: { count: number; type?: string }) => {
      const url = type && type !== "mixed" 
        ? `/api/underwriting/generate-bulk?count=${count}&type=${type}`
        : `/api/underwriting/generate-bulk?count=${count}`;
      const response = await apiRequest("GET", url);
      return response.json();
    },
    onSuccess: (result: { applications: UnderwritingApplicationInput[]; count: number }) => {
      setBulkApplications(result.applications);
      setBulkResults(null);
      setSelectedBulkAssessment(null);
      toast({
        title: "Applications Generated",
        description: `Generated ${result.count} random applications for analysis`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const analyzeBulkMutation = useMutation({
    mutationFn: async (applications: UnderwritingApplicationInput[]) => {
      const response = await apiRequest("POST", "/api/underwriting/analyze-bulk", { applications });
      return response.json();
    },
    onSuccess: (result: BulkUnderwritingResult) => {
      setBulkResults(result);
      setSelectedBulkAssessment(null);
      toast({
        title: "Bulk Analysis Complete",
        description: `Analyzed ${result.totalApplications} applications. Preferred: ${result.summary.preferred}, Standard: ${result.summary.standard}, Substandard: ${result.summary.substandard}, Declined: ${result.summary.declined}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleIndividualChange = useCallback((field: keyof IndividualApplicantInput, value: any) => {
    setIndividualData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCompanyChange = useCallback((field: keyof CompanyApplicantInput, value: any) => {
    setCompanyData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleLoadSample = useCallback(() => {
    if (sampleData) {
      if (applicantType === "individual") {
        setIndividualData(sampleData.individual);
      } else {
        setCompanyData(sampleData.company);
      }
      setAssessment(null);
      toast({
        title: "Sample Data Loaded",
        description: `Loaded sample ${applicantType} application`,
      });
    }
  }, [sampleData, applicantType, toast]);

  const handleAnalyze = useCallback(() => {
    const data = applicantType === "individual" ? individualData : companyData;
    analyzeMutation.mutate(data);
  }, [applicantType, individualData, companyData, analyzeMutation]);

  const handleReset = useCallback(() => {
    if (applicantType === "individual") {
      setIndividualData(defaultIndividualData);
    } else {
      setCompanyData(defaultCompanyData);
    }
    setAssessment(null);
    setExpandedSignals(new Set());
  }, [applicantType]);

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

  const handleGenerateBulk = useCallback(() => {
    generateBulkMutation.mutate({ count: 100, type: bulkType === "mixed" ? undefined : bulkType });
  }, [generateBulkMutation, bulkType]);

  const handleAnalyzeBulk = useCallback(() => {
    if (bulkApplications.length > 0) {
      analyzeBulkMutation.mutate(bulkApplications);
    }
  }, [bulkApplications, analyzeBulkMutation]);

  const handleClearBulk = useCallback(() => {
    setBulkApplications([]);
    setBulkResults(null);
    setSelectedBulkAssessment(null);
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
              <h1 className="text-lg font-semibold" data-testid="text-page-title">Underwriting Agent</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Assess insurance applications</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" data-testid="link-claims-processing">
                <FileText className="w-4 h-4 mr-2" />
                Claims Processing
              </Button>
            </Link>
            <Link href="/fraud-detection">
              <Button variant="outline" data-testid="link-fraud-detection">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Fraud Detection
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="single" data-testid="tab-single-application">
              <FileText className="w-4 h-4 mr-2" />
              Single Application
            </TabsTrigger>
            <TabsTrigger value="bulk" data-testid="tab-bulk-analysis">
              <Users className="w-4 h-4 mr-2" />
              Bulk Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {applicantType === "individual" ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                      Application Input
                    </CardTitle>
                    <CardDescription>
                      Enter applicant details or load sample data for testing
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                      <Label className="w-32">Applicant Type</Label>
                      <Select 
                        value={applicantType} 
                        onValueChange={(v) => {
                          setApplicantType(v as "individual" | "company");
                          setAssessment(null);
                        }}
                      >
                        <SelectTrigger className="flex-1" data-testid="select-applicant-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="individual">Individual</SelectItem>
                          <SelectItem value="company">Company</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        onClick={handleLoadSample}
                        disabled={!sampleData}
                        data-testid="button-load-sample"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Load Sample Data
                      </Button>
                      <Button 
                        variant="ghost" 
                        onClick={handleReset}
                        data-testid="button-reset"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reset
                      </Button>
                    </div>

                    {applicantType === "individual" ? (
                      <div className="space-y-6">
                        <div className="border-t pt-4 space-y-4">
                          <h3 className="font-medium text-sm text-muted-foreground">PERSONAL INFORMATION</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="fullName">Full Name</Label>
                              <Input
                                id="fullName"
                                value={individualData.fullName || ""}
                                onChange={(e) => handleIndividualChange("fullName", e.target.value)}
                                placeholder="John Smith"
                                data-testid="input-full-name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="age">Age</Label>
                              <Input
                                id="age"
                                type="number"
                                value={individualData.age || ""}
                                onChange={(e) => handleIndividualChange("age", e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="35"
                                data-testid="input-age"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="gender">Gender</Label>
                              <Select 
                                value={individualData.gender || ""} 
                                onValueChange={(v) => handleIndividualChange("gender", v)}
                              >
                                <SelectTrigger data-testid="select-gender">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="male">Male</SelectItem>
                                  <SelectItem value="female">Female</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="occupation">Occupation</Label>
                              <Input
                                id="occupation"
                                value={individualData.occupation || ""}
                                onChange={(e) => handleIndividualChange("occupation", e.target.value)}
                                placeholder="Software Engineer"
                                data-testid="input-occupation"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                          <h3 className="font-medium text-sm text-muted-foreground">FINANCIAL INFORMATION</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="annualIncome">Annual Income ($)</Label>
                              <Input
                                id="annualIncome"
                                type="number"
                                value={individualData.annualIncome || ""}
                                onChange={(e) => handleIndividualChange("annualIncome", e.target.value ? parseFloat(e.target.value) : undefined)}
                                placeholder="100000"
                                data-testid="input-annual-income"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="creditScore">Credit Score</Label>
                              <Input
                                id="creditScore"
                                type="number"
                                value={individualData.creditScore || ""}
                                onChange={(e) => handleIndividualChange("creditScore", e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="750"
                                data-testid="input-credit-score"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                          <h3 className="font-medium text-sm text-muted-foreground">HEALTH & LIFESTYLE</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="smokingStatus">Smoking Status</Label>
                              <Select 
                                value={individualData.smokingStatus || ""} 
                                onValueChange={(v) => handleIndividualChange("smokingStatus", v)}
                              >
                                <SelectTrigger data-testid="select-smoking-status">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="never">Never</SelectItem>
                                  <SelectItem value="former">Former</SelectItem>
                                  <SelectItem value="current">Current</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="bmi">BMI</Label>
                              <Input
                                id="bmi"
                                type="number"
                                step="0.1"
                                value={individualData.bmi || ""}
                                onChange={(e) => handleIndividualChange("bmi", e.target.value ? parseFloat(e.target.value) : undefined)}
                                placeholder="24.5"
                                data-testid="input-bmi"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Switch
                                id="hasChronicConditions"
                                checked={individualData.hasChronicConditions || false}
                                onCheckedChange={(v) => handleIndividualChange("hasChronicConditions", v)}
                                data-testid="switch-chronic-conditions"
                              />
                              <Label htmlFor="hasChronicConditions">Has Chronic Conditions</Label>
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                          <h3 className="font-medium text-sm text-muted-foreground">COVERAGE REQUEST</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="requestedCoverageAmount">Coverage Amount ($)</Label>
                              <Input
                                id="requestedCoverageAmount"
                                type="number"
                                value={individualData.requestedCoverageAmount || ""}
                                onChange={(e) => handleIndividualChange("requestedCoverageAmount", e.target.value ? parseFloat(e.target.value) : 0)}
                                placeholder="500000"
                                data-testid="input-coverage-amount"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="coverageType">Coverage Type</Label>
                              <Select 
                                value={individualData.coverageType || ""} 
                                onValueChange={(v) => handleIndividualChange("coverageType", v)}
                              >
                                <SelectTrigger data-testid="select-coverage-type">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Life">Life</SelectItem>
                                  <SelectItem value="Health">Health</SelectItem>
                                  <SelectItem value="Disability">Disability</SelectItem>
                                  <SelectItem value="Auto">Auto</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="policyTerm">Policy Term (years)</Label>
                              <Select 
                                value={individualData.policyTerm?.toString() || ""} 
                                onValueChange={(v) => handleIndividualChange("policyTerm", parseInt(v))}
                              >
                                <SelectTrigger data-testid="select-policy-term">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">1 Year</SelectItem>
                                  <SelectItem value="5">5 Years</SelectItem>
                                  <SelectItem value="10">10 Years</SelectItem>
                                  <SelectItem value="20">20 Years</SelectItem>
                                  <SelectItem value="30">30 Years</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="previousClaimsCount">Prior Claims</Label>
                              <Input
                                id="previousClaimsCount"
                                type="number"
                                value={individualData.previousClaimsCount || ""}
                                onChange={(e) => handleIndividualChange("previousClaimsCount", e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="0"
                                data-testid="input-previous-claims"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="border-t pt-4 space-y-4">
                          <h3 className="font-medium text-sm text-muted-foreground">COMPANY INFORMATION</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="companyName">Company Name</Label>
                              <Input
                                id="companyName"
                                value={companyData.companyName || ""}
                                onChange={(e) => handleCompanyChange("companyName", e.target.value)}
                                placeholder="Tech Solutions Inc"
                                data-testid="input-company-name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="industry">Industry</Label>
                              <Select 
                                value={companyData.industry || ""} 
                                onValueChange={(v) => handleCompanyChange("industry", v)}
                              >
                                <SelectTrigger data-testid="select-industry">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Technology">Technology</SelectItem>
                                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                                  <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                                  <SelectItem value="Retail">Retail</SelectItem>
                                  <SelectItem value="Construction">Construction</SelectItem>
                                  <SelectItem value="Transportation">Transportation</SelectItem>
                                  <SelectItem value="Finance">Finance</SelectItem>
                                  <SelectItem value="Mining">Mining</SelectItem>
                                  <SelectItem value="Oil & Gas">Oil & Gas</SelectItem>
                                  <SelectItem value="Professional Services">Professional Services</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="yearsInBusiness">Years in Business</Label>
                              <Input
                                id="yearsInBusiness"
                                type="number"
                                value={companyData.yearsInBusiness || ""}
                                onChange={(e) => handleCompanyChange("yearsInBusiness", e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="10"
                                data-testid="input-years-in-business"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="employeeCount">Employee Count</Label>
                              <Input
                                id="employeeCount"
                                type="number"
                                value={companyData.employeeCount || ""}
                                onChange={(e) => handleCompanyChange("employeeCount", e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="50"
                                data-testid="input-employee-count"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                          <h3 className="font-medium text-sm text-muted-foreground">FINANCIAL INFORMATION</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="annualRevenue">Annual Revenue ($)</Label>
                              <Input
                                id="annualRevenue"
                                type="number"
                                value={companyData.annualRevenue || ""}
                                onChange={(e) => handleCompanyChange("annualRevenue", e.target.value ? parseFloat(e.target.value) : undefined)}
                                placeholder="5000000"
                                data-testid="input-annual-revenue"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="priorLossRatio">Prior Loss Ratio (%)</Label>
                              <Input
                                id="priorLossRatio"
                                type="number"
                                step="0.1"
                                value={companyData.priorLossRatio || ""}
                                onChange={(e) => handleCompanyChange("priorLossRatio", e.target.value ? parseFloat(e.target.value) : undefined)}
                                placeholder="35"
                                data-testid="input-loss-ratio"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="liquidityRatio">Liquidity Ratio</Label>
                              <Input
                                id="liquidityRatio"
                                type="number"
                                step="0.1"
                                value={companyData.liquidityRatio || ""}
                                onChange={(e) => handleCompanyChange("liquidityRatio", e.target.value ? parseFloat(e.target.value) : undefined)}
                                placeholder="2.0"
                                data-testid="input-liquidity-ratio"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="oshaIncidents">OSHA Incidents</Label>
                              <Input
                                id="oshaIncidents"
                                type="number"
                                value={companyData.oshaIncidents || ""}
                                onChange={(e) => handleCompanyChange("oshaIncidents", e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="0"
                                data-testid="input-osha-incidents"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                          <h3 className="font-medium text-sm text-muted-foreground">RISK MANAGEMENT</h3>
                          <div className="flex flex-wrap gap-6">
                            <div className="flex items-center gap-2">
                              <Switch
                                id="hasSafetyCertifications"
                                checked={companyData.hasSafetyCertifications || false}
                                onCheckedChange={(v) => handleCompanyChange("hasSafetyCertifications", v)}
                                data-testid="switch-safety-certs"
                              />
                              <Label htmlFor="hasSafetyCertifications">Safety Certifications</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                id="hasRiskManagementProgram"
                                checked={companyData.hasRiskManagementProgram || false}
                                onCheckedChange={(v) => handleCompanyChange("hasRiskManagementProgram", v)}
                                data-testid="switch-risk-program"
                              />
                              <Label htmlFor="hasRiskManagementProgram">Risk Management Program</Label>
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-4 space-y-4">
                          <h3 className="font-medium text-sm text-muted-foreground">COVERAGE REQUEST</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="companyCoverageAmount">Coverage Amount ($)</Label>
                              <Input
                                id="companyCoverageAmount"
                                type="number"
                                value={companyData.requestedCoverageAmount || ""}
                                onChange={(e) => handleCompanyChange("requestedCoverageAmount", e.target.value ? parseFloat(e.target.value) : 0)}
                                placeholder="2000000"
                                data-testid="input-company-coverage-amount"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="companyCoverageType">Coverage Type</Label>
                              <Select 
                                value={companyData.coverageType || ""} 
                                onValueChange={(v) => handleCompanyChange("coverageType", v)}
                              >
                                <SelectTrigger data-testid="select-company-coverage-type">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="General Liability">General Liability</SelectItem>
                                  <SelectItem value="Workers Compensation">Workers Compensation</SelectItem>
                                  <SelectItem value="Professional Liability">Professional Liability</SelectItem>
                                  <SelectItem value="Property">Property</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-4 flex gap-4">
                      <Button 
                        onClick={handleAnalyze}
                        disabled={analyzeMutation.isPending}
                        className="flex-1"
                        data-testid="button-analyze"
                      >
                        {analyzeMutation.isPending ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Analyze Application
                          </>
                        )}
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
                        <CardTitle className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5" />
                            Underwriting Assessment
                          </span>
                          <Badge 
                            variant={getTierBadgeVariant(assessment.riskTier)}
                            className="text-sm"
                            data-testid="badge-risk-tier"
                          >
                            {assessment.riskTier.toUpperCase()}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {assessment.isApproved ? "Application approved" : "Application declined"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs">RISK SCORE</Label>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={assessment.overallRiskScore} 
                                className="flex-1"
                              />
                              <span className={`font-semibold ${getTierColor(assessment.riskTier)}`} data-testid="text-risk-score">
                                {assessment.overallRiskScore}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-muted-foreground text-xs">PROFITABILITY</Label>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={assessment.profitabilityScore} 
                                className="flex-1"
                              />
                              <span className="font-semibold" data-testid="text-profitability-score">
                                {assessment.profitabilityScore}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 border-t pt-4">
                          <div className="text-center">
                            <div className="text-muted-foreground text-xs mb-1">BASE PREMIUM</div>
                            <div className="font-semibold text-lg" data-testid="text-base-premium">
                              ${assessment.basePremium.toLocaleString()}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-muted-foreground text-xs mb-1">ADJUSTMENT</div>
                            <div className={`font-semibold text-lg flex items-center justify-center gap-1 ${assessment.adjustmentPercentage >= 0 ? 'text-amber-600' : 'text-emerald-600'}`} data-testid="text-adjustment">
                              {assessment.adjustmentPercentage >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                              {assessment.adjustmentPercentage >= 0 ? '+' : ''}{assessment.adjustmentPercentage.toFixed(1)}%
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-muted-foreground text-xs mb-1">RECOMMENDED</div>
                            <div className="font-semibold text-lg text-primary flex items-center justify-center gap-1" data-testid="text-recommended-premium">
                              <DollarSign className="w-4 h-4" />
                              {assessment.recommendedPremium.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <p className="text-sm text-muted-foreground" data-testid="text-summary">
                            {assessment.summary}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          Triggered Signals ({assessment.triggeredSignals.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[400px] pr-4">
                          <div className="space-y-2">
                            {assessment.triggeredSignals.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                                No risk signals triggered
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
                                      className="flex items-center gap-2 p-3 rounded-md border cursor-pointer hover-elevate"
                                      data-testid={`signal-${signal.code}`}
                                    >
                                      {expandedSignals.has(signal.id) ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                      {getSeverityIcon(signal.severity)}
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium text-sm">{signal.name}</span>
                                          <Badge variant={getSeverityBadgeVariant(signal.severity)} className="text-xs">
                                            {signal.severity}
                                          </Badge>
                                          <Badge variant="outline" className="text-xs">
                                            {signal.dimension}
                                          </Badge>
                                        </div>
                                      </div>
                                      <span className={`text-sm font-medium ${signal.premiumImpact >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                        {signal.premiumImpact >= 0 ? '+' : ''}{signal.premiumImpact}%
                                      </span>
                                    </div>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="ml-6 p-3 space-y-2 text-sm text-muted-foreground border-l">
                                      <p>{signal.description}</p>
                                      <p><strong>Confidence:</strong> {signal.confidence}%</p>
                                      <p><strong>Affected Fields:</strong> {signal.impactedFields.join(", ")}</p>
                                      <p><strong>Recommendation:</strong> {signal.recommendation}</p>
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Shield className="w-12 h-12 mb-4 opacity-50" />
                      <p>Enter application data and click Analyze to see the underwriting assessment</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Bulk Generation
                  </CardTitle>
                  <CardDescription>
                    Generate random applications for testing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Application Type</Label>
                    <Select value={bulkType} onValueChange={(v) => setBulkType(v as any)}>
                      <SelectTrigger data-testid="select-bulk-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mixed">Mixed (Individual & Company)</SelectItem>
                        <SelectItem value="individual">Individual Only</SelectItem>
                        <SelectItem value="company">Company Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleGenerateBulk}
                    disabled={generateBulkMutation.isPending}
                    className="w-full"
                    data-testid="button-generate-bulk"
                  >
                    {generateBulkMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Generate 100 Applications
                      </>
                    )}
                  </Button>

                  {bulkApplications.length > 0 && (
                    <>
                      <div className="text-sm text-muted-foreground text-center">
                        {bulkApplications.length} applications ready
                      </div>
                      <Button 
                        onClick={handleAnalyzeBulk}
                        disabled={analyzeBulkMutation.isPending}
                        className="w-full"
                        variant="default"
                        data-testid="button-analyze-bulk"
                      >
                        {analyzeBulkMutation.isPending ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Analyze All
                          </>
                        )}
                      </Button>
                      <Button 
                        onClick={handleClearBulk}
                        variant="outline"
                        className="w-full"
                        data-testid="button-clear-bulk"
                      >
                        Clear All
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {bulkResults && (
                <>
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        Analysis Summary
                      </CardTitle>
                      <CardDescription>
                        {bulkResults.totalApplications} applications analyzed
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="text-center p-4 rounded-md bg-emerald-500/10">
                          <div className="text-2xl font-bold text-emerald-600" data-testid="stat-preferred">
                            {bulkResults.summary.preferred}
                          </div>
                          <div className="text-sm text-muted-foreground">Preferred</div>
                        </div>
                        <div className="text-center p-4 rounded-md bg-blue-500/10">
                          <div className="text-2xl font-bold text-blue-600" data-testid="stat-standard">
                            {bulkResults.summary.standard}
                          </div>
                          <div className="text-sm text-muted-foreground">Standard</div>
                        </div>
                        <div className="text-center p-4 rounded-md bg-amber-500/10">
                          <div className="text-2xl font-bold text-amber-600" data-testid="stat-substandard">
                            {bulkResults.summary.substandard}
                          </div>
                          <div className="text-sm text-muted-foreground">Substandard</div>
                        </div>
                        <div className="text-center p-4 rounded-md bg-red-500/10">
                          <div className="text-2xl font-bold text-red-600" data-testid="stat-declined">
                            {bulkResults.summary.declined}
                          </div>
                          <div className="text-sm text-muted-foreground">Declined</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center border-t pt-4">
                        <div>
                          <div className="text-lg font-semibold" data-testid="stat-avg-risk">
                            {bulkResults.summary.averageRiskScore.toFixed(1)}
                          </div>
                          <div className="text-xs text-muted-foreground">Avg Risk Score</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold" data-testid="stat-avg-adjustment">
                            {bulkResults.summary.averagePremiumAdjustment >= 0 ? '+' : ''}{bulkResults.summary.averagePremiumAdjustment.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">Avg Adjustment</div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-primary" data-testid="stat-total-premium">
                            ${bulkResults.summary.totalPremiumValue.toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">Total Premium</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-3">
                    <CardHeader>
                      <CardTitle>Application Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-2">
                          {bulkResults.results.map((result, idx) => (
                            <div
                              key={result.id}
                              className={`flex items-center justify-between p-3 rounded-md border cursor-pointer hover-elevate ${
                                selectedBulkAssessment?.id === result.id ? 'border-primary bg-primary/5' : ''
                              }`}
                              onClick={() => setSelectedBulkAssessment(result)}
                              data-testid={`bulk-result-${idx}`}
                            >
                              <div className="flex items-center gap-3">
                                {result.applicantType === "individual" ? (
                                  <User className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <Building2 className="w-4 h-4 text-muted-foreground" />
                                )}
                                <div>
                                  <div className="font-medium text-sm">{result.applicantName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Score: {result.overallRiskScore} | Premium: ${result.recommendedPremium.toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <Badge variant={getTierBadgeVariant(result.riskTier)}>
                                {result.riskTier}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {selectedBulkAssessment && (
                    <Card className="lg:col-span-3">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-2">
                          <span>Assessment Details: {selectedBulkAssessment.applicantName}</span>
                          <Badge variant={getTierBadgeVariant(selectedBulkAssessment.riskTier)}>
                            {selectedBulkAssessment.riskTier.toUpperCase()}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-muted-foreground text-xs">Risk Score</div>
                            <div className="font-semibold">{selectedBulkAssessment.overallRiskScore}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Profitability</div>
                            <div className="font-semibold">{selectedBulkAssessment.profitabilityScore}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Adjustment</div>
                            <div className="font-semibold">
                              {selectedBulkAssessment.adjustmentPercentage >= 0 ? '+' : ''}{selectedBulkAssessment.adjustmentPercentage.toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Premium</div>
                            <div className="font-semibold text-primary">${selectedBulkAssessment.recommendedPremium.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="border-t pt-4">
                          <p className="text-sm text-muted-foreground">{selectedBulkAssessment.summary}</p>
                        </div>
                        {selectedBulkAssessment.triggeredSignals.length > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="text-sm font-medium mb-2">Triggered Signals ({selectedBulkAssessment.triggeredSignals.length})</h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedBulkAssessment.triggeredSignals.map((signal) => (
                                <Badge key={signal.id} variant={getSeverityBadgeVariant(signal.severity)}>
                                  {signal.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {!bulkResults && bulkApplications.length === 0 && (
                <Card className="lg:col-span-2">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Users className="w-12 h-12 mb-4 opacity-50" />
                    <p>Generate applications to get started with bulk analysis</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
