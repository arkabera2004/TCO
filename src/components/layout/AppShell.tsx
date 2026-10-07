"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import CountUp from "@/components/shared/CountUp";
import { AppIcon } from "@/components/icons/AppIcon";
import { IconButton } from "@/components/icons/IconButton";
import type { IconName } from "@/components/icons/registry";
import { FilterChip, FilterChipGroup } from "@/components/shared/FilterChip";
import { useSimulationStore, formatHorizon, HORIZON_ANNUAL_KM } from "@/store/simulationStore";
import { useTheme } from "@/context/theme-context";
import { LOCOMOTIVES } from "@/data/syntheticData";
import { cn } from "@/lib/utils";
import { getSession, logout } from "@/lib/auth";

type NavItem = { to: string; label: string; icon: IconName; badge?: "NEW" | "LIVE" };

const NAV: NavItem[] = [
  { to: "/", label: "Command Center", icon: "dashboard" },
  { to: "/fleet-explorer", label: "Fleet Explorer", icon: "hierarchy" },
  { to: "/bom", label: "BOM Explorer", icon: "bom", badge: "NEW" },
  { to: "/library", label: "Maintenance Library", icon: "library", badge: "NEW" },
  { to: "/simulation", label: "Simulation", icon: "simulation", badge: "LIVE" },
  { to: "/forecasting", label: "Forecasting", icon: "forecasting", badge: "NEW" },
  { to: "/scenarios", label: "Scenarios", icon: "scenarios" },
  { to: "/monte-carlo", label: "Monte Carlo", icon: "monteCarlo", badge: "NEW" },
  { to: "/maintenance", label: "Maintenance", icon: "schedule" },
  { to: "/reliability", label: "Reliability", icon: "reliability" },
  { to: "/asset-health", label: "Asset Health", icon: "assetHealth", badge: "NEW" },
  { to: "/benchmark", label: "Benchmark", icon: "benchmark" },
  { to: "/tender", label: "Tender Mode", icon: "document", badge: "NEW" },
  { to: "/sustainability", label: "Sustainability", icon: "sustainability", badge: "NEW" },
  { to: "/integrations", label: "Integrations", icon: "integrations", badge: "NEW" },
  { to: "/glossary", label: "Glossary", icon: "glossary", badge: "NEW" },
  { to: "/configure", label: "Configure", icon: "settings" },
];

const ROUTE_TITLES: Record<string, string> = {
  "/": "Command Center",
  "/fleet-explorer": "Fleet & Product Hierarchy Explorer",
  "/bom": "Bill of Materials — Part-Level Explorer",
  "/library": "Maintenance Library — Part-Level Cost Definitions",
  "/simulation": "TCO Simulation Playground",
  "/forecasting": "Forecasting Engine",
  "/scenarios": "Scenario Comparator",
  "/monte-carlo": "Monte Carlo Risk Simulation",
  "/maintenance": "Maintenance Schedule & Rule Engine",
  "/reliability": "Reliability & Warranty Analytics",
  "/asset-health": "Asset Health Index",
  "/benchmark": "Competitor Benchmark Arena",
  "/tender": "Tender Optimization Mode",
  "/sustainability": "Sustainability Dashboard",
  "/integrations": "Data Integration Hub",
  "/glossary": "Glossary — What Every Cost Category Includes",
  "/configure": "Self-Service Configuration",
};

/** Short label for the breadcrumb — the full title goes in the page heading. */
const CRUMB: Record<string, string> = Object.fromEntries(NAV.map((n) => [n.to, n.label]));

/**
 * One navigation row. States follow the action-surface token scale:
 *   inactive -> surface.action + icon.tertiary
 *   hover    -> surface.raised-x2 + icon.secondary
 *   active   -> action-surface.primary (light) + icon.on-color (near-black)
 */
