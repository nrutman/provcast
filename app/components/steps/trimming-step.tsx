import { useState, useCallback } from "react";
import { useAudioStore } from "@/stores/audio-store";
import {
  deleteRegion,
  playAudio,
  undoEdit,
  redoEdit,
  detectSilence,
  trimSilence,
  type SilenceRegion,
} from "@/hooks/use-tauri-audio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Scissors,
  Play,
  Trash2,
  Undo2,
  Redo2,
  Search,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const whole = Math.floor(secs);
  const tenths = Math.floor((secs - whole) * 10);
  return `${mins}:${whole.toString().padStart(2, "0")}.${tenths}`;
}

interface CheckedRegion {
  region: SilenceRegion;
  checked: boolean;
}

function ManualTrimSection() {
  const selectedRegion = useAudioStore((s) => s.selectedRegion);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!selectedRegion) return;
    setDeleting(true);
    try {
      await deleteRegion(selectedRegion.start, selectedRegion.end);
    } finally {
      setDeleting(false);
    }
  }, [selectedRegion]);

  const handlePlaySelection = useCallback(async () => {
    if (!selectedRegion) return;
    await playAudio(selectedRegion.start);
  }, [selectedRegion]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <Scissors className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Manual Trim</CardTitle>
        </div>
        {selectedRegion && (
          <Badge variant="outline">
            {formatTime(selectedRegion.start)} - {formatTime(selectedRegion.end)}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Select a region on the waveform above, then:
        </p>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={!selectedRegion || deleting}
            onClick={handleDelete}
          >
            {deleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete Selection
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!selectedRegion}
            onClick={handlePlaySelection}
          >
            <Play className="mr-2 h-4 w-4" />
            Play Selection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SilenceDetectionSection() {
  const [threshold, setThreshold] = useState(-40);
  const [minDuration, setMinDuration] = useState(1.0);
  const [checkedRegions, setCheckedRegions] = useState<CheckedRegion[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [trimming, setTrimming] = useState(false);

  const setDetectedSilenceRegions = useAudioStore((s) => s.setDetectedSilenceRegions);

  const handleDetect = useCallback(async () => {
    setDetecting(true);
    try {
      const regions = await detectSilence(threshold, minDuration);
      const checked = regions.map((region) => ({ region, checked: true }));
      setCheckedRegions(checked);
      setDetectedSilenceRegions(regions);
    } catch {
      setCheckedRegions([]);
      setDetectedSilenceRegions([]);
    } finally {
      setDetecting(false);
    }
  }, [threshold, minDuration, setDetectedSilenceRegions]);

  const handleToggleRegion = useCallback((index: number) => {
    setCheckedRegions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item)),
    );
  }, []);

  const handleTrimSelected = useCallback(async () => {
    const selected = checkedRegions.filter((item) => item.checked).map((item) => item.region);
    if (selected.length === 0) return;
    setTrimming(true);
    try {
      await trimSilence(selected, 0.05);
      setCheckedRegions([]);
      setDetectedSilenceRegions([]);
    } finally {
      setTrimming(false);
    }
  }, [checkedRegions, setDetectedSilenceRegions]);

  const handleClearAll = useCallback(() => {
    setCheckedRegions([]);
    setDetectedSilenceRegions([]);
  }, [setDetectedSilenceRegions]);

  const selectedCount = checkedRegions.filter((r) => r.checked).length;
  const totalSilenceDuration = checkedRegions.reduce(
    (sum, item) => sum + (item.region.end - item.region.start),
    0,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Silence Detection</CardTitle>
        </div>
        {checkedRegions.length > 0 && (
          <Badge variant="outline">
            {checkedRegions.length} region{checkedRegions.length !== 1 && "s"}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Threshold slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Threshold</Label>
            <span className="text-sm text-muted-foreground">{threshold} dB</span>
          </div>
          <Slider
            min={-60}
            max={-20}
            step={1}
            value={[threshold]}
            onValueChange={([v]) => setThreshold(v)}
          />
        </div>

        {/* Min Duration slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Min Duration</Label>
            <span className="text-sm text-muted-foreground">{minDuration.toFixed(1)}s</span>
          </div>
          <Slider
            min={0.1}
            max={3.0}
            step={0.1}
            value={[minDuration]}
            onValueChange={([v]) => setMinDuration(v)}
          />
        </div>

        {/* Detect button */}
        <Button onClick={handleDetect} disabled={detecting} className="w-full">
          {detecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Detect Silence
        </Button>

        {/* Results */}
        {checkedRegions.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Found {checkedRegions.length} silent region
              {checkedRegions.length !== 1 && "s"} ({totalSilenceDuration.toFixed(1)}s total)
            </p>

            <ScrollArea className="max-h-48">
              <div className="space-y-1">
                {checkedRegions.map((item, index) => {
                  const duration = item.region.end - item.region.start;
                  return (
                    <label
                      key={index}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => handleToggleRegion(index)}
                        className="h-4 w-4 rounded border-muted-foreground/50"
                      />
                      <span className="font-mono">
                        {formatTime(item.region.start)} - {formatTime(item.region.end)}
                      </span>
                      <span className="text-muted-foreground">({duration.toFixed(1)}s)</span>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={selectedCount === 0 || trimming}
                onClick={handleTrimSelected}
              >
                {trimming ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Scissors className="mr-2 h-4 w-4" />
                )}
                Trim Selected
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                <XCircle className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditHistorySection() {
  const undoCount = useAudioStore((s) => s.undoCount);
  const redoCount = useAudioStore((s) => s.redoCount);
  const editCount = useAudioStore((s) => s.editCount);
  const audioInfo = useAudioStore((s) => s.audioInfo);

  const handleUndo = useCallback(async () => {
    await undoEdit();
  }, []);

  const handleRedo = useCallback(async () => {
    await redoEdit();
  }, []);

  // Duration stats
  // Original duration is only available if we have audioInfo.
  // Since edits change the audioInfo.duration, we compute:
  // - Final = current audioInfo.duration
  // - Original = we don't have a separate store for original duration,
  //   so we show the current duration and edit count context
  const finalDuration = audioInfo?.duration ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Edit History</CardTitle>
        </div>
        {editCount > 0 && (
          <Badge variant="outline">
            {editCount} edit{editCount !== 1 && "s"}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Undo/Redo buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={undoCount === 0} onClick={handleUndo}>
            <Undo2 className="mr-2 h-4 w-4" />
            Undo
          </Button>
          <Button variant="outline" size="sm" disabled={redoCount === 0} onClick={handleRedo}>
            <Redo2 className="mr-2 h-4 w-4" />
            Redo
          </Button>
        </div>

        {/* Duration stats */}
        <Separator />
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Original</p>
            <p className="text-sm font-medium">
              {finalDuration !== null ? formatTime(finalDuration) : "--:--.-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Trimmed</p>
            <p className="text-sm font-medium">
              {editCount > 0 ? `${editCount} edit${editCount !== 1 ? "s" : ""}` : "--:--.-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Final</p>
            <p className="text-sm font-medium">
              {finalDuration !== null ? formatTime(finalDuration) : "--:--.-"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TrimmingStep() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h2 className="text-lg font-semibold">Trim & Edit</h2>
        <p className="text-sm text-muted-foreground">
          Remove unwanted sections from your audio. Select regions on the waveform or detect and
          trim silent passages automatically.
        </p>
      </div>

      <ManualTrimSection />

      <Separator />

      <SilenceDetectionSection />

      <Separator />

      <EditHistorySection />
    </div>
  );
}
