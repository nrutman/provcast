import { describe, it, expect, beforeEach, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useAudioStore, type AudioInfo } from "@/stores/useAudioStore";
import { loadAudio, playAudio, pauseAudio, stopAudio, seekAudio } from "../tauri/playback";
import { deleteRegion, undoEdit, redoEdit } from "../tauri/editing";
import {
  applyCompression,
  applyNoiseReduction,
  detectSilence,
  trimSilence,
  findQuietestRegion,
  previewEffect,
  stopPreview,
} from "../tauri/processing";
import { readMetadata, updateMetadata, setAlbumArt } from "../tauri/metadata";
import { estimateExportSize, exportMp3, previewExport } from "../tauri/export";

// ---------- helpers ----------

function mockAudioInfo(overrides?: Partial<AudioInfo>): AudioInfo {
  return {
    duration: 120,
    sampleRate: 44100,
    channels: 2,
    format: "mp3",
    peaks: [0.1, 0.2, 0.3, 0.4],
    ...overrides,
  };
}

function mockUpdatedPeaks(overrides?: Record<string, unknown>) {
  return {
    peaks: [0.5, 0.6, 0.7],
    edit_count: 1,
    undo_count: 1,
    redo_count: 0,
    duration: 110,
    ...overrides,
  };
}

/** Seed the store with a loaded file so applyUpdatedPeaks can do its work. */
function seedStore() {
  const info = mockAudioInfo();
  useAudioStore.getState().setFile("/test/file.mp3", info);
}

// ---------- setup ----------

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  // Reset the store to its initial state between tests
  useAudioStore.getState().clearFile();
});

// ---------- loadAudio ----------

describe("loadAudio", () => {
  it("calls invoke with load_audio command and path", async () => {
    const info = mockAudioInfo();
    vi.mocked(invoke).mockResolvedValue(info);

    const result = await loadAudio("/path/to/episode.mp3");

    expect(invoke).toHaveBeenCalledWith("load_audio", { path: "/path/to/episode.mp3" });
    expect(result).toEqual(info);
  });

  it("propagates errors from invoke", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("File not found"));

    await expect(loadAudio("/nonexistent.mp3")).rejects.toThrow("File not found");
  });
});

// ---------- playAudio ----------

describe("playAudio", () => {
  it("calls invoke with play_audio and fromPosition", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await playAudio(5.5);

    expect(invoke).toHaveBeenCalledWith("play_audio", {
      fromPosition: 5.5,
      usePreview: false,
    });
  });

  it("passes usePreview when provided", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await playAudio(0, true);

    expect(invoke).toHaveBeenCalledWith("play_audio", {
      fromPosition: 0,
      usePreview: true,
    });
  });

  it("defaults usePreview to false when omitted", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await playAudio(10);

    expect(invoke).toHaveBeenCalledWith("play_audio", {
      fromPosition: 10,
      usePreview: false,
    });
  });

  it("propagates errors from invoke", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("Playback failed"));

    await expect(playAudio(0)).rejects.toThrow("Playback failed");
  });
});

// ---------- pauseAudio ----------

describe("pauseAudio", () => {
  it("calls invoke with pause_audio and no params", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await pauseAudio();

    expect(invoke).toHaveBeenCalledWith("pause_audio");
  });

  it("propagates errors from invoke", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("Nothing playing"));

    await expect(pauseAudio()).rejects.toThrow("Nothing playing");
  });
});

// ---------- stopAudio ----------

describe("stopAudio", () => {
  it("calls invoke with stop_audio", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await stopAudio();

    expect(invoke).toHaveBeenCalledWith("stop_audio");
  });
});

// ---------- seekAudio ----------

describe("seekAudio", () => {
  it("calls invoke with seek_audio and position", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await seekAudio(42.5);

    expect(invoke).toHaveBeenCalledWith("seek_audio", { position: 42.5 });
  });
});

// ---------- deleteRegion ----------

