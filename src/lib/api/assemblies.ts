import { apiRequest } from "./client";
import type { BackendAssembly } from "./locomotives";

export type CreateAssemblyInput = {
  name: string;
};

export async function createAssembly(
  locomotiveId: string,
  systemId: string,
  body: CreateAssemblyInput,
): Promise<BackendAssembly> {
  return apiRequest<BackendAssembly>(
    `/locomotives/${locomotiveId}/systems/${systemId}/assemblies`,
    { method: "POST", body },
  );
}
