import { Check, Info, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ConfidenceLevel } from "@shared/schema";

interface ConfidenceBadgeProps {
  confidence: ConfidenceLevel;
  className?: string;
}

const confidenceConfig = {
  high: {
    label: "High",
    icon: Check,
    variant: "default" as const,
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  medium: {
    label: "Medium",
    icon: Info,
    variant: "secondary" as const,
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  low: {
    label: "Low",
    icon: AlertTriangle,
    variant: "destructive" as const,
    className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  },
};

export function ConfidenceBadge({ confidence, className = "" }: ConfidenceBadgeProps) {
  const config = confidenceConfig[confidence];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`gap-1 text-xs font-medium border ${config.className} ${className}`}
      data-testid={`badge-confidence-${confidence}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}
