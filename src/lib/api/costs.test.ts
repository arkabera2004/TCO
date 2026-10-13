import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession } from "./session";
import {
  createCostRecord,
  createMaintenanceSchedule,
  deleteMaintenanceSchedule,
  listCostRecords,
  listMaintenanceSchedules,
  updateMaintenanceSchedule,
} from "./costs";

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

const scheduleInput = {
  name: "Annual overhaul",
  triggerMonths: 12,
  rule: "Whichever first",
  laborHours: 40,
  laborRatePerHour: 95,
  partsEstimate: 5000,
  type: "OVERHAUL" as const,
};

describe("costs api", () => {
  beforeAll(() => {
    installWindowStub();
  });

  beforeEach(() => {
    clearSession();
  });

  it("listMaintenanceSchedules GETs the locomotive's schedules", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: "sched-1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listMaintenanceSchedules("loco-1");

    expect(result).toEqual([{ id: "sched-1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/locomotives/loco-1/maintenance-schedules",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("createMaintenanceSchedule POSTs the schedule body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "sched-1", ...scheduleInput } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createMaintenanceSchedule("loco-1", scheduleInput);

    expect(result).toMatchObject({ id: "sched-1", name: "Annual overhaul" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/locomotives/loco-1/maintenance-schedules",
      expect.objectContaining({ method: "POST", body: JSON.stringify(scheduleInput) }),
    );
  });

  it("updateMaintenanceSchedule PATCHes a partial body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { id: "sched-1", name: "Renamed" } }));
    vi.stubGlobal("fetch", fetchMock);

    await updateMaintenanceSchedule("sched-1", { name: "Renamed" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/maintenance-schedules/sched-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Renamed" }) }),
    );
  });

  it("deleteMaintenanceSchedule DELETEs the schedule", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteMaintenanceSchedule("sched-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/maintenance-schedules/sched-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("listCostRecords builds year/category query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: "cost-1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listCostRecords("loco-1", { year: 2026, category: "MAINTENANCE" });

    expect(result).toEqual([{ id: "cost-1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/locomotives/loco-1/cost-records?year=2026&category=MAINTENANCE",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("createCostRecord POSTs the cost record body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { id: "cost-1", year: 2026, category: "FUEL", amount: 1200 } }, 201),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCostRecord("loco-1", {
      year: 2026,
      category: "FUEL",
      amount: 1200,
    });

    expect(result).toMatchObject({ id: "cost-1", amount: 1200 });
  });

  it("surfaces a 403 when a non-ADMIN/MANAGER role creates a schedule", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: "FORBIDDEN", message: "Forbidden" } }, 403),
        ),
    );

    await expect(createMaintenanceSchedule("loco-1", scheduleInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });
});
