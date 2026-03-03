import { useState } from "react";
import { useAudioStore } from "@/stores/audio-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  applyCompression,
  applyNoiseReduction,
  detectSilence,
  trimSilence,
  type SilenceRegion,
} from "@/hooks/use-tauri-audio";

export function ProcessingPanel() {
  const filePath = useAudioStore((s) => s.filePath);

  // Compression params
  const [threshold, setThreshold] = useState(-20);
  const [ratio, setRatio] = useState(4);
  const [attack, setAttack] = useState(10);
  const [release, setRelease] = useState(100);
  const [makeupGain, setMakeupGain] = useState(0);

  // Noise reduction
  const [noiseStrength, setNoiseStrength] = useState(50);

  // Silence detection
  const [silenceThreshold, setSilenceThreshold] = useState(-40);
  const [minSilenceDuration, setMinSilenceDuration] = useState(2);
  const [keepDuration, setKeepDuration] = useState(0.5);
  const [detectedSilence, setDetectedSilence] = useState<SilenceRegion[]>([]);

  const [processing, setProcessing] = useState(false);

  if (!filePath) return null;

  async function handleCompression() {
    setProcessing(true);
    try {
      await applyCompression({
        threshold_db: threshold,
        ratio,
        attack_ms: attack,
        release_ms: release,
        makeup_gain_db: makeupGain,
      });
    } finally {
      setProcessing(false);
    }
  }

  async function handleNoiseReduction() {
    setProcessing(true);
    try {
      await applyNoiseReduction(noiseStrength / 100);
    } finally {
      setProcessing(false);
    }
  }

  async function handleDetectSilence() {
    setProcessing(true);
    try {
      const regions = await detectSilence(silenceThreshold, minSilenceDuration);
      setDetectedSilence(regions);
    } finally {
      setProcessing(false);
    }
  }

  async function handleTrimSilence() {
    setProcessing(true);
    try {
      await trimSilence(detectedSilence, keepDuration);
      setDetectedSilence([]);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-semibold">Processing</h3>

      {/* Compression */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground">Compression</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Threshold</Label>
            <span className="text-xs text-muted-foreground">{threshold} dB</span>
          </div>
          <Slider
            value={[threshold]}
            onValueChange={([v]) => setThreshold(v)}
            min={-60}
            max={0}
            step={1}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Ratio</Label>
            <span className="text-xs text-muted-foreground">{ratio}:1</span>
          </div>
          <Slider
            value={[ratio]}
            onValueChange={([v]) => setRatio(v)}
            min={1}
            max={20}
            step={0.5}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Attack</Label>
            <span className="text-xs text-muted-foreground">{attack} ms</span>
          </div>
          <Slider
            value={[attack]}
            onValueChange={([v]) => setAttack(v)}
            min={0.1}
            max={100}
            step={0.1}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Release</Label>
            <span className="text-xs text-muted-foreground">{release} ms</span>
          </div>
          <Slider
            value={[release]}
            onValueChange={([v]) => setRelease(v)}
            min={10}
            max={1000}
            step={10}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Makeup Gain</Label>
            <span className="text-xs text-muted-foreground">{makeupGain} dB</span>
          </div>
          <Slider
            value={[makeupGain]}
            onValueChange={([v]) => setMakeupGain(v)}
            min={0}
            max={30}
            step={1}
          />
        </div>
        <Button size="sm" className="w-full" onClick={handleCompression} disabled={processing}>
          Apply Compression
        </Button>
      </div>

      <Separator />

      {/* Noise Reduction */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground">Noise Reduction</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Strength</Label>
            <span className="text-xs text-muted-foreground">{noiseStrength}%</span>
          </div>
          <Slider
            value={[noiseStrength]}
            onValueChange={([v]) => setNoiseStrength(v)}
            min={0}
            max={100}
            step={1}
          />
        </div>
        <Button size="sm" className="w-full" onClick={handleNoiseReduction} disabled={processing}>
          Apply Noise Reduction
        </Button>
      </div>

      <Separator />

      {/* Silence Trimming */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground">Silence Trimming</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Threshold</Label>
            <span className="text-xs text-muted-foreground">{silenceThreshold} dB</span>
          </div>
          <Slider
            value={[silenceThreshold]}
            onValueChange={([v]) => setSilenceThreshold(v)}
            min={-60}
            max={-10}
            step={1}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Min Duration</Label>
            <span className="text-xs text-muted-foreground">{minSilenceDuration}s</span>
          </div>
          <Slider
            value={[minSilenceDuration]}
            onValueChange={([v]) => setMinSilenceDuration(v)}
            min={0.5}
            max={10}
            step={0.5}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Keep Duration</Label>
            <span className="text-xs text-muted-foreground">{keepDuration}s</span>
          </div>
          <Slider
            value={[keepDuration]}
            onValueChange={([v]) => setKeepDuration(v)}
            min={0}
            max={3}
            step={0.1}
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={handleDetectSilence}
            disabled={processing}
          >
            Detect
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleTrimSilence}
            disabled={processing || detectedSilence.length === 0}
          >
            Trim ({detectedSilence.length})
          </Button>
        </div>
      </div>
    </div>
  );
}
