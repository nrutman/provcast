import { invoke } from "@tauri-apps/api/core";
import { type ExportParams, type SizeEstimate, type ExportPreviewParams } from "./types";

export async function estimateExportSize(params: ExportParams): Promise<SizeEstimate> {
  return invoke("estimate_export_size", { params });
}

export async function exportMp3(
  params: ExportParams,
  outputPath: string,
): Promise<{ path: string; size_bytes: number }> {
  return invoke("export_mp3", { params, outputPath });
}

export async function previewExport(params: ExportPreviewParams): Promise<string> {
  return invoke("preview_export", { params });
}
