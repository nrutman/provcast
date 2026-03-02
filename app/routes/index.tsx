import { createFileRoute } from "@tanstack/react-router";
import { WaveformEditor } from "@/components/waveform-editor";
import { AudioControls } from "@/components/audio-controls";
import { ProcessingPanel } from "@/components/processing-panel";
import { MetadataEditor } from "@/components/metadata-editor";
import { useAudioStore } from "@/stores/audio-store";

export const Route = createFileRoute("/")({
  component: EditorView,
});

function EditorView() {
  const hasFile = useAudioStore((s) => s.filePath !== null);

  if (!hasFile) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-muted-foreground">
            No file loaded
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Open an audio file to get started (Ctrl+O)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        <WaveformEditor />
        <AudioControls />
      </div>
      <div className="w-80 overflow-y-auto border-l border-border">
        <ProcessingPanel />
        <MetadataEditor />
      </div>
    </div>
  );
}
