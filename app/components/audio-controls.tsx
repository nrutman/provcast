import { useAudioStore } from "@/stores/audio-store";
import { playAudio, pauseAudio, stopAudio } from "@/hooks/use-tauri-audio";
import { usePlaybackPositionSync } from "@/hooks/use-tauri-audio";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square } from "lucide-react";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

export function AudioControls() {
  usePlaybackPositionSync();

  const isPlaying = useAudioStore((s) => s.isPlaying);
  const playbackPosition = useAudioStore((s) => s.playbackPosition);
  const duration = useAudioStore((s) => s.audioInfo?.duration ?? 0);
  const selectedRegion = useAudioStore((s) => s.selectedRegion);

  async function handlePlayPause() {
    if (isPlaying) {
      await pauseAudio();
      useAudioStore.getState().setPlaying(false);
    } else {
      await playAudio(playbackPosition);
      useAudioStore.getState().setPlaying(true);
    }
  }

  async function handleStop() {
    await stopAudio();
    useAudioStore.getState().setPlaying(false);
    useAudioStore.getState().setPlaybackPosition(0);
  }

  return (
    <div className="flex items-center gap-4 border-t border-border bg-card px-4 py-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={handlePlayPause}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleStop}>
          <Square className="h-4 w-4" />
        </Button>
      </div>

      <div className="font-mono text-sm text-foreground">
        {formatTime(playbackPosition)} / {formatTime(duration)}
      </div>

      {selectedRegion && (
        <div className="text-xs text-muted-foreground">
          Selection: {formatTime(selectedRegion.start)} — {formatTime(selectedRegion.end)} (
          {formatTime(selectedRegion.end - selectedRegion.start)})
        </div>
      )}
    </div>
  );
}
