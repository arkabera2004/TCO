import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession } from "./session";
import { getMyOrganization, renameMyOrganization } from "./organizations";

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

describe("organizations api", () => {
  beforeAll(() => {
    installWindowStub();
  });

  beforeEach(() => {
    clearSession();
  });

  it("getMyOrganization GETs /organizations/me", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "org-1", name: "Wayam Rail" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMyOrganization();

    expect(result).toEqual({ id: "org-1", name: "Wayam Rail" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/organizations/me",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("renameMyOrganization PATCHes /organizations/me with the new name", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "org-1", name: "Renamed Co" } }));
    vi.stubGlobal("fetch", fetchMock);

    await renameMyOrganization("Renamed Co");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/organizations/me",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Renamed Co" }) }),
    );
  });
});
