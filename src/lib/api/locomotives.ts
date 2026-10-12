import { apiRequest } from "./client";

// Shape returned by GET /locomotives on the real backend (src/modules/assets
// in TCO_Backend). Only the fields this frontend currently renders are
// declared — the backend returns more (purchaseCost, commissionYear, etc.)
// that aren't consumed yet.
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

export async function listLocomotives(): Promise<BackendLocomotive[]> {
  return apiRequest<BackendLocomotive[]>("/locomotives");
}
