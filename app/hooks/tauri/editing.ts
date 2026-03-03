import { invoke } from "@tauri-apps/api/core";
import { useAudioStore } from "@/stores/useAudioStore";
import { type UpdatedPeaks, applyUpdatedPeaks } from "./types";

export async function deleteRegion(start: number, end: number): Promise<void> {
  const result = await invoke<UpdatedPeaks>("delete_region", { start, end });
  applyUpdatedPeaks(result);
  useAudioStore.getState().addDeletedRegion({ start, end });
}

export async function undoEdit(): Promise<void> {
  const result = await invoke<UpdatedPeaks>("undo_edit");
  applyUpdatedPeaks(result);
}

export async function redoEdit(): Promise<void> {
  const result = await invoke<UpdatedPeaks>("redo_edit");
  applyUpdatedPeaks(result);
}
