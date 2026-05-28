import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitToLeadMailbox, LEADMAILBOX_URL } from "./leadmailbox";
import type { Lead } from "./types";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    lead_id: "lead-test-123",
    created_at: 1700000000000,
    funnel: "heloc",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    phone_e164: "+15555551234",
    address1: "123 Main St, Phoenix, AZ 85001",
    loan_request: "",
    notes: "",
    source: "smartr8.com",
    landing_page: "https://smartr8.com/heloc-v2",
    ip: "1.2.3.4",
    user_agent: "Test/1.0",
    ...overrides,
  };
}

function lmResponse({
  ok: okFlag = true,
  status = 200,
  body = '{"code":0}',
}: { ok?: boolean; status?: number; body?: string } = {}): Response {
  return {
    ok: okFlag,
    status,
    text: async () => body,
  } as unknown as Response;
}

describe("submitToLeadMailbox", () => {
  it("POSTs to the live LeadMailbox URL with the IP forwarded across three headers", async () => {
    fetchMock.mockResolvedValueOnce(lmResponse());
    await submitToLeadMailbox(makeLead());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(LEADMAILBOX_URL);
    expect(init.method).toBe("POST");
    expect(init.headers["X-Forwarded-For"]).toBe("1.2.3.4");
    expect(init.headers["X-Real-IP"]).toBe("1.2.3.4");
    expect(init.headers["True-Client-IP"]).toBe("1.2.3.4");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("sends a PascalCase body shape with the expected fields", async () => {
    fetchMock.mockResolvedValueOnce(lmResponse());
    await submitToLeadMailbox(makeLead({ phone_e164: "+15555551234" }));
    const init = fetchMock.mock.calls[0][1];
    const body = JSON.parse(init.body);
    expect(body.FirstName).toBe("Jane");
    expect(body.LastName).toBe("Doe");
    expect(body.Email).toBe("jane@example.com");
    expect(body.MobilePhone).toBe("15555551234"); // digits-only, not E.164
    expect(body.Loan_Request).toBe("HELOC");
    expect(typeof body.Notes).toBe("string");
    expect(body.Notes).toContain("Funnel: heloc");
    expect(body.Notes).toContain("Lead ID: lead-test-123");
  });

  it("returns ok:true on a 200 with LeadMailbox code:0", async () => {
    fetchMock.mockResolvedValueOnce(lmResponse({ body: '{"code":0}' }));
    const result = await submitToLeadMailbox(makeLead());
    expect(result.ok).toBe(true);
  });

  it("returns ok:false with error on a non-200 response", async () => {
    fetchMock.mockResolvedValueOnce(lmResponse({ ok: false, status: 500, body: "boom" }));
    const result = await submitToLeadMailbox(makeLead());
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/LM 500/);
  });

  it("returns ok:false with code:1 even on HTTP 200", async () => {
    fetchMock.mockResolvedValueOnce(lmResponse({ body: '{"code":1,"message":"duplicate"}' }));
    const result = await submitToLeadMailbox(makeLead());
    expect(result.ok).toBe(false);
  });

  it("returns fallbackPayload on a 403 ip_blocked response", async () => {
    fetchMock.mockResolvedValueOnce(lmResponse({ ok: false, status: 403, body: "blocked" }));
    const result = await submitToLeadMailbox(makeLead());
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/ip_blocked/);
    expect(result.fallbackPayload).toBeDefined();
    expect(result.fallbackPayload?.FirstName).toBe("Jane");
  });

  it("returns fallbackPayload on a network error so the browser can retry", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await submitToLeadMailbox(makeLead());
    expect(result.ok).toBe(false);
    expect(result.fallbackPayload).toBeDefined();
  });

  it("does not set the X-Forwarded-For header when the lead IP is 'unknown'", async () => {
    fetchMock.mockResolvedValueOnce(lmResponse());
    await submitToLeadMailbox(makeLead({ ip: "unknown" }));
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["X-Forwarded-For"]).toBeUndefined();
  });
});
