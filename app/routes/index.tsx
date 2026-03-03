import { createFileRoute } from "@tanstack/react-router";
import { WizardLayout } from "@/components/wizard/wizard-layout";
import { StepSidebar } from "@/components/wizard/step-sidebar";
import { WaveformEditor } from "@/components/waveform-editor";
import { AudioControls } from "@/components/audio-controls";
import { FileSelectStep } from "@/components/steps/file-select-step";
import { NormalizationStep } from "@/components/steps/normalization-step";
import { TrimmingStep } from "@/components/steps/trimming-step";
import { MetadataStep } from "@/components/steps/metadata-step";
import { ExportStep } from "@/components/steps/export-step";
import { useUIStore, type WizardStep } from "@/stores/ui-store";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

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
