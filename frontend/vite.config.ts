import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";

// Shown in the Android app's footer (the Docker build has no VERSION file; it doesn't need it).
const versionFile = new URL("../VERSION", import.meta.url);
const version = existsSync(versionFile) ? readFileSync(versionFile, "utf8").trim() : "dev";

export default defineConfig(({ mode }) => ({
  // GitHub Pages lives under /<repo>/ and the Android app loads from disk, so use relative paths.
  base: mode === "static" || mode === "app" ? "./" : "/",
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
}));
