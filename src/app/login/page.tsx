"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { login } from "@/lib/auth";
import { AppIcon } from "@/components/icons/AppIcon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Demo mode: any non-empty email + password is accepted — there is no
    // real credential check. This app is a sales/demo tool, not a
    // production system with real user accounts.
    if (!email.trim() || !password.trim()) {
      setError("Enter any email and password to continue.");
      return;
    }

    setSubmitting(true);
    login(email.trim(), password);
    router.push("/");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-page px-4">
      <div className="relative w-full max-w-sm rounded-xl border border-muted bg-container p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <img src="/wayam-logo.svg" alt="Wayam AI" className="h-12 w-auto object-contain" />
          <h1 className="mt-4 font-display text-lg font-bold tracking-tight text-primary">SAHAY</h1>
          <p className="mt-1 text-caption text-secondary">Fleet Lifecycle Intelligence Platform</p>
        </div>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-caption tracking-[0.08em] text-quaternary uppercase">
              Email address
            </span>
            <div className="relative">
              <AppIcon
                name="mail"
                size="md"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-quaternary"
              />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-full border border-muted bg-action pl-9 pr-3 text-body-md text-primary outline-none placeholder:text-quaternary focus-visible:border-default focus-visible:ring-2 focus-visible:ring-active"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-caption tracking-[0.08em] text-quaternary uppercase">
              Password
            </span>
            <div className="relative">
              <AppIcon
                name="lock"
                size="md"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-quaternary"
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 w-full rounded-full border border-muted bg-action pl-9 pr-9 text-body-md text-primary outline-none placeholder:text-quaternary focus-visible:border-default focus-visible:ring-2 focus-visible:ring-active"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-quaternary transition-colors hover:text-primary"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <AppIcon name="hide" size="md" />
                ) : (
                  <AppIcon name="show" size="md" />
                )}
              </button>
            </div>
          </label>

          {error ? <p className="text-body-sm text-error">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-10 w-full rounded-full bg-action-primary text-label-md text-on-color outline-none transition-colors duration-[180ms] hover:bg-action-primary-hover focus-visible:ring-2 focus-visible:ring-active disabled:bg-action-primary-disabled"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-muted bg-action p-3">
          <AppIcon name="warrantyActive" size="sm" className="mt-0.5 shrink-0 text-teal" />
          <p className="text-caption leading-relaxed text-secondary">
            Demo mode — enter any email and password to explore the platform. No real account is
            required.
          </p>
        </div>
      </div>
    </div>
  );
}
