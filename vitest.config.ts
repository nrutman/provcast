import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
      "@tauri-apps/api/event": path.resolve(
        __dirname,
        "./app/test/__mocks__/@tauri-apps/api/event.ts",
      ),
      "@tauri-apps/api": path.resolve(
        __dirname,
        "./app/test/__mocks__/@tauri-apps/api.ts",
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
