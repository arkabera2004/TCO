// Client-side cache of the backend-issued JWT pair and user profile.
// This is convenience storage, not access control — every protected
// request is independently authorized by the backend validating the
// bearer token it receives (see api/client.ts).
const SESSION_KEY = "tco_auth_session";

export type AuthSession = {
  email: string;
  userId: string;
  organizationId: string;
  role: string;
  loginAt: number;
  accessToken: string;
  refreshToken: string;
};

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function saveSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("tco-auth-change"));
}

export function updateTokens(accessToken: string, refreshToken: string): void {
  const session = getSession();
  if (!session) return;
  saveSession({ ...session, accessToken, refreshToken });
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("tco-auth-change"));
}

export function getAccessToken(): string | null {
  return getSession()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return getSession()?.refreshToken ?? null;
}
