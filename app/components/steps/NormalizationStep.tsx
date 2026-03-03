import { useState, useEffect, useCallback } from "react";
import { useAudioStore } from "@/stores/useAudioStore";
import { useUIStore } from "@/stores/useUIStore";
import {
  applyCompression,
  applyNoiseReduction,
  findQuietestRegion,
  previewEffect,
  stopPreview,
} from "@/hooks/tauri/processing";
import { type SilenceRegion } from "@/hooks/tauri/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Volume2, AudioLines, Check, Loader2 } from "lucide-react";

export function NormalizationStep() {
  const setPreviewMode = useAudioStore((s) => s.setPreviewMode);
  const currentStep = useUIStore((s) => s.currentStep);

  // Clean up preview when navigating away from this step
  useEffect(() => {
    return () => {
      stopPreview();
      setPreviewMode(null);
    };
  }, [currentStep, setPreviewMode]);

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h2 className="text-lg font-semibold">Audio Normalization</h2>
        <p className="text-sm text-muted-foreground">
          Apply compression and noise reduction to improve your audio quality. Use the A/B toggle to
          compare before and after.
        </p>
      </div>

      <CompressionSection />

      <Separator />

      <NoiseReductionSection />
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function ABToggle({
  previewMode,
  onOriginal,
  onProcessed,
  disabled,
}: {
  previewMode: "original" | "processed" | null;
  onOriginal: () => void;
  onProcessed: () => void;
  disabled?: boolean;
}) {
  const isOriginal = previewMode !== "processed";

  return (
    <div className="flex rounded-md border">
      <Button
        variant={isOriginal ? "default" : "ghost"}
        size="sm"
        className="rounded-r-none"
        onClick={onOriginal}
        disabled={disabled}
      >
        Original
      </Button>
      <Button
        variant={!isOriginal ? "default" : "ghost"}
        size="sm"
        className="rounded-l-none"
        onClick={onProcessed}
        disabled={disabled}
      >
        Processed
      </Button>
    </div>
  );
}

function CompressionSection() {
  const [threshold, setThreshold] = useState(-20);
  const [ratio, setRatio] = useState(4);
  const [attack, setAttack] = useState(10);
  const [release, setRelease] = useState(100);
  const [makeupGain, setMakeupGain] = useState(0);
  const [applying, setApplying] = useState(false);

  const previewMode = useAudioStore((s) => s.previewMode);
  const compressionApplied = useAudioStore((s) => s.compressionApplied);
  const setPreviewMode = useAudioStore((s) => s.setPreviewMode);
  const setCompressionApplied = useAudioStore((s) => s.setCompressionApplied);

  const handlePreviewOriginal = useCallback(async () => {
    await stopPreview();
    setPreviewMode("original");
  }, [setPreviewMode]);

  const handlePreviewProcessed = useCallback(async () => {
    await previewEffect({
      effectType: "compression",
      thresholdDb: threshold,
      ratio,
      attackMs: attack,
      releaseMs: release,
      makeupGainDb: makeupGain,
    });
    setPreviewMode("processed");
  }, [threshold, ratio, attack, release, makeupGain, setPreviewMode]);

  const handleApply = useCallback(async () => {
    setApplying(true);
    try {
      await applyCompression({
        threshold_db: threshold,
        ratio,
        attack_ms: attack,
        release_ms: release,
        makeup_gain_db: makeupGain,
      });
      setCompressionApplied(true);
      await stopPreview();
      setPreviewMode(null);
    } finally {
      setApplying(false);
    }
  }, [threshold, ratio, attack, release, makeupGain, setCompressionApplied, setPreviewMode]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <Volume2 className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Compression</CardTitle>
        </div>
        <Badge variant={compressionApplied ? "default" : "outline"}>
          {compressionApplied ? (
            <>
              <Check className="mr-1 h-3 w-3" /> Applied
            </>
          ) : (
            "Not applied"
          )}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Threshold</Label>
              <span className="text-sm text-muted-foreground">{threshold} dB</span>
            </div>
            <Slider
              min={-60}
              max={0}
              step={1}
              value={[threshold]}
              onValueChange={([v]) => setThreshold(v)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ratio</Label>
              <span className="text-sm text-muted-foreground">{ratio}:1</span>
            </div>
            <Slider
              min={1}
              max={20}
              step={0.5}
              value={[ratio]}
              onValueChange={([v]) => setRatio(v)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Attack</Label>
              <span className="text-sm text-muted-foreground">{attack} ms</span>
            </div>
            <Slider
              min={0.1}
              max={100}
              step={0.1}
              value={[attack]}
              onValueChange={([v]) => setAttack(v)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Release</Label>
              <span className="text-sm text-muted-foreground">{release} ms</span>
            </div>
            <Slider
              min={10}
              max={1000}
              step={10}
              value={[release]}
              onValueChange={([v]) => setRelease(v)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Makeup Gain</Label>
              <span className="text-sm text-muted-foreground">{makeupGain} dB</span>
            </div>
            <Slider
              min={0}
              max={30}
              step={0.5}
              value={[makeupGain]}
              onValueChange={([v]) => setMakeupGain(v)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <ABToggle
            previewMode={previewMode}
            onOriginal={handlePreviewOriginal}
            onProcessed={handlePreviewProcessed}
          />
          <Button onClick={handleApply} disabled={applying}>
            {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply Compression
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NoiseReductionSection() {
  const [strength, setStrength] = useState(0.7);
  const [applying, setApplying] = useState(false);
  const [quietRegion, setQuietRegion] = useState<SilenceRegion | null>(null);
  const [regionAccepted, setRegionAccepted] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const previewMode = useAudioStore((s) => s.previewMode);
  const noiseReductionApplied = useAudioStore((s) => s.noiseReductionApplied);
  const setPreviewMode = useAudioStore((s) => s.setPreviewMode);
  const setNoiseReductionApplied = useAudioStore((s) => s.setNoiseReductionApplied);
  const setDetectedSilenceRegions = useAudioStore((s) => s.setDetectedSilenceRegions);
  const currentStep = useUIStore((s) => s.currentStep);

  useEffect(() => {
    if (currentStep !== 3) return;
    let cancelled = false;

    async function detect() {
      setDetecting(true);
      try {
        const region = await findQuietestRegion(0.5);
        if (!cancelled && region) {
          setQuietRegion(region);
        }
      } catch {
        // Quiet region detection may fail if no audio loaded
      } finally {
        if (!cancelled) setDetecting(false);
      }
    }

    detect();
    return () => {
      cancelled = true;
    };
  }, [currentStep]);

  const handleUseRegion = useCallback(() => {
    if (quietRegion) {
      setDetectedSilenceRegions([quietRegion]);
      setRegionAccepted(true);
    }
  }, [quietRegion, setDetectedSilenceRegions]);

  const handlePreviewOriginal = useCallback(async () => {
    await stopPreview();
    setPreviewMode("original");
  }, [setPreviewMode]);

  const handlePreviewProcessed = useCallback(async () => {
    await previewEffect({
      effectType: "noise_reduction",
      strength,
    });
    setPreviewMode("processed");
  }, [strength, setPreviewMode]);

  const handleApply = useCallback(async () => {
    setApplying(true);
    try {
      await applyNoiseReduction(strength);
      setNoiseReductionApplied(true);
      await stopPreview();
      setPreviewMode(null);
    } finally {
      setApplying(false);
    }
  }, [strength, setNoiseReductionApplied, setPreviewMode]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <AudioLines className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Noise Reduction</CardTitle>
        </div>
        <Badge variant={noiseReductionApplied ? "default" : "outline"}>
          {noiseReductionApplied ? (
            <>
              <Check className="mr-1 h-3 w-3" /> Applied
            </>
          ) : (
            "Not applied"
          )}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Quiet region detection */}
        <div className="rounded-md border bg-muted/50 p-3">
          {detecting ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Detecting quiet region for noise profile...
            </div>
          ) : quietRegion ? (
            <div className="space-y-2">
              <p className="text-sm">
                A quiet section was found at{" "}
                <span className="font-medium">
                  {formatTime(quietRegion.start)}-{formatTime(quietRegion.end)}
                </span>
              </p>
              {!regionAccepted ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleUseRegion}>
                    Use this region
                  </Button>
                  <Button size="sm" variant="outline">
                    Select manually on waveform
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <Check className="mr-1 inline h-3 w-3" />
                  Noise profile region selected
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No quiet region detected. You can select a region manually on the waveform.
            </p>
          )}
        </div>

        {/* Strength slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Strength</Label>
            <span className="text-sm text-muted-foreground">{strength.toFixed(2)}</span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[strength]}
            onValueChange={([v]) => setStrength(v)}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <ABToggle
            previewMode={previewMode}
            onOriginal={handlePreviewOriginal}
            onProcessed={handlePreviewProcessed}
          />
          <Button onClick={handleApply} disabled={applying}>
            {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply Noise Reduction
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