describe("deleteRegion", () => {
  it("calls invoke with delete_region and start/end params", async () => {
    seedStore();
    vi.mocked(invoke).mockResolvedValue(mockUpdatedPeaks());

    await deleteRegion(10, 20);

    expect(invoke).toHaveBeenCalledWith("delete_region", { start: 10, end: 20 });
  });

  it("updates store peaks and edit counts after successful delete", async () => {
    seedStore();
    const updated = mockUpdatedPeaks({
      peaks: [0.9, 0.8],
      edit_count: 3,
      undo_count: 3,
      redo_count: 0,
      duration: 100,
    });
    vi.mocked(invoke).mockResolvedValue(updated);

    await deleteRegion(5, 15);

    const state = useAudioStore.getState();
    expect(state.audioInfo?.peaks).toEqual([0.9, 0.8]);
    expect(state.audioInfo?.duration).toBe(100);
    expect(state.editCount).toBe(3);
    expect(state.undoCount).toBe(3);
    expect(state.redoCount).toBe(0);
  });

  it("adds the deleted region to the store", async () => {
    seedStore();
    vi.mocked(invoke).mockResolvedValue(mockUpdatedPeaks());

    await deleteRegion(10, 20);

    const state = useAudioStore.getState();
    expect(state.deletedRegions).toEqual([{ start: 10, end: 20 }]);
  });

  it("resets deletedRegions on each call because applyUpdatedPeaks calls setFile", async () => {
    // Note: applyUpdatedPeaks calls store.setFile() which resets deletedRegions to [],
    // then deleteRegion appends one region. So only the latest region survives.
    seedStore();
    vi.mocked(invoke).mockResolvedValue(mockUpdatedPeaks());

    await deleteRegion(1, 2);
    await deleteRegion(5, 6);

    const state = useAudioStore.getState();
    expect(state.deletedRegions).toHaveLength(1);
    expect(state.deletedRegions[0]).toEqual({ start: 5, end: 6 });
  });

  it("propagates errors and does not update store on failure", async () => {
    seedStore();
    const peaksBefore = useAudioStore.getState().audioInfo?.peaks;
    vi.mocked(invoke).mockRejectedValue(new Error("Region out of bounds"));

    await expect(deleteRegion(999, 1000)).rejects.toThrow("Region out of bounds");

    const state = useAudioStore.getState();
    expect(state.audioInfo?.peaks).toEqual(peaksBefore);
    expect(state.deletedRegions).toEqual([]);
  });
});

// ---------- undoEdit / redoEdit ----------

describe("undoEdit", () => {
  it("calls invoke with undo_edit and updates store", async () => {
    seedStore();
    const updated = mockUpdatedPeaks({ edit_count: 2, undo_count: 1, redo_count: 1 });
    vi.mocked(invoke).mockResolvedValue(updated);

    await undoEdit();

    expect(invoke).toHaveBeenCalledWith("undo_edit");
    const state = useAudioStore.getState();
    expect(state.undoCount).toBe(1);
    expect(state.redoCount).toBe(1);
  });
});

describe("redoEdit", () => {
  it("calls invoke with redo_edit and updates store", async () => {
    seedStore();
    const updated = mockUpdatedPeaks({ edit_count: 3, undo_count: 3, redo_count: 0 });
    vi.mocked(invoke).mockResolvedValue(updated);

    await redoEdit();

    expect(invoke).toHaveBeenCalledWith("redo_edit");
    const state = useAudioStore.getState();
    expect(state.undoCount).toBe(3);
    expect(state.redoCount).toBe(0);
  });
});

// ---------- applyCompression ----------

describe("applyCompression", () => {
  it("calls invoke with apply_compression and params", async () => {
    seedStore();
    vi.mocked(invoke).mockResolvedValue(mockUpdatedPeaks());

    const params = {
      threshold_db: -20,
      ratio: 4,
      attack_ms: 10,
      release_ms: 100,
      makeup_gain_db: 6,
    };
    await applyCompression(params);

    expect(invoke).toHaveBeenCalledWith("apply_compression", { params });
  });

  it("updates store peaks after compression", async () => {
    seedStore();
    const updated = mockUpdatedPeaks({ peaks: [0.3, 0.3, 0.3] });
    vi.mocked(invoke).mockResolvedValue(updated);

    await applyCompression({
      threshold_db: -20,
      ratio: 4,
      attack_ms: 10,
      release_ms: 100,
      makeup_gain_db: 6,
    });

    expect(useAudioStore.getState().audioInfo?.peaks).toEqual([0.3, 0.3, 0.3]);
  });
});

// ---------- applyNoiseReduction ----------

describe("applyNoiseReduction", () => {
  it("calls invoke with apply_noise_reduction and strength", async () => {
    seedStore();
    vi.mocked(invoke).mockResolvedValue(mockUpdatedPeaks());

    await applyNoiseReduction(0.75);

    expect(invoke).toHaveBeenCalledWith("apply_noise_reduction", { strength: 0.75 });
  });
});

// ---------- detectSilence ----------

describe("detectSilence", () => {
  it("calls invoke with detect_silence and returns regions", async () => {
    const regions = [
      { start: 5, end: 8 },
      { start: 30, end: 35 },
    ];
    vi.mocked(invoke).mockResolvedValue(regions);

    const result = await detectSilence(-40, 0.5);

    expect(invoke).toHaveBeenCalledWith("detect_silence", {
      thresholdDb: -40,
      minDurationSecs: 0.5,
    });
    expect(result).toEqual(regions);
  });
});

