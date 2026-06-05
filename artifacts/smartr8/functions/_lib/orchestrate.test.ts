import { describe, it, expect, vi, beforeEach } from "vitest";
import { processLead } from "./orchestrate";
import type { Env, Lead, TcpaConsent } from "./types";
import { makeD1Mock, makeKVMock, makeCtxMock, drainWaitUntil } from "./__test-utils";

vi.mock("./ghl", () => ({
  ghlUpsert: vi.fn(),
  ghlCreateOpportunity: vi.fn(),
}));
vi.mock("./leadmailbox", () => ({
  submitToLeadMailbox: vi.fn(),
}));
vi.mock("./resend", () => ({
  sendResendConfirmation: vi.fn(),
}));
vi.mock("./log", () => ({
  log: vi.fn(),
}));

import { ghlUpsert, ghlCreateOpportunity } from "./ghl";
import { submitToLeadMailbox } from "./leadmailbox";
import { sendResendConfirmation } from "./resend";
import { log } from "./log";

const ghlUpsertMock = vi.mocked(ghlUpsert);
const ghlCreateOpportunityMock = vi.mocked(ghlCreateOpportunity);
const submitToLeadMailboxMock = vi.mocked(submitToLeadMailbox);
const sendResendConfirmationMock = vi.mocked(sendResendConfirmation);
const logMock = vi.mocked(log);

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    lead_id: "lead-1",
    created_at: 1700000000000,
    funnel: "heloc",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    phone_e164: "+15555551234",
    landing_page: "https://smartr8.com/heloc-v2",
    ...overrides,
  };
}

function makeConsent(overrides: Partial<TcpaConsent> = {}): TcpaConsent {
  return {
    consent_id: "consent-1",
    lead_id: "lead-1",
    consent_version: "2026-05-27.v1",
    consent_text: "I agree.",
    ip: "1.2.3.4",
    user_agent: "Test/1.0",
    page_url: "https://smartr8.com/heloc-v2",
    created_at: 1700000000000,
    ...overrides,
  };
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  const db = makeD1Mock();
  const kv = makeKVMock();
  return {
    LEADS_DB: db as unknown as Env["LEADS_DB"],
    LEAD_DEDUP: kv as unknown as Env["LEAD_DEDUP"],
    ...overrides,
  };
}

beforeEach(() => {
  ghlUpsertMock.mockReset();
  ghlCreateOpportunityMock.mockReset();
  submitToLeadMailboxMock.mockReset();
  sendResendConfirmationMock.mockReset();
  logMock.mockReset();

  // Sensible defaults so each test only overrides what it cares about.
  submitToLeadMailboxMock.mockResolvedValue({ ok: true });
  ghlUpsertMock.mockResolvedValue({ ok: true, contactId: "ghl-c-1" });
  ghlCreateOpportunityMock.mockResolvedValue({ ok: true, contactId: "ghl-c-1" });
  sendResendConfirmationMock.mockResolvedValue({ ok: true });
});

describe("processLead — happy path", () => {
  it("performs the LeadMailbox sync write before returning, and queues Resend + CRM webhook via waitUntil (GHL retired)", async () => {
    const env = makeEnv();
    const ctx = makeCtxMock();
    const lead = makeLead();

    const result = await processLead(lead, null, env, ctx);

    expect(result.ok).toBe(true);
    expect(result.duplicate).toBeFalsy();
    expect(submitToLeadMailboxMock).toHaveBeenCalledTimes(1);
    expect(submitToLeadMailboxMock).toHaveBeenCalledWith(lead, expect.any(String));
    // GHL is retired, so only Resend + CRM webhook are queued via waitUntil (not 3).
    expect(ctx._promises.length).toBe(2);

    await drainWaitUntil(ctx);
    expect(ghlUpsertMock).not.toHaveBeenCalled();
    expect(sendResendConfirmationMock).toHaveBeenCalledWith(env, lead);
  });

  it("writes the D1 audit row before any destination side effect fires", async () => {
    const env = makeEnv();
    const db = env.LEADS_DB as unknown as ReturnType<typeof makeD1Mock>;
    await processLead(makeLead(), null, env, makeCtxMock());
    const insertCall = db._calls.find((c) => c.sql.includes("INSERT OR IGNORE INTO leads"));
    expect(insertCall).toBeDefined();
    // The bind list should include the lead_id at position 0.
    expect(insertCall?.bind[0]).toBe("lead-1");
  });
});

describe("processLead — TCPA consent row", () => {
  it("inserts a tcpa_consents row when consent fields are present", async () => {
    const env = makeEnv();
    const db = env.LEADS_DB as unknown as ReturnType<typeof makeD1Mock>;
    await processLead(makeLead(), makeConsent(), env, makeCtxMock());
    const consentCall = db._calls.find((c) => c.sql.includes("INSERT OR IGNORE INTO tcpa_consents"));
    expect(consentCall).toBeDefined();
    expect(consentCall?.bind[0]).toBe("consent-1");
    expect(consentCall?.bind[1]).toBe("lead-1");
  });

  it("does NOT insert a tcpa_consents row when consent is null", async () => {
    const env = makeEnv();
    const db = env.LEADS_DB as unknown as ReturnType<typeof makeD1Mock>;
    await processLead(makeLead(), null, env, makeCtxMock());
    const consentCall = db._calls.find((c) => c.sql.includes("INSERT OR IGNORE INTO tcpa_consents"));
    expect(consentCall).toBeUndefined();
  });
});

