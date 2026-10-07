"use client";

import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, KpiTile, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { CHART_COLORS } from "@/data/syntheticData";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/icons/AppIcon";
import type { IconName } from "@/components/icons/registry";

type Group = "Cost categories" | "Warranty & risk" | "TCO views" | "Rates & intervals";

interface Definition {
  term: string;
  group: Group;
  icon: IconName;
  color: string;
  summary: string;
  includes: string[];
  excludes?: string[];
  formula?: string;
}

const DEFINITIONS: Definition[] = [
  {
    term: "Maintenance",
    group: "Cost categories",
    icon: "maintenance",
    color: CHART_COLORS.teal,
    summary:
      "Planned, part-level work carried out at a fixed interval. Every maintenance record belongs to a specific part — never to the locomotive as a whole.",
    includes: [
      "Parts consumed at each service (quantity × unit price)",
      "Scheduled inspections, overhauls and rebuilds",
      "Both time-based (months) and usage-based (hours / km) intervals",
    ],
    excludes: ["Labour — calculated separately as a percentage", "Unplanned failure repairs"],
    formula: "Maintenance Cost = Quantity × Price, once per interval",
  },
  {
    term: "Labour",
    group: "Cost categories",
    icon: "users",
    color: CHART_COLORS.purple,
    summary:
      "The workshop cost of performing maintenance. It is never entered by hand — it is derived from the parts spend on every occurrence.",
    includes: ["Technician time to fit the parts", "Applied at every maintenance event"],
    excludes: ["Parts cost itself", "Overheads billed separately"],
    formula: "Labour Cost = Sum(Part Prices) × 18%  (percentage editable in the Library)",
  },
  {
    term: "Consumables",
    group: "Cost categories",
    icon: "fluid",
    color: CHART_COLORS.yellow,
    summary:
      "Fluids and short-life items replaced on a fixed cadence rather than on condition. Expensed, not capitalised.",
    includes: [
      "Oils, coolants, greases, refrigerant",
      "Filters and gaskets",
      "Anything with a sub-year replacement interval",
    ],
    excludes: ["Rotables and unit-exchange parts", "Anything carrying a core credit"],
  },
  {
    term: "Failures",
    group: "Cost categories",
    icon: "warning",
    color: CHART_COLORS.red,
    summary:
      "Unplanned breakdowns — the expected cost of parts failing before their scheduled replacement, weighted by how likely each failure is.",
    includes: [
      "Replacement part plus the labour to fit it",
      "A cascade premium where one failure damages downstream parts",
      "Weighted by failure probability, not counted as a certainty",
    ],
    excludes: ["Failures still inside the warranty window — those sit under Warranty"],
    formula: "Failure Cost = Failure Probability × Repair Cost",
  },
  {
    term: "Downtime",
    group: "Cost categories",
    icon: "clock",
    color: CHART_COLORS.orange,
    summary:
      "Revenue lost while the locomotive is out of service. Measured from the moment the unit stops earning to the moment it returns to traffic.",
    includes: [
      "Time to repair (MTTR) valued at the daily revenue rate",
      "Both planned service windows and unplanned outages",
      "Warranty outages counted at half rate — the unit is still unavailable even when the repair is free",
    ],
    excludes: ["The repair cost itself — that is Maintenance or Failures"],
    formula: "Downtime Cost = Days Out of Service × Revenue per Active Day",
  },
  {
    term: "Warranty Coverage",
    group: "Warranty & risk",
    icon: "warrantyActive",
    color: CHART_COLORS.blue,
    summary:
      "The period during which the manufacturer, not the operator, pays for a failure. Cover has two limits and ends at whichever is reached first.",
    includes: [
      "Warranty in years — for parts that age",
      "Warranty in kilometres — for parts that wear with use",
    ],
    formula: "Covered = (Years elapsed ≤ Warranty Years) AND (Km run ≤ Warranty Km)",
  },
  {
    term: "Failure Probability",
    group: "Warranty & risk",
    icon: "percent",
    color: CHART_COLORS.red,
    summary:
      "How likely a given part is to fail within its warranty window, expressed as a percentage. Trended against hours in service rather than held as a fixed number.",
    includes: [
      "Derived from criticality and replacement cadence",
      "Rises with accumulated wear (Weibull wear-out phase)",
      "Editable per part in the Library",
    ],
  },
  {
    term: "Company Buffer (Warranty Reserve)",
    group: "Warranty & risk",
    icon: "savings",
    color: CHART_COLORS.orange,
    summary:
      "The contingency fund the organization sets aside per part to cover warranty claims it expects to receive.",
    includes: [
      "Held per part, then rolled up across the BOM hierarchy",
      "Recalculates in real-time whenever price or failure probability changes",
    ],
    formula: "Company Buffer = Part Cost × Failure Probability",
  },
  {
    term: "Customer TCO",
    group: "TCO views",
    icon: "gauge",
    color: CHART_COLORS.teal,
    summary: "Everything the operator actually pays across the planning horizon.",
    includes: [
      "Maintenance parts and derived labour",
      "Consumables and fluids",
      "Out-of-warranty failures",
      "Downtime lost revenue",
    ],
    excludes: ["Anything the warranty covers", "The manufacturer's warranty reserve"],
    formula: "Customer TCO = Total Cost − Warranty-Covered Cost",
  },
  {
    term: "Organization TCO",
    group: "TCO views",
    icon: "calculator",
    color: CHART_COLORS.purple,
    summary: "What the manufacturer carries — the mirror image of the customer's bill.",
    includes: [
      "Warranty replacement cost obligation",
      "Service and spare parts provisioning risk",
      "Company warranty reserve across all active parts",
    ],
    formula: "Organization TCO = Warranty-Covered Cost + Company Buffer",
  },
  {
    term: "Maintenance Interval",
    group: "Rates & intervals",
    icon: "clock",
    color: CHART_COLORS.blue,
    summary:
      "How often a part needs attention, expressed in the unit that actually governs it. Where several limits apply, whichever is reached first triggers the work.",
    includes: [
      "Running hours — engine internals",
      "Kilometres — running gear and brakes",
      "Months — calendar-driven inspections",
    ],
  },
  {
    term: "Extended Cost",
    group: "Rates & intervals",
    icon: "package",
    color: CHART_COLORS.green,
    summary: "The cost of a whole part line rather than a single unit.",
    formula: "Extended Cost = Unit Price × Quantity per Component",
    includes: ["Used for BOM roll-ups and depreciation calculations"],
  },
  {
    term: "Depreciation",
    group: "Rates & intervals",
    icon: "trendDown",
    color: CHART_COLORS.purple,
    summary:
      "How a capitalised part loses book value over its useful life. Each part depreciates on its own schedule (IAS 16 component approach).",
    includes: [
      "Straight-line for steady-wear parts",
      "Units-of-production where charge scales with utilisation",
    ],
    excludes: ["Consumables — expensed as incurred, never capitalised"],
  },
];