// ---------- trimSilence ----------

describe("trimSilence", () => {
  it("calls invoke with trim_silence, regions, and keepDuration", async () => {
    seedStore();
    vi.mocked(invoke).mockResolvedValue(mockUpdatedPeaks());

    const regions = [{ start: 5, end: 10 }];
    await trimSilence(regions, 0.3);

    expect(invoke).toHaveBeenCalledWith("trim_silence", {
      regions,
      keepDuration: 0.3,
    });
  });
});

// ---------- readMetadata ----------

describe("readMetadata", () => {
  it("calls invoke with read_metadata and returns metadata", async () => {
    const metadata = {
      title: "Episode 1",
      artist: "Host",
      album: "My Podcast",
      genre: "Podcast",
      year: "2026",
      trackNumber: "1",
      comment: "",
      copyright: "",
      publisher: "",
      url: "",
      albumArt: null,
    };
    vi.mocked(invoke).mockResolvedValue(metadata);

    const result = await readMetadata("/path/to/file.mp3");

    expect(invoke).toHaveBeenCalledWith("read_metadata", { path: "/path/to/file.mp3" });
    expect(result).toEqual(metadata);
  });
});

// ---------- updateMetadata ----------

describe("updateMetadata", () => {
  it("calls invoke with update_metadata and the metadata object", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    const metadata = {
      title: "Updated Title",
      artist: "Author",
      album: "Podcast Album",
      genre: "Podcast",
      year: "2026",
      trackNumber: "2",
      comment: "A comment",
      copyright: "CC-BY",
      publisher: "Publisher",
      url: "https://example.com",
      albumArt: null,
    };
    await updateMetadata(metadata);

    expect(invoke).toHaveBeenCalledWith("update_metadata", { metadata });
  });
});

// ---------- setAlbumArt ----------

describe("setAlbumArt", () => {
  it("calls invoke with set_album_art and returns dimensions", async () => {
    const response = { width: 1400, height: 1400, size_bytes: 250000 };
    vi.mocked(invoke).mockResolvedValue(response);

    const result = await setAlbumArt("/path/to/cover.jpg");

    expect(invoke).toHaveBeenCalledWith("set_album_art", { imagePath: "/path/to/cover.jpg" });
    expect(result).toEqual(response);
  });
});

// ---------- estimateExportSize ----------

describe("estimateExportSize", () => {
  it("calls invoke with estimate_export_size and returns size estimate", async () => {
    const estimate = { min_bytes: 1000000, max_bytes: 2000000 };
    vi.mocked(invoke).mockResolvedValue(estimate);

    const params = {
      mode: "cbr" as const,
      bitrate: 128,
      sample_rate: 44100,
      mono: false,
    };
    const result = await estimateExportSize(params);

    expect(invoke).toHaveBeenCalledWith("estimate_export_size", { params });
    expect(result).toEqual(estimate);
  });
});

// ---------- exportMp3 ----------

describe("exportMp3", () => {
  it("calls invoke with export_mp3, params, and outputPath", async () => {
    const response = { path: "/output/episode.mp3", size_bytes: 1500000 };
    vi.mocked(invoke).mockResolvedValue(response);

    const params = {
      mode: "cbr" as const,
      bitrate: 192,
      sample_rate: 44100,
      mono: false,
    };
    const result = await exportMp3(params, "/output/episode.mp3");

    expect(invoke).toHaveBeenCalledWith("export_mp3", {
      params,
      outputPath: "/output/episode.mp3",
    });
    expect(result).toEqual(response);
  });

  it("supports vbr mode with quality parameter", async () => {
    const response = { path: "/output/episode.mp3", size_bytes: 1200000 };
    vi.mocked(invoke).mockResolvedValue(response);

    const params = {
      mode: "vbr" as const,
      quality: 4,
      sample_rate: 44100,
      mono: true,
    };
    const result = await exportMp3(params, "/output/episode.mp3");

    expect(invoke).toHaveBeenCalledWith("export_mp3", {
      params,
      outputPath: "/output/episode.mp3",
    });
    expect(result).toEqual(response);
  });

  it("propagates errors from invoke", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("Disk full"));

    const params = {
      mode: "cbr" as const,
      bitrate: 128,
      sample_rate: 44100,
      mono: false,
    };

    await expect(exportMp3(params, "/output/episode.mp3")).rejects.toThrow("Disk full");
  });
});

// ---------- findQuietestRegion ----------

