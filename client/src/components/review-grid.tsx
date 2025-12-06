import { useState, useCallback } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { ConfidenceBadge } from "./confidence-badge";
import type { ExtractedField } from "@shared/schema";

interface ReviewGridProps {
  fields: ExtractedField[];
  onFieldUpdate: (id: string, newValue: string) => void;
}

// Format field labels from camelCase to readable format
function formatLabel(label: string): string {
  return label
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export function ReviewGrid({ fields, onFieldUpdate }: ReviewGridProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEditing = useCallback((field: ExtractedField) => {
    setEditingId(field.id);
    setEditValue(field.value);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditValue("");
  }, []);

  const saveEdit = useCallback((id: string) => {
    onFieldUpdate(id, editValue);
    setEditingId(null);
    setEditValue("");
  }, [editValue, onFieldUpdate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      saveEdit(id);
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  }, [saveEdit, cancelEditing]);

  if (fields.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">No fields extracted yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full" data-testid="review-grid">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
        <CardTitle className="text-lg font-medium">Extracted Fields</CardTitle>
        <span className="text-sm text-muted-foreground">
          {fields.length} field{fields.length !== 1 ? "s" : ""} extracted
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[500px] overflow-y-auto">
          <div className="divide-y divide-border">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className={`
                  flex items-center gap-4 p-4 transition-colors
                  ${index % 2 === 0 ? "bg-background" : "bg-muted/30"}
                  ${field.isEdited ? "bg-primary/5" : ""}
                `}
                data-testid={`field-row-${field.id}`}
              >
                <div className="w-1/3 min-w-[140px]">
                  <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    {formatLabel(field.label)}
                  </span>
                </div>
                
                <div className="flex-1 flex items-center gap-3">
                  {editingId === field.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, field.id)}
                        className="flex-1"
                        autoFocus
                        data-testid={`input-edit-${field.id}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => saveEdit(field.id)}
                        data-testid={`button-save-${field.id}`}
                      >
                        <Check className="w-4 h-4 text-emerald-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={cancelEditing}
                        data-testid={`button-cancel-${field.id}`}
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span 
                        className={`flex-1 text-base ${field.isEdited ? "font-medium" : ""}`}
                        data-testid={`text-value-${field.id}`}
                      >
                        {field.value || <span className="text-muted-foreground italic">Empty</span>}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEditing(field)}
                        className="opacity-0 group-hover:opacity-100 hover:opacity-100"
                        style={{ opacity: 1 }}
                        data-testid={`button-edit-${field.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <ConfidenceBadge confidence={field.confidence} />
                  {field.isEdited && (
                    <span className="text-xs text-muted-foreground">(edited)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
