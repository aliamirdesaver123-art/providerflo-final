import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

const isReplit = process.env.REPL_ID !== undefined;

async function replitPlugins() {
  if (!isReplit) return [];
  const plugins = [];
  try {
    const m = await import("@replit/vite-plugin-runtime-error-modal");
    plugins.push(m.default());
  } catch {}
  if (process.env.NODE_ENV !== "production") {
    try {
      const m = await import("@replit/vite-plugin-cartographer");
      plugins.push(m.cartographer({ root: path.resolve(import.meta.dirname, "..") }));
    } catch {}
    try {
      const m = await import("@replit/vite-plugin-dev-banner");
      plugins.push(m.devBanner());
    } catch {}
  }
  return plugins;
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(await replitPlugins()),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
