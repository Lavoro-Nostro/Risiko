import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const packsDir = fileURLToPath(new URL("../packs", import.meta.url));
const rootDir = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@packs": packsDir
    }
  },
  server: {
    fs: {
      allow: [rootDir]
    }
  },
  test: {
    environment: "node"
  }
});
