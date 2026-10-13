import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession } from "./session";
import {
  createScenario,
  deleteScenario,
  getScenario,
  listScenarios,
  updateScenario,
} from "./scenarios";

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

const sampleInput = {
  name: "Heavy Freight",
  planningHorizonYears: 20,
  discountRate: 5,
  laborRate: 95,
  maintenanceIntervalMultiplier: 1,
  failureRateMultiplier: 1,
  warrantyExtendedYears: 0,
  fuelCostPerLiter: 1.42,
  inflationEnabled: false,
  includeDowntime: true,
};

describe("scenarios api", () => {
  beforeAll(() => {
    installWindowStub();
  });

  beforeEach(() => {
    clearSession();
  });

  it("listScenarios GETs /scenarios", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: "sc-1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listScenarios();

    expect(result).toEqual([{ id: "sc-1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/scenarios",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("getScenario GETs /scenarios/:id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: { id: "sc-1" } })));

    const result = await getScenario("sc-1");

    expect(result).toEqual({ id: "sc-1" });
  });

  it("createScenario POSTs the full required field set", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "sc-1", ...sampleInput } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createScenario(sampleInput);

    expect(result).toMatchObject({ id: "sc-1", name: "Heavy Freight" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/scenarios",
      expect.objectContaining({ method: "POST", body: JSON.stringify(sampleInput) }),
    );
  });

  it("updateScenario PATCHes a partial body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "sc-1", name: "Renamed" } }));
    vi.stubGlobal("fetch", fetchMock);

    await updateScenario("sc-1", { name: "Renamed" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/scenarios/sc-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Renamed" }) }),
    );
  });

  it("deleteScenario DELETEs /scenarios/:id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteScenario("sc-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/scenarios/sc-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("surfaces a 403 when a non-ADMIN/MANAGER role creates a scenario", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: "FORBIDDEN", message: "Forbidden" } }, 403),
        ),
    );

    await expect(createScenario(sampleInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });
});
