import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, setAuthHandlers, TokenResponse } from "./api";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

const REFRESHED: TokenResponse = {
  token: "new-token",
  userId: "u1",
  email: "a@b.com",
  role: "USER",
};

describe("apiFetch 401 handling", () => {
  beforeEach(() => {
    setAuthHandlers({});
  });

  it("passes through a successful request unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: "1" }]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.observations.getAll("good-token");

    expect(result).toEqual([{ id: "1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("silently refreshes and retries once on a 401, syncing auth state", async () => {
    const onTokenRefreshed = vi.fn();
    setAuthHandlers({ onTokenRefreshed });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "expired" }, 401)) // original call
      .mockResolvedValueOnce(jsonResponse(REFRESHED)) // /auth/refresh
      .mockResolvedValueOnce(jsonResponse([{ id: "obs-1" }])); // retry
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.observations.getAll("expired-token");

    expect(result).toEqual([{ id: "obs-1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain("/api/v1/auth/refresh");
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      headers: { Authorization: "Bearer new-token" },
    });
    expect(onTokenRefreshed).toHaveBeenCalledWith(REFRESHED);
  });

  it("signals session expiry and rejects when the refresh cookie is also dead", async () => {
    const onSessionExpired = vi.fn();
    setAuthHandlers({ onSessionExpired });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "expired" }, 401)) // original call
      .mockResolvedValueOnce(jsonResponse({ error: "no cookie" }, 401)); // refresh fails
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.observations.getAll("expired-token")).rejects.toThrow("401");
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2); // no retry attempted
  });

  it("dedupes concurrent refresh attempts into a single /auth/refresh call", async () => {
    const seenOnce = new Set<string>();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/v1/auth/refresh")) {
        return Promise.resolve(jsonResponse(REFRESHED));
      }
      if (seenOnce.has(url)) {
        return Promise.resolve(jsonResponse({ url }));
      }
      seenOnce.add(url);
      return Promise.resolve(jsonResponse({ error: "expired" }, 401));
    });
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([
      api.observations.getById("1", "expired-token"),
      api.observations.getById("2", "expired-token"),
    ]);

    expect(a).toMatchObject({ url: expect.stringContaining("/observations/1") });
    expect(b).toMatchObject({ url: expect.stringContaining("/observations/2") });

    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      (url as string).includes("/api/v1/auth/refresh")
    );
    expect(refreshCalls).toHaveLength(1);
  });
});

describe("billing.checkout", () => {
  it("sends the caller-supplied Idempotency-Key header and returns the processor field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      processor: "stripe",
      clientSecret: "pi_123_secret_abc",
      subscriptionId: "sub_456",
      status: "incomplete",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.billing.checkout("monthly", "token-1", "key-abc");

    expect(result.processor).toBe("stripe");
    expect(result.clientSecret).toBe("pi_123_secret_abc");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Idempotency-Key"]).toBe("key-abc");
  });

  it("does not generate its own key — a retry must pass the same one back in", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      processor: "stripe", clientSecret: "secret", subscriptionId: "sub_1", status: "incomplete",
    }));
    vi.stubGlobal("fetch", fetchMock);

    await api.billing.checkout("monthly", "token-1", "same-key");
    await api.billing.checkout("monthly", "token-1", "same-key");

    const key1 = fetchMock.mock.calls[0][1].headers["Idempotency-Key"];
    const key2 = fetchMock.mock.calls[1][1].headers["Idempotency-Key"];
    expect(key1).toEqual(key2);
  });
});

describe("billing.portalSession", () => {
  it("sends the return URL and returns the portal session url", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      url: "https://billing.stripe.com/session/abc",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.billing.portalSession("https://app.example.com/account", "token-1");

    expect(result.url).toBe("https://billing.stripe.com/session/abc");
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).returnUrl).toBe("https://app.example.com/account");
  });
});

describe("admin.refund", () => {
  it("sends the caller-supplied Idempotency-Key header and returns the refund result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      refundId: "re_123",
      status: "succeeded",
      amountCents: 500,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await api.admin.refund("user-1", "token-1", "key-xyz");

    expect(result.refundId).toBe("re_123");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Idempotency-Key"]).toBe("key-xyz");
  });
});
