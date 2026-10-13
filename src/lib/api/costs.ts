import { apiRequest } from "./client";

// Matches src/modules/costs/routes.ts in TCO_Backend.
export type MaintenanceScheduleType = "PREVENTIVE" | "OVERHAUL" | "REBUILD";

export type BackendMaintenanceSchedule = {
  id: string;
  organizationId: string;
  locomotiveId: string;
  name: string;
  triggerMonths: number | null;
  triggerKm: number | null;
  triggerHours: number | null;
  rule: string;
  laborHours: number;
  laborRatePerHour: number;
  partsEstimate: number;
  type: MaintenanceScheduleType;
};

export type MaintenanceScheduleInput = {
  name: string;
  triggerMonths?: number;
  triggerKm?: number;
  triggerHours?: number;
  rule: string;
  laborHours: number;
  laborRatePerHour: number;
  partsEstimate: number;
  type: MaintenanceScheduleType;
};

export type CostCategory =
  | "CAPEX"
  | "MAINTENANCE"
  | "CONSUMABLE"
  | "LABOR"
  | "FAILURE"
  | "WARRANTY"
  | "FUEL"
  | "DOWNTIME";

export type BackendCostRecord = {
  id: string;
  organizationId: string;
  locomotiveId: string;
  year: number;
  category: CostCategory;
  amount: number;
};

export type CostRecordInput = {
  year: number;
  category: CostCategory;
  amount: number;
};

export async function listMaintenanceSchedules(
  locomotiveId: string,
): Promise<BackendMaintenanceSchedule[]> {
  return apiRequest<BackendMaintenanceSchedule[]>(
    `/locomotives/${locomotiveId}/maintenance-schedules`,
  );
}

export async function createMaintenanceSchedule(
  locomotiveId: string,
  body: MaintenanceScheduleInput,
): Promise<BackendMaintenanceSchedule> {
  return apiRequest<BackendMaintenanceSchedule>(
    `/locomotives/${locomotiveId}/maintenance-schedules`,
    { method: "POST", body },
  );
}

export async function updateMaintenanceSchedule(
  scheduleId: string,
  body: Partial<MaintenanceScheduleInput>,
): Promise<BackendMaintenanceSchedule> {
  return apiRequest<BackendMaintenanceSchedule>(`/maintenance-schedules/${scheduleId}`, {
    method: "PATCH",
    body,
  });
}

export async function deleteMaintenanceSchedule(scheduleId: string): Promise<void> {
  await apiRequest<void>(`/maintenance-schedules/${scheduleId}`, { method: "DELETE" });
}

export async function listCostRecords(
  locomotiveId: string,
  params: { year?: number; category?: CostCategory } = {},
): Promise<BackendCostRecord[]> {
  const query = new URLSearchParams();
  if (params.year) query.set("year", String(params.year));
  if (params.category) query.set("category", params.category);
  const qs = query.toString();
  return apiRequest<BackendCostRecord[]>(
    `/locomotives/${locomotiveId}/cost-records${qs ? `?${qs}` : ""}`,
  );
}

export async function createCostRecord(
  locomotiveId: string,
  body: CostRecordInput,
): Promise<BackendCostRecord> {
  return apiRequest<BackendCostRecord>(`/locomotives/${locomotiveId}/cost-records`, {
    method: "POST",
    body,
  });
}
