import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendResendConfirmation } from "./resend";
import { subjectFor } from "./leadEmail";
import type { Env, Lead } from "./types";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeEnv(): Env {
  return { RESEND_API_KEY: "re_test_key" };
}

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    lead_id: "lead-1",
    created_at: 1700000000000,
    funnel: "heloc",
    first_name: "Jane",
    email: "jane@example.com",
    phone_e164: "+15555551234",
    ...overrides,
  };
}

function resendOk(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ id: "msg-1" }),
    text: async () => JSON.stringify({ id: "msg-1" }),
  } as unknown as Response;
}

describe("subjectFor (leadEmail funnel-specific subjects)", () => {
  it("returns the cash-out subject for cash-out / cashout", () => {
    expect(subjectFor("cash-out", "Jane")).toMatch(/cash-out options/i);
    expect(subjectFor("cashout", "Jane")).toMatch(/cash-out options/i);
  });

  it("returns the rate-reduction subject for rate-reduction", () => {
    expect(subjectFor("rate-reduction", "Jane")).toMatch(/rate options/i);
  });

  it("returns the purchase subject for purchase", () => {
    expect(subjectFor("purchase", "Jane")).toMatch(/purchase started/i);
  });

  it("returns the HELOC subject for any heloc-prefixed funnel", () => {
    expect(subjectFor("heloc", "Jane")).toMatch(/HELOC options/);
    expect(subjectFor("heloc-v2", "Jane")).toMatch(/HELOC options/);
    expect(subjectFor("heloc-quick-v2", "Jane")).toMatch(/HELOC options/);
  });

  it("returns a generic 'options' subject for unknown funnels", () => {
    expect(subjectFor("worksheet", "Jane")).toMatch(/working on your options$/);
    expect(subjectFor("other", "Jane")).toMatch(/working on your options$/);
  });
});

describe("sendResendConfirmation", () => {
  it("POSTs to the Resend emails endpoint with the configured from + reply_to + funnel subject", async () => {
    fetchMock.mockResolvedValueOnce(resendOk());
    const r = await sendResendConfirmation(makeEnv(), makeLead({ funnel: "heloc-v2" }));
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(init.body);
    expect(body.from).toContain("mykoal@mykoal.com");
    expect(body.reply_to).toBe("mykoal@adaxahome.com");
    expect(body.to).toEqual(["jane@example.com"]);
    expect(body.subject).toBe(subjectFor("heloc-v2", "Jane"));
  });

  it("returns ok:false on non-2xx Resend response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => "invalid recipient",
      json: async () => ({}),
    } as unknown as Response);
    const r = await sendResendConfirmation(makeEnv(), makeLead());
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Resend 422/);
  });
});