const GROUPS: Group[] = ["Cost categories", "Warranty & risk", "TCO views", "Rates & intervals"];

export default function Glossary() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Group | "All">("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEFINITIONS.filter((d) => {
      if (group !== "All" && d.group !== group) return false;
      if (!q) return true;
      return (
        d.term.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q) ||
        d.includes.some((i) => i.toLowerCase().includes(q))
      );
    });
  }, [query, group]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Glossary & Accounting Methodologies"
        description="Standardized technical definitions, mathematical formulas, and accounting principles governing TCO calculations, warranty allocations, and risk reserves."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex items-center">
              <AppIcon
                name="search"
                size="xs"
                className="absolute left-3 text-quaternary pointer-events-none"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search concepts, formulas…"
                className="h-8 w-56 rounded-full border border-muted bg-action pl-8 pr-3 text-label-sm text-primary placeholder:text-quaternary outline-none transition-colors hover:border-default focus-visible:ring-1 focus-visible:ring-active"
              />
            </div>
            <div className="flex items-center gap-1 rounded-full border border-muted bg-container p-0.5">
              {(["All", ...GROUPS] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroup(g as Group | "All")}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-label-sm font-medium transition-colors",
                    group === g
                      ? "bg-action-selected text-primary shadow-sm"
                      : "text-tertiary hover:bg-action hover:text-secondary",
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label="Methodology Library"
            value={`${DEFINITIONS.length} terms`}
            delta="Fully documented"
            tone="neutral"
            hint="Mathematical TCO standards"
          />
          <KpiTile
            label="Cost Taxonomies"
            value="4 groups"
            delta="O&M, risk, views, rates"
            tone="info"
            hint="Canonical accounting buckets"
          />
          <KpiTile
            label="Accounting Standard"
            value="IAS 16"
            delta="Component-level depreciation"
            tone="neutral"
            hint="IFRS compliant roll-up"
          />
          <KpiTile
            label="Warranty Limit Rule"
            value="Whichever-First"
            delta="Dual threshold: Yrs & Km"
            tone="success"
            hint="Deterministic warranty end"
          />
        </div>

        {/* Definitions Grid */}
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((d) => (
            <Panel
              key={d.term}
              title={
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-md border border-muted bg-action text-secondary">
                    <AppIcon name={d.icon} size="xs" />
                  </span>
                  <span className="text-body-sm font-semibold text-primary">{d.term}</span>
                </div>
              }
              action={<StatusBadge tone="neutral">{d.group}</StatusBadge>}
            >
              <div className="space-y-3">
                <p className="text-body-sm text-secondary leading-relaxed">{d.summary}</p>

                {d.formula && (
                  <div className="font-mono-data rounded-md border border-muted bg-container p-2.5 text-caption font-medium text-teal">
                    {d.formula}
                  </div>
                )}

                <div>
                  <p className="text-caption font-semibold uppercase tracking-wider text-quaternary mb-1.5">
                    What is Included
                  </p>
                  <ul className="space-y-1">
                    {d.includes.map((i) => (
                      <li key={i} className="flex items-start gap-2 text-caption text-secondary">
                        <span className="text-success font-bold">+</span>
                        <span>{i}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {d.excludes && (
                  <div>
                    <p className="text-caption font-semibold uppercase tracking-wider text-quaternary mb-1.5">
                      What is Excluded
                    </p>
                    <ul className="space-y-1">
                      {d.excludes.map((i) => (
                        <li key={i} className="flex items-start gap-2 text-caption text-tertiary">
                          <span className="text-error font-bold">−</span>
                          <span>{i}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Panel>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <EmptyState
              title={`No definitions match "${query}"`}
              detail="Try searching for another financial term, accounting standard, or clearing the filter."
            />
          </div>
        )}
      </PageBody>
    </div>
  );
}
