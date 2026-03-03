import { useAudioStore } from "@/stores/useAudioStore";
import { playAudio, pauseAudio, stopAudio } from "@/hooks/tauri/playback";
import { usePlaybackPositionSync } from "@/hooks/tauri/playback";
import { Button } from "@/components/ui/button";
import { formatTimePrecise } from "@/components/utils/formatTime";
import { Play, Pause, Square } from "lucide-react";

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
        {formatTimePrecise(playbackPosition)} / {formatTimePrecise(duration)}
      </div>

      {selectedRegion && (
        <div className="text-xs text-muted-foreground">
          Selection: {formatTimePrecise(selectedRegion.start)} —{" "}
          {formatTimePrecise(selectedRegion.end)} (
          {formatTimePrecise(selectedRegion.end - selectedRegion.start)})
        </div>
      )}
    </div>
  );
}
