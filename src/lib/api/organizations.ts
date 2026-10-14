import { apiRequest } from "./client";

// Matches src/modules/organizations/routes.ts's organizationSchema in TCO_Backend.
export type BackendOrganization = {
  id: string;
  name: string;
};

export async function getMyOrganization(): Promise<BackendOrganization> {
  return apiRequest<BackendOrganization>("/organizations/me");
}

export async function renameMyOrganization(name: string): Promise<BackendOrganization> {
  return apiRequest<BackendOrganization>("/organizations/me", { method: "PATCH", body: { name } });
}
