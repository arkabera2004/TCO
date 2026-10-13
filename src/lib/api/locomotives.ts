import { apiRequest } from "./client";

// Shape returned by GET /locomotives and GET /locomotives/:id on the real
// backend (src/modules/assets in TCO_Backend). Only the fields this frontend
// currently renders are declared — the backend returns more (purchaseCost,
// commissionYear, etc.) that aren't consumed yet.
export type BackendLocomotive = {
  id: string;
  fleetId: string;
  model: string;
  manufacturer: string;
  type: string;
  horsepower: number;
  status: string;
  currentHealthScore: number;
  availabilityPct: number;
};

export type BackendComponent = {
  id: string;
  assemblyId: string;
  name: string;
  purchaseCost: number;
  replacementCost: number;
  lifeYears: number;
  pmTriggerMonths: number | null;
  pmTriggerKm: number | null;
  pmTriggerHours: number | null;
  mtbfHours: number;
  weibullBeta: number;
  weibullEta: number;
  mttrHours: number;
  warrantyYears: number;
  laborCostPct: number;
  failureImpact: string;
  category: string;
  currentHours: number;
  downtimeCostPerDay: number;
  healthScore: number;
  dependsOn?: { dependsOnComponentId: string }[];
};

export type BackendAssembly = {
  id: string;
  systemNodeId: string;
  name: string;
  components: BackendComponent[];
};

export type BackendSystemNode = {
  id: string;
  locomotiveId: string;
  name: string;
  icon: string;
  criticality: string;
  healthScore: number;
  assemblies: BackendAssembly[];
};

export type BackendLocomotiveDetail = BackendLocomotive & {
  systems: BackendSystemNode[];
};

export type ListLocomotivesParams = {
  fleetId?: string;
  page?: number;
  pageSize?: number;
};

export async function listLocomotives(
  params: ListLocomotivesParams = {},
): Promise<BackendLocomotive[]> {
  const query = new URLSearchParams();
  if (params.fleetId) query.set("fleetId", params.fleetId);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  const qs = query.toString();
  return apiRequest<BackendLocomotive[]>(`/locomotives${qs ? `?${qs}` : ""}`);
}

export async function getLocomotive(id: string): Promise<BackendLocomotiveDetail> {
  return apiRequest<BackendLocomotiveDetail>(`/locomotives/${id}`);
}
