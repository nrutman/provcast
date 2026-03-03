import { invoke } from "@tauri-apps/api/core";
import { type Metadata } from "@/stores/useAudioStore";

export async function readMetadata(path: string): Promise<Metadata> {
  return invoke("read_metadata", { path });
}

export async function updateMetadata(metadata: Metadata): Promise<void> {
  return invoke("update_metadata", { metadata });
}

export async function setAlbumArt(
  imagePath: string,
): Promise<{ width: number; height: number; size_bytes: number }> {
  return invoke("set_album_art", { imagePath });
}
