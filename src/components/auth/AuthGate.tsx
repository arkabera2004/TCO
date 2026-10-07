"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { isAuthenticated } from "@/lib/auth";

// Gates every route except /login behind a demo login screen. Auth state is
// tracked client-side only (see src/lib/auth.ts) — this is a UI gate for a
// demo, not real access control.
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const check = () => setAuthed(isAuthenticated());
    check();
    setReady(true);
    window.addEventListener("tco-auth-change", check);
    window.addEventListener("storage", check);
    return () => {
      window.removeEventListener("tco-auth-change", check);
      window.removeEventListener("storage", check);
    };
  }, []);

  const isLoginRoute = pathname === "/login" || pathname.endsWith("/login");

  useEffect(() => {
    if (!ready) return;
    if (!authed && !isLoginRoute) {
      router.push("/login");
    } else if (authed && isLoginRoute) {
      router.push("/");
    }
  }, [ready, authed, isLoginRoute, router]);

  // Login page renders standalone, without the app shell/sidebar.
  if (isLoginRoute) {
    return <>{children}</>;
  }

  // Avoid flashing the dashboard before we've checked auth state on mount.
  if (!ready || !authed) {
    return <div className="min-h-screen bg-background" />;
  }

  return <AppShell>{children}</AppShell>;
}
