import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_TARGET = process.env["VITE_API_TARGET"] ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", sourcemap: true },
  server: {
    port: 5173,
    // The app calls the API on its own origin, which is how it will work in
    // production behind a single CloudFront distribution with an /api/*
    // behaviour. In development the dev server stands in for that routing, so
    // there is one fetch path rather than a CORS-shaped difference between
    // local and deployed.
    proxy: {
      "/monitors": { target: API_TARGET, changeOrigin: true },
      "/healthz": { target: API_TARGET, changeOrigin: true },
    },
  },
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
