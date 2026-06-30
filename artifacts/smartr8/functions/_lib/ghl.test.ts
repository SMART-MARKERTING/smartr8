import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ghlUpsert, ghlCreateOpportunity } from "./ghl";
import type { Env, Lead } from "./types";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    SMARTR8_LEAD_CAPTURE_PROD: "pit-token-abc",
    GHL_LOCATION_ID: "loc-123",
    GHL_CF_LOAN_TYPE: "cf-loan-type",
    GHL_CF_PROPERTY_STATE: "cf-prop-state",
    GHL_CF_TCPA_CONSENT: "cf-tcpa",
    GHL_CF_CONVERSATION_SUMMARY: "cf-conv",
    GHL_PIPELINE_ID: "pipe-1",
    GHL_PIPELINE_STAGE_NEW: "stage-new",
    ...overrides,
  };
}

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
    notes: "Some answers",
    ...overrides,
  };
}

function upsertOk(): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ contact: { id: "ghl-contact-123" } }),
  } as unknown as Response;
}

function opportunityOk(): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ id: "opp-1" }),
  } as unknown as Response;
}

describe("ghlUpsert request shape", () => {
  it("POSTs to the GHL contacts/upsert URL with Bearer + Version 2021-07-28", async () => {
    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(makeEnv(), makeLead());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://services.leadconnectorhq.com/contacts/upsert");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer pit-token-abc");
    expect(init.headers.Version).toBe("2021-07-28");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("sets source = 'smartr8.com' by default", async () => {
    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(makeEnv(), makeLead({ source: undefined }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.source).toBe("smartr8.com");
  });

  it("sets the TCPA Consent custom field value to lowercase 'yes' (not a placeholder)", async () => {
    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(makeEnv(), makeLead());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const tcpa = body.customFields.find((cf: { id: string }) => cf.id === "cf-tcpa");
    expect(tcpa).toBeDefined();
    expect(tcpa.value).toBe("yes");
  });

  it("sets the loan type custom field from the helocmeta selected purpose", async () => {
    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(makeEnv(), makeLead({ funnel: "helocmeta", loan_request: "Purchase" }));
    let body = JSON.parse(fetchMock.mock.calls[0][1].body);
    let loanType = body.customFields.find((cf: { id: string }) => cf.id === "cf-loan-type");
    expect(loanType.value).toBe("Mortgage");

    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(makeEnv(), makeLead({ funnel: "helocmeta", loan_request: "HELOC" }));
    body = JSON.parse(fetchMock.mock.calls[1][1].body);
    loanType = body.customFields.find((cf: { id: string }) => cf.id === "cf-loan-type");
    expect(loanType.value).toBe("HELOC");
  });

  it("sets DSCR custom field for dscrcometa leads", async () => {
    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(makeEnv(), makeLead({ funnel: "dscrcometa", loan_request: "DSCR Investor Loan Quote" }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const loanType = body.customFields.find((cf: { id: string }) => cf.id === "cf-loan-type");
    expect(loanType.value).toBe("DSCR");
  });

  it("filters out customFields whose value is empty (no placeholder leaks)", async () => {
    fetchMock.mockResolvedValueOnce(upsertOk());
    // Lead with no notes and no property data — Conversation Summary and
    // Property State should both be dropped.
    await ghlUpsert(makeEnv(), makeLead({ notes: undefined, landing_page: "https://smartr8.com/heloc" }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const ids = body.customFields.map((cf: { id: string }) => cf.id);
    expect(ids).toContain("cf-loan-type");
    expect(ids).toContain("cf-tcpa");
    expect(ids).not.toContain("cf-conv"); // empty notes
    expect(ids).not.toContain("cf-prop-state"); // no state extractable
  });
});

describe("ghlUpsert tag derivation from landing_page", () => {
  // funnel "other" carries no funnel-based loan-type tag, so these cases
  // isolate the landing-page fallback derivation.
  async function tagsFor(landing_page: string | undefined): Promise<string[]> {
    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(makeEnv(), makeLead({ landing_page, funnel: "other" }));
    return JSON.parse(fetchMock.mock.calls[0][1].body).tags as string[];
  }

  it('returns ["web lead", "heloc"] for /heloc-v2', async () => {
    expect(await tagsFor("https://smartr8.com/heloc-v2")).toEqual(["web lead", "heloc"]);
  });

  it('returns ["web lead", "heloc"] for /heloc-v2 with trailing slash', async () => {
    expect(await tagsFor("https://smartr8.com/heloc-v2/")).toEqual(["web lead", "heloc"]);
  });

  it('returns ["web lead", "heloc"] for /heloc-v2 with query string', async () => {
    expect(await tagsFor("https://smartr8.com/heloc-v2?utm_source=fb")).toEqual([
      "web lead",
      "heloc",
    ]);
  });

  it('returns ["web lead", "heloc"] for /heloc/quick-v2', async () => {
    expect(await tagsFor("https://smartr8.com/heloc/quick-v2")).toEqual(["web lead", "heloc"]);
  });

  it('returns ["web lead"] only for the v1 /heloc control', async () => {
    expect(await tagsFor("https://smartr8.com/heloc")).toEqual(["web lead"]);
  });

  it('returns ["web lead"] only for the v1 /heloc/quick control', async () => {
    expect(await tagsFor("https://smartr8.com/heloc/quick")).toEqual(["web lead"]);
  });

  it('returns ["web lead"] only for the worksheet funnel', async () => {
    expect(await tagsFor("https://smartr8.com/worksheet")).toEqual(["web lead"]);
  });

  it('returns ["web lead"] when landing_page is empty', async () => {
    expect(await tagsFor("")).toEqual(["web lead"]);
  });

  it('returns ["web lead"] when landing_page is malformed (does not throw)', async () => {
    expect(await tagsFor("not-a-url")).toEqual(["web lead"]);
  });

  it('returns ["web lead"] when landing_page is undefined', async () => {
    expect(await tagsFor(undefined)).toEqual(["web lead"]);
  });
});

describe("ghlUpsert tag derivation from funnel", () => {
  // Hold landing_page to an unmapped URL so these cases isolate the
  // funnel-based loan-type derivation.
  async function tagsFor(funnel: Lead["funnel"]): Promise<string[]> {
    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(makeEnv(), makeLead({ funnel, landing_page: "https://smartr8.com/x" }));
    return JSON.parse(fetchMock.mock.calls[0][1].body).tags as string[];
  }

  it.each(["heloc", "heloc-v2", "heloc-quick", "heloc-quick-v2"] as const)(
    'tags %s as ["web lead", "heloc"]',
    async (funnel) => {
      expect(await tagsFor(funnel)).toEqual(["web lead", "heloc"]);
    },
  );

  it.each(["cashout", "cash-out", "rate-reduction", "purchase", "worksheet"] as const)(
    'tags %s as ["web lead", "mortgage"]',
    async (funnel) => {
      expect(await tagsFor(funnel)).toEqual(["web lead", "mortgage"]);
    },
  );

  it('tags dscrcometa as ["web lead", "dscr"]', async () => {
    expect(await tagsFor("dscrcometa")).toEqual(["web lead", "dscr"]);
  });

  it("tags helocmeta as mortgage or heloc based on the selected loan purpose", async () => {
    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(
      makeEnv(),
      makeLead({ funnel: "helocmeta", landing_page: "https://smartr8.com/helocmeta", loan_request: "Cash-Out Refinance" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tags).toEqual(["web lead", "mortgage"]);

    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(
      makeEnv(),
      makeLead({ funnel: "helocmeta", landing_page: "https://smartr8.com/helocmeta", loan_request: "Home Equity Loan" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).tags).toEqual(["web lead", "heloc"]);
  });

  it('tags the "other" funnel as ["web lead"] only', async () => {
    expect(await tagsFor("other")).toEqual(["web lead"]);
  });

  it("dedupes when funnel and landing_page map to the same loan type", async () => {
    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(
      makeEnv(),
      makeLead({ funnel: "heloc", landing_page: "https://smartr8.com/heloc-v2" }),
    );
    const tags = JSON.parse(fetchMock.mock.calls[0][1].body).tags as string[];
    expect(tags).toEqual(["web lead", "heloc"]);
  });
});

describe("ghlUpsert property_state resolution", () => {
  it("prefers an explicit lead.property_state over any address1 parse", async () => {
    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(
      makeEnv(),
      makeLead({
        property_state: "ca",
        address1: "1 Main St, AZ 85001", // would otherwise resolve to AZ
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const state = body.customFields.find((cf: { id: string }) => cf.id === "cf-prop-state");
    expect(state.value).toBe("CA"); // upper-cased on the way out
  });

  it("falls back to the trailing ', XX' regex parse of address1", async () => {
    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(
      makeEnv(),
      makeLead({ property_state: undefined, address1: "1 Main St, Phoenix, AZ 85001" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const state = body.customFields.find((cf: { id: string }) => cf.id === "cf-prop-state");
    expect(state.value).toBe("AZ");
  });

  it("drops the property_state custom field entirely when nothing is resolvable", async () => {
    fetchMock.mockResolvedValueOnce(upsertOk());
    await ghlUpsert(makeEnv(), makeLead({ property_state: undefined, address1: "" }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const ids = body.customFields.map((cf: { id: string }) => cf.id);
    expect(ids).not.toContain("cf-prop-state");
  });
});

describe("ghlUpsert result handling", () => {
  it("returns ok:true with the contactId on success", async () => {
    fetchMock.mockResolvedValueOnce(upsertOk());
    const r = await ghlUpsert(makeEnv(), makeLead());
    expect(r.ok).toBe(true);
    expect(r.contactId).toBe("ghl-contact-123");
  });

  it("flags 401 as a scope error so callers can surface it loudly", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
    } as unknown as Response);
    const r = await ghlUpsert(makeEnv(), makeLead());
    expect(r.ok).toBe(false);
    expect(r.scopeError).toBe(true);
  });
});

describe("ghlCreateOpportunity", () => {
  it("creates an opportunity using the captured contactId from the upsert response", async () => {
    fetchMock.mockResolvedValueOnce(opportunityOk());
    const r = await ghlCreateOpportunity(makeEnv(), makeLead(), "ghl-contact-123");
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://services.leadconnectorhq.com/opportunities/");
    const body = JSON.parse(init.body);
    expect(body.contactId).toBe("ghl-contact-123");
    expect(body.pipelineId).toBe("pipe-1");
    expect(body.pipelineStageId).toBe("stage-new");
    expect(body.monetaryValue).toBe(0);
    expect(body.status).toBe("open");
  });

  it("is a no-op (returns ok:true) when pipeline env vars are missing", async () => {
    const r = await ghlCreateOpportunity(
      makeEnv({ GHL_PIPELINE_ID: undefined, GHL_PIPELINE_STAGE_NEW: undefined }),
      makeLead(),
      "ghl-contact-123",
    );
    expect(r.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
