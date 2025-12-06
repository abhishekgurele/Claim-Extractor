import { useCallback, useState } from "react";
import { Upload, FileText, Image, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function UploadZone({ onFileSelect, isProcessing }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    const validTypes = Object.keys(ACCEPTED_TYPES);
    if (!validTypes.includes(file.type)) {
      return "Invalid file type. Please upload a PDF, PNG, or JPG file.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size exceeds 10MB limit.";
    }
    return null;
  }, []);

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onFileSelect(file);
  }, [validateFile, onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const getFileIcon = (type: string) => {
    if (type === "application/pdf") {
      return <FileText className="w-16 h-16 text-muted-foreground" />;
    }
    return <Image className="w-16 h-16 text-muted-foreground" />;
  };

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <Card
        className={`
          relative w-full min-h-96 flex flex-col items-center justify-center
          border-2 border-dashed transition-all duration-200 cursor-pointer
          ${isDragging 
            ? "border-primary bg-primary/5" 
            : "border-muted-foreground/25 hover:border-primary/50"
          }
          ${isProcessing ? "pointer-events-none opacity-60" : ""}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="upload-dropzone"
      >
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
          data-testid="input-file-upload"
        />
        
        <div className="flex flex-col items-center gap-6 p-8">
          <div className="relative">
            <div className="p-6 rounded-full bg-muted">
              <Upload className="w-12 h-12 text-muted-foreground" />
            </div>
            {isDragging && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
            )}
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium" data-testid="text-upload-title">
              {isDragging ? "Drop your file here" : "Drag and drop your document"}
            </h3>
            <p className="text-sm text-muted-foreground">
              or click to browse files
            </p>
          </div>
          
          <Button 
            variant="outline" 
            size="default"
            disabled={isProcessing}
            data-testid="button-browse-files"
          >
            Browse Files
          </Button>
          
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>PDF</span>
            </div>
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              <span>PNG, JPG</span>
            </div>
            <span className="text-muted-foreground/60">Max 10MB</span>
          </div>
        </div>
      </Card>
      
      {error && (
        <div className="mt-4 flex items-center gap-2 text-sm text-destructive" data-testid="text-upload-error">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setError(null)}
            data-testid="button-dismiss-error"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
