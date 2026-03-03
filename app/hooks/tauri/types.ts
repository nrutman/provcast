import { useAudioStore } from "@/stores/useAudioStore";

export interface UpdatedPeaks {
  peaks: number[];
  edit_count: number;
  undo_count: number;
  redo_count: number;
  duration: number;
}

export interface SilenceRegion {
  start: number;
  end: number;
}

export interface CompressionParams {
  threshold_db: number;
  ratio: number;
  attack_ms: number;
  release_ms: number;
  makeup_gain_db: number;
}

export interface ExportParams {
  mode: "cbr" | "vbr";
  bitrate?: number;
  quality?: number;
  sample_rate: number;
  mono: boolean;
}

export interface SizeEstimate {
  min_bytes: number;
  max_bytes: number;
}

export interface EffectPreviewParams {
  effectType: string;
  thresholdDb?: number;
  ratio?: number;
  attackMs?: number;
  releaseMs?: number;
  makeupGainDb?: number;
  strength?: number;
}

export interface ExportPreviewParams {
  bitrate: number;
  cbr: boolean;
  vbrQuality?: number;
  sampleRateOut: number;
  mono: boolean;
  start: number;
  end: number;
}

export function applyUpdatedPeaks(result: UpdatedPeaks) {
  const store = useAudioStore.getState();
  store.updatePeaks(result.peaks);
  store.setEditCounts(result.edit_count, result.undo_count, result.redo_count);
  if (store.audioInfo) {
    store.setFile(store.filePath!, {
      ...store.audioInfo,
      peaks: result.peaks,
      duration: result.duration,
    });
    store.setEditCounts(result.edit_count, result.undo_count, result.redo_count);
  }
}
