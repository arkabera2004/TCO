import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession } from "./session";
import { createComponent, deleteComponent, listComponents, updateComponent } from "./components";

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

const sampleInput = {
  assemblyId: "asm-1",
  name: "Turbocharger",
  purchaseCost: 10000,
  replacementCost: 12000,
  lifeYears: 8,
  mtbfHours: 20000,
  weibullBeta: 2,
  weibullEta: 24000,
  mttrHours: 8,
  warrantyYears: 2,
  laborCostPct: 20,
  failureImpact: "Moderate",
  category: "General",
  downtimeCostPerDay: 500,
};

describe("components api", () => {
  beforeAll(() => {
    installWindowStub();
  });

  beforeEach(() => {
    clearSession();
  });

  it("listComponents GETs /locomotives/:id/components", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: "cmp-1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listComponents("loco-1");

    expect(result).toEqual([{ id: "cmp-1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/locomotives/loco-1/components",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("createComponent POSTs the full component payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "cmp-1", ...sampleInput } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createComponent("loco-1", sampleInput);

    expect(result).toMatchObject({ id: "cmp-1", name: "Turbocharger" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/locomotives/loco-1/components",
      expect.objectContaining({ method: "POST", body: JSON.stringify(sampleInput) }),
    );
  });

  it("updateComponent PATCHes /components/:id with a partial body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "cmp-1", name: "Renamed" } }));
    vi.stubGlobal("fetch", fetchMock);

    await updateComponent("cmp-1", { name: "Renamed" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/components/cmp-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Renamed" }) }),
    );
  });

  it("deleteComponent DELETEs /components/:id and tolerates an empty body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteComponent("cmp-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/components/cmp-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("surfaces a 409 conflict as an ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: "CONFLICT", message: "Already exists" } }, 409),
        ),
    );

    await expect(createComponent("loco-1", sampleInput)).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
  });
});
