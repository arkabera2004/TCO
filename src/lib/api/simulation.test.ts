import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession } from "./session";
import {
  createSimulationRun,
  getSimulationRun,
  listSimulationRunsForLocomotive,
} from "./simulation";

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

describe("simulation api", () => {
  beforeAll(() => {
    installWindowStub();
  });

  beforeEach(() => {
    clearSession();
  });

  it("createSimulationRun POSTs /simulation-runs with the input body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "sim-1", percentiles: { p50: 100 } } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createSimulationRun({ locomotiveId: "loco-1", iterations: 2000 });

    expect(result).toMatchObject({ id: "sim-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/simulation-runs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ locomotiveId: "loco-1", iterations: 2000 }),
      }),
    );
  });

  it("getSimulationRun GETs /simulation-runs/:id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: { id: "sim-1" } })));

    const result = await getSimulationRun("sim-1");

    expect(result).toEqual({ id: "sim-1" });
  });

  it("listSimulationRunsForLocomotive GETs the locomotive's run history", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: "sim-1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSimulationRunsForLocomotive("loco-1");

    expect(result).toEqual([{ id: "sim-1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/locomotives/loco-1/simulation-runs",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("surfaces a 400 when there are no components to simulate", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: "VALIDATION_ERROR", message: "No components to simulate" } },
            400,
          ),
        ),
    );

    await expect(createSimulationRun({ locomotiveId: "loco-1" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });
});
