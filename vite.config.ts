import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { dependencies, name } from "./package.json";

export default defineConfig({
  build: {
    lib: { entry: "./src/main.ts", formats: ["es"], fileName: name },
    rolldownOptions: { external: Object.keys(dependencies) },
  },
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
});
