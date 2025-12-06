import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Scale, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Rule, RuleCondition, RuleOperator, FieldDefinition } from "@shared/schema";
import { ruleOperators } from "@shared/schema";

const operatorLabels: Record<RuleOperator, string> = {
  greaterThan: "> Greater than",
  lessThan: "< Less than",
  equals: "= Equals",
  notEquals: "!= Not equals",
  contains: "Contains",
  notContains: "Not contains",
  greaterThanOrEqual: ">= Greater or equal",
  lessThanOrEqual: "<= Less or equal",
};

function ConditionBuilder({
  condition,
  index,
  fieldOptions,
  onChange,
  onRemove,
}: {
  condition: RuleCondition;
  index: number;
  fieldOptions: string[];
  onChange: (condition: RuleCondition) => void;
  onRemove: () => void;
}) {
  const [localValue, setLocalValue] = useState(condition.value);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(condition.value);
  }, [condition.value]);

  const handleValueChange = useCallback((newValue: string) => {
    setLocalValue(newValue);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onChange({ ...condition, value: newValue });
    }, 500);
  }, [onChange, condition]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30" data-testid={`condition-${index}`}>
      <Select
        value={condition.field}
        onValueChange={(value) => onChange({ ...condition, field: value })}
      >
        <SelectTrigger className="w-[140px]" data-testid={`select-condition-field-${index}`}>
          <SelectValue placeholder="Field" />
        </SelectTrigger>
        <SelectContent>
          {fieldOptions.map((field) => (
            <SelectItem key={field} value={field}>
              {field}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Select
        value={condition.operator}
        onValueChange={(value) => onChange({ ...condition, operator: value as RuleOperator })}
      >
        <SelectTrigger className="w-[160px]" data-testid={`select-condition-operator-${index}`}>
          <SelectValue placeholder="Operator" />
        </SelectTrigger>
        <SelectContent>
          {ruleOperators.map((op) => (
            <SelectItem key={op} value={op}>
              {operatorLabels[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Input
        placeholder="Value"
        value={localValue}
        onChange={(e) => handleValueChange(e.target.value)}
        className="flex-1"
        data-testid={`input-condition-value-${index}`}
      />
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        data-testid={`button-remove-condition-${index}`}
      >
        <Trash2 className="w-4 h-4 text-muted-foreground" />
      </Button>
    </div>
  );
}

function RuleItem({
  rule,
  fieldOptions,
  onUpdate,
  onDelete,
}: {
  rule: Rule;
  fieldOptions: string[];
  onUpdate: (updates: Partial<Rule>) => void;
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-md overflow-visible" data-testid={`rule-item-${rule.id}`}>
        <div className="flex items-center gap-3 p-3">
          <Switch
            checked={rule.enabled}
            onCheckedChange={(checked) => onUpdate({ enabled: checked })}
            data-testid={`switch-rule-${rule.id}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{rule.name}</p>
              <Badge variant={rule.action === "fail" ? "destructive" : "secondary"} className="text-xs">
                {rule.action === "fail" ? "Fail if matched" : "Pass if matched"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""} ({rule.logic})
            </p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-expand-rule-${rule.id}`}>
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            data-testid={`button-delete-rule-${rule.id}`}
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
        
        <CollapsibleContent>
          <Separator />
          <div className="p-3 space-y-3">
            <p className="text-xs text-muted-foreground">{rule.description}</p>
            
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Logic:</Label>
                <Select
                  value={rule.logic}
                  onValueChange={(value) => onUpdate({ logic: value as "all" | "any" })}
                >
                  <SelectTrigger className="w-[100px]" data-testid={`select-rule-logic-${rule.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All (AND)</SelectItem>
                    <SelectItem value="any">Any (OR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Label className="text-xs">Action:</Label>
                <Select
                  value={rule.action}
                  onValueChange={(value) => onUpdate({ action: value as "fail" | "pass" })}
                >
                  <SelectTrigger className="w-[120px]" data-testid={`select-rule-action-${rule.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fail">Fail claim</SelectItem>
                    <SelectItem value="pass">Pass claim</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              {rule.conditions.map((condition, idx) => (
                <ConditionBuilder
                  key={idx}
                  condition={condition}
                  index={idx}
                  fieldOptions={fieldOptions}
                  onChange={(updated) => {
                    const newConditions = [...rule.conditions];
                    newConditions[idx] = updated;
                    onUpdate({ conditions: newConditions });
                  }}
                  onRemove={() => {
                    const newConditions = rule.conditions.filter((_, i) => i !== idx);
                    onUpdate({ conditions: newConditions });
                  }}
                />
              ))}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newCondition: RuleCondition = {
                    field: fieldOptions[0] || "claimAmount",
                    operator: "greaterThan",
                    value: "",
                  };
                  onUpdate({ conditions: [...rule.conditions, newCondition] });
                }}
                data-testid={`button-add-condition-${rule.id}`}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Condition
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function RulesDialog() {
  const [open, setOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleDescription, setNewRuleDescription] = useState("");
  const { toast } = useToast();

  const { data: rules = [], isLoading: rulesLoading } = useQuery<Rule[]>({
    queryKey: ["/api/rules"],
    enabled: open,
  });

  const { data: fieldDefs = [] } = useQuery<FieldDefinition[]>({
    queryKey: ["/api/fields"],
    enabled: open,
  });

  const fieldOptions = fieldDefs.filter(f => f.enabled).map(f => f.name);

  const createRuleMutation = useMutation({
    mutationFn: async (rule: Omit<Rule, "id">) => {
      const res = await apiRequest("POST", "/api/rules", rule);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      setNewRuleName("");
      setNewRuleDescription("");
      toast({ title: "Rule created", description: "New validation rule added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create rule.", variant: "destructive" });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Rule> }) => {
      const res = await apiRequest("PATCH", `/api/rules/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update rule.", variant: "destructive" });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      toast({ title: "Rule deleted", description: "Validation rule removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete rule.", variant: "destructive" });
    },
  });

  const validateConditions = (conditions: RuleCondition[]): boolean => {
    if (conditions.length === 0) {
      toast({ title: "Invalid Rule", description: "Rule must have at least one condition.", variant: "destructive" });
      return false;
    }
    for (const cond of conditions) {
      if (!cond.field || !cond.operator || !cond.value.trim()) {
        toast({ title: "Invalid Condition", description: "All conditions must have field, operator, and value.", variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const handleAddRule = () => {
    if (!newRuleName.trim()) {
      toast({ title: "Required", description: "Rule name is required.", variant: "destructive" });
      return;
    }

    const defaultCondition: RuleCondition = {
      field: fieldOptions[0] || "claimAmount",
      operator: "greaterThan",
      value: "10000",
    };

    createRuleMutation.mutate({
      name: newRuleName.trim(),
      description: newRuleDescription.trim() || "Custom validation rule",
      conditions: [defaultCondition],
      logic: "all",
      action: "fail",
      enabled: true,
    });
  };

  const handleUpdateRule = (id: string, updates: Partial<Rule>) => {
    if (updates.conditions && !validateConditions(updates.conditions)) {
      return;
    }
    updateRuleMutation.mutate({ id, updates });
  };

  const enabledCount = rules.filter(r => r.enabled).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-rules">
          <Scale className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[650px]" data-testid="dialog-rules">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5" />
            Validation Rules
          </DialogTitle>
          <DialogDescription>
            Define rules to automatically validate extracted claim data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">
              {enabledCount} of {rules.length} rules enabled
            </span>
          </div>

          <Separator />

          <ScrollArea className="h-[300px] pr-4">
            {rulesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Scale className="w-10 h-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No validation rules defined yet.</p>
                <p className="text-xs text-muted-foreground">Add a rule to start validating claims.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <RuleItem
                    key={rule.id}
                    rule={rule}
                    fieldOptions={fieldOptions}
                    onUpdate={(updates) => handleUpdateRule(rule.id, updates)}
                    onDelete={() => deleteRuleMutation.mutate(rule.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium">Add New Rule</Label>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Rule name (e.g., High Value Claim)"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                className="flex-1 min-w-[200px]"
                data-testid="input-new-rule-name"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="Description (optional)"
                value={newRuleDescription}
                onChange={(e) => setNewRuleDescription(e.target.value)}
                className="flex-1 min-w-[200px]"
                data-testid="input-new-rule-description"
              />
              <Button
                onClick={handleAddRule}
                disabled={createRuleMutation.isPending}
                data-testid="button-add-rule"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
