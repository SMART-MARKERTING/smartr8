// Smartr8 retry cron — companion Worker.
//
// Runs every 5 minutes (see wrangler.toml [triggers]). Calls the Pages
// Function /api/cron/retry-failed with the shared X-Cron-Secret header.
// The Pages Function does the actual D1 lookup + replay.
//
// Env (set via `wrangler secret put`):
//   CRON_SECRET     same value as the Pages env var of the same name
//   PAGES_BASE_URL  e.g. "https://smartr8.com" (no trailing slash)

interface Env {
  CRON_SECRET: string;
  PAGES_BASE_URL: string;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runRetry(env));
  },
  // Manual trigger (optional): GET this Worker URL to fire on demand.
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/__retry") {
      const result = await runRetry(env);
      return new Response(JSON.stringify(result), { status: result.ok ? 200 : 500, headers: { "Content-Type": "application/json" } });
    }
    return new Response("smartr8-retry-cron", { status: 200 });
  },
};

async function runRetry(env: Env): Promise<{ ok: boolean; status?: number; body?: unknown; error?: string }> {
  if (!env.CRON_SECRET || !env.PAGES_BASE_URL) {
    return { ok: false, error: "CRON_SECRET or PAGES_BASE_URL missing" };
  }
  try {
    const res = await fetch(`${env.PAGES_BASE_URL.replace(/\/+$/, "")}/api/cron/retry-failed`, {
      method: "POST",
      headers: { "X-Cron-Secret": env.CRON_SECRET, "Content-Type": "application/json" },
      body: "{}",
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
