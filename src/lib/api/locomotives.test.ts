import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./client";
import { clearSession } from "./session";
import { getLocomotive, listLocomotives } from "./locomotives";

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

describe("locomotives api", () => {
  beforeAll(() => {
    installWindowStub();
  });

  beforeEach(() => {
    clearSession();
  });

  it("listLocomotives builds query params and unwraps data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: "loco-1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listLocomotives({ fleetId: "fleet-1", page: 2, pageSize: 25 });

    expect(result).toEqual([{ id: "loco-1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/locomotives?fleetId=fleet-1&page=2&pageSize=25",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("getLocomotive returns the nested systems/assemblies/components tree", async () => {
    const detail = { id: "loco-1", systems: [{ id: "sys-1", assemblies: [] }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: detail })));

    const result = await getLocomotive("loco-1");

    expect(result).toEqual(detail);
  });

  it("surfaces a 404 as an ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            jsonResponse({ error: { code: "NOT_FOUND", message: "Not found" } }, 404),
          ),
        ),
    );

    await expect(getLocomotive("missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
    await expect(getLocomotive("missing")).rejects.toBeInstanceOf(ApiError);
  });
});
