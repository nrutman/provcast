import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAudioStore, type Metadata } from "@/stores/useAudioStore";
import { updateMetadata, setAlbumArt } from "@/hooks/tauri/metadata";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Image, Save, Trash2, Upload } from "lucide-react";

export function MetadataStep() {
  const metadata = useAudioStore((s) => s.metadata);
  const setMetadata = useAudioStore((s) => s.setMetadata);

  const [form, setForm] = useState<Metadata>({ ...metadata });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ ...metadata });
  }, [metadata]);

  function handleChange(field: keyof Metadata, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const handleChooseImage = useCallback(async () => {
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
      await setAlbumArt(path);
      setForm((prev) => ({ ...prev, albumArt: path }));
      setMetadata({ albumArt: path });
    }
  }, [setMetadata]);

  function handleRemoveArt() {
    setForm((prev) => ({ ...prev, albumArt: null }));
    setMetadata({ albumArt: null });
  }

  async function handleSave() {
    setSaving(true);
    try {
      setMetadata(form);
      await updateMetadata(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Album Art Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Image className="h-4 w-4" />
            Album Art
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-secondary/50">
              {form.albumArt ? (
                <img
                  src={`asset://localhost/${form.albumArt}`}
                  alt="Album art"
                  className="h-full w-full rounded-md object-cover"
                />
              ) : (
                <Image className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" onClick={handleChooseImage}>
                <Upload className="mr-2 h-4 w-4" />
                Choose Image
              </Button>
              {form.albumArt && (
                <Button variant="ghost" size="sm" onClick={handleRemoveArt}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata Fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ID3 Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="metadata-title">Title</Label>
              <Input
                id="metadata-title"
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metadata-artist">Artist</Label>
              <Input
                id="metadata-artist"
                value={form.artist}
                onChange={(e) => handleChange("artist", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metadata-album">Album</Label>
              <Input
                id="metadata-album"
                value={form.album}
                onChange={(e) => handleChange("album", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metadata-genre">Genre</Label>
              <Input
                id="metadata-genre"
                value={form.genre}
                onChange={(e) => handleChange("genre", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metadata-year">Year</Label>
              <Input
                id="metadata-year"
                value={form.year}
                onChange={(e) => handleChange("year", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metadata-track">Track Number</Label>
              <Input
                id="metadata-track"
                value={form.trackNumber}
                onChange={(e) => handleChange("trackNumber", e.target.value)}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="metadata-comment">Comment</Label>
            <textarea
              id="metadata-comment"
              value={form.comment}
              onChange={(e) => handleChange("comment", e.target.value)}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={3}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="metadata-copyright">Copyright</Label>
              <Input
                id="metadata-copyright"
                value={form.copyright}
                onChange={(e) => handleChange("copyright", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metadata-publisher">Publisher</Label>
              <Input
                id="metadata-publisher"
                value={form.publisher}
                onChange={(e) => handleChange("publisher", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="metadata-url">URL</Label>
              <Input
                id="metadata-url"
                value={form.url}
                onChange={(e) => handleChange("url", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button className="w-full" onClick={handleSave} disabled={saving}>
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Saving..." : "Save Metadata"}
      </Button>
    </div>
  );
}
