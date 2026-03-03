import { useAudioStore } from "@/stores/audio-store";
import { updateMetadata } from "@/hooks/use-tauri-audio";
import { AlbumArtEditor } from "./album-art-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export function MetadataEditor() {
  const filePath = useAudioStore((s) => s.filePath);
  const metadata = useAudioStore((s) => s.metadata);
  const setMetadata = useAudioStore((s) => s.setMetadata);

  if (!filePath) return null;

  function handleChange(field: string, value: string) {
    setMetadata({ [field]: value });
  }

  async function handleSave() {
    await updateMetadata(metadata);
  }

  return (
    <div className="space-y-4 border-t border-border p-4">
      <h3 className="text-sm font-semibold">Metadata</h3>

      <AlbumArtEditor />

      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground">Basic</h4>
        <Field label="Title" value={metadata.title} onChange={(v) => handleChange("title", v)} />
        <Field
          label="Artist / Host"
          value={metadata.artist}
          onChange={(v) => handleChange("artist", v)}
        />
        <Field
          label="Album / Show"
          value={metadata.album}
          onChange={(v) => handleChange("album", v)}
        />
        <div className="flex gap-2">
          <Field
            label="Episode #"
            value={metadata.trackNumber}
            onChange={(v) => handleChange("trackNumber", v)}
            className="flex-1"
          />
          <Field
            label="Year"
            value={metadata.year}
            onChange={(v) => handleChange("year", v)}
            className="flex-1"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground">Description</h4>
        <div className="space-y-1">
          <Label className="text-xs">Show Notes</Label>
          <textarea
            value={metadata.comment}
            onChange={(e) => handleChange("comment", e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={3}
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground">Additional</h4>
        <Field label="Genre" value={metadata.genre} onChange={(v) => handleChange("genre", v)} />
        <Field
          label="Copyright"
          value={metadata.copyright}
          onChange={(v) => handleChange("copyright", v)}
        />
        <Field
          label="Publisher"
          value={metadata.publisher}
          onChange={(v) => handleChange("publisher", v)}
        />
        <Field label="URL" value={metadata.url} onChange={(v) => handleChange("url", v)} />
      </div>

      <Button size="sm" className="w-full" onClick={handleSave}>
        Save Metadata
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" />
    </div>
  );
}
