// NEXT_PUBLIC_API_BASE_URL is the backend's ORIGIN only (e.g. "http://localhost:8000"),
// not the versioned API prefix — the prefix is appended once here so every
// call site stays agnostic of the backend's versioning scheme.
export const API_ORIGIN = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/+$/,
  "",
);
export const API_PREFIX = "/api/v1";