describe("findQuietestRegion", () => {
  it("calls invoke with find_quietest_region and returns a region", async () => {
    const region = { start: 45.2, end: 48.7 };
    vi.mocked(invoke).mockResolvedValue(region);

    const result = await findQuietestRegion(2.0);

    expect(invoke).toHaveBeenCalledWith("find_quietest_region", { minDurationSecs: 2.0 });
    expect(result).toEqual(region);
  });

  it("returns null when no quiet region is found", async () => {
    vi.mocked(invoke).mockResolvedValue(null);

    const result = await findQuietestRegion(60);

    expect(invoke).toHaveBeenCalledWith("find_quietest_region", { minDurationSecs: 60 });
    expect(result).toBeNull();
  });

  it("propagates errors from invoke", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("No audio loaded"));

    await expect(findQuietestRegion(1.0)).rejects.toThrow("No audio loaded");
  });
});

// ---------- previewEffect ----------

describe("previewEffect", () => {
  it("calls invoke with preview_effect and effect params", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    const params = {
      effectType: "compression",
      thresholdDb: -20,
      ratio: 4,
      attackMs: 10,
      releaseMs: 100,
      makeupGainDb: 6,
    };
    await previewEffect(params);

    expect(invoke).toHaveBeenCalledWith("preview_effect", { params });
  });

  it("calls invoke with noise_reduction effect params", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    const params = {
      effectType: "noise_reduction",
      strength: 0.8,
    };
    await previewEffect(params);

    expect(invoke).toHaveBeenCalledWith("preview_effect", { params });
  });

  it("propagates errors from invoke", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("Preview failed"));

    await expect(previewEffect({ effectType: "compression" })).rejects.toThrow("Preview failed");
  });
});

// ---------- stopPreview ----------

describe("stopPreview", () => {
  it("calls invoke with stop_preview and no params", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await stopPreview();

    expect(invoke).toHaveBeenCalledWith("stop_preview");
  });

  it("propagates errors from invoke", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("No preview active"));

    await expect(stopPreview()).rejects.toThrow("No preview active");
  });
});

// ---------- previewExport ----------

describe("previewExport", () => {
  it("calls invoke with preview_export and returns a preview path", async () => {
    vi.mocked(invoke).mockResolvedValue("/tmp/preview_12345.mp3");

    const params = {
      bitrate: 128,
      cbr: true,
      sampleRateOut: 44100,
      mono: false,
      start: 10,
      end: 20,
    };
    const result = await previewExport(params);

    expect(invoke).toHaveBeenCalledWith("preview_export", { params });
    expect(result).toBe("/tmp/preview_12345.mp3");
  });

  it("supports vbr params", async () => {
    vi.mocked(invoke).mockResolvedValue("/tmp/preview_vbr.mp3");

    const params = {
      bitrate: 0,
      cbr: false,
      vbrQuality: 4,
      sampleRateOut: 22050,
      mono: true,
      start: 0,
      end: 5,
    };
    const result = await previewExport(params);

    expect(invoke).toHaveBeenCalledWith("preview_export", { params });
    expect(result).toBe("/tmp/preview_vbr.mp3");
  });

  it("propagates errors from invoke", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("Export preview failed"));

    const params = {
      bitrate: 128,
      cbr: true,
      sampleRateOut: 44100,
      mono: false,
      start: 0,
      end: 10,
    };
    await expect(previewExport(params)).rejects.toThrow("Export preview failed");
  });
});

// ---------- applyUpdatedPeaks integration ----------

describe("applyUpdatedPeaks (via editing functions)", () => {
  it("updates audioInfo duration when store has a loaded file", async () => {
    seedStore();
    const updated = mockUpdatedPeaks({ duration: 95.5 });
    vi.mocked(invoke).mockResolvedValue(updated);

    await undoEdit();

    const state = useAudioStore.getState();
    expect(state.audioInfo?.duration).toBe(95.5);
  });

  it("does not crash when store has no loaded file", async () => {
    // Do NOT seed the store — no file loaded
    vi.mocked(invoke).mockResolvedValue(mockUpdatedPeaks());

    // Should not throw even though audioInfo is null
    await expect(undoEdit()).resolves.toBeUndefined();
  });

  it("preserves non-peak audioInfo fields after update", async () => {
    const info = mockAudioInfo({
      sampleRate: 48000,
      channels: 1,
      format: "wav",
    });
    useAudioStore.getState().setFile("/test.wav", info);

    const updated = mockUpdatedPeaks({ peaks: [0.1], duration: 60 });
    vi.mocked(invoke).mockResolvedValue(updated);

    await redoEdit();

    const state = useAudioStore.getState();
    expect(state.audioInfo?.sampleRate).toBe(48000);
    expect(state.audioInfo?.channels).toBe(1);
    expect(state.audioInfo?.format).toBe("wav");
    expect(state.audioInfo?.peaks).toEqual([0.1]);
    expect(state.audioInfo?.duration).toBe(60);
  });
});
