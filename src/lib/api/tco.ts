import { apiRequest } from "./client";

// Matches src/modules/tco/engine.ts's LocomotiveTco return shape in
// TCO_Backend — persisted verbatim as TcoRun.outputs (service.ts).
export type TcoMaintenanceEvent = {
  occurrence: number;
  atYear: number;
  cost: number;
  laborCost: number;
  downtimeCost: number;
  totalCost: number;
  underWarranty: boolean;
};

export type TcoComponentRow = {
  componentId: string;
  componentName: string;
  events: TcoMaintenanceEvent[];
  eventCount: number;
  maintenanceCost: number;
  laborCost: number;
  downtimeCost: number;
  totalCost: number;
  warrantyCoveredCost: number;
  customerCost: number;
  companyCost: number;
  buffer: number;
  avgAnnualCost: number;
};

export type TcoOutputs = {
  rows: TcoComponentRow[];
  maintenanceCost: number;
  laborCost: number;
  downtimeCost: number;
  totalCost: number;
  warrantyCoveredCost: number;
  customerTCO: number;
  organizationTCO: number;
  buffer: number;
  avgAnnualCost: number;
};

export type TcoInputs = {
  horizonYears: number;
  annualHours: number;
  componentCount: number;
  scenarioId: string | null;
  maintenanceIntervalMultiplier: number;
  warrantyExtendedYears: number;
  failureRateMultiplier: number;
  includeDowntime: boolean;
};

export type BackendTcoRun = {
  id: string;
  organizationId: string;
  locomotiveId: string;
  scenarioId: string | null;
  horizonYears: number;
  inputs: TcoInputs;
  outputs: TcoOutputs;
  createdByUserId: string;
  createdAt: string;
};

export type CreateTcoRunInput = {
  locomotiveId: string;
  horizonYears?: number;
  scenarioId?: string;
};

export async function createTcoRun(body: CreateTcoRunInput): Promise<BackendTcoRun> {
  return apiRequest<BackendTcoRun>("/tco/runs", { method: "POST", body });
}

export async function getTcoRun(id: string): Promise<BackendTcoRun> {
  return apiRequest<BackendTcoRun>(`/tco/runs/${id}`);
}

export async function listTcoRunsForLocomotive(locomotiveId: string): Promise<BackendTcoRun[]> {
  return apiRequest<BackendTcoRun[]>(`/locomotives/${locomotiveId}/tco-runs`);
}
