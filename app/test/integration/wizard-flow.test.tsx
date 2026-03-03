import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useUIStore } from "@/stores/ui-store";
import { useAudioStore } from "@/stores/audio-store";

// We can't easily render the full TanStack Router setup, so test the stores and
// step components together as an integrated whole.

describe("Wizard Flow Integration", () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState());
    useAudioStore.setState(useAudioStore.getInitialState());
  });

  describe("Initial state", () => {
    it("starts on step 1 with no file loaded", () => {
      const ui = useUIStore.getState();
      expect(ui.currentStep).toBe(1);
      expect(ui.fileLoaded).toBe(false);
    });

    it("audio store starts empty", () => {
      const audio = useAudioStore.getState();
      expect(audio.filePath).toBeNull();
      expect(audio.audioInfo).toBeNull();
      expect(audio.previewMode).toBeNull();
      expect(audio.deletedRegions).toEqual([]);
      expect(audio.detectedSilenceRegions).toEqual([]);
    });
  });

  describe("File load simulation", () => {
    it("loading a file updates both stores correctly", () => {
      const audioInfo = {
        duration: 120,
        sampleRate: 44100,
        channels: 2,
        format: "wav",
        peaks: [0.1, 0.2, 0.3],
      };

      useAudioStore.getState().setFile("/path/to/file.wav", audioInfo);
      useUIStore.getState().setFileLoaded(true);
      useUIStore.getState().setCurrentStep(2);

      expect(useAudioStore.getState().filePath).toBe("/path/to/file.wav");
      expect(useAudioStore.getState().audioInfo).toEqual(audioInfo);
      expect(useUIStore.getState().fileLoaded).toBe(true);
      expect(useUIStore.getState().currentStep).toBe(2);
    });
  });

  describe("Step navigation", () => {
    it("can navigate to all steps", () => {
      useUIStore.getState().setFileLoaded(true);

      for (const step of [1, 2, 3, 4, 5] as const) {
        useUIStore.getState().setCurrentStep(step);
        expect(useUIStore.getState().currentStep).toBe(step);
      }
    });
  });

  describe("Step sidebar rendering", () => {
    it("renders sidebar and allows step switching", async () => {
      const { StepSidebar } = await import(
        "@/components/wizard/step-sidebar"
      );
      const user = userEvent.setup();
      const onStepClick = vi.fn();

      render(<StepSidebar currentStep={1} onStepClick={onStepClick} />);

      // Click through steps
      await user.click(screen.getByText("Normalize"));
      expect(onStepClick).toHaveBeenCalledWith(2);

      await user.click(screen.getByText("Trim"));
      expect(onStepClick).toHaveBeenCalledWith(3);

      await user.click(screen.getByText("Metadata"));
      expect(onStepClick).toHaveBeenCalledWith(4);

      await user.click(screen.getByText("Export"));
      expect(onStepClick).toHaveBeenCalledWith(5);
    });
  });

  describe("Step components render", () => {
    it("FileSelectStep renders drop zone", async () => {
      const { FileSelectStep } = await import(
        "@/components/steps/file-select-step"
      );
      render(<FileSelectStep />);
      expect(screen.getByText(/drop an audio file/i)).toBeInTheDocument();
    });

    it("NormalizationStep renders both sections", async () => {
      const { NormalizationStep } = await import(
        "@/components/steps/normalization-step"
      );
      render(<NormalizationStep />);
      expect(screen.getByText("Compression")).toBeInTheDocument();
      expect(screen.getByText("Noise Reduction")).toBeInTheDocument();
    });

    it("TrimmingStep renders all sections", async () => {
      const { TrimmingStep } = await import(
        "@/components/steps/trimming-step"
      );
      render(<TrimmingStep />);
      expect(
        screen.getByRole("button", { name: /delete selection/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/silence detection/i)).toBeInTheDocument();
    });

    it("MetadataStep renders fields", async () => {
      const { MetadataStep } = await import(
        "@/components/steps/metadata-step"
      );
      render(<MetadataStep />);
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByText(/album art/i)).toBeInTheDocument();
    });

    it("ExportStep renders controls", async () => {
      const { ExportStep } = await import(
        "@/components/steps/export-step"
      );
      render(<ExportStep />);
      expect(
        screen.getByRole("button", { name: /cbr/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^export$/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Cross-step state", () => {
    it("clearing file resets all wizard state", () => {
      // Simulate a loaded file with edits
      useAudioStore.getState().setFile("/test.wav", {
        duration: 60,
        sampleRate: 44100,
        channels: 1,
        format: "wav",
        peaks: [0.1],
      });
      useUIStore.getState().setFileLoaded(true);
      useUIStore.getState().setCurrentStep(3);
      useAudioStore.getState().setCompressionApplied(true);
      useAudioStore.getState().setDetectedSilenceRegions([
        { start: 1, end: 2 },
      ]);

      // Clear
      useAudioStore.getState().clearFile();
      useUIStore.getState().setFileLoaded(false);
      useUIStore.getState().setCurrentStep(1);

      expect(useAudioStore.getState().filePath).toBeNull();
      expect(useAudioStore.getState().compressionApplied).toBe(false);
      expect(useAudioStore.getState().detectedSilenceRegions).toEqual([]);
      expect(useUIStore.getState().currentStep).toBe(1);
      expect(useUIStore.getState().fileLoaded).toBe(false);
    });
  });
});
