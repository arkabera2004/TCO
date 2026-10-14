import { apiRequest } from "./client";

export type MemberRole = "ADMIN" | "MANAGER" | "ANALYST" | "VIEWER";

// Matches src/modules/users/routes.ts's memberSchema in TCO_Backend.
export type BackendMember = {
  id: string;
  email: string;
  role: string;
  deactivatedAt?: string | null;
};

export type CreateMemberInput = {
  email: string;
  password: string;
  role: MemberRole;
};

export async function listMembers(): Promise<BackendMember[]> {
  return apiRequest<BackendMember[]>("/users");
}

export async function inviteMember(body: CreateMemberInput): Promise<BackendMember> {
  return apiRequest<BackendMember>("/users", { method: "POST", body });
}

export async function updateMemberRole(
  userId: string,
  role: MemberRole,
): Promise<{ id: string; role: string }> {
  return apiRequest<{ id: string; role: string }>(`/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
}

export async function deactivateMember(userId: string): Promise<void> {
  await apiRequest<void>(`/users/${userId}`, { method: "DELETE" });
}
