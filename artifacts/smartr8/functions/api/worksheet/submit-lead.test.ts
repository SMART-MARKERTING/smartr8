import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { onRequest } from "./submit-lead";

// Branch 3 (public unlock-lead) is exercised through the orchestrator, which
// owns D1/KV/GHL. We mock it so this suite focuses on the worksheet endpoint's
// own behavior — request routing, the email branches, and (the point of issue
// #19) the LeadMailbox payload built for branches 1 and 2 via the shared
// _lib/leadmailbox helper.
vi.mock("../../_lib/orchestrate", () => ({
  processLead: vi.fn(),
}));
import { processLead } from "../../_lib/orchestrate";

interface RecordedCall {
  url: string;
  init: RequestInit & { headers: Record<string, string>; body: string };
}

let calls: RecordedCall[];
let fetchMock: ReturnType<typeof vi.fn>;
let waited: Promise<unknown>[];

beforeEach(() => {
  calls = [];
  waited = [];
  fetchMock = vi.fn(async (url: string, init: RecordedCall["init"]) => {
    calls.push({ url, init });
    if (url.includes("api.resend.com")) {
      return { ok: true, status: 200, json: async () => ({ id: "email-1" }), text: async () => "{}" } as unknown as Response;
    }
    if (url.includes("leadmailbox.com")) {
      return { ok: true, status: 200, text: async () => '{"code":0}' } as unknown as Response;
    }
    if (url.includes("formspree.io")) {
      return { ok: true, status: 200, text: async () => "{}" } as unknown as Response;
    }
    return { ok: true, status: 200, text: async () => "{}", json: async () => ({}) } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeRequest(payload: Record<string, unknown>): Request {
  return new Request("https://smartr8.com/api/worksheet/submit-lead", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://smartr8.com",
      "CF-Connecting-IP": "203.0.113.7",
    },
    body: JSON.stringify(payload),
  });
}

function makeContext(payload: Record<string, unknown>, env: Record<string, unknown> = { RESEND_API_KEY: "test-key" }) {
  return {
    request: makeRequest(payload),
    env: env as never,
    waitUntil: (p: Promise<unknown>) => {
      waited.push(p);
    },
  };
}

async function drain() {
  await Promise.all(waited);
}

function lmCall(): RecordedCall {
  const c = calls.find((c) => c.url.includes("leadmailbox.com"));
  if (!c) throw new Error("no LeadMailbox call recorded");
  return c;
}

describe("worksheet/submit-lead — branch 1 (worksheet-internal)", () => {
  it("submits to LeadMailbox via the shared helper with the funnel marker and manual-send tag preserved", async () => {
    const res = await onRequest(
      makeContext({
        source: "worksheet-internal",
        clientEmail: "client@example.com",
        clientName: "Jane Q Public",
        pdfBase64: "JVBERi0=",
        worksheetSummary: "Saves $400/mo",
      }),
    );
    await drain();

    expect(res.status).toBe(200);
    const body = JSON.parse(lmCall().init.body);
    expect(body.FirstName).toBe("Jane");
    expect(body.LastName).toBe("Q Public");
    expect(body.Email).toBe("client@example.com");
    expect(body.Loan_Request).toBe("Worksheet Internal Send");
    // Funnel marker contract (issue #19) — both the fine-grained marker and
    // the manual-send tag must survive the migration.
    expect(body.Notes).toContain("Funnel: worksheet-internal");
    expect(body.Notes).toContain("Tag: manual send by Mykoal");
    expect(body.Notes).toContain("Worksheet summary:\nSaves $400/mo");
    // No phone/state collected on the internal path.
    expect(body.MobilePhone).toBe("");
    expect(body.Phys_State).toBeUndefined();
  });

  it("forwards the visitor IP to LeadMailbox across the three headers", async () => {
    await onRequest(
      makeContext({
        source: "worksheet-internal",
        clientEmail: "client@example.com",
        clientName: "Jane Doe",
        pdfBase64: "JVBERi0=",
      }),
    );
    await drain();
    const headers = lmCall().init.headers;
    expect(headers["X-Forwarded-For"]).toBe("203.0.113.7");
    expect(headers["True-Client-IP"]).toBe("203.0.113.7");
    expect(headers["X-Real-IP"]).toBe("203.0.113.7");
  });

  it("returns 400 when clientEmail or pdfBase64 is missing", async () => {
    const res = await onRequest(makeContext({ source: "worksheet-internal", clientName: "Jane" }));
    expect(res.status).toBe(400);
  });
});

describe("worksheet/submit-lead — branch 2 (worksheet-self)", () => {
  it("submits to LeadMailbox with funnel marker, normalized phone digits, and Phys_State", async () => {
    const res = await onRequest(
      makeContext({
        source: "worksheet-self",
        clientEmail: "self@example.com",
        firstName: "Sam",
        lastName: "Self",
        phone: "(480) 206-9290",
        state: "AZ",
        trackingId: "trk-123",
        pdfBase64: "JVBERi0=",
        worksheetSummary: "Big savings",
      }),
    );
    await drain();

    expect(res.status).toBe(200);
    const body = JSON.parse(lmCall().init.body);
    expect(body.FirstName).toBe("Sam");
    expect(body.LastName).toBe("Self");
    expect(body.Email).toBe("self@example.com");
    expect(body.Loan_Request).toBe("Worksheet Self-Send");
    expect(body.Notes).toContain("Funnel: worksheet-self");
    expect(body.Notes).toContain("Tracking ID: trk-123");
    expect(body.Notes).toContain("Worksheet summary:\nBig savings");
    // Phone normalized to E.164 → digits-only (leading 1), matching the
    // public unlock-lead path.
    expect(body.MobilePhone).toBe("14802069290");
    // State preserved via property_state → Phys_State (the library extension).
    expect(body.Phys_State).toBe("AZ");
  });

  it("posts the LeadMailbox success flag to Formspree", async () => {
    await onRequest(
      makeContext({
        source: "worksheet-self",
        clientEmail: "self@example.com",
        firstName: "Sam",
        lastName: "Self",
        pdfBase64: "JVBERi0=",
      }),
    );
    await drain();
    const fs = calls.find((c) => c.url.includes("formspree.io"));
    expect(fs).toBeDefined();
    expect(JSON.parse(fs!.init.body).lmSuccess).toBe(true);
  });
});

describe("worksheet/submit-lead — branch 3 (public unlock-lead)", () => {
  it("routes through processLead with a canonical worksheet Lead and returns the lead_id", async () => {
    vi.mocked(processLead).mockResolvedValue({
      ok: true,
      lead_id: "generated-id",
      duplicate: false,
      leadmailbox: { ok: true },
    });

    const res = await onRequest(
      makeContext({
        firstName: "Pat",
        lastName: "Public",
        email: "pat@example.com",
        phone: "4802069290",
        state: "TX",
        worksheetSummary: "details",
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; lead_id: string };
    expect(json.success).toBe(true);
    expect(json.lead_id).toBe("generated-id");

    expect(vi.mocked(processLead)).toHaveBeenCalledTimes(1);
    const lead = vi.mocked(processLead).mock.calls[0][0];
    expect(lead.funnel).toBe("worksheet");
    expect(lead.first_name).toBe("Pat");
    expect(lead.property_state).toBe("TX");
    expect(lead.loan_request).toBe("Worksheet Lead");
  });

  it("returns 400 when required public fields are missing", async () => {
    const res = await onRequest(makeContext({ firstName: "Pat" }));
    expect(res.status).toBe(400);
    expect(vi.mocked(processLead)).not.toHaveBeenCalled();
  });

  it("surfaces the LeadMailbox fallbackPayload when the orchestrator was IP-blocked", async () => {
    vi.mocked(processLead).mockResolvedValue({
      ok: true,
      lead_id: "id-2",
      duplicate: false,
      leadmailbox: { ok: false, error: "LM 403 ip_blocked", fallbackPayload: { FirstName: "Pat" } },
    });

    const res = await onRequest(
      makeContext({ firstName: "Pat", lastName: "Public", email: "pat@example.com" }),
    );
    const json = (await res.json()) as { lmPayload: Record<string, string> | null };
    expect(json.lmPayload).toEqual({ FirstName: "Pat" });
  });
});

describe("worksheet/submit-lead — CORS / method handling", () => {
  it("answers OPTIONS preflight with 204", async () => {
    const ctx = makeContext({});
    const res = await onRequest({ ...ctx, request: new Request("https://smartr8.com/x", { method: "OPTIONS", headers: { Origin: "https://smartr8.com" } }) });
    expect(res.status).toBe(204);
  });

  it("rejects non-POST with 405", async () => {
    const ctx = makeContext({});
    const res = await onRequest({ ...ctx, request: new Request("https://smartr8.com/x", { method: "GET", headers: { Origin: "https://smartr8.com" } }) });
    expect(res.status).toBe(405);
  });
});
