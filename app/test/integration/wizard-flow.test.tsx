import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useUIStore } from "@/stores/ui-store";
import { useAudioStore, type AudioInfo } from "@/stores/audio-store";

// We can't easily render the full TanStack Router setup, so test the stores and
// step components together as an integrated whole.

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const sampleAudioInfo: AudioInfo = {
  duration: 120,
  sampleRate: 44100,
  channels: 2,
  format: "wav",
  peaks: [0.1, 0.2, 0.3],
};

/** Simulate the full file-load flow that FileSelectStep.handleBrowse performs:
 *  set the file in audio store, mark loaded in UI store, advance to step 2. */
function simulateFileLoad(path = "/path/to/episode.wav", info: AudioInfo = sampleAudioInfo) {
  useAudioStore.getState().setFile(path, info);
  useUIStore.getState().setFileLoaded(true);
  useUIStore.getState().setCurrentStep(2);
}

describe("Wizard Flow Integration", () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState());
    useAudioStore.setState(useAudioStore.getInitialState());
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Cross-store consistency after file load
  // -------------------------------------------------------------------------
  describe("Cross-store consistency on file load", () => {
    it("loading a file updates both stores atomically", () => {
      simulateFileLoad("/recordings/interview.wav");

      expect(useAudioStore.getState().filePath).toBe("/recordings/interview.wav");
      expect(useAudioStore.getState().audioInfo).toEqual(sampleAudioInfo);
      expect(useUIStore.getState().fileLoaded).toBe(true);
      expect(useUIStore.getState().currentStep).toBe(2);
    });

    it("fileLoaded in UI store always reflects whether audio store has a file", () => {
      // No file yet — both should agree
      expect(useUIStore.getState().fileLoaded).toBe(false);
      expect(useAudioStore.getState().filePath).toBeNull();

      // Load a file
      simulateFileLoad();
      expect(useUIStore.getState().fileLoaded).toBe(true);
      expect(useAudioStore.getState().filePath).not.toBeNull();

      // Clear the file
      useAudioStore.getState().clearFile();
      useUIStore.getState().setFileLoaded(false);
      expect(useUIStore.getState().fileLoaded).toBe(false);
      expect(useAudioStore.getState().filePath).toBeNull();
    });

    it("loading a new file resets audio editing state but keeps UI step", () => {
      // Set up some editing state
      simulateFileLoad();
      useAudioStore.getState().setCompressionApplied(true);
      useAudioStore.getState().addDeletedRegion({ start: 5, end: 10 });
      useAudioStore.getState().setSelectedRegion({ start: 20, end: 30 });
      useUIStore.getState().setCurrentStep(4);

      // Load a completely different file via setFile (which resets editing state)
      useAudioStore.getState().setFile("/recordings/new-episode.wav", {
        ...sampleAudioInfo,
        duration: 300,
      });

      // Audio editing state should be reset by setFile
      expect(useAudioStore.getState().filePath).toBe("/recordings/new-episode.wav");
      expect(useAudioStore.getState().compressionApplied).toBe(false);
      expect(useAudioStore.getState().deletedRegions).toEqual([]);
      expect(useAudioStore.getState().selectedRegion).toBeNull();
      // UI step is unchanged — the caller controls this
      expect(useUIStore.getState().currentStep).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // Step navigation
  // -------------------------------------------------------------------------
  describe("Step navigation", () => {
    it("can navigate to all steps", () => {
      useUIStore.getState().setFileLoaded(true);

      for (const step of [1, 2, 3, 4, 5] as const) {
        useUIStore.getState().setCurrentStep(step);
        expect(useUIStore.getState().currentStep).toBe(step);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Sidebar rendering + click callbacks
  // -------------------------------------------------------------------------
  describe("Step sidebar rendering", () => {
    it("renders sidebar and allows step switching", async () => {
      const { StepSidebar } = await import("@/components/wizard/step-sidebar");
      const user = userEvent.setup();
      const onStepClick = vi.fn();

      render(<StepSidebar currentStep={1} onStepClick={onStepClick} />);

      await user.click(screen.getByText("Normalize"));
      expect(onStepClick).toHaveBeenCalledWith(2);

      await user.click(screen.getByText("Trim"));
      expect(onStepClick).toHaveBeenCalledWith(3);

      await user.click(screen.getByText("Metadata"));
      expect(onStepClick).toHaveBeenCalledWith(4);

      await user.click(screen.getByText("Export"));
      expect(onStepClick).toHaveBeenCalledWith(5);
    });

    it("marks the current step as active via data attribute", async () => {
      const { StepSidebar } = await import("@/components/wizard/step-sidebar");

      const { rerender } = render(<StepSidebar currentStep={3} onStepClick={() => {}} />);

      // The "Trim" button (step 3) should be active
      expect(screen.getByText("Trim").closest("button")).toHaveAttribute("data-active", "true");
      // "Normalize" (step 2) should not
      expect(screen.getByText("Normalize").closest("button")).toHaveAttribute(
        "data-active",
        "false",
      );

      // Re-render at step 5 — "Export" becomes active
      rerender(<StepSidebar currentStep={5} onStepClick={() => {}} />);
      expect(screen.getByText("Export").closest("button")).toHaveAttribute("data-active", "true");
      expect(screen.getByText("Trim").closest("button")).toHaveAttribute("data-active", "false");
    });
  });

  // -------------------------------------------------------------------------
  // Step switching preserves form state across store
  // -------------------------------------------------------------------------
  describe("Step switching preserves form state", () => {
    it("metadata typed in store survives a round-trip through other steps", () => {
      simulateFileLoad();

      // User navigates to metadata step and fills in fields
      useUIStore.getState().setCurrentStep(4);
      useAudioStore.getState().setMetadata({
        title: "My Great Podcast",
        artist: "Jane Doe",
        year: "2026",
      });

      // Navigate away to trimming
      useUIStore.getState().setCurrentStep(3);
      expect(useUIStore.getState().currentStep).toBe(3);

      // Navigate back to metadata
      useUIStore.getState().setCurrentStep(4);

      // Store-level metadata must be preserved
      const { metadata } = useAudioStore.getState();
      expect(metadata.title).toBe("My Great Podcast");
      expect(metadata.artist).toBe("Jane Doe");
      expect(metadata.year).toBe("2026");
    });

    it("compression applied flag persists when visiting other steps", () => {
      simulateFileLoad();

      // Apply compression on step 2
      useUIStore.getState().setCurrentStep(2);
      useAudioStore.getState().setCompressionApplied(true);

      // Visit every other step
      for (const step of [3, 4, 5, 1] as const) {
        useUIStore.getState().setCurrentStep(step);
      }

      // Come back to step 2
      useUIStore.getState().setCurrentStep(2);
      expect(useAudioStore.getState().compressionApplied).toBe(true);
    });

    it("deleted regions accumulate across step visits", () => {
      simulateFileLoad();

      // Step 3: trim
      useUIStore.getState().setCurrentStep(3);
      useAudioStore.getState().addDeletedRegion({ start: 0, end: 2 });

      // Visit metadata
      useUIStore.getState().setCurrentStep(4);

      // Come back and trim more
      useUIStore.getState().setCurrentStep(3);
      useAudioStore.getState().addDeletedRegion({ start: 30, end: 35 });

      expect(useAudioStore.getState().deletedRegions).toEqual([
        { start: 0, end: 2 },
        { start: 30, end: 35 },
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // Metadata form renders from store and syncs back
  // -------------------------------------------------------------------------
  describe("MetadataStep form integration", () => {
    it("renders form fields populated from the store and typing updates local state", async () => {
      const { MetadataStep } = await import("@/components/steps/metadata-step");
      const user = userEvent.setup();

      // Pre-populate metadata in the store (as if read from file tags)
      useAudioStore.getState().setMetadata({
        title: "Episode One",
        artist: "Alice",
      });

      render(<MetadataStep />);

      // The input should reflect the store value
      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
      expect(titleInput.value).toBe("Episode One");

      // Type additional text
      await user.clear(titleInput);
      await user.type(titleInput, "Episode Two");
      expect(titleInput.value).toBe("Episode Two");
    });

    it("re-mount after step switch shows metadata from the store", async () => {
      const { MetadataStep } = await import("@/components/steps/metadata-step");

      // Simulate: user typed metadata and it was saved to store
      useAudioStore.getState().setMetadata({
        title: "Persisted Title",
        genre: "Technology",
      });

      // First mount (as if we're on step 4)
      const { unmount } = render(<MetadataStep />);
      expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe("Persisted Title");

      // Unmount (navigate away)
      unmount();

      // Re-mount (navigate back)
      render(<MetadataStep />);
      expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe("Persisted Title");
      expect((screen.getByLabelText(/genre/i) as HTMLInputElement).value).toBe("Technology");
    });
  });

  // -------------------------------------------------------------------------
  // Keyboard shortcuts within the wizard context
  // -------------------------------------------------------------------------
  describe("Keyboard shortcuts", () => {
    it("Ctrl+= zooms in and Ctrl+- zooms out", async () => {
      // Render a simple component that registers shortcuts
      const { useKeyboardShortcuts } = await import("@/hooks/use-keyboard-shortcuts");
      function ShortcutHost() {
        useKeyboardShortcuts();
        return <div data-testid="host" />;
      }

      render(<ShortcutHost />);

      const initialZoom = useUIStore.getState().zoom;
      expect(initialZoom).toBe(1);

      // Ctrl+=  (zoom in)
      await userEvent.keyboard("{Control>}={/Control}");
      const zoomedIn = useUIStore.getState().zoom;
      expect(zoomedIn).toBeGreaterThan(initialZoom);

      // Ctrl+-  (zoom out)
      await userEvent.keyboard("{Control>}-{/Control}");
      const zoomedOut = useUIStore.getState().zoom;
      expect(zoomedOut).toBeLessThan(zoomedIn);
    });

    it("Escape resets playback position and stops playing", async () => {
      const { useKeyboardShortcuts } = await import("@/hooks/use-keyboard-shortcuts");
      function ShortcutHost() {
        useKeyboardShortcuts();
        return <div data-testid="host" />;
      }

      // Simulate mid-playback state
      useAudioStore.getState().setPlaying(true);
      useAudioStore.getState().setPlaybackPosition(45);

      render(<ShortcutHost />);

      await userEvent.keyboard("{Escape}");

      expect(useAudioStore.getState().isPlaying).toBe(false);
      expect(useAudioStore.getState().playbackPosition).toBe(0);
    });

    it("Space does not toggle play when an input is focused", async () => {
      const { useKeyboardShortcuts } = await import("@/hooks/use-keyboard-shortcuts");
      function ShortcutHost() {
        useKeyboardShortcuts();
        return <input data-testid="text-input" />;
      }

      render(<ShortcutHost />);

      const input = screen.getByTestId("text-input");
      input.focus();

      // Space should type into the input, not toggle play
      await userEvent.keyboard(" ");
      expect(useAudioStore.getState().isPlaying).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // FileSelectStep shows drop zone when no file is loaded
  // -------------------------------------------------------------------------
  describe("FileSelectStep gating", () => {
    it("shows drop zone when no file is loaded", async () => {
      const { FileSelectStep } = await import("@/components/steps/file-select-step");
      render(<FileSelectStep />);
      expect(screen.getByText(/drop an audio file/i)).toBeInTheDocument();
    });

    it("shows file info when a file is loaded in the store", async () => {
      const { FileSelectStep } = await import("@/components/steps/file-select-step");

      simulateFileLoad("/recordings/interview.wav");

      render(<FileSelectStep />);
      // Should show the filename, not the drop zone
      expect(screen.getByText("interview.wav")).toBeInTheDocument();
      expect(screen.queryByText(/drop an audio file/i)).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Zoom state boundaries
  // -------------------------------------------------------------------------
  describe("Zoom boundaries", () => {
    it("zoom cannot go below 1", () => {
      useUIStore.getState().setZoom(1);
      useUIStore.getState().zoomOut();
      expect(useUIStore.getState().zoom).toBe(1);
    });

    it("zoom cannot exceed 500", () => {
      useUIStore.getState().setZoom(500);
      useUIStore.getState().zoomIn();
      expect(useUIStore.getState().zoom).toBe(500);
    });

    it("zoom in then zoom out returns close to original value", () => {
      useUIStore.getState().setZoom(10);
      useUIStore.getState().zoomIn();
      useUIStore.getState().zoomOut();
      // 10 * 1.25 / 1.25 === 10
      expect(useUIStore.getState().zoom).toBeCloseTo(10);
    });
  });

  // -------------------------------------------------------------------------
  // Clearing file resets all state
  // -------------------------------------------------------------------------
  describe("Cross-step state reset", () => {
    it("clearing file resets all wizard state", () => {
      simulateFileLoad();
      useUIStore.getState().setCurrentStep(3);
      useAudioStore.getState().setCompressionApplied(true);
      useAudioStore.getState().setNoiseReductionApplied(true);
      useAudioStore.getState().setDetectedSilenceRegions([{ start: 1, end: 2 }]);
      useAudioStore.getState().addDeletedRegion({ start: 5, end: 10 });
      useAudioStore.getState().setMetadata({ title: "Will be cleared" });
      useUIStore.getState().setZoom(50);

      // Clear
      useAudioStore.getState().clearFile();
      useUIStore.getState().setFileLoaded(false);
      useUIStore.getState().setCurrentStep(1);

      // Audio store fully reset
      expect(useAudioStore.getState().filePath).toBeNull();
      expect(useAudioStore.getState().audioInfo).toBeNull();
      expect(useAudioStore.getState().compressionApplied).toBe(false);
      expect(useAudioStore.getState().noiseReductionApplied).toBe(false);
      expect(useAudioStore.getState().detectedSilenceRegions).toEqual([]);
      expect(useAudioStore.getState().deletedRegions).toEqual([]);
      expect(useAudioStore.getState().metadata.title).toBe("");

      // UI store reset
      expect(useUIStore.getState().currentStep).toBe(1);
      expect(useUIStore.getState().fileLoaded).toBe(false);
      // Note: zoom is not reset by clearFile — it's a UI preference, not file state
      expect(useUIStore.getState().zoom).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // Full multi-step workflow simulation
  // -------------------------------------------------------------------------
  describe("End-to-end workflow simulation", () => {
    it("walks through the full wizard: load -> normalize -> trim -> metadata -> export", () => {
      // Step 1: Load file
      expect(useUIStore.getState().currentStep).toBe(1);
      simulateFileLoad("/podcast/raw-recording.wav", {
        duration: 3600,
        sampleRate: 48000,
        channels: 1,
        format: "wav",
        peaks: [0.05, 0.1, 0.15, 0.2],
      });
      expect(useUIStore.getState().currentStep).toBe(2);

      // Step 2: Normalize — apply compression
      useAudioStore.getState().setCompressionApplied(true);
      useAudioStore.getState().setNoiseReductionApplied(true);

      // Step 3: Trim — remove intro silence and an "um"
      useUIStore.getState().setCurrentStep(3);
      useAudioStore.getState().addDeletedRegion({ start: 0, end: 3.5 });
      useAudioStore.getState().addDeletedRegion({ start: 120.2, end: 121.8 });
      expect(useAudioStore.getState().deletedRegions).toHaveLength(2);

      // Step 4: Metadata
      useUIStore.getState().setCurrentStep(4);
      useAudioStore.getState().setMetadata({
        title: "Deep Dive: Testing",
        artist: "Provcast Team",
        genre: "Technology",
        year: "2026",
      });

      // Step 5: Export (just verify we can get there with all state intact)
      useUIStore.getState().setCurrentStep(5);

      // Verify everything accumulated correctly
      const audio = useAudioStore.getState();
      const ui = useUIStore.getState();

      expect(ui.currentStep).toBe(5);
      expect(ui.fileLoaded).toBe(true);
      expect(audio.filePath).toBe("/podcast/raw-recording.wav");
      expect(audio.compressionApplied).toBe(true);
      expect(audio.noiseReductionApplied).toBe(true);
      expect(audio.deletedRegions).toHaveLength(2);
      expect(audio.metadata.title).toBe("Deep Dive: Testing");
      expect(audio.metadata.artist).toBe("Provcast Team");
      expect(audio.metadata.year).toBe("2026");
    });
  });
});
