import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      "@bg": path.resolve(__dirname, "src/background"),
      "@content": path.resolve(__dirname, "src/content"),
      "@ui": path.resolve(__dirname, "src/content/ui")
    }
  }
});