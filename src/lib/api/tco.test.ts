import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession } from "./session";
import { createTcoRun, getTcoRun, listTcoRunsForLocomotive } from "./tco";

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

describe("tco api", () => {
  beforeAll(() => {
    installWindowStub();
  });

  beforeEach(() => {
    clearSession();
  });

  it("createTcoRun POSTs /tco/runs with locomotiveId/horizonYears/scenarioId", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "run-1", outputs: { totalCost: 100 } } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createTcoRun({ locomotiveId: "loco-1", horizonYears: 20 });

    expect(result).toMatchObject({ id: "run-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/tco/runs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ locomotiveId: "loco-1", horizonYears: 20 }),
      }),
    );
  });

  it("getTcoRun GETs /tco/runs/:id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: { id: "run-1" } })));

    const result = await getTcoRun("run-1");

    expect(result).toEqual({ id: "run-1" });
  });

  it("listTcoRunsForLocomotive GETs the locomotive's run history", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: "run-1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listTcoRunsForLocomotive("loco-1");

    expect(result).toEqual([{ id: "run-1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/locomotives/loco-1/tco-runs",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("surfaces a 404 when the locomotive doesn't exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            jsonResponse({ error: { code: "NOT_FOUND", message: "Locomotive not found" } }, 404),
          ),
        ),
    );

    await expect(createTcoRun({ locomotiveId: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});
