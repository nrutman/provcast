import { useEffect } from "react";
import { useAudioStore } from "@/stores/useAudioStore";
import { useUIStore } from "@/stores/useUIStore";
import { playAudio, pauseAudio, stopAudio } from "./tauri/playback";
import { deleteRegion, undoEdit, redoEdit } from "./tauri/editing";

export function useKeyboardShortcuts() {
  const store = useAudioStore.getState;

  useEffect(() => {
    async function handleKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;

      // Space: Play/Pause
      if (e.key === " " && !isInputFocused()) {
        e.preventDefault();
        const { isPlaying, playbackPosition } = store();
        if (isPlaying) {
          await pauseAudio();
          useAudioStore.getState().setPlaying(false);
        } else {
          await playAudio(playbackPosition);
          useAudioStore.getState().setPlaying(true);
        }
      }

      // Escape: Stop playback
      if (e.key === "Escape") {
        await stopAudio();
        useAudioStore.getState().setPlaying(false);
        useAudioStore.getState().setPlaybackPosition(0);
      }

      // Delete/Backspace: Delete selected region
      if ((e.key === "Delete" || e.key === "Backspace") && !isInputFocused()) {
        const region = store().selectedRegion;
        if (region) {
          await deleteRegion(region.start, region.end);
          useAudioStore.getState().setSelectedRegion(null);
        }
      }

      // Ctrl+Z: Undo
      if (ctrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        await undoEdit();
      }

      // Ctrl+Shift+Z: Redo
      if (ctrl && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        await redoEdit();
      }

      // Ctrl+=: Zoom in
      if (ctrl && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        useUIStore.getState().zoomIn();
      }

      // Ctrl+-: Zoom out
      if (ctrl && e.key === "-") {
        e.preventDefault();
        useUIStore.getState().zoomOut();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [store]);
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
}