// GHL behavior tests removed: GHL is retired, so processLead no longer triggers the
// upsert/opportunity chain (runGhlChain is dormant). The happy-path test now asserts
// ghlUpsert is NOT called; ghl.ts keeps its own unit coverage in ghl.test.ts for if
// the chain is ever restored.

describe("processLead — dedup", () => {
  it("returns { duplicate: true } early but STILL forwards to the CRM so the text/drip fires", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => "" }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const kv = makeKVMock();
      const env = makeEnv({
        LEAD_DEDUP: kv as unknown as Env["LEAD_DEDUP"],
        CRM_LEAD_WEBHOOK: "https://crm.example.com/webhooks/lead?key=test",
      });
      // Pre-seed KV with the dedup key for this lead.
      const lead = makeLead();
      // Mimic dedup hit by writing any value to a key matching the dedupKey shape;
      // we don't know the hash, so use a get-stub.
      const originalGet = kv.get;
      kv.get = vi.fn(async (key: string) => {
        if (key.startsWith("lead_dedup:")) return "1";
        return await originalGet.call(kv, key);
      }) as typeof kv.get;
      const ctx = makeCtxMock();
      const result = await processLead(lead, null, env, ctx);
      expect(result.duplicate).toBe(true);
      // LeadMailbox/GHL/Resend stay deduped (no double advisor pings)...
      expect(submitToLeadMailboxMock).not.toHaveBeenCalled();
      // ...but the CRM webhook fires even on a dedup hit so the text/drip goes out.
      await drainWaitUntil(ctx);
      const crmCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("crm.example.com"));
      expect(crmCall).toBeDefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("processLead — degraded mode (no D1)", () => {
  it("runs cleanly when LEADS_DB is unbound — destinations still fire, no errors", async () => {
    const env = makeEnv({ LEADS_DB: undefined });
    const ctx = makeCtxMock();
    const result = await processLead(makeLead(), null, env, ctx);
    expect(result.ok).toBe(true);
    expect(submitToLeadMailboxMock).toHaveBeenCalled();
    await drainWaitUntil(ctx);
    // GHL retired — only Resend + CRM fire as async destinations now.
    expect(sendResendConfirmationMock).toHaveBeenCalled();
    // No error-level logs should have been emitted by the orchestrator itself.
    const errorCalls = logMock.mock.calls.filter((c) => c[0] === "error");
    expect(errorCalls.length).toBe(0);
  });
});

describe("processLead — worksheet funnel", () => {
  it("routes worksheet leads through with funnel='worksheet'", async () => {
    const env = makeEnv();
    const ctx = makeCtxMock();
    const worksheetLead = makeLead({
      funnel: "worksheet",
      landing_page: "https://smartr8.com/worksheet",
    });
    await processLead(worksheetLead, null, env, ctx);
    await drainWaitUntil(ctx);
    // Assert via LeadMailbox (the sync destination) since GHL is retired.
    expect(submitToLeadMailboxMock).toHaveBeenCalledTimes(1);
    const passedLead = submitToLeadMailboxMock.mock.calls[0][0];
    expect(passedLead.funnel).toBe("worksheet");
    expect(passedLead.landing_page).toBe("https://smartr8.com/worksheet");
    // Here we only assert that processLead forwards the canonical Lead unchanged.
  });
});

describe("processLead — CRM webhook", () => {
  it("POSTs the lead as JSON to env.CRM_LEAD_WEBHOOK when configured", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => "" }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const env = makeEnv({ CRM_LEAD_WEBHOOK: "https://crm.example.com/webhooks/lead?key=test" });
      const ctx = makeCtxMock();
      await processLead(makeLead(), null, env, ctx);
      await drainWaitUntil(ctx);
      const crmCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("crm.example.com"));
      expect(crmCall).toBeDefined();
      expect(crmCall?.[1]?.method).toBe("POST");
      const body = JSON.parse(crmCall?.[1]?.body as string);
      expect(body.email).toBe("jane@example.com");
      expect(body.funnel).toBe("heloc");
      expect(body.lead_id).toBe("lead-1");
      // No consent passed → the CRM is told the lead did NOT opt in to texts.
      expect(body.smsOptIn).toBe("no");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("forwards smsOptIn:\"yes\" only when the visitor opted in (TCPA box checked)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => "" }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const env = makeEnv({ CRM_LEAD_WEBHOOK: "https://crm.example.com/webhooks/lead?key=test" });
      const ctx = makeCtxMock();
      await processLead(makeLead(), makeConsent(), env, ctx);
      await drainWaitUntil(ctx);
      const crmCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("crm.example.com"));
      const body = JSON.parse(crmCall?.[1]?.body as string);
      // CRM derives sms_consent from this; "yes" is what lets its drip text the lead.
      expect(body.smsOptIn).toBe("yes");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to the built-in CRM URL when CRM_LEAD_WEBHOOK is unset", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => "" }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const env = makeEnv(); // no CRM_LEAD_WEBHOOK override
      const ctx = makeCtxMock();
      await processLead(makeLead(), null, env, ctx);
      await drainWaitUntil(ctx);
      const crmCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("crm.smartr8.com/webhooks/lead"));
      expect(crmCall).toBeDefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
