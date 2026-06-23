import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "./submit-lead";

vi.mock("../_lib/orchestrate", () => ({
  processLead: vi.fn(),
}));
vi.mock("../_lib/turnstile", () => ({
  verifyTurnstile: vi.fn(),
}));

import { processLead } from "../_lib/orchestrate";
import { verifyTurnstile } from "../_lib/turnstile";
import type { Env, KVNamespace } from "../_lib/types";

interface TestContext {
  request: Request;
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
}

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "4802069290",
    funnel: "heloc-v2",
    homeValue: "700000",
    mortgageBalance: "350000",
    creditScore: "740",
    additionalFields: {
      helocPurpose: "Debt consolidation",
      timeline: "30 days",
    },
    page_url: "https://smartr8.com/heloc-v2?utm_source=meta",
    referrer: "https://facebook.com/",
    utm_source: "meta",
    turnstile_token: "turnstile-token",
    consent: true,
    consent_version: "2026-06-01.v4",
    consent_text: "I agree to receive recurring SMS messages.",
    pageLoadTime: Date.now() - 10_000,
    ...overrides,
  };
}

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://smartr8.com/api/submit-lead", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://smartr8.com",
      "CF-Connecting-IP": "203.0.113.10",
      "User-Agent": "vitest",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function makeContext(body: unknown, env: Env = {}): TestContext {
  return {
    request: makeRequest(body),
    env,
    waitUntil: vi.fn(),
  };
}

function makeRateLimitKv(initialCount: string | null): KVNamespace {
  let value = initialCount;
  return {
    get: vi.fn(async () => value),
    put: vi.fn(async (_key: string, nextValue: string) => {
      value = nextValue;
    }),
    delete: vi.fn(async () => {
      value = null;
    }),
  };
}

beforeEach(() => {
  vi.mocked(verifyTurnstile).mockResolvedValue({ ok: true });
  vi.mocked(processLead).mockResolvedValue({
    ok: true,
    lead_id: "lead-1",
    duplicate: false,
    leadmailbox: { ok: true },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("api/submit-lead", () => {
  it("rejects invalid JSON", async () => {
    const res = await onRequest({
      ...makeContext("{"),
      request: makeRequest("{"),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
    expect(vi.mocked(processLead)).not.toHaveBeenCalled();
  });

  it("silently drops honeypot submissions before validation or side effects", async () => {
    const res = await onRequest(makeContext(payload({ honeypot: "bot-field" })));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(vi.mocked(verifyTurnstile)).not.toHaveBeenCalled();
    expect(vi.mocked(processLead)).not.toHaveBeenCalled();
  });

  it("rejects failed Turnstile verification", async () => {
    vi.mocked(verifyTurnstile).mockResolvedValue({ ok: false, error: "invalid-input-response" });

    const res = await onRequest(makeContext(payload(), { TURNSTILE_SECRET_KEY: "secret" }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ success: false, error: "turnstile: invalid-input-response" });
    expect(vi.mocked(processLead)).not.toHaveBeenCalled();
  });

  it("rate limits after five submissions from the same IP when KV is bound", async () => {
    const kv = makeRateLimitKv("5");

    const res = await onRequest(makeContext(payload(), { CF_KV_NAMESPACE: kv }));

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ success: false, error: "Too many requests, please try again later" });
    expect(kv.get).toHaveBeenCalledWith("rate:203.0.113.10");
    expect(vi.mocked(processLead)).not.toHaveBeenCalled();
  });

  it("normalizes and forwards a consented lead to the orchestrator", async () => {
    const kv = makeRateLimitKv(null);

    const res = await onRequest(makeContext(payload(), {
      CF_KV_NAMESPACE: kv,
      TURNSTILE_SECRET_KEY: "secret",
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      lead_id: "lead-1",
      duplicate: false,
      lmPayload: null,
    });

    expect(vi.mocked(verifyTurnstile)).toHaveBeenCalledWith("secret", "turnstile-token", "203.0.113.10");
    expect(kv.put).toHaveBeenCalledWith("rate:203.0.113.10", "1", { expirationTtl: 60 });
    expect(vi.mocked(processLead)).toHaveBeenCalledTimes(1);

    const [lead, consent, env, context, clientIp] = vi.mocked(processLead).mock.calls[0];
    expect(lead.first_name).toBe("Jane");
    expect(lead.last_name).toBe("Doe");
    expect(lead.email).toBe("jane@example.com");
    expect(lead.phone_e164).toBe("+14802069290");
    expect(lead.property_state).toBe("AZ");
    expect(lead.notes).toContain("Loan Purpose: Debt consolidation");
    expect(lead.notes).toContain("Timeline: 30 days");
    expect(lead.notes).toContain("helocPurpose: Debt consolidation");
    expect(lead.notes).toContain("timeline: 30 days");
    expect(lead.quote_fields).toMatchObject({
      home_value: "700000",
      mortgage_balance: "350000",
      credit: "740",
      loan_goal: "Debt consolidation",
    });
    expect(consent).toMatchObject({
      lead_id: lead.lead_id,
      consent_version: "2026-06-01.v4",
      consent_text: "I agree to receive recurring SMS messages.",
      ip: "203.0.113.10",
      user_agent: "vitest",
      page_url: "https://smartr8.com/heloc-v2?utm_source=meta",
    });
    expect(env.CF_KV_NAMESPACE).toBe(kv);
    expect(typeof context.waitUntil).toBe("function");
    expect(clientIp).toBe("203.0.113.10");
  });

  it("accepts the program finder email/text quote path and preserves routing notes", async () => {
    const res = await onRequest(makeContext(payload({
      funnel: "see-my-options",
      page_url: "https://smartr8.com/main-see-my-options",
      pageLoadTime: 0,
      additionalFields: {
        "Funnel-Source": "main-see-my-options",
        Occupancy: "Primary residence",
        "Employment Status": "Employed",
        "Mortgage Setup": "Only a first mortgage",
        "Requested Next Step": "Have quote emailed/texted to me",
        "Best-Fit Genre": "Home equity or cash-out path",
      },
    })));

    expect(res.status).toBe(200);
    expect(vi.mocked(processLead)).toHaveBeenCalledTimes(1);

    const [lead, consent] = vi.mocked(processLead).mock.calls[0];
    expect(lead.funnel).toBe("see-my-options");
    expect(lead.landing_page).toBe("https://smartr8.com/main-see-my-options");
    expect(lead.loan_request).toBe("Program Finder");
    expect(lead.notes).toContain("Funnel-Source: main-see-my-options");
    expect(lead.notes).toContain("Occupancy: Primary residence");
    expect(lead.notes).toContain("Requested Next Step: Have quote emailed/texted to me");
    expect(consent).toMatchObject({
      lead_id: lead.lead_id,
      consent_version: "2026-06-01.v4",
    });
  });

  it("does not create a TCPA consent row when the optional SMS box is unchecked", async () => {
    const res = await onRequest(makeContext(payload({ consent: false })));

    expect(res.status).toBe(200);
    const [, consent] = vi.mocked(processLead).mock.calls[0];
    expect(consent).toBeNull();
  });
});
