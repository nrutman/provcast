import { describe, it, expect, beforeEach } from "vitest";
import { useAudioStore } from "../audio-store";

describe("Audio Store", () => {
  beforeEach(() => {
    useAudioStore.setState(useAudioStore.getInitialState());
  });

  it("initializes with no file", () => {
    const state = useAudioStore.getState();
    expect(state.filePath).toBeNull();
    expect(state.audioInfo).toBeNull();
  });

  it("initializes preview mode as null", () => {
    expect(useAudioStore.getState().previewMode).toBeNull();
  });

  it("initializes with empty silence regions", () => {
    expect(useAudioStore.getState().detectedSilenceRegions).toEqual([]);
  });

  it("initializes compression and noise reduction as not applied", () => {
    const state = useAudioStore.getState();
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

  it("setCompressionApplied updates state", () => {
    useAudioStore.getState().setCompressionApplied(true);
    expect(useAudioStore.getState().compressionApplied).toBe(true);
  });

  it("setNoiseReductionApplied updates state", () => {
    useAudioStore.getState().setNoiseReductionApplied(true);
    expect(useAudioStore.getState().noiseReductionApplied).toBe(true);
  });

  it("clearFile resets new fields too", () => {
    useAudioStore.getState().setPreviewMode("processed");
    useAudioStore.getState().setDetectedSilenceRegions([{ start: 1, end: 2 }]);
    useAudioStore.getState().setCompressionApplied(true);
    useAudioStore.getState().setNoiseReductionApplied(true);
    useAudioStore.getState().clearFile();
    const state = useAudioStore.getState();
    expect(state.previewMode).toBeNull();
    expect(state.detectedSilenceRegions).toEqual([]);
    expect(state.compressionApplied).toBe(false);
    expect(state.noiseReductionApplied).toBe(false);
  });
});
