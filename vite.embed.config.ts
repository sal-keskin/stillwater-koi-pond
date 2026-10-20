import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: { entry: "src/embed.ts", name: "Stillwater", formats: ["es", "iife"], fileName: (format) => format === "es" ? "stillwater.js" : "stillwater.global.js" },
  },
});
