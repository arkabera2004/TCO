import { API_ORIGIN, API_PREFIX } from "./env";
import { getAccessToken, getRefreshToken, updateTokens, clearSession } from "./session";

const DEFAULT_TIMEOUT_MS = 10000;

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, opts: { code: string; status: number; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Attach the bearer token and allow the 401-refresh retry. Defaults to true. */
  auth?: boolean;
  timeoutMs?: number;
};

type ApiEnvelope<T> = { data?: T; error?: { code?: string; message?: string; details?: unknown } };

async function rawRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}${API_PREFIX}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted) {
      throw new ApiError("Request timed out", { code: "TIMEOUT", status: 0 });
    }
    throw new ApiError("Network request failed", {
      code: "NETWORK_ERROR",
      status: 0,
      details: err,
    });
  }
  clearTimeout(timer);

  // Responses may be empty (204) or non-JSON (e.g. a proxy error page) — never assume JSON.
  const text = await res.text();
  let parsed: ApiEnvelope<T> | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as ApiEnvelope<T>;
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const err = parsed?.error;
    throw new ApiError(err?.message ?? `Request failed with status ${res.status}`, {
      code: err?.code ?? "HTTP_ERROR",
      status: res.status,
      details: err?.details,
    });
  }

  return (parsed?.data ?? (parsed as unknown as T)) as T;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const data = await rawRequest<{ accessToken: string; refreshToken: string }>(
        "/auth/refresh",
        {
          method: "POST",
          body: { refreshToken },
          auth: false,
        },
      );
      updateTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  })();
  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}

/**
 * Authenticated request with a single automatic retry after a token refresh
 * on 401. Concurrent 401s share one in-flight refresh (see refreshPromise).
 * If the refresh itself fails, the local session is cleared so AuthGate
 * redirects to /login on its next check.
 */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && opts.auth !== false) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return await rawRequest<T>(path, opts);
      }
      clearSession();
    }
    throw err;
  }
}
