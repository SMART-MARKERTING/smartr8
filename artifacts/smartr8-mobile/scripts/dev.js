#!/usr/bin/env node
/**
 * dev.js — Replit Expo dev startup shim.
 *
 * Problem: Metro prints "Web is waiting on http://localhost:PORT" before it
 * actually binds the TCP socket (bundle compilation happens first, ~2 min).
 * Replit's workflow port-detection times out waiting for the port to open.
 *
 * Solution:
 *  1. Immediately serve the pre-built static web export on PORT — the port
 *     opens in < 1 second and the platform health-check passes right away.
 *  2. Launch Expo Metro on port 8081 in the background. This keeps the
 *     QR-code / Expo Go tunnel working for native device testing.
 *  3. Once Metro is ready (port 8081 responds), swap incoming requests to
 *     proxy to Metro's live dev server so hot-reload works in the browser.
 */

const fs      = require("fs");
const http    = require("http");
const net     = require("net");
const path    = require("path");
const { spawn } = require("child_process");

const PROXY_PORT  = parseInt(process.env.PORT || "8081", 10);
const METRO_PORT  = PROXY_PORT === 8081 ? 18081 : 8081;
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

let metroReady = false;

// ── helpers ──────────────────────────────────────────────────────────────────

function serveStatic(urlPath, res) {
  let safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
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

function proxyToMetro(req, res) {
  const opts = {
    hostname: "127.0.0.1",
    port:     METRO_PORT,
    path:     req.url,
    method:   req.method,
    headers:  req.headers,
  };
  const proxy = http.request(opts, (pr) => {
    res.writeHead(pr.statusCode, pr.headers);
    pr.pipe(res, { end: true });
  });
  proxy.on("error", () => {
    // Metro not yet ready — fall back to static
    serveStatic(new URL(req.url, "http://localhost").pathname, res);
  });
  req.pipe(proxy, { end: true });
}

function proxyWebSocket(req, socket, head) {
  const upstream = net.createConnection({ port: METRO_PORT, host: "127.0.0.1" }, () => {
    upstream.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
      Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n") +
      "\r\n\r\n"
    );
    if (head && head.length) upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });
  const cleanup = () => { socket.destroy(); upstream.destroy(); };
  upstream.on("error", cleanup);
  socket.on("error",   cleanup);
  socket.on("close",   cleanup);
}

function pollMetro() {
  const probe = net.createConnection({ port: METRO_PORT, host: "127.0.0.1" });
  probe.on("connect", () => { probe.destroy(); metroReady = true; console.log("[dev.js] Metro ready — proxying live"); });
  probe.on("error",   () => { probe.destroy(); setTimeout(pollMetro, 3000); });
}

// ── 1. Serve static immediately on PROXY_PORT ────────────────────────────────

const server = http.createServer((req, res) => {
  const urlPath = new URL(req.url, "http://localhost").pathname;
  if (metroReady) {
    proxyToMetro(req, res);
  } else {
    serveStatic(urlPath, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (metroReady) proxyWebSocket(req, socket, head);
  else socket.destroy();
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`[dev.js] static server on :${PROXY_PORT}  Metro target :${METRO_PORT}`);

  // ── 2. Launch Expo Metro on METRO_PORT ─────────────────────────────────────
  const env  = { ...process.env, PORT: String(METRO_PORT) };
  const args = ["exec", "expo", "start", "--localhost", "--port", String(METRO_PORT)];
  const child = spawn("pnpm", args, { env, stdio: "inherit", shell: false });

  child.on("error", (err) => { console.error("[dev.js] expo error:", err.message); server.close(); process.exit(1); });
  child.on("exit",  (code) => { server.close(); process.exit(code ?? 0); });

  const cleanup = (sig) => () => { child.kill(sig); server.close(); };
  process.on("SIGTERM", cleanup("SIGTERM"));
  process.on("SIGINT",  cleanup("SIGINT"));

  // Poll until Metro is up, then switch to live-proxy mode
  setTimeout(pollMetro, 10_000);
});