function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.to}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "transition-ui text-body-md group flex items-center gap-2.5 rounded-lg px-2.5 py-2",
        active
          ? "bg-action-primary text-on-color font-medium"
          : "text-fg-tertiary hover:bg-raised-2 hover:text-fg-primary",
      )}
    >
      <AppIcon
        name={item.icon}
        size="lg"
        className={cn(
          "transition-ui",
          active ? "text-icon-on-color" : "text-icon-tertiary group-hover:text-icon-secondary",
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span
          className={cn(
            "text-caption rounded px-1 py-0.5 uppercase",
            active
              ? "bg-page/10 text-on-color"
              : item.badge === "LIVE"
                ? "bg-success-bg text-success"
                : "bg-info-bg text-info",
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { params, result, activeScenarioName, setParams, horizonUnit, setHorizonUnit } =
    useSimulationStore();
  const loco = LOCOMOTIVES.find((l) => l.id === params.locomotiveId) ?? LOCOMOTIVES[0];
  const shortModel = loco.model.split(" ")[0];
  const session = getSession();
  const [navOpen, setNavOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  // Close the mobile drawer automatically whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  function handleLogout() {
    logout();
    setNavOpen(false);
    router.push("/login");
  }

  const horizonControls = (
    <div className="flex items-center gap-1.5">
      <FilterChipGroup>
        {[5, 10, 20, 30].map((n) => (
          <FilterChip
            key={n}
            selected={params.N === n}
            onClick={() => setParams({ N: n })}
            title={`${n} years · ${((n * HORIZON_ANNUAL_KM) / 1e6).toFixed(1)}M km`}
          >
            {formatHorizon(n, horizonUnit)}
          </FilterChip>
        ))}
      </FilterChipGroup>
      <FilterChipGroup>
        {(["years", "km"] as const).map((u) => (
          <FilterChip key={u} selected={horizonUnit === u} onClick={() => setHorizonUnit(u)}>
            {u === "years" ? "Yr" : "Km"}
          </FilterChip>
        ))}
      </FilterChipGroup>
    </div>
  );

  const sidebarNav = (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-muted px-4">
        <div className="flex items-center gap-2.5">
          <img src="/wayam-logo.svg" alt="Wayam AI" className="h-7 w-auto object-contain" />
        </div>
        <span className="text-caption tracking-[0.08em] text-quaternary uppercase">SAHAY</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map((item) => (
          <SidebarItem key={item.to} item={item} active={pathname === item.to} />
        ))}
      </nav>
      <div className="border-t border-muted space-y-2 p-3">
        <div className="bg-container border border-muted rounded-lg p-2.5">
          <p className="text-caption tracking-[0.08em] text-quaternary uppercase">Live scenario</p>
          <p className="font-mono-data text-body-sm text-secondary mt-1 truncate">
            {activeScenarioName} · {shortModel} · {params.N}yr
          </p>
          <p className="font-display text-display-base text-primary mt-1 tabular-nums">
            ${(result.totalTCO / 1e6).toFixed(2)}M TCO
          </p>
        </div>
        {session ? (
          <button
            onClick={handleLogout}
            className="transition-ui text-body-sm text-tertiary hover:bg-raised-2 hover:text-primary flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5"
            title={session.email}
            aria-label={`Sign out of ${session.email}`}
          >
            <AppIcon name="logout" size="sm" className="text-icon-tertiary" />
            <span className="min-w-0 flex-1 truncate text-left">{session.email}</span>
            <span className="text-caption text-quaternary uppercase">Sign out</span>
          </button>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="bg-page flex h-screen w-full overflow-hidden text-primary font-sans antialiased">
      {/* Desktop sidebar — fixed 240px */}
      <aside className="bg-container border-r border-muted fixed inset-y-0 left-0 z-40 hidden w-60 flex-col lg:flex">
        {sidebarNav}
      </aside>

      {/* Mobile / tablet nav drawer — hand-rolled overlay, no Radix dialog */}
      {navOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      ) : null}
      <aside
        aria-label="Navigation"
        className={cn(
          "bg-container border-r border-muted fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col transition-transform duration-200 ease-out lg:hidden",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarNav}
      </aside>

      {/* Main Canvas */}
      <div className="flex h-screen w-full min-w-0 flex-1 flex-col lg:ml-60">
        {/* Chronos-aligned TopBar: h-14 with breadcrumb & scope controls */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-muted bg-page px-4 sm:gap-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <IconButton
              icon="menu"
              aria-label="Open navigation"
              variant="subtle"
              size="sm"
              className="lg:hidden"
              onClick={() => setNavOpen(true)}
            />
            <Link
              href="/"
              className="transition-ui text-quaternary hover:text-secondary hidden sm:inline"
              aria-label="Command Center"
            >
              <AppIcon name="home" size="xs" />
            </Link>
            <span className="hidden text-quaternary sm:inline" aria-hidden="true">
              /
            </span>
            <span className="hidden font-mono text-caption tracking-[0.08em] text-quaternary uppercase sm:inline">
              SAHAY
            </span>
            <span className="hidden text-quaternary sm:inline" aria-hidden="true">
              /
            </span>
            <h1
              className="truncate font-display text-display-md text-primary"
              title={CRUMB[pathname] ?? "Command Center"}
            >
              {CRUMB[pathname] ?? "Command Center"}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Fleet TCO Live metric pill */}
            <div className="hidden h-8 items-center gap-2 rounded-full border border-muted bg-action px-3 text-label-sm text-secondary md:flex">
              <span className="text-caption text-quaternary uppercase">Fleet TCO</span>
              <span className="font-display text-primary tabular-nums">
                <CountUp
                  end={result.totalTCO}
                  duration={0.5}
                  separator=","
                  prefix="$"
                  preserveValue
                />
              </span>
            </div>

            {/* Scope controls */}
            <div className="hidden items-center gap-2 xl:flex">{horizonControls}</div>

            <IconButton
              icon={isDark ? "themeLight" : "themeDark"}
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              variant="subtle"
              size="sm"
              onClick={toggleTheme}
            />

            <span className="inline-flex items-center gap-1.5 rounded-full border border-muted bg-action px-2.5 py-1 text-caption text-secondary">
              <span className="size-1.5 rounded-full bg-success" />
              <span>Live</span>
            </span>
          </div>
        </header>

        {/* Compact horizon controls on screens narrower than xl */}
        <div className="border-b border-muted bg-page flex shrink-0 items-center gap-2 overflow-x-auto px-4 py-2 xl:hidden">
          {horizonControls}
        </div>

        {/* Page canvas */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-page">
          {children}
        </main>

        {/* Docked operational status bar */}
        <footer className="h-9 shrink-0 border-t border-muted bg-container px-4 text-caption flex items-center justify-between text-secondary">
          <div className="flex items-center gap-2 min-w-0 truncate">
            <span className="size-1.5 rounded-full bg-success shrink-0" />
            <span className="font-mono-data text-quaternary truncate">
              {activeScenarioName} · {shortModel} · {params.operatingProfile} · {params.N}yr
            </span>
            <span className="text-quaternary">·</span>
            <span className="font-mono-data text-primary tabular-nums font-medium">
              ${Math.round(result.totalTCO).toLocaleString("en-US")}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <Link
              href="/simulation"
              className="text-tertiary hover:text-primary transition-colors flex items-center gap-1 text-label-sm"
            >
              <AppIcon name="play" size="xs" /> Re-run
            </Link>
            <Link
              href="/monte-carlo"
              className="text-tertiary hover:text-primary transition-colors hidden sm:flex items-center gap-1 text-label-sm"
            >
              Monte Carlo <AppIcon name="arrowRight" size="xs" />
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
