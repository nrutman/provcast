import { useState, useEffect } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { useAudioStore } from "@/stores/audio-store";
import { useUIStore } from "@/stores/ui-store";
import { estimateExportSize, exportMp3, type ExportParams } from "@/hooks/use-tauri-audio";
import { listen } from "@tauri-apps/api/event";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CBR_OPTIONS = [64, 96, 128, 160, 192, 224, 256, 320];
const VBR_LABELS = ["V0 (Best)", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9 (Smallest)"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function ExportDialog() {
  const open = useUIStore((s) => s.exportDialogOpen);
  const setOpen = useUIStore((s) => s.setExportDialogOpen);
  const duration = useAudioStore((s) => s.audioInfo?.duration ?? 0);

  const [mode, setMode] = useState<"cbr" | "vbr">("cbr");
  const [bitrate, setBitrate] = useState(128);
  const [vbrQuality, setVbrQuality] = useState(2);
  const [sampleRate, setSampleRate] = useState(44100);
  const [mono, setMono] = useState(true);
  const [sizeEstimate, setSizeEstimate] = useState<{
    min_bytes: number;
    max_bytes: number;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");

  const params: ExportParams = {
    mode,
    bitrate: mode === "cbr" ? bitrate : undefined,
    quality: mode === "vbr" ? vbrQuality : undefined,
    sample_rate: sampleRate,
    mono,
  };

  useEffect(() => {
    if (!open || duration === 0) return;
    estimateExportSize(params)
      .then(setSizeEstimate)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, bitrate, vbrQuality, sampleRate, mono, duration]);

  useEffect(() => {
    if (!exporting) return;
    const unlisten = listen<{ percent: number; stage: string }>("export-progress", (event) => {
      setProgress(event.payload.percent);
      setStage(event.payload.stage);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [exporting]);

  async function handleExport() {
    const outputPath = await save({
      filters: [{ name: "MP3 Files", extensions: ["mp3"] }],
      defaultPath: "podcast.mp3",
    });
    if (!outputPath) return;

    setExporting(true);
    setProgress(0);
    try {
      await exportMp3(params, outputPath);
    } finally {
      setExporting(false);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export MP3</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "cbr" ? "default" : "outline"}
              onClick={() => setMode("cbr")}
              className="flex-1"
            >
              CBR
            </Button>
            <Button
              size="sm"
              variant={mode === "vbr" ? "default" : "outline"}
              onClick={() => setMode("vbr")}
              className="flex-1"
            >
              VBR
            </Button>
          </div>

          {/* Bitrate / Quality */}
          {mode === "cbr" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Bitrate</Label>
                <span className="text-xs text-muted-foreground">{bitrate} kbps</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {CBR_OPTIONS.map((b) => (
                  <Button
                    key={b}
                    size="sm"
                    variant={bitrate === b ? "default" : "outline"}
                    onClick={() => setBitrate(b)}
                    className="text-xs"
                  >
                    {b}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Quality</Label>
                <span className="text-xs text-muted-foreground">{VBR_LABELS[vbrQuality]}</span>
              </div>
              <Slider
                value={[vbrQuality]}
                onValueChange={([v]) => setVbrQuality(v)}
                min={0}
                max={9}
                step={1}
              />
            </div>
          )}

          {/* Sample Rate */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={sampleRate === 44100 ? "default" : "outline"}
              onClick={() => setSampleRate(44100)}
              className="flex-1 text-xs"
            >
              44.1 kHz
            </Button>
            <Button
              size="sm"
              variant={sampleRate === 48000 ? "default" : "outline"}
              onClick={() => setSampleRate(48000)}
              className="flex-1 text-xs"
            >
              48 kHz
            </Button>
          </div>

          {/* Mono/Stereo */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mono ? "default" : "outline"}
              onClick={() => setMono(true)}
              className="flex-1 text-xs"
            >
              Mono
            </Button>
            <Button
              size="sm"
              variant={!mono ? "default" : "outline"}
              onClick={() => setMono(false)}
              className="flex-1 text-xs"
            >
              Stereo
            </Button>
          </div>

          {/* Size estimate */}
          {sizeEstimate && (
            <div className="rounded-md bg-secondary p-3 text-center text-sm">
              Estimated size:{" "}
              <span className="font-medium">
                {formatBytes(sizeEstimate.min_bytes)}
                {sizeEstimate.min_bytes !== sizeEstimate.max_bytes &&
                  ` – ${formatBytes(sizeEstimate.max_bytes)}`}
              </span>
            </div>
          )}

          {/* Progress */}
          {exporting && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-center text-xs text-muted-foreground">
                {stage} ({Math.round(progress)}%)
              </p>
            </div>
          )}

          <Button className="w-full" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting..." : "Export MP3"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
