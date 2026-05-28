import { describe, it, expect, vi, beforeEach } from "vitest";
import { onRequestPost } from "./retry-failed";
import type { Env } from "../../_lib/types";
import { makeD1Mock } from "../../_lib/__test-utils";

vi.mock("../../_lib/ghl", () => ({
  ghlUpsert: vi.fn(),
  ghlCreateOpportunity: vi.fn(),
}));
vi.mock("../../_lib/leadmailbox", () => ({
  submitToLeadMailbox: vi.fn(),
}));
vi.mock("../../_lib/resend", () => ({
  sendResendConfirmation: vi.fn(),
}));
vi.mock("../../_lib/log", () => ({
  log: vi.fn(),
}));

import { ghlUpsert } from "../../_lib/ghl";
import { submitToLeadMailbox } from "../../_lib/leadmailbox";
import { sendResendConfirmation } from "../../_lib/resend";

const ghlUpsertMock = vi.mocked(ghlUpsert);
const submitToLeadMailboxMock = vi.mocked(submitToLeadMailbox);
const sendResendConfirmationMock = vi.mocked(sendResendConfirmation);

const FRESH_CREATED_AT = Date.now() - 30 * 1000; // 30s ago — too fresh to retry
const STALE_CREATED_AT = Date.now() - 5 * 60 * 1000; // 5 min ago — eligible

function makeRequest(secret: string | null): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (secret !== null) headers.set("X-Cron-Secret", secret);
  return new Request("https://example.com/api/cron/retry-failed", {
    method: "POST",
    headers,
    body: "{}",
  });
}

function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    lead_id: "lead-r1",
    created_at: STALE_CREATED_AT,
    funnel: "heloc",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    phone_e164: "+15555551234",
    leadmailbox_status: "sent",
    leadmailbox_attempts: 0,
    ghl_upsert_status: "sent",
    ghl_upsert_attempts: 0,
    ghl_contact_id: null,
    ghl_status: "sent",
    ghl_attempts: 0,
    resend_status: "sent",
    resend_attempts: 0,
    ...overrides,
  };
}

function makeEnv(rows: Record<string, unknown>[] = []): { env: Env; db: ReturnType<typeof makeD1Mock> } {
  const db = makeD1Mock({ allResults: rows });
  const env: Env = {
    CRON_SECRET: "secret-shhh",
    LEADS_DB: db as unknown as Env["LEADS_DB"],
  };
  return { env, db };
}

beforeEach(() => {
  ghlUpsertMock.mockReset();
  submitToLeadMailboxMock.mockReset();
  sendResendConfirmationMock.mockReset();
  ghlUpsertMock.mockResolvedValue({ ok: true, contactId: "ghl-c-1" });
  submitToLeadMailboxMock.mockResolvedValue({ ok: true });
  sendResendConfirmationMock.mockResolvedValue({ ok: true });
});

describe("onRequestPost auth", () => {
  it("returns 401 when X-Cron-Secret header is absent", async () => {
    const { env } = makeEnv();
    const res = await onRequestPost({ request: makeRequest(null), env });
    expect(res.status).toBe(401);
  });

  it("returns 401 when X-Cron-Secret does not match env.CRON_SECRET", async () => {
    const { env } = makeEnv();
    const res = await onRequestPost({ request: makeRequest("wrong-secret"), env });
    expect(res.status).toBe(401);
  });

  it("returns 200 with retried:0 when the secret matches and no rows are eligible", async () => {
    const { env } = makeEnv([]);
    const res = await onRequestPost({ request: makeRequest("secret-shhh"), env });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.retried).toBe(0);
  });
});

