import { describe, it, expect, beforeEach } from "vitest";
import { useAudioStore } from "../useAudioStore";

describe("Audio Store", () => {
  beforeEach(() => {
    useAudioStore.setState(useAudioStore.getInitialState());
  });

  it("initializes with default values", () => {
    const state = useAudioStore.getState();
    expect(state.filePath).toBeNull();
    expect(state.audioInfo).toBeNull();
    expect(state.previewMode).toBeNull();
    expect(state.detectedSilenceRegions).toEqual([]);
    expect(state.deletedRegions).toEqual([]);
    expect(state.compressionApplied).toBe(false);
    expect(state.noiseReductionApplied).toBe(false);
  });

  it("setPreviewMode updates the mode", () => {
    useAudioStore.getState().setPreviewMode("processed");
    expect(useAudioStore.getState().previewMode).toBe("processed");
    useAudioStore.getState().setPreviewMode("original");
    expect(useAudioStore.getState().previewMode).toBe("original");
    useAudioStore.getState().setPreviewMode(null);
    expect(useAudioStore.getState().previewMode).toBeNull();
  });

  it("setDetectedSilenceRegions stores regions", () => {
    const regions = [
      { start: 1.0, end: 2.0 },
      { start: 5.0, end: 6.5 },
    ];
    useAudioStore.getState().setDetectedSilenceRegions(regions);
    expect(useAudioStore.getState().detectedSilenceRegions).toEqual(regions);
  });

  it("addDeletedRegion appends to deletedRegions", () => {
    useAudioStore.getState().addDeletedRegion({ start: 1.0, end: 2.0 });
    useAudioStore.getState().addDeletedRegion({ start: 5.0, end: 6.5 });
    expect(useAudioStore.getState().deletedRegions).toEqual([
      { start: 1.0, end: 2.0 },
      { start: 5.0, end: 6.5 },
    ]);
  });

  it("setCompressionApplied updates state", () => {
    useAudioStore.getState().setCompressionApplied(true);
    expect(useAudioStore.getState().compressionApplied).toBe(true);
  });

  it("setNoiseReductionApplied updates state", () => {
    useAudioStore.getState().setNoiseReductionApplied(true);
    expect(useAudioStore.getState().noiseReductionApplied).toBe(true);
  });

  it("setFile resets deletedRegions", () => {
    useAudioStore.getState().addDeletedRegion({ start: 1, end: 2 });
    useAudioStore.getState().setFile("/test.wav", {
      duration: 10,
      sampleRate: 44100,
      channels: 2,
      format: "wav",
      peaks: [0.1, 0.2],
    });
    expect(useAudioStore.getState().deletedRegions).toEqual([]);
  });

  it("clearFile resets all fields to defaults", () => {
    // Set up dirty state across all fields
    useAudioStore.getState().setFile("/test.wav", {
      duration: 10,
      sampleRate: 44100,
      channels: 2,
      format: "wav",
      peaks: [0.1, 0.2],
    });
    useAudioStore.getState().setPreviewMode("processed");
    useAudioStore.getState().setDetectedSilenceRegions([{ start: 1, end: 2 }]);
    useAudioStore.getState().addDeletedRegion({ start: 3, end: 4 });
    useAudioStore.getState().setCompressionApplied(true);
    useAudioStore.getState().setNoiseReductionApplied(true);

    useAudioStore.getState().clearFile();

    const state = useAudioStore.getState();
    expect(state.filePath).toBeNull();
    expect(state.audioInfo).toBeNull();
    expect(state.previewMode).toBeNull();
    expect(state.detectedSilenceRegions).toEqual([]);
    expect(state.deletedRegions).toEqual([]);
    expect(state.compressionApplied).toBe(false);
    expect(state.noiseReductionApplied).toBe(false);
  });
});
