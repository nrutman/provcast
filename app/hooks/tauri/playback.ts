import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useAudioStore, type AudioInfo } from "@/stores/useAudioStore";

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

export async function playAudio(fromPosition: number, usePreview?: boolean): Promise<void> {
  return invoke("play_audio", { fromPosition, usePreview: usePreview ?? false });
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
