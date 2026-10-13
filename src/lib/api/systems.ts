import { apiRequest } from "./client";
import type { BackendSystemNode } from "./locomotives";

export type CreateSystemInput = {
  name: string;
  icon: string;
  criticality: string;
};

export async function createSystem(
  locomotiveId: string,
  body: CreateSystemInput,
): Promise<BackendSystemNode> {
  return apiRequest<BackendSystemNode>(`/locomotives/${locomotiveId}/systems`, {
    method: "POST",
    body,
  });
}
