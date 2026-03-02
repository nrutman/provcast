import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useAudioStore, type AudioInfo, type Metadata } from "@/stores/audio-store";

interface UpdatedPeaks {
  peaks: number[];
  edit_count: number;
  undo_count: number;
  redo_count: number;
  duration: number;
}

interface SilenceRegion {
  start: number;
  end: number;
}

interface CompressionParams {
  threshold_db: number;
  ratio: number;
  attack_ms: number;
  release_ms: number;
  makeup_gain_db: number;
}

interface ExportParams {
  mode: "cbr" | "vbr";
  bitrate?: number;
  quality?: number;
  sample_rate: number;
  mono: boolean;
}

interface SizeEstimate {
  min_bytes: number;
  max_bytes: number;
}

function applyUpdatedPeaks(result: UpdatedPeaks) {
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

export function usePlaybackPositionSync() {
  const setPlaybackPosition = useAudioStore((s) => s.setPlaybackPosition);
  const setPlaying = useAudioStore((s) => s.setPlaying);

  useEffect(() => {
    const unlistenPosition = listen<number>("playback-position", (event) => {
      setPlaybackPosition(event.payload);
    });

    const unlistenStopped = listen("playback-stopped", () => {
      setPlaying(false);
    });

    return () => {
      unlistenPosition.then((fn) => fn());
      unlistenStopped.then((fn) => fn());
    };
  }, [setPlaybackPosition, setPlaying]);
}

export async function loadAudio(path: string): Promise<AudioInfo> {
  return invoke<AudioInfo>("load_audio", { path });
}

export async function playAudio(fromPosition: number): Promise<void> {
  return invoke("play_audio", { fromPosition });
}

export async function pauseAudio(): Promise<void> {
  return invoke("pause_audio");
}

export async function stopAudio(): Promise<void> {
  return invoke("stop_audio");
}

export async function seekAudio(position: number): Promise<void> {
  return invoke("seek_audio", { position });
}

export async function deleteRegion(start: number, end: number): Promise<void> {
  const result = await invoke<UpdatedPeaks>("delete_region", { start, end });
  applyUpdatedPeaks(result);
}

export async function undoEdit(): Promise<void> {
  const result = await invoke<UpdatedPeaks>("undo_edit");
  applyUpdatedPeaks(result);
}

export async function redoEdit(): Promise<void> {
  const result = await invoke<UpdatedPeaks>("redo_edit");
  applyUpdatedPeaks(result);
}

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

export async function trimSilence(
  regions: SilenceRegion[],
  keepDuration: number,
): Promise<void> {
  const result = await invoke<UpdatedPeaks>("trim_silence", { regions, keepDuration });
  applyUpdatedPeaks(result);
}

export async function readMetadata(path: string): Promise<Metadata> {
  return invoke("read_metadata", { path });
}

export async function updateMetadata(metadata: Metadata): Promise<void> {
  return invoke("update_metadata", { metadata });
}

export async function setAlbumArt(
  imagePath: string,
): Promise<{ width: number; height: number; size_bytes: number }> {
  return invoke("set_album_art", { imagePath });
}

export async function estimateExportSize(params: ExportParams): Promise<SizeEstimate> {
  return invoke("estimate_export_size", { params });
}

export async function exportMp3(
  params: ExportParams,
  outputPath: string,
): Promise<{ path: string; size_bytes: number }> {
  return invoke("export_mp3", { params, outputPath });
}

export type { CompressionParams, ExportParams, SilenceRegion, SizeEstimate };
