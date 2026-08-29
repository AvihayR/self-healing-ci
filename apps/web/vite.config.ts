import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", sourcemap: true },
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
