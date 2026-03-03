import { createFileRoute } from "@tanstack/react-router";
import { WizardLayout } from "@/components/wizard/WizardLayout";
import { StepSidebar } from "@/components/wizard/StepSidebar";
import { WaveformEditor } from "@/components/WaveformEditor";
import { AudioControls } from "@/components/AudioControls";
import { FileSelectStep } from "@/components/steps/FileSelectStep";
import { NormalizationStep } from "@/components/steps/NormalizationStep";
import { TrimmingStep } from "@/components/steps/TrimmingStep";
import { MetadataStep } from "@/components/steps/MetadataStep";
import { ExportStep } from "@/components/steps/ExportStep";
import { useUIStore, type WizardStep } from "@/stores/useUIStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export const Route = createFileRoute("/")({
  component: EditorView,
});

const stepComponents: Record<WizardStep, () => React.JSX.Element> = {
  1: FileSelectStep,
  2: NormalizationStep,
  3: TrimmingStep,
  4: MetadataStep,
  5: ExportStep,
};

function EditorView() {
  useKeyboardShortcuts();

  const currentStep = useUIStore((s) => s.currentStep);
  const setCurrentStep = useUIStore((s) => s.setCurrentStep);
  const fileLoaded = useUIStore((s) => s.fileLoaded);

  const StepContent = stepComponents[currentStep];

  return (
    <WizardLayout
      waveform={fileLoaded ? <WaveformEditor /> : <div className="flex-1" />}
      controls={fileLoaded ? <AudioControls /> : <div />}
    >
      {fileLoaded ? (
        <div className="flex h-full">
          <StepSidebar currentStep={currentStep} onStepClick={setCurrentStep} />
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <StepContent />
          </div>
        </div>
      ) : (
        <FileSelectStep />
      )}
    </WizardLayout>
  );
}
