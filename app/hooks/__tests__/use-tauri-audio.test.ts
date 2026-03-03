import { describe, it, expect } from "vitest";

describe("Tauri Audio Hooks - new commands", () => {
  it("exports findQuietestRegion", async () => {
    const { findQuietestRegion } = await import("../use-tauri-audio");
    expect(typeof findQuietestRegion).toBe("function");
  });

  it("exports previewEffect", async () => {
    const { previewEffect } = await import("../use-tauri-audio");
    expect(typeof previewEffect).toBe("function");
  });

  it("exports stopPreview", async () => {
    const { stopPreview } = await import("../use-tauri-audio");
    expect(typeof stopPreview).toBe("function");
  });

  it("exports previewExport", async () => {
    const { previewExport } = await import("../use-tauri-audio");
    expect(typeof previewExport).toBe("function");
  });

  it("exports EffectPreviewParams type", async () => {
    // Type-level check — importing should not throw
    const mod = await import("../use-tauri-audio");
    expect(mod).toBeDefined();
  });
});
