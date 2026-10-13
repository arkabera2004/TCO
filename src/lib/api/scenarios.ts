import { apiRequest } from "./client";

// Matches src/modules/scenarios/routes.ts's scenarioSchema in TCO_Backend.
export type BackendScenario = {
  id: string;
  organizationId: string;
  name: string;
  planningHorizonYears: number;
  discountRate: number;
  laborRate: number;
  maintenanceIntervalMultiplier: number;
  failureRateMultiplier: number;
  warrantyExtendedYears: number;
  fuelCostPerLiter: number;
  inflationEnabled: boolean;
  includeDowntime: boolean;
  operatingProfileId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScenarioInput = {
  name: string;
  planningHorizonYears: number;
  discountRate: number;
  laborRate: number;
  maintenanceIntervalMultiplier: number;
  failureRateMultiplier: number;
  warrantyExtendedYears: number;
  fuelCostPerLiter: number;
  inflationEnabled: boolean;
  includeDowntime: boolean;
  operatingProfileId?: string;
};

export async function listScenarios(): Promise<BackendScenario[]> {
  return apiRequest<BackendScenario[]>("/scenarios");
}

export async function getScenario(id: string): Promise<BackendScenario> {
  return apiRequest<BackendScenario>(`/scenarios/${id}`);
}

export async function createScenario(body: ScenarioInput): Promise<BackendScenario> {
  return apiRequest<BackendScenario>("/scenarios", { method: "POST", body });
}

export async function updateScenario(
  id: string,
  body: Partial<ScenarioInput>,
): Promise<BackendScenario> {
  return apiRequest<BackendScenario>(`/scenarios/${id}`, { method: "PATCH", body });
}

export async function deleteScenario(id: string): Promise<void> {
  await apiRequest<void>(`/scenarios/${id}`, { method: "DELETE" });
}
