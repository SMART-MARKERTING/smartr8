import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyTurnstile } from "./turnstile";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function http(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => "",
  } as unknown as Response;
}

describe("verifyTurnstile", () => {
  it("returns ok:true when Cloudflare returns success:true", async () => {
    fetchMock.mockResolvedValueOnce(ok({ success: true }));
    const result = await verifyTurnstile("secret-key", "token-abc", "1.2.3.4");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SITEVERIFY_URL);
    expect(init.method).toBe("POST");
  });

  it("returns ok:false with error-codes joined when success:false", async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ success: false, "error-codes": ["invalid-input-response"] }),
    );
    const result = await verifyTurnstile("secret-key", "bad-token", "1.2.3.4");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid-input-response");
  });

  it("returns ok:false when secret is missing", async () => {
    const result = await verifyTurnstile(undefined, "token", "1.2.3.4");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns ok:false when token is missing", async () => {
    const result = await verifyTurnstile("secret-key", "", "1.2.3.4");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/missing token/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns ok:false on Cloudflare HTTP error", async () => {
    fetchMock.mockResolvedValueOnce(http(503));
    const result = await verifyTurnstile("secret-key", "token", "1.2.3.4");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/siteverify 503/);
  });

  it("returns ok:false on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    const result = await verifyTurnstile("secret-key", "token", "1.2.3.4");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/network error/);
  });

  it("omits remoteip from the form when the IP is 'unknown'", async () => {
    fetchMock.mockResolvedValueOnce(ok({ success: true }));
    await verifyTurnstile("secret-key", "token", "unknown");
    const [, init] = fetchMock.mock.calls[0];
    const body = init.body as FormData;
    expect(body.get("remoteip")).toBeNull();
    expect(body.get("secret")).toBe("secret-key");
    expect(body.get("response")).toBe("token");
  });
});
