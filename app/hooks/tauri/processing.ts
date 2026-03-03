import { invoke } from "@tauri-apps/api/core";
import {
  type UpdatedPeaks,
  type CompressionParams,
  type SilenceRegion,
  type EffectPreviewParams,
  applyUpdatedPeaks,
} from "./types";

export async function applyCompression(params: CompressionParams): Promise<void> {
  const result = await invoke<UpdatedPeaks>("apply_compression", { params });
  applyUpdatedPeaks(result);
}

export async function applyNoiseReduction(strength: number): Promise<void> {
  const result = await invoke<UpdatedPeaks>("apply_noise_reduction", { strength });
  applyUpdatedPeaks(result);
}

export async function detectSilence(
  thresholdDb: number,
  minDurationSecs: number,
): Promise<SilenceRegion[]> {
  return invoke("detect_silence", { thresholdDb, minDurationSecs });
}

export async function findQuietestRegion(minDurationSecs: number): Promise<SilenceRegion | null> {
  return invoke("find_quietest_region", { minDurationSecs });
}

export async function trimSilence(regions: SilenceRegion[], keepDuration: number): Promise<void> {
  const result = await invoke<UpdatedPeaks>("trim_silence", { regions, keepDuration });
  applyUpdatedPeaks(result);
}

export async function previewEffect(params: EffectPreviewParams): Promise<void> {
  return invoke("preview_effect", { params });
}

export async function stopPreview(): Promise<void> {
  return invoke("stop_preview");
}
