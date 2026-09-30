import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  // `npm run build:static` (GitHub Pages) lives under /<repo>/, so use relative paths.
  base: mode === "static" ? "./" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
}));
