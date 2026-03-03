import { useState, useEffect, useCallback } from "react";
import { useAudioStore } from "@/stores/useAudioStore";
import { playAudio } from "@/hooks/tauri/playback";
import { estimateExportSize, exportMp3, previewExport } from "@/hooks/tauri/export";
import { type ExportParams, type SizeEstimate } from "@/hooks/tauri/types";
import { save } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  Headphones,
  FileAudio,
  Loader2,
  Check,
  HardDrive,
  Clock,
  Settings2,
} from "lucide-react";

const CBR_BITRATES = [24, 32, 48, 64, 96, 128, 160, 192, 256, 320] as const;

export function ExportStep() {
  const [mode, setMode] = useState<"cbr" | "vbr">("cbr");
  const [bitrate, setBitrate] = useState(128);
  const [vbrQuality, setVbrQuality] = useState(4);
  const [sampleRate, setSampleRate] = useState(44100);
  const [mono, setMono] = useState(true);

  const [sizeEstimate, setSizeEstimate] = useState<SizeEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportResult, setExportResult] = useState<{
    path: string;
    size_bytes: number;
  } | null>(null);

  const [previewing, setPreviewing] = useState(false);

  const audioInfo = useAudioStore((s) => s.audioInfo);
  const selectedRegion = useAudioStore((s) => s.selectedRegion);
  const filePath = useAudioStore((s) => s.filePath);

  const duration = audioInfo?.duration ?? 0;

  // Build export params from current state
  const buildExportParams = useCallback((): ExportParams => {
    if (mode === "cbr") {
      return { mode: "cbr", bitrate, sample_rate: sampleRate, mono };
    }
    return { mode: "vbr", quality: vbrQuality, sample_rate: sampleRate, mono };
  }, [mode, bitrate, vbrQuality, sampleRate, mono]);

  // Estimate file size whenever params change
  useEffect(() => {
    if (!filePath) return;

    let cancelled = false;
    setEstimating(true);

    estimateExportSize(buildExportParams())
      .then((estimate) => {
        if (!cancelled) {
          setSizeEstimate(estimate);
        }
      })
      .catch(() => {
        if (!cancelled) setSizeEstimate(null);
      })
      .finally(() => {
        if (!cancelled) setEstimating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath, buildExportParams]);

  // Handle export
  const handleExport = useCallback(async () => {
    const outputPath = await save({
      defaultPath: "podcast.mp3",
      filters: [{ name: "MP3 Audio", extensions: ["mp3"] }],
    });
    if (!outputPath) return;

    setExporting(true);
    setExportProgress(0);
    setExportResult(null);

    const unlisten = await listen<number>("export-progress", (event) => {
      setExportProgress(Math.round(event.payload * 100));
    });

    try {
      const result = await exportMp3(buildExportParams(), outputPath);
      setExportResult(result);
    } catch {
      // Export failed - progress will stop
    } finally {
      unlisten();
      setExporting(false);
    }
  }, [buildExportParams]);

  // Handle preview
  const handlePreview = useCallback(async () => {
    if (!selectedRegion) return;

    setPreviewing(true);
    try {
      const tempPath = await previewExport({
        bitrate: mode === "cbr" ? bitrate : 128,
        cbr: mode === "cbr",
        vbrQuality: mode === "vbr" ? vbrQuality : undefined,
        sampleRateOut: sampleRate,
        mono,
        start: selectedRegion.start,
        end: selectedRegion.end,
      });
      if (tempPath) {
        await playAudio(0, true);
      }
    } catch {
      // Preview failed
    } finally {
      setPreviewing(false);
    }
  }, [selectedRegion, mode, bitrate, vbrQuality, sampleRate, mono]);

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h2 className="text-lg font-semibold">Export</h2>
        <p className="text-sm text-muted-foreground">
          Configure encoding settings and export your podcast as an MP3 file.
        </p>
      </div>

      {/* Encoding Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Encoding Settings</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileAudio className="h-4 w-4" />
            MP3
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Mode toggle: CBR / VBR */}
          <div className="space-y-2">
            <Label>Encoding Mode</Label>
            <div className="flex rounded-md border">
              <Button
                variant={mode === "cbr" ? "default" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setMode("cbr")}
              >
                CBR
              </Button>
              <Button
                variant={mode === "vbr" ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setMode("vbr")}
              >
                VBR
              </Button>
            </div>
          </div>

          {/* CBR: Bitrate select */}
          {mode === "cbr" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Bitrate</Label>
                <span className="text-sm text-muted-foreground">{bitrate} kbps</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CBR_BITRATES.map((b) => (
                  <Button
                    key={b}
                    variant={bitrate === b ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setBitrate(b)}
                  >
                    {b}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* VBR: Quality slider */}
          {mode === "vbr" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>VBR Quality</Label>
                <span className="text-sm text-muted-foreground">{vbrQuality}</span>
              </div>
              <Slider
                min={0}
                max={9}
                step={1}
                value={[vbrQuality]}
                onValueChange={([v]) => setVbrQuality(v)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Best</span>
                <span>Smallest</span>
              </div>
            </div>
          )}

          <Separator />

          {/* Sample Rate */}
          <div className="space-y-2">
            <Label>Sample Rate</Label>
            <div className="flex rounded-md border">
              <Button
                variant={sampleRate === 44100 ? "default" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setSampleRate(44100)}
              >
                44100 Hz
              </Button>
              <Button
                variant={sampleRate === 48000 ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setSampleRate(48000)}
              >
                48000 Hz
              </Button>
            </div>
          </div>

          {/* Channels */}
          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="flex rounded-md border">
              <Button
                variant={mono ? "default" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setMono(true)}
              >
                Mono
              </Button>
              <Button
                variant={!mono ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setMono(false)}
              >
                Stereo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Display */}
      <Card>
        <CardContent className="flex items-center gap-6 py-4">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-medium">{formatDuration(duration)}</span>
          </div>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2 text-sm">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Estimated size:</span>
            {estimating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : sizeEstimate ? (
              <span className="font-medium">
                {formatFileSize(sizeEstimate.min_bytes)}
                {sizeEstimate.min_bytes !== sizeEstimate.max_bytes &&
                  ` - ${formatFileSize(sizeEstimate.max_bytes)}`}
              </span>
            ) : (
              <span className="text-muted-foreground">--</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Preview at these settings</p>
            <p className="text-xs text-muted-foreground">
              {selectedRegion
                ? `Selected region: ${formatDuration(selectedRegion.start)} - ${formatDuration(selectedRegion.end)}`
                : "Select a region on the waveform first"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!selectedRegion || previewing}
          >
            {previewing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Headphones className="mr-2 h-4 w-4" />
            )}
            Preview
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Export */}
      {exporting && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Exporting...</span>
            <span className="font-medium">{exportProgress}%</span>
          </div>
          <Progress value={exportProgress} />
        </div>
      )}

      {exportResult && (
        <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
          <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Export complete
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {exportResult.path} ({formatFileSize(exportResult.size_bytes)})
            </p>
          </div>
        </div>
      )}

      <Button
        size="lg"
        onClick={handleExport}
        disabled={exporting || !filePath}
        className="self-end"
      >
        {exporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Export
      </Button>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
