import { type WizardStep } from "@/stores/useUIStore";
import { FileAudio, SlidersHorizontal, Scissors, Tag, Download } from "lucide-react";

const steps: { step: WizardStep; label: string; icon: typeof FileAudio }[] = [
  { step: 1, label: "File", icon: FileAudio },
  { step: 2, label: "Normalize", icon: SlidersHorizontal },
  { step: 3, label: "Trim", icon: Scissors },
  { step: 4, label: "Metadata", icon: Tag },
  { step: 5, label: "Export", icon: Download },
];

interface StepSidebarProps {
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
}

export function StepSidebar({ currentStep, onStepClick }: StepSidebarProps) {
  return (
    <nav className="flex flex-col gap-1 w-20 border-r border-border p-2">
      {steps.map(({ step, label, icon: Icon }) => (
        <button
          key={step}
          data-active={currentStep === step}
          onClick={() => onStepClick(step)}
          className="flex flex-col items-center gap-1 rounded-md p-2 text-xs text-muted-foreground
            data-[active=true]:bg-accent data-[active=true]:text-accent-foreground
            hover:bg-muted transition-colors cursor-pointer"
        >
          <Icon className="h-5 w-5" />
          {label}
        </button>
      ))}
    </nav>
  );
}
