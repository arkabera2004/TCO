import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getSession, isAuthenticated, login, logout } from "./auth";
import { clearSession } from "./api/session";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

describe("auth", () => {
  beforeAll(() => {
    installWindowStub();
  });

  beforeEach(() => {
    clearSession();
  });

  it("is not authenticated before login", () => {
    expect(isAuthenticated()).toBe(false);
  });

  it("stores the session and tokens on a successful login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            accessToken: "access-1",
            refreshToken: "refresh-1",
            user: { id: "u1", email: "demo@sahay.dev", organizationId: "o1", role: "ADMIN" },
          },
        }),
      ),
    );

    const session = await login("demo@sahay.dev", "DemoPass123!");

    expect(session.email).toBe("demo@sahay.dev");
    expect(isAuthenticated()).toBe(true);
    expect(getSession()?.accessToken).toBe("access-1");
  });

  it("rejects with the backend's error on invalid credentials and leaves no session", async () => {
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

    await expect(login("demo@sahay.dev", "wrong")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    expect(isAuthenticated()).toBe(false);
  });

  it("rejects with ApiError instances specifically", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: { code: "INVALID_CREDENTIALS" } }, 401)),
    );

    await expect(login("demo@sahay.dev", "wrong")).rejects.toBeInstanceOf(ApiError);
  });

  it("clears the session on logout even if the backend call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          data: {
            accessToken: "access-1",
            refreshToken: "refresh-1",
            user: { id: "u1", email: "demo@sahay.dev", organizationId: "o1", role: "ADMIN" },
          },
        }),
      ),
    );
    await login("demo@sahay.dev", "DemoPass123!");
    expect(isAuthenticated()).toBe(true);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
    await logout();

    expect(isAuthenticated()).toBe(false);
  });
});
