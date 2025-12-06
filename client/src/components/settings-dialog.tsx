import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, Plus, Trash2, RotateCcw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { FieldDefinition } from "@shared/schema";

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldDescription, setNewFieldDescription] = useState("");
  const { toast } = useToast();

  const { data: fields = [], isLoading } = useQuery<FieldDefinition[]>({
    queryKey: ["/api/fields"],
    enabled: open,
  });

  const createFieldMutation = useMutation({
    mutationFn: async (field: { name: string; description: string }) => {
      const res = await apiRequest("POST", "/api/fields", field);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fields"] });
      setNewFieldName("");
      setNewFieldDescription("");
      toast({ title: "Field added", description: "New extraction field created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add field.", variant: "destructive" });
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FieldDefinition> }) => {
      const res = await apiRequest("PATCH", `/api/fields/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fields"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update field.", variant: "destructive" });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/fields/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fields"] });
      toast({ title: "Field removed", description: "Extraction field deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete field.", variant: "destructive" });
    },
  });

  const resetFieldsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fields/reset");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fields"] });
      toast({ title: "Fields reset", description: "Restored default extraction fields." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reset fields.", variant: "destructive" });
    },
  });

  const handleAddField = () => {
    if (!newFieldName.trim() || !newFieldDescription.trim()) {
      toast({ title: "Required", description: "Both name and description are required.", variant: "destructive" });
      return;
    }
    createFieldMutation.mutate({ name: newFieldName.trim(), description: newFieldDescription.trim() });
  };

  const handleToggleField = (id: string, enabled: boolean) => {
    updateFieldMutation.mutate({ id, updates: { enabled } });
  };

  const enabledCount = fields.filter(f => f.enabled).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-settings">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[550px]" data-testid="dialog-settings">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Extraction Fields
          </DialogTitle>
          <DialogDescription>
            Configure which fields the AI extracts from your documents.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {enabledCount} of {fields.length} fields enabled
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetFieldsMutation.mutate()}
              disabled={resetFieldsMutation.isPending}
              data-testid="button-reset-fields"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Defaults
            </Button>
          </div>

          <Separator />

          <ScrollArea className="h-[280px] pr-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-3 p-3 rounded-md bg-muted/30"
                    data-testid={`field-item-${field.id}`}
                  >
                    <Switch
                      checked={field.enabled}
                      onCheckedChange={(checked) => handleToggleField(field.id, checked)}
                      data-testid={`switch-field-${field.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{field.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{field.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteFieldMutation.mutate(field.id)}
                      disabled={deleteFieldMutation.isPending}
                      data-testid={`button-delete-field-${field.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium">Add New Field</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Field name (e.g., witnessName)"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                className="flex-1"
                data-testid="input-new-field-name"
              />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Description (e.g., Name of witness)"
                value={newFieldDescription}
                onChange={(e) => setNewFieldDescription(e.target.value)}
                className="flex-1"
                data-testid="input-new-field-description"
              />
              <Button
                onClick={handleAddField}
                disabled={createFieldMutation.isPending}
                data-testid="button-add-field"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
