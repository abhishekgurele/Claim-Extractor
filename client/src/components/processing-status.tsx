import { Check, Upload, Brain, FileCheck, Download, Loader2 } from "lucide-react";
import type { ProcessingStatus } from "@shared/schema";

interface ProcessingStatusBarProps {
  status: ProcessingStatus;
  progress?: number;
}

const steps = [
  { key: "uploading", label: "Upload", icon: Upload },
  { key: "processing", label: "AI Processing", icon: Brain },
  { key: "completed", label: "Review", icon: FileCheck },
] as const;

export function ProcessingStatusBar({ status, progress }: ProcessingStatusBarProps) {
  const getCurrentStepIndex = () => {
    switch (status) {
      case "idle":
        return -1;
      case "uploading":
        return 0;
      case "processing":
        return 1;
      case "completed":
        return 3;
      case "error":
        return -1;
      default:
        return -1;
    }
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <div className="w-full" data-testid="processing-status-bar">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentIndex > index;
          const isCurrent = currentIndex === index;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`
                    relative flex items-center justify-center w-10 h-10 rounded-full
                    transition-all duration-300
                    ${isCompleted 
                      ? "bg-primary text-primary-foreground" 
                      : isCurrent 
                        ? "bg-primary/20 text-primary border-2 border-primary" 
                        : "bg-muted text-muted-foreground"
                    }
                  `}
                  data-testid={`step-indicator-${step.key}`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : isCurrent && status !== "error" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span 
                  className={`
                    text-xs font-medium
                    ${isCompleted || isCurrent ? "text-foreground" : "text-muted-foreground"}
                  `}
                >
                  {step.label}
                </span>
              </div>
              
              {index < steps.length - 1 && (
                <div className="flex-1 mx-4">
                  <div className="h-0.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`
                        h-full bg-primary transition-all duration-500
                        ${isCompleted ? "w-full" : isCurrent ? "w-1/2" : "w-0"}
                      `}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {status === "processing" && progress !== undefined && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Extracting fields...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
              data-testid="progress-bar"
            />
          </div>
        </div>
      )}
    </div>
  );
}
