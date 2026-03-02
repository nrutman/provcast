import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAudioStore } from "@/stores/audio-store";
import { setAlbumArt } from "@/hooks/use-tauri-audio";
import { Button } from "@/components/ui/button";
import { ImagePlus } from "lucide-react";

export function AlbumArtEditor() {
  const albumArt = useAudioStore((s) => s.metadata.albumArt);
  const setMetadata = useAudioStore((s) => s.setMetadata);
  const [artInfo, setArtInfo] = useState<{
    width: number;
    height: number;
    size_bytes: number;
  } | null>(null);

  const handleSelectArt = useCallback(async () => {
    const path = await open({
      multiple: false,
      filters: [
        {
          name: "Images",
          extensions: ["jpg", "jpeg", "png"],
        },
      ],
    });
    if (path) {
      const info = await setAlbumArt(path);
      setArtInfo(info);
      setMetadata({ albumArt: path });
    }
  }, [setMetadata]);

  return (
    <div className="space-y-2">
      <div
        className="flex aspect-square w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-secondary/50 hover:bg-secondary"
        onClick={handleSelectArt}
      >
        {albumArt ? (
          <img
            src={`asset://localhost/${albumArt}`}
            alt="Album art"
            className="h-full w-full rounded-md object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImagePlus className="h-8 w-8" />
            <span className="text-xs">Click to add album art</span>
          </div>
        )}
      </div>
      {artInfo && (
        <div className="text-xs text-muted-foreground">
          {artInfo.width}x{artInfo.height} &middot;{" "}
          {(artInfo.size_bytes / 1024).toFixed(1)} KB
          {artInfo.size_bytes > 256000 && (
            <span className="ml-1 text-destructive">
              (large — may increase file size)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
