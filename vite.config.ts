/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { playwright } from "@vitest/browser-playwright";
import dts from "unplugin-dts/vite";

export default defineConfig({
  build: {
    lib: { entry: "./src/main.ts", formats: ["es"], fileName: "dadata-suggestions" },
  },
  plugins: [vue(), dts({ tsconfigPath: "./tsconfig.app.json", include: "./src/**/*", entryRoot: "./src" })],
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      screenshotFailures: false,
    },
    include: ["test/specs/*.js"],
    setupFiles: ["test/setup.js"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
});
