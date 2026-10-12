// Real backend authentication against TCO_Backend's /api/v1/auth routes.
// Session (including the JWT pair) is cached client-side for convenience —
// see src/lib/api/session.ts for why that's not the same as access control.
import { ApiError, apiRequest } from "./api/client";
import {
  type AuthSession,
  clearSession,
  getRefreshToken,
  getSession,
  isAuthenticated,
  saveSession,
} from "./api/session";

export type { AuthSession };
export { getSession, isAuthenticated, ApiError };

type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; organizationId: string; role: string };
};

export async function login(email: string, password: string): Promise<AuthSession> {
  const data = await apiRequest<AuthResult>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  const session: AuthSession = {
    email: data.user.email,
    userId: data.user.id,
    organizationId: data.user.organizationId,
    role: data.user.role,
    loginAt: Date.now(),
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
  saveSession(session);
  return session;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  // Clear locally first so the UI reflects logout immediately regardless of
  // whether the backend call below succeeds.
  clearSession();
  if (refreshToken) {
    try {
      await apiRequest("/auth/logout", { method: "POST", body: { refreshToken }, auth: false });
    } catch {
      // Best-effort: the local session is already gone either way.
    }
  }
}
