import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
      "@tauri-apps/plugin-dialog": path.resolve(
        __dirname,
        "./app/test/__mocks__/@tauri-apps/plugin-dialog.ts",
      ),
      "@tauri-apps/api/core": path.resolve(
        __dirname,
        "./app/test/__mocks__/@tauri-apps/api/core.ts",
      ),
      "@tauri-apps/api/event": path.resolve(
        __dirname,
        "./app/test/__mocks__/@tauri-apps/api/event.ts",
      ),
      "@tauri-apps/api": path.resolve(
        __dirname,
        "./app/test/__mocks__/@tauri-apps/api.ts",
      ),
      "@wavesurfer/react": path.resolve(
        __dirname,
        "./app/test/__mocks__/wavesurfer.ts",
      ),
      "wavesurfer.js/dist/plugins/regions.js": path.resolve(
        __dirname,
        "./app/test/__mocks__/wavesurfer-plugins.ts",
      ),
      "wavesurfer.js/dist/plugins/minimap.js": path.resolve(
        __dirname,
        "./app/test/__mocks__/wavesurfer-plugins.ts",
      ),
      "wavesurfer.js/dist/plugins/timeline.js": path.resolve(
        __dirname,
        "./app/test/__mocks__/wavesurfer-plugins.ts",
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./app/test/setup.ts"],
    include: ["app/**/*.test.{ts,tsx}"],
  },
});
