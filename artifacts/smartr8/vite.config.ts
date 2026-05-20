import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { existsSync } from "fs";
import type { Plugin } from "vite";

const isProd = process.env.NODE_ENV === "production";
const isDevServer = !isProd;

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : undefined;

if (isDevServer) {
  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }
  if (port === undefined || Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }
}

const basePath = process.env.BASE_PATH ?? "/";

// ─── Fix: @react-pdf/pdfkit imports pako deep subpaths (e.g. pako/lib/zlib/zstream.js)
// Pako v2 restricts subpath access via its exports map, breaking production builds.
// We redirect those imports to the pako v1 installation which has the full lib/ tree.
function findPakoV1LibPath(): string | null {
  const candidates = [
    // pnpm store paths — try multiple patch levels
    "node_modules/.pnpm/pako@1.0.11/node_modules/pako/lib",
    "node_modules/.pnpm/pako@1.0.10/node_modules/pako/lib",
    "node_modules/.pnpm/pako@1.0.9/node_modules/pako/lib",
    // workspace root (two levels up from this file)
    "../../node_modules/.pnpm/pako@1.0.11/node_modules/pako/lib",
    "../../node_modules/.pnpm/pako@1.0.10/node_modules/pako/lib",
  ];
  for (const rel of candidates) {
    const abs = path.resolve(import.meta.dirname, rel);
    if (existsSync(path.join(abs, "zlib/zstream.js"))) return abs;
  }
  return null;
}

const pakoV1LibPath = findPakoV1LibPath();

function fixPakoPlugin(): Plugin {
  return {
    name: "fix-pako-subpath-imports",
    resolveId(id) {
      if (id.startsWith("pako/lib/")) {
        if (!pakoV1LibPath) return null;
        const subpath = id.slice("pako/lib/".length);
        const resolved = path.join(pakoV1LibPath, subpath);
        if (existsSync(resolved)) return resolved;
      }
      return null;
    },
  };
}

function nonBlockingCssPlugin(): Plugin {
  // Vite emits <link rel="stylesheet" crossorigin href="/assets/index-*.css">
  // in production. That tag is render-blocking. Swap it to a preload + onload
  // promotion so the browser can paint immediately, with a <noscript> fallback
  // for JS-disabled crawlers. Pattern: https://web.dev/articles/defer-non-critical-css
  return {
    name: "non-blocking-css",
    enforce: "post",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        /<link\s+rel="stylesheet"([^>]*?)href="([^"]+\.css)"([^>]*)>/g,
        (_match, before, href, after) => {
          const attrs = `${before}href="${href}"${after}`.trim();
          return (
            `<link rel="preload" as="style" ${attrs} onload="this.onload=null;this.rel='stylesheet'">` +
            `<noscript><link rel="stylesheet" ${attrs}></noscript>`
          );
        },
      );
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    fixPakoPlugin(),
    react(),
    tailwindcss(),
    nonBlockingCssPlugin(),
    ...(isDevServer && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
            m.default(),
          ),
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  optimizeDeps: {
    exclude: ["@react-pdf/renderer", "@react-pdf/pdfkit"],
  },
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
    target: "es2020",
  },
  server: {
    port: port ?? 5173,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port: port ?? 5173,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
