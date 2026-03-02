import { open, save } from "@tauri-apps/plugin-dialog";
import { useAudioStore } from "@/stores/audio-store";
import { useUIStore } from "@/stores/ui-store";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import {
  loadAudio,
  undoEdit,
  redoEdit,
  readMetadata,
} from "@/hooks/use-tauri-audio";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FolderOpen,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
} from "lucide-react";

export function Toolbar() {
  useKeyboardShortcuts();

  const filePath = useAudioStore((s) => s.filePath);
  const undoCount = useAudioStore((s) => s.undoCount);
  const redoCount = useAudioStore((s) => s.redoCount);
  const zoomIn = useUIStore((s) => s.zoomIn);
  const zoomOut = useUIStore((s) => s.zoomOut);
  const setExportDialogOpen = useUIStore((s) => s.setExportDialogOpen);

  async function handleOpen() {
    const path = await open({
      multiple: false,
      filters: [
        {
          name: "Audio Files",
          extensions: ["mp3", "wav", "aiff", "aif", "flac", "ogg", "m4a"],
        },
      ],
    });
    if (path) {
      const info = await loadAudio(path);
      useAudioStore.getState().setFile(path, info);
      try {
        const metadata = await readMetadata(path);
        useAudioStore.getState().setMetadata(metadata);
      } catch {
        // File may not have metadata
      }
    }
  }

  const fileName = filePath ? filePath.split("/").pop() : null;

  return (
    <div className="flex h-12 items-center gap-1 border-b border-border bg-card px-3">
      <div className="flex items-center gap-1">
        <span className="mr-2 text-sm font-bold text-primary">Provcast</span>
        <Button variant="ghost" size="sm" onClick={handleOpen} title="Open file (Ctrl+O)">
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => undoEdit()}
          disabled={undoCount === 0}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => redoEdit()}
          disabled={redoCount === 0}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={zoomIn} title="Zoom in (Ctrl+=)">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={zoomOut} title="Zoom out (Ctrl+-)">
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1" />

      {fileName && (
        <span className="mr-3 text-sm text-muted-foreground">{fileName}</span>
      )}

      <Button
        variant="default"
        size="sm"
        onClick={() => setExportDialogOpen(true)}
        disabled={!filePath}
        title="Export MP3 (Ctrl+E)"
      >
        <Download className="mr-1 h-4 w-4" />
        Export
      </Button>
    </div>
  );
}
