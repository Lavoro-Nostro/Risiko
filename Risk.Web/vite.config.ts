import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@packs": path.resolve(__dirname, "../packs")
    }
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")]
    }
  },
  test: {
    environment: "node"
  }
});
