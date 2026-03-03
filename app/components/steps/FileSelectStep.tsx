import { open } from "@tauri-apps/plugin-dialog";
import { useAudioStore, type AudioInfo } from "@/stores/useAudioStore";
import { useUIStore } from "@/stores/useUIStore";
import { loadAudio } from "@/hooks/tauri/playback";
import { readMetadata } from "@/hooks/tauri/metadata";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileAudio, Upload, RefreshCw } from "lucide-react";

export function FileSelectStep() {
  const filePath = useAudioStore((s) => s.filePath);
  const audioInfo = useAudioStore((s) => s.audioInfo);

  if (filePath && audioInfo) {
    return <FileInfo filePath={filePath} audioInfo={audioInfo} />;
  }

  return <DropZone />;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatSampleRate(rate: number): string {
  return `${(rate / 1000).toFixed(1)} kHz`;
}

function formatChannels(channels: number): string {
  if (channels === 1) return "Mono";
  if (channels === 2) return "Stereo";
  return `${channels} channels`;
}

async function handleBrowse() {
  const path = await open({
    multiple: false,
    filters: [
      {
        name: "Audio Files",
        extensions: ["mp3", "wav", "aiff", "aif", "flac", "ogg", "m4a"],
      },
    ],
  });

  if (!path) return;

  const info = await loadAudio(path);
  useAudioStore.getState().setFile(path, info);

  try {
    const metadata = await readMetadata(path);
    useAudioStore.getState().setMetadata(metadata);
  } catch {
    // File may not have metadata tags
  }

  useUIStore.getState().setFileLoaded(true);
  useUIStore.getState().setCurrentStep(2);
}

function DropZone() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-6 p-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Upload className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">Drop an audio file here or click to browse</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Supports: MP3, WAV, FLAC, OGG, AIFF
            </p>
          </div>
          <Button onClick={handleBrowse} size="lg">
            <FileAudio className="mr-2 h-4 w-4" />
            Browse files
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function FileInfo({ filePath, audioInfo }: { filePath: string; audioInfo: AudioInfo }) {
  const fileName = filePath.split("/").pop() ?? filePath;

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-6 p-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <FileAudio className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">{fileName}</p>
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-muted-foreground">
              <span>Duration</span>
              <span className="font-medium text-foreground">
                {formatDuration(audioInfo.duration)}
              </span>
              <span>Format</span>
              <span className="font-medium text-foreground">{audioInfo.format.toUpperCase()}</span>
              <span>Sample Rate</span>
              <span className="font-medium text-foreground">
                {formatSampleRate(audioInfo.sampleRate)}
              </span>
              <span>Channels</span>
              <span className="font-medium text-foreground">
                {formatChannels(audioInfo.channels)}
              </span>
            </div>
          </div>
          <Button variant="outline" onClick={handleBrowse}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Load different file
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
