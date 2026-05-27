// Structured JSON logger for Cloudflare Pages Functions.
//
// Use console.log/console.error so Cloudflare's built-in log streaming
// (Pages -> Functions -> Real-time logs) picks it up and a future
// Logpush destination ingests cleanly.

export type LogLevel = "debug" | "info" | "warn" | "error";

export function log(
  level: LogLevel,
  event: string,
  data: Record<string, unknown> = {},
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
