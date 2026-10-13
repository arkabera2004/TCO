import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession } from "./session";
import { createSystem } from "./systems";

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

describe("createSystem", () => {
  beforeAll(() => {
    installWindowStub();
  });

  beforeEach(() => {
    clearSession();
  });

  it("POSTs to /locomotives/:id/systems with the body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "sys-1", name: "Engine" } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createSystem("loco-1", {
      name: "Engine",
      icon: "layers",
      criticality: "Vital",
    });

    expect(result).toEqual({ id: "sys-1", name: "Engine" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/locomotives/loco-1/systems",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Engine", icon: "layers", criticality: "Vital" }),
      }),
    );
  });

  it("surfaces a 403 as an ApiError when the user lacks permission", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: "FORBIDDEN", message: "Forbidden" } }, 403),
        ),
    );

    await expect(
      createSystem("loco-1", { name: "Engine", icon: "layers", criticality: "Vital" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
