import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  // GitHub Pages lives under /<repo>/ and the Android app loads from disk, so use relative paths.
  base: mode === "static" || mode === "app" ? "./" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
}));
