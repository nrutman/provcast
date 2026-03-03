import { useRef, useEffect } from "react";
import { useWavesurfer } from "@wavesurfer/react";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";
import MinimapPlugin from "wavesurfer.js/dist/plugins/minimap.js";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.js";
import type WaveSurfer from "wavesurfer.js";
import { useAudioStore } from "@/stores/audio-store";
import { useUIStore } from "@/stores/ui-store";
import { seekAudio } from "@/hooks/use-tauri-audio";

function getRegionsPlugin(ws: WaveSurfer): RegionsPlugin | null {
  return ws.getActivePlugins().find((p): p is RegionsPlugin => p instanceof RegionsPlugin) ?? null;
}

export function WaveformEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioInfo = useAudioStore((s) => s.audioInfo);
  const playbackPosition = useAudioStore((s) => s.playbackPosition);
  const setSelectedRegion = useAudioStore((s) => s.setSelectedRegion);
  const deletedRegions = useAudioStore((s) => s.deletedRegions);
  const detectedSilenceRegions = useAudioStore((s) => s.detectedSilenceRegions);
  const zoom = useUIStore((s) => s.zoom);
  const currentStep = useUIStore((s) => s.currentStep);

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

    const regions = getRegionsPlugin(wavesurfer);
    if (!regions) return;

    let isCreating = false;

    const unsub = regions.on("region-created", (region) => {
      if (isCreating) return;
      // Don't interfere with overlay regions
      if (region.id.startsWith("deleted-") || region.id.startsWith("context-")) {
        return;
      }
      isCreating = true;

      // Remove previous selection regions only (not overlays)
      regions.getRegions().forEach((r) => {
        if (r.id !== region.id && !r.id.startsWith("deleted-") && !r.id.startsWith("context-")) {
          r.remove();
        }
      });

      setSelectedRegion({ start: region.start, end: region.end });
      isCreating = false;
    });

    const unsubUpdate = regions.on("region-updated", (region) => {
      // Only update selection for user-created regions
      if (region.id.startsWith("deleted-") || region.id.startsWith("context-")) {
        return;
      }
      setSelectedRegion({ start: region.start, end: region.end });
    });

    return () => {
      unsub();
      unsubUpdate();
    };
  }, [wavesurfer, setSelectedRegion]);

  // Render deleted region overlays (gray, non-interactive)
  useEffect(() => {
    if (!wavesurfer) return;
    const regions = getRegionsPlugin(wavesurfer);
    if (!regions) return;

    // Clear old deleted overlays
    regions.getRegions().forEach((r) => {
      if (r.id.startsWith("deleted-")) r.remove();
    });

    // Add current deleted regions
    deletedRegions.forEach((region, i) => {
      regions.addRegion({
        id: `deleted-${i}`,
        start: region.start,
        end: region.end,
        color: "rgba(128, 128, 128, 0.3)",
        drag: false,
        resize: false,
      });
    });
  }, [wavesurfer, deletedRegions]);

  // Render context-specific overlays based on wizard step
  useEffect(() => {
    if (!wavesurfer) return;
    const regions = getRegionsPlugin(wavesurfer);
    if (!regions) return;

    // Clear old context overlays
    regions.getRegions().forEach((r) => {
      if (r.id.startsWith("context-")) r.remove();
    });

    // Step 3 (Trimming): Show detected silence regions in orange
    if (currentStep === 3 && detectedSilenceRegions.length > 0) {
      detectedSilenceRegions.forEach((region, i) => {
        regions.addRegion({
          id: `context-${i}`,
          start: region.start,
          end: region.end,
          color: "rgba(255, 165, 0, 0.25)",
          drag: false,
          resize: false,
        });
      });
    }
  }, [wavesurfer, currentStep, detectedSilenceRegions]);

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
