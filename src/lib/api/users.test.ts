import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession } from "./session";
import { deactivateMember, inviteMember, listMembers, updateMemberRole } from "./users";

function jsonResponse(body: unknown, status = 200) {
  return new Response(body === undefined ? "" : JSON.stringify(body), {
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

describe("users api", () => {
  beforeAll(() => {
    installWindowStub();
  });

  beforeEach(() => {
    clearSession();
  });

  it("listMembers GETs /users", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: "u-1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listMembers();

    expect(result).toEqual([{ id: "u-1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/users",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("inviteMember POSTs /users with email, password, and role", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { id: "u-2", email: "a@b.com", role: "VIEWER" } }, 201),
      );
    vi.stubGlobal("fetch", fetchMock);

    await inviteMember({ email: "a@b.com", password: "supersecret", role: "VIEWER" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/users",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "a@b.com", password: "supersecret", role: "VIEWER" }),
      }),
    );
  });

  it("updateMemberRole PATCHes /users/:userId/role", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "u-1", role: "MANAGER" } }));
    vi.stubGlobal("fetch", fetchMock);

    await updateMemberRole("u-1", "MANAGER");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/users/u-1/role",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ role: "MANAGER" }) }),
    );
  });

  it("deactivateMember DELETEs /users/:userId and tolerates an empty body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deactivateMember("u-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/users/u-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
