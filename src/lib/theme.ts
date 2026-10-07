// Plain (non-"use client") module so Server Components can safely import
// this constant. theme-context.tsx is "use client" — a value exported from
// a client module is not reliably usable from server code across the RSC
// boundary, so it must live here instead.
export const THEME_STORAGE_KEY = "sahay-theme";

export type ThemeMode = "light" | "dark";
