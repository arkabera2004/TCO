import { apiRequest } from "./client";
import type { BackendComponent } from "./locomotives";

export type ComponentInput = {
  assemblyId: string;
  name: string;
  purchaseCost: number;
  replacementCost: number;
  lifeYears: number;
  mtbfHours: number;
  weibullBeta: number;
  weibullEta: number;
  mttrHours: number;
  warrantyYears: number;
  laborCostPct: number;
  failureImpact: string;
  category: string;
  downtimeCostPerDay: number;
};

export async function listComponents(locomotiveId: string): Promise<BackendComponent[]> {
  return apiRequest<BackendComponent[]>(`/locomotives/${locomotiveId}/components`);
}

export async function createComponent(
  locomotiveId: string,
  body: ComponentInput,
): Promise<BackendComponent> {
  return apiRequest<BackendComponent>(`/locomotives/${locomotiveId}/components`, {
    method: "POST",
    body,
  });
}

export async function updateComponent(
  id: string,
  body: Partial<ComponentInput>,
): Promise<BackendComponent> {
  return apiRequest<BackendComponent>(`/components/${id}`, { method: "PATCH", body });
}

export async function deleteComponent(id: string): Promise<void> {
  await apiRequest<void>(`/components/${id}`, { method: "DELETE" });
}
