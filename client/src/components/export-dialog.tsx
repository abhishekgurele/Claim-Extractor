import { useState } from "react";
import { Download, Copy, Check, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExportData } from "@shared/schema";

interface ExportDialogProps {
  exportData: ExportData | null;
  onExport: () => void;
  isLoading?: boolean;
}

export function ExportDialog({ exportData, onExport, isLoading }: ExportDialogProps) {
  const [copied, setCopied] = useState(false);
  const [filename, setFilename] = useState("claim-export.json");

  const hasData = exportData !== null && exportData.metadata.totalFields > 0;

  const handleCopy = async () => {
    if (!exportData) return;
    
    await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!exportData) return;
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          onClick={onExport}
          disabled={isLoading || !hasData}
          data-testid="button-export-json"
        >
          <Download className="w-4 h-4 mr-2" />
          Export JSON
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px]" data-testid="dialog-export">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5" />
            Export Claims Data
          </DialogTitle>
          <DialogDescription>
            Download or copy the extracted claims data in JSON format.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="filename">Filename</Label>
            <Input
              id="filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="claim-export.json"
              data-testid="input-export-filename"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Preview</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                data-testid="button-copy-json"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <ScrollArea className="h-[200px] w-full rounded-md border bg-muted/30 p-4">
              <pre className="text-xs font-mono text-foreground">
                {exportData ? JSON.stringify(exportData, null, 2) : "No data to export"}
              </pre>
            </ScrollArea>
          </div>
          
          {exportData && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{exportData.metadata.totalFields} fields</span>
              <span>{exportData.metadata.editedFields} edited</span>
            </div>
          )}
        </div>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCopy} disabled={!hasData} data-testid="button-copy-export">
            <Copy className="w-4 h-4 mr-2" />
            Copy to Clipboard
          </Button>
          <Button onClick={handleDownload} disabled={!hasData} data-testid="button-download-export">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
