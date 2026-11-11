import { defineConfig } from "vite";

export default defineConfig({
  // Göreli yollar: GitHub Pages'te /imaj-cad/ altında da çalışır.
  base: "./",
  worker: { format: "es" },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    exclude: ["replicad-opencascadejs"],
  },
});
