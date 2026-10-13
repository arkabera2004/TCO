import { apiRequest } from "./client";

// Matches src/modules/simulation/{service,statistics}.ts in TCO_Backend.
export type SimulationSummary = {
  mean: number;
  median: number;
  min: number;
  max: number;
  variance: number;
};

export type SimulationPercentiles = {
  p10: number;
  p50: number;
  p90: number;
  p95: number;
};

export type SimulationHistogramBin = {
  rangeStart: number;
  rangeEnd: number;
  count: number;
};

export type SimulationConfig = {
  annualHours: number;
  componentCount: number;
  baseFailureMultiplier: number;
  includeDowntime: boolean;
  scenarioId: string | null;
};

export type BackendSimulationRun = {
  id: string;
  organizationId: string;
  locomotiveId: string;
  scenarioId: string | null;
  horizonYears: number;
  iterations: number;
  seed: string;
  engineVersion: string;
  config: SimulationConfig;
  summary: SimulationSummary;
  percentiles: SimulationPercentiles;
  histogram: SimulationHistogramBin[];
  createdByUserId: string;
  createdAt: string;
};

export type CreateSimulationRunInput = {
  locomotiveId: string;
  horizonYears?: number;
  scenarioId?: string;
  iterations?: number;
  seed?: string;
};

export async function createSimulationRun(
  body: CreateSimulationRunInput,
): Promise<BackendSimulationRun> {
  return apiRequest<BackendSimulationRun>("/simulation-runs", { method: "POST", body });
}

export async function getSimulationRun(id: string): Promise<BackendSimulationRun> {
  return apiRequest<BackendSimulationRun>(`/simulation-runs/${id}`);
}

export async function listSimulationRunsForLocomotive(
  locomotiveId: string,
): Promise<BackendSimulationRun[]> {
  return apiRequest<BackendSimulationRun[]>(`/locomotives/${locomotiveId}/simulation-runs`);
}
