import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "./client";
import { clearSession, saveSession } from "./session";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// The vitest project runs in a plain Node environment (no jsdom), but
// session.ts is written for the browser. Stub just enough of `window` for
// localStorage-backed session storage to work in these tests.
function installWindowStub() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

describe("apiRequest", () => {
  beforeAll(() => {
    installWindowStub();
  });

  beforeEach(() => {
    clearSession();
  });

  it("constructs the URL from API_ORIGIN + API_PREFIX + path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/locomotives", { auth: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/locomotives",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("unwraps the {data} envelope on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: "loco-1" }] })));

    const result = await apiRequest<{ id: string }[]>("/locomotives", { auth: false });

    expect(result).toEqual([{ id: "loco-1" }]);
  });

  it("throws ApiError with the backend's code/message on a validation error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } },
            401,
          ),
        ),
    );

    await expect(apiRequest("/auth/login", { method: "POST", auth: false })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      status: 401,
      message: "Invalid email or password",
    });
  });

  it("throws a NETWORK_ERROR ApiError when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(apiRequest("/locomotives", { auth: false })).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });

  it("attaches the Authorization header when a session exists", async () => {
    saveSession({
      email: "demo@sahay.dev",
      userId: "u1",
      organizationId: "o1",
      role: "ADMIN",
      loginAt: Date.now(),
      accessToken: "token-abc",
      refreshToken: "refresh-abc",
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/locomotives");

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-abc");
  });

  it("retries once after a successful token refresh on 401, then succeeds", async () => {
    saveSession({
      email: "demo@sahay.dev",
      userId: "u1",
      organizationId: "o1",
      role: "ADMIN",
      loginAt: Date.now(),
      accessToken: "expired-token",
      refreshToken: "refresh-abc",
    });

    const fetchMock = vi.fn();
    // 1: original request -> 401
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: "TOKEN_EXPIRED", message: "expired" } }, 401),
    );
    // 2: refresh call -> new tokens
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { accessToken: "new-token", refreshToken: "new-refresh" } }),
    );
    // 3: retried original request -> success
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ id: "loco-1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest<{ id: string }[]>("/locomotives");

    expect(result).toEqual([{ id: "loco-1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retriedHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Record<string, string>;
    expect(retriedHeaders.Authorization).toBe("Bearer new-token");
  });

  it("clears the session when refresh also fails after a 401", async () => {
    saveSession({
      email: "demo@sahay.dev",
      userId: "u1",
      organizationId: "o1",
      role: "ADMIN",
      loginAt: Date.now(),
      accessToken: "expired-token",
      refreshToken: "dead-refresh",
    });

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "TOKEN_EXPIRED" } }, 401));
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "INVALID_REFRESH" } }, 401));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/locomotives")).rejects.toBeInstanceOf(ApiError);

    const { getSession } = await import("./session");
    expect(getSession()).toBeNull();
  });
});
