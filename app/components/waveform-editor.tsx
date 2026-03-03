import { useRef, useEffect } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import MinimapPlugin from "wavesurfer.js/dist/plugins/minimap.js";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.js";
import { useAudioStore } from "@/stores/audio-store";
import { useUIStore } from "@/stores/ui-store";
import { seekAudio } from "@/hooks/use-tauri-audio";

export function WaveformEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioInfo = useAudioStore((s) => s.audioInfo);
  const playbackPosition = useAudioStore((s) => s.playbackPosition);
  const setSelectedRegion = useAudioStore((s) => s.setSelectedRegion);
  const zoom = useUIStore((s) => s.zoom);

  const { wavesurfer } = useWavesurfer({
    container: containerRef,
    peaks: audioInfo ? [audioInfo.peaks] : undefined,
    duration: audioInfo?.duration,
    waveColor: "oklch(0.6 0.15 250)",
    progressColor: "oklch(0.7 0.18 250)",
    cursorColor: "oklch(0.9 0 0)",
    cursorWidth: 1,
    height: 200,
    minPxPerSec: zoom,
    interact: true,
    fillParent: true,
    autoCenter: true,
    plugins: [
      RegionsPlugin.create(),
      TimelinePlugin.create({
        timeInterval: 1,
        primaryLabelInterval: 5,
        style: {
          color: "oklch(0.65 0 0)",
          fontSize: "11px",
        },
      }),
      MinimapPlugin.create({
        height: 30,
        waveColor: "oklch(0.4 0.1 250)",
        progressColor: "oklch(0.5 0.15 250)",
        cursorColor: "oklch(0.9 0 0)",
      }),
    ],
  });

  // Sync playback position from Rust backend
  useEffect(() => {
    if (wavesurfer && audioInfo) {
      const duration = audioInfo.duration;
      if (duration > 0) {
        wavesurfer.seekTo(playbackPosition / duration);
      }
    }
  }, [wavesurfer, playbackPosition, audioInfo]);

  // Update zoom
  useEffect(() => {
    if (wavesurfer) {
      wavesurfer.zoom(zoom);
    }
  }, [wavesurfer, zoom]);

  // Handle region selection for editing
  useEffect(() => {
    if (!wavesurfer) return;

    const regions = wavesurfer
      .getActivePlugins()
      .find((p): p is RegionsPlugin => p instanceof RegionsPlugin);
    if (!regions) return;

    let isCreating = false;

    const unsub = regions.on("region-created", (region) => {
      if (isCreating) return;
      isCreating = true;

      // Remove previous regions
      regions.getRegions().forEach((r) => {
        if (r.id !== region.id) r.remove();
      });

      setSelectedRegion({ start: region.start, end: region.end });
      isCreating = false;
    });

    const unsubUpdate = regions.on("region-updated", (region) => {
      setSelectedRegion({ start: region.start, end: region.end });
    });

    return () => {
      unsub();
      unsubUpdate();
    };
  }, [wavesurfer, setSelectedRegion]);

  // Click to seek via Rust backend
  useEffect(() => {
    if (!wavesurfer) return;

    const unsub = wavesurfer.on("click", (relativeX) => {
      const duration = audioInfo?.duration ?? 0;
      if (duration > 0) {
        seekAudio(relativeX * duration);
      }
    });

    return () => {
      unsub();
    };
  }, [wavesurfer, audioInfo]);

  if (!audioInfo) return null;

  return (
    <div className="flex-1 overflow-hidden p-4">
      <div ref={containerRef} className="rounded-md border border-border bg-background" />
    </div>
  );
}
