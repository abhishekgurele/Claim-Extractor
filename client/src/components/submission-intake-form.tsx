import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Upload, CheckCircle, AlertCircle, Mail, Loader2, FileText, User, Phone, AtSign, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  patientInfoSchema,
  documentTypeLabels,
  requiredDocumentTypes,
  type ClaimSubmission,
  type RequiredDocumentType,
  type PatientInfo,
} from "@shared/schema";
import { z } from "zod";

const submissionFormSchema = patientInfoSchema.extend({
  providerEmail: z.string().email("Valid provider email is required"),
});

type SubmissionFormData = z.infer<typeof submissionFormSchema>;

interface SubmissionIntakeFormProps {
  onSubmissionComplete: (submission: ClaimSubmission) => void;
}

export function SubmissionIntakeForm({ onSubmissionComplete }: SubmissionIntakeFormProps) {
  const [submission, setSubmission] = useState<ClaimSubmission | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<RequiredDocumentType | null>(null);
  const { toast } = useToast();

  const form = useForm<SubmissionFormData>({
    resolver: zodResolver(submissionFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      providerEmail: "",
    },
  });

  const createSubmissionMutation = useMutation({
    mutationFn: async (data: SubmissionFormData) => {
      const response = await apiRequest("POST", "/api/submissions", {
        patientInfo: {
          name: data.name,
          email: data.email,
          phone: data.phone,
        },
        providerEmail: data.providerEmail,
      });
      return response.json();
    },
    onSuccess: (data: ClaimSubmission) => {
      setSubmission(data);
      toast({
        title: "Submission Created",
        description: "Now upload the required documents.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create submission",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ documentType, file }: { documentType: RequiredDocumentType; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", documentType);

      const response = await fetch(`/api/submissions/${submission?.id}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload document");
      }

      return response.json();
    },
    onSuccess: (data: ClaimSubmission) => {
      setSubmission(data);
      setUploadingDoc(null);
      
      if (data.isComplete) {
        toast({
          title: "All Documents Uploaded",
          description: "Ready to process the claim.",
        });
      } else {
        toast({
          title: "Document Uploaded",
          description: `${data.missingDocuments.length} more document(s) required.`,
        });
      }
    },
    onError: (error: Error) => {
      setUploadingDoc(null);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const notifyProviderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/submissions/${submission?.id}/notify`, {});
      return response.json();
    },
    onSuccess: (data: ClaimSubmission) => {
      setSubmission(data);
      toast({
        title: "Notification Sent",
        description: "Email sent to provider requesting missing documents.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send notification",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const processSubmissionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/submissions/${submission?.id}/process`, {});
      return response.json();
    },
    onSuccess: (data: ClaimSubmission) => {
      onSubmissionComplete(data);
    },
    onError: (error: Error) => {
      toast({
        title: "Processing Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (documentType: RequiredDocumentType, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingDoc(documentType);
    uploadDocumentMutation.mutate({ documentType, file });
  };

  const onSubmit = (data: SubmissionFormData) => {
    createSubmissionMutation.mutate(data);
  };

  if (!submission) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Patient Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          {...field} 
                          placeholder="Enter patient name" 
                          className="pl-10"
                          data-testid="input-patient-name"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          {...field} 
                          type="email"
                          placeholder="patient@example.com" 
                          className="pl-10"
                          data-testid="input-patient-email"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient Phone</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          {...field} 
                          type="tel"
                          placeholder="Enter phone number" 
                          className="pl-10"
                          data-testid="input-patient-phone"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="providerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Healthcare Provider Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          {...field} 
                          type="email"
                          placeholder="provider@hospital.com" 
                          className="pl-10"
                          data-testid="input-provider-email"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full"
                disabled={createSubmissionMutation.isPending}
                data-testid="button-start-submission"
              >
                {createSubmissionMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Submission...
                  </>
                ) : (
                  "Start Document Upload"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Patient: {submission.patientInfo.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <AtSign className="w-4 h-4" />
              {submission.patientInfo.email}
            </span>
            <span className="flex items-center gap-1">
              <Phone className="w-4 h-4" />
              {submission.patientInfo.phone}
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              {submission.providerEmail}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Required Documents
            </CardTitle>
            <div className="flex items-center gap-2">
              {submission.isComplete ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  All Documents Uploaded
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {submission.missingDocuments.length} Missing
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {requiredDocumentTypes.map((docType) => {
            const docItem = submission.documentChecklist.find((d) => d.type === docType);
            const isUploaded = docItem?.uploaded;
            const isUploading = uploadingDoc === docType;

            return (
              <div
                key={docType}
                className="flex items-center justify-between gap-4 p-4 rounded-md border"
                data-testid={`doc-slot-${docType}`}
              >
                <div className="flex items-center gap-3">
                  {isUploaded ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{documentTypeLabels[docType]}</p>
                    {isUploaded && docItem?.filename && (
                      <p className="text-sm text-muted-foreground">{docItem.filename}</p>
                    )}
                  </div>
                </div>

                {isUploaded ? (
                  <Badge variant="outline">Uploaded</Badge>
                ) : (
                  <label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={(e) => handleFileUpload(docType, e)}
                      disabled={isUploading || uploadDocumentMutation.isPending}
                      data-testid={`input-file-${docType}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploading || uploadDocumentMutation.isPending}
                      asChild
                    >
                      <span className="cursor-pointer">
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 justify-end">
        {!submission.isComplete && (
          <Button
            variant="outline"
            onClick={() => notifyProviderMutation.mutate()}
            disabled={notifyProviderMutation.isPending || submission.status === "notified"}
            data-testid="button-notify-provider"
          >
            {notifyProviderMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : submission.status === "notified" ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Notification Sent
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Request Missing Documents
              </>
            )}
          </Button>
        )}

        <Button
          onClick={() => processSubmissionMutation.mutate()}
          disabled={!submission.isComplete || processSubmissionMutation.isPending}
          data-testid="button-process-claim"
        >
          {processSubmissionMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            "Process Claim"
          )}
        </Button>
      </div>

      {!submission.isComplete && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertCircle className="w-6 h-6 text-amber-500" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">Missing Documents</p>
              <p className="text-sm text-muted-foreground">
                Upload all 4 required documents before processing. You can also email the healthcare provider to request the missing documents.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
