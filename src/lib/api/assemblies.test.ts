import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession } from "./session";
import { createAssembly } from "./assemblies";

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

describe("createAssembly", () => {
  beforeAll(() => {
    installWindowStub();
  });

  beforeEach(() => {
    clearSession();
  });

  it("POSTs to /locomotives/:id/systems/:systemId/assemblies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "asm-1", name: "Exhaust Path" } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createAssembly("loco-1", "sys-1", { name: "Exhaust Path" });

    expect(result).toEqual({ id: "asm-1", name: "Exhaust Path" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/locomotives/loco-1/systems/sys-1/assemblies",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Exhaust Path" }) }),
    );
  });

  it("surfaces a 422 validation error as an ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: "VALIDATION_ERROR", message: "name is required" } }, 422),
        ),
    );

    await expect(createAssembly("loco-1", "sys-1", { name: "" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 422,
    });
  });
});
