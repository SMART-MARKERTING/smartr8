#!/usr/bin/env node
/**
 * dev.js — Replit Expo dev startup shim.
 *
 * Problem: Metro prints "Web is waiting on http://localhost:PORT" before it
 * actually binds the TCP socket (bundle compilation happens first, ~2 min).
 * Replit's workflow port-detection times out waiting for the port to open.
 * Additionally, port 8081 is occupied by the mockup-sandbox service, causing
 * Metro to hang on an interactive "Use a different port?" prompt.
 *
 * Solution:
 *  1. Immediately serve the pre-built static web export on PORT — the port
 *     opens in < 1 second and the platform health-check passes right away.
 *     The web preview always shows this static build (instant, no Metro needed).
 *  2. Launch Expo Metro on METRO_PORT (19001) in the background with
 *     --non-interactive so it never hangs on a port-conflict prompt.
 *     This keeps the QR-code / Expo Go tunnel working for native device testing.
 */

const fs      = require("fs");
const http    = require("http");
const path    = require("path");
const { spawn } = require("child_process");

const PROXY_PORT  = parseInt(process.env.PORT || "21804", 10);
const METRO_PORT  = 19001; // Fixed port — well away from 8081 (mockup-sandbox) and 8080 (api-server)
const STATIC_DIR  = path.resolve(__dirname, "..", "web-export");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".ico":  "image/x-icon",
  ".ttf":  "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".svg":  "image/svg+xml",
};

// ── helpers ──────────────────────────────────────────────────────────────────

function serveStatic(urlPath, res) {
  // Strip the /mobile/ base-path prefix if present (added by the Replit proxy)
  let safePath = urlPath.replace(/^\/mobile(\/|$)/, "/");
  safePath = path.normalize(safePath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (safePath === "/" || safePath === "") safePath = "/index.html";

  const filePath = path.join(STATIC_DIR, safePath);
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(STATIC_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } else {
      res.writeHead(404); res.end("Not Found");
    }
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const ct  = MIME[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": ct });
  res.end(fs.readFileSync(filePath));
}

// ── 1. Serve static immediately on PROXY_PORT ────────────────────────────────

const server = http.createServer((req, res) => {
  const urlPath = new URL(req.url, "http://localhost").pathname;
  serveStatic(urlPath, res);
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`[dev.js] static server on :${PROXY_PORT}  (web-export ready immediately)`);

  // ── 2. Launch Expo Metro on METRO_PORT for native Expo Go ──────────────────
  const env  = { ...process.env, PORT: String(METRO_PORT), CI: "1" }; // CI=1 disables interactive prompts
  const args = [
    "exec", "expo", "start",
    "--localhost",
    "--port", String(METRO_PORT),
  ];
  const child = spawn("pnpm", args, { env, stdio: "inherit", shell: false });

  child.on("error", (err) => { console.error("[dev.js] expo error:", err.message); });
  child.on("exit",  (code) => { server.close(); process.exit(code ?? 0); });

  const cleanup = (sig) => () => { child.kill(sig); server.close(); };
  process.on("SIGTERM", cleanup("SIGTERM"));
  process.on("SIGINT",  cleanup("SIGINT"));
});
