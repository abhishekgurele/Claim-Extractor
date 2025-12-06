import { FileText, Image, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import type { Document } from "@shared/schema";

interface DocumentPreviewProps {
  document: Document;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function DocumentPreview({ document }: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 1; // For MVP, we only handle single pages

  const isPdf = document.fileType === "application/pdf";
  const Icon = isPdf ? FileText : Image;

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  return (
    <Card className="w-full h-full flex flex-col" data-testid="document-preview">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 flex-shrink-0">
        <CardTitle className="text-lg font-medium">Document Preview</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Document Info */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
          <div className="p-2 bg-background rounded-md">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" data-testid="text-filename">
              {document.filename}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="text-filesize">
              {formatFileSize(document.fileSize)} • {isPdf ? "PDF" : "Image"}
            </p>
          </div>
        </div>
        
        {/* Preview Area */}
        <div className="flex-1 relative bg-muted/30 rounded-md overflow-hidden flex items-center justify-center">
          {document.thumbnailUrl ? (
            <img
              src={document.thumbnailUrl}
              alt={`Preview of ${document.filename}`}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom / 100})` }}
              data-testid="img-document-preview"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Icon className="w-16 h-16" />
              <span className="text-sm">Preview not available</span>
            </div>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex items-center justify-between gap-4 flex-shrink-0">
          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[60px] text-center">
              {currentPage} / {totalPages}
            </span>
            <Button
              size="icon"
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              data-testid="button-next-page"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[50px] text-center">
              {zoom}%
            </span>
            <Button
              size="icon"
              variant="outline"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