describe("onRequestPost retry behavior", () => {
  it("retries a failed LeadMailbox row and marks status='sent' on success", async () => {
    const { env, db } = makeEnv([
      makeRow({ leadmailbox_status: "failed", leadmailbox_attempts: 2 }),
    ]);
    const res = await onRequestPost({ request: makeRequest("secret-shhh"), env });
    expect(res.status).toBe(200);
    expect(submitToLeadMailboxMock).toHaveBeenCalledTimes(1);
    const update = db._calls.find(
      (c) => c.sql.includes("UPDATE leads SET leadmailbox_status"),
    );
    expect(update?.bind[0]).toBe("sent");
    expect(update?.bind[1]).toBe(3); // attempts incremented
  });

  it("marks a failed retry as 'dead_letter' when attempts hit the 5-attempt cap", async () => {
    submitToLeadMailboxMock.mockResolvedValue({ ok: false, error: "LM 503" });
    const { env, db } = makeEnv([
      makeRow({ leadmailbox_status: "failed", leadmailbox_attempts: 4 }),
    ]);
    await onRequestPost({ request: makeRequest("secret-shhh"), env });
    const update = db._calls.find(
      (c) => c.sql.includes("UPDATE leads SET leadmailbox_status"),
    );
    expect(update?.bind[0]).toBe("dead_letter");
    expect(update?.bind[1]).toBe(5);
  });

  it("retries failed GHL upsert and updates ghl_upsert_status + ghl_contact_id on success", async () => {
    ghlUpsertMock.mockResolvedValue({ ok: true, contactId: "ghl-from-retry" });
    const { env, db } = makeEnv([
      makeRow({ ghl_upsert_status: "failed", ghl_upsert_attempts: 1 }),
    ]);
    await onRequestPost({ request: makeRequest("secret-shhh"), env });
    expect(ghlUpsertMock).toHaveBeenCalled();
    const update = db._calls.find(
      (c) => c.sql.includes("UPDATE leads SET ghl_upsert_status"),
    );
    expect(update?.bind[0]).toBe("sent");
    expect(update?.bind[1]).toBe("ghl-from-retry");
  });

  it("retries Resend and updates resend_status accordingly", async () => {
    sendResendConfirmationMock.mockResolvedValue({ ok: false, error: "Resend 503" });
    const { env, db } = makeEnv([
      makeRow({ resend_status: "failed", resend_attempts: 1 }),
    ]);
    await onRequestPost({ request: makeRequest("secret-shhh"), env });
    expect(sendResendConfirmationMock).toHaveBeenCalled();
    const update = db._calls.find(
      (c) => c.sql.includes("UPDATE leads SET resend_status"),
    );
    expect(update?.bind[0]).toBe("failed"); // still failed, but attempts bumped
    expect(update?.bind[1]).toBe(2);
  });

  it("uses a cutoff of 60 seconds in the eligibility query", async () => {
    const { env, db } = makeEnv([]);
    await onRequestPost({ request: makeRequest("secret-shhh"), env });
    const selectCall = db._calls.find((c) => c.sql.includes("SELECT * FROM leads"));
    expect(selectCall).toBeDefined();
    // The first bind is the cutoff timestamp.
    const cutoff = selectCall?.bind[0] as number;
    const now = Date.now();
    // Cutoff should be ~60 seconds in the past (allow generous slack for CI).
    expect(now - cutoff).toBeGreaterThanOrEqual(59 * 1000);
    expect(now - cutoff).toBeLessThanOrEqual(61 * 1000);
  });

  it("uses 5 as the per-destination max-attempts cap", async () => {
    const { env, db } = makeEnv([]);
    await onRequestPost({ request: makeRequest("secret-shhh"), env });
    const selectCall = db._calls.find((c) => c.sql.includes("SELECT * FROM leads"));
    // After cutoff, the four following binds are the max-attempts caps (one per destination).
    expect(selectCall?.bind.slice(1, 5)).toEqual([5, 5, 5, 5]);
    // Then the batch limit.
    expect(selectCall?.bind[5]).toBeTypeOf("number");
  });

  it("returns 500 when LEADS_DB binding is missing", async () => {
    const env: Env = { CRON_SECRET: "secret-shhh" };
    const res = await onRequestPost({ request: makeRequest("secret-shhh"), env });
    expect(res.status).toBe(500);
  });
});

// The eligibility-window guard (skip rows < 60s old) is exercised by the SQL
// itself, which filters on created_at < cutoff. We verified the cutoff value
// above; the SQL behavior is the database's responsibility (covered by the
// integration smoke test against the live D1 binding post-deploy).
void FRESH_CREATED_AT;
