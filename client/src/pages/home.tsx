import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileText, RotateCcw, AlertCircle } from "lucide-react";
import { UploadZone } from "@/components/upload-zone";
import { ProcessingStatusBar } from "@/components/processing-status";
import { ReviewGrid } from "@/components/review-grid";
import { DocumentPreview } from "@/components/document-preview";
import { ExportDialog } from "@/components/export-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsDialog } from "@/components/settings-dialog";
import { RulesDialog } from "@/components/rules-dialog";
import { VerdictBanner } from "@/components/verdict-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Document, ExtractedField, ExportData, ProcessingStatus, ClaimVerdict, Rule } from "@shared/schema";

export default function Home() {
  const [document, setDocument] = useState<Document | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [verdict, setVerdict] = useState<ClaimVerdict | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const { toast } = useToast();

  const { data: rules = [] } = useQuery<Rule[]>({
    queryKey: ["/api/rules"],
  });

  const evaluateRules = useCallback(async (fields: ExtractedField[]) => {
    if (!fields || fields.length === 0) return;
    
    setIsEvaluating(true);
    try {
      const response = await apiRequest("POST", "/api/rules/evaluate", {
        fields,
      });
      const verdictData = await response.json();
      setVerdict(verdictData);
    } catch (error) {
      console.error("Failed to evaluate rules:", error);
      toast({
        title: "Evaluation Failed",
        description: "Could not evaluate validation rules. Verdict may be outdated.",
        variant: "destructive",
      });
    } finally {
      setIsEvaluating(false);
    }
  }, [toast]);

  useEffect(() => {
    if (document?.extractedFields && document.extractedFields.length > 0 && status === "completed") {
      evaluateRules(document.extractedFields);
    }
  }, [rules, document?.extractedFields, evaluateRules, status]);

  // Process document mutation
  const processDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch("/api/documents/process", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process document");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setDocument(data.document);
      setStatus("completed");
      setProgress(100);
      toast({
        title: "Document Processed",
        description: `Successfully extracted ${data.document.extractedFields?.length || 0} fields.`,
      });
    },
    onError: (error: Error) => {
      setStatus("error");
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback(async (file: File) => {
    // Create a preview document
    const previewDoc: Document = {
      id: crypto.randomUUID(),
      filename: file.name,
      fileType: file.type,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      status: "uploading",
    };

    // Create thumbnail for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewDoc.thumbnailUrl = e.target?.result as string;
        setDocument({ ...previewDoc });
      };
      reader.readAsDataURL(file);
    } else {
      setDocument(previewDoc);
    }

    setStatus("uploading");
    setProgress(0);

    // Simulate upload progress
    const uploadInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 30) {
          clearInterval(uploadInterval);
          return 30;
        }
        return prev + 10;
      });
    }, 100);

    setTimeout(() => {
      setStatus("processing");
      
      // Simulate processing progress
      const processInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(processInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 200);

      processDocumentMutation.mutate(file);
    }, 500);
  }, [processDocumentMutation]);

  const handleFieldUpdate = useCallback((fieldId: string, newValue: string) => {
    if (!document?.extractedFields) return;

    const updatedFields = document.extractedFields.map((field) =>
      field.id === fieldId
        ? { ...field, value: newValue, isEdited: true }
        : field
    );

    setDocument({
      ...document,
      extractedFields: updatedFields,
    });

    toast({
      title: "Field Updated",
      description: "Your changes have been saved.",
    });
  }, [document, toast]);

  const handleReset = useCallback(() => {
    setDocument(null);
    setStatus("idle");
    setProgress(0);
    setVerdict(null);
  }, []);

  const generateExportData = useCallback((): ExportData | null => {
    if (!document?.extractedFields) return null;

    const fields: Record<string, string> = {};
    let editedCount = 0;

    document.extractedFields.forEach((field) => {
      fields[field.label] = field.value;
      if (field.isEdited) editedCount++;
    });

    return {
      documentId: document.id,
      filename: document.filename,
      processedAt: new Date().toISOString(),
      fields,
      metadata: {
        originalFileType: document.fileType,
        totalFields: document.extractedFields.length,
        editedFields: editedCount,
      },
    };
  }, [document]);

  const isProcessing = status === "uploading" || status === "processing";
  const showReview = status === "completed" && document?.extractedFields;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-app-title">ClaimScan</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">AI Document Processing</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {showReview && (
              <>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  data-testid="button-upload-new"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Upload New
                </Button>
                <ExportDialog
                  exportData={generateExportData()}
                  onExport={() => {}}
                />
              </>
            )}
            <RulesDialog />
            <SettingsDialog />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Processing Status */}
        {status !== "idle" && (
          <div className="mb-8">
            <ProcessingStatusBar status={status} progress={progress} />
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <Card className="mb-8 border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-4 py-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Processing Failed</p>
                <p className="text-sm text-muted-foreground">
                  There was an error processing your document. Please try again.
                </p>
              </div>
              <Button onClick={handleReset} variant="outline" data-testid="button-try-again">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Content Area */}
        {status === "idle" ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-full max-w-2xl">
              <UploadZone onFileSelect={handleFileSelect} isProcessing={false} />
            </div>
          </div>
        ) : showReview ? (
          <div className="space-y-6">
            <VerdictBanner verdict={verdict} isLoading={isEvaluating} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Review Grid - 2/3 width */}
              <div className="lg:col-span-2">
                <ReviewGrid
                fields={document.extractedFields || []}
                onFieldUpdate={handleFieldUpdate}
              />
            </div>
            
              {/* Document Preview - 1/3 width */}
              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-24">
                  <DocumentPreview document={document} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Processing Skeleton */}
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="h-6 w-48 bg-muted animate-pulse rounded" />
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                        <div className="flex-1 h-10 bg-muted animate-pulse rounded" />
                        <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Document Preview during processing */}
            {document && (
              <div className="lg:col-span-1">
                <DocumentPreview document={document} />
              </div>
            )}
          </div>
        )}

        {/* Footer Stats */}
        {document && (
          <div className="mt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <span>File: {document.filename}</span>
            <span>Size: {(document.fileSize / 1024).toFixed(1)} KB</span>
            {document.extractedFields && (
              <span>Fields: {document.extractedFields.length}</span>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
