"use client";

import { useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, KpiTile, StatusBadge } from "@/components/ui/primitives";
import {
  LOCOMOTIVES,
  SYSTEMS,
  ASSEMBLIES,
  COMPONENTS,
  STANDARDS_COMPLIANCE,
  type Component,
} from "@/data/syntheticData";
import { fmtUSD } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/icons/AppIcon";

const TABS = ["Product Configuration", "Maintenance Rules", "Standards Compliance"] as const;

export default function ConfigurePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Product Configuration");
  const [selected, setSelected] = useState<Component | null>(COMPONENTS[4]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="System Configuration & Standards"
        description="Product taxonomy architecture, maintenance interval trigger builder, and international railway standards compliance matrices."
        actions={
          <div className="flex items-center gap-1 rounded-full border border-muted bg-container p-0.5">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-3 py-1 text-label-sm font-medium transition-colors",
                  tab === t
                    ? "bg-action-selected text-primary shadow-sm"
                    : "text-tertiary hover:bg-action hover:text-secondary",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label="Taxonomy Hierarchy"
            value="4 Levels"
            delta="Loco → System → Assembly → Part"
            tone="neutral"
            hint="Canonical product breakdown"
          />
          <KpiTile
            label="Active Components"
            value={`${COMPONENTS.length} parts`}
            delta="100% telemetry coverage"
            tone="info"
            hint="With Weibull parameters"
          />
          <KpiTile
            label="Maintenance Rule Engine"
            value="Whichever-First"
            delta="Time · Distance · Running Hours"
            tone="success"
            hint="Deterministic multi-trigger"
          />
          <KpiTile
            label="Standards Compliance"
            value="94.6%"
            delta="EN 50126 · IEC 60300 · ISO 55000"
            tone="success"
            hint="Full RAMS & LCC alignment"
          />
        </div>

        {tab === "Product Configuration" && (
          <SplitRow from="xl" ratio="1/1.4" className="shrink-0">
            {/* Left Taxonomy Tree */}
            <Panel
              title="Product Taxonomy Tree"
              action={<span className="text-caption text-quaternary">Click a part to edit</span>}
            >
              <div className="space-y-3">
                {LOCOMOTIVES.map((l) => (
                  <div key={l.id} className="rounded-lg border border-muted bg-container p-2.5">
                    <p className="flex items-center gap-1.5 text-body-sm font-semibold text-primary pb-1 border-b border-muted">
                      <AppIcon name="locomotive" size="xs" className="text-teal" />
                      {l.model}
                    </p>
                    <div className="mt-2 space-y-2 pl-2">
                      {SYSTEMS.filter((s) => s.locomotiveId === l.id).map((s) => (
                        <div key={s.id} className="space-y-1">
                          <p className="flex items-center gap-1 text-caption font-medium text-secondary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {s.name}
                          </p>
                          <div className="space-y-1 pl-3">
                            {ASSEMBLIES.filter((a) => a.systemId === s.id).map((a) => (
                              <div key={a.id} className="space-y-0.5">
                                <p className="text-caption text-tertiary">{a.name}</p>
                                <div className="space-y-0.5 pl-2">
                                  {COMPONENTS.filter((c) => c.assemblyId === a.id).map((c) => (
                                    <button
                                      key={c.id}
                                      onClick={() => setSelected(c)}
                                      className={cn(
                                        "block w-full rounded px-2 py-1 text-left text-caption transition-colors",
                                        selected?.id === c.id
                                          ? "bg-action-selected text-primary font-semibold border border-default shadow-sm"
                                          : "text-secondary hover:bg-hover hover:text-primary",
                                      )}
                                    >
                                      {c.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Right Component Editor */}
            <Panel
              title={`Component Specification — ${selected?.name ?? "Select Component"}`}
              action={selected && <StatusBadge tone="success">Active Spec</StatusBadge>}
            >
              {selected ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-body-sm">
                    {[
                      ["Component Name", selected.name],
                      ["Category", selected.category],
                      ["Purchase Cost", fmtUSD(selected.purchaseCost)],
                      ["Replacement Cost", fmtUSD(selected.replacementCost)],
                      ["Design Life Horizon", `${selected.lifeYears} yrs`],
                      [
                        "Weibull β (Shape) / η (Scale)",
                        `${selected.weibullBeta} / ${selected.weibullEta.toLocaleString()}h`,
                      ],
                      [
                        "MTBF / MTTR",
                        `${selected.mtbfHours.toLocaleString()}h / ${selected.mttrHours}h`,
                      ],
                      ["Warranty Period", `${selected.warrantyYears} yrs`],
                      [
                        "PM: Time Trigger",
                        selected.pmTrigger.intervalMonths
                          ? `${selected.pmTrigger.intervalMonths} mo`
                          : "—",
                      ],
                      [
                        "PM: Distance Trigger",
                        selected.pmTrigger.intervalKm
                          ? `${selected.pmTrigger.intervalKm.toLocaleString()} km`
                          : "—",
                      ],
                      [
                        "PM: Operating Hours Trigger",
                        selected.pmTrigger.intervalHours
                          ? `${selected.pmTrigger.intervalHours.toLocaleString()} hrs`
                          : "—",
                      ],
                      ["Downtime Lost Revenue / Day", fmtUSD(selected.downtimeCostPerDay)],
                    ].map(([l, v]) => (
                      <div key={l} className="space-y-1">
                        <label className="text-caption font-medium text-tertiary block">{l}</label>
                        <input
                          readOnly
                          value={v as string}
                          className="font-mono-data w-full rounded-md border border-muted bg-action px-2.5 py-1.5 text-body-sm text-primary outline-none"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-caption text-quaternary pt-2 border-t border-muted">
                    Session configuration parameters — changes hot-recalculate across simulation and
                    asset health engines.
                  </p>
                </div>
              ) : (
                <div className="p-8 text-center text-caption text-quaternary">
                  Select a component from the taxonomy tree on the left.
                </div>
              )}
            </Panel>
          </SplitRow>
        )}

        {tab === "Maintenance Rules" && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {COMPONENTS.filter((c) => c.pmTrigger.intervalMonths)
              .slice(0, 8)
              .map((c) => (
                <Panel key={c.id} title={c.name}>
                  <div className="font-mono-data space-y-2 text-body-sm">
                    <div className="flex justify-between">
                      <span className="font-sans text-secondary">Rule 1 · Calendar</span>
                      <span className="text-primary font-medium">
                        every {c.pmTrigger.intervalMonths} mo
                      </span>
                    </div>
                    {c.pmTrigger.intervalKm && (
                      <div className="flex justify-between">
                        <span className="font-sans text-secondary">Rule 2 · Distance</span>
                        <span className="text-primary font-medium">
                          every {c.pmTrigger.intervalKm.toLocaleString()} km
                        </span>
                      </div>
                    )}
                    {c.pmTrigger.intervalHours && (
                      <div className="flex justify-between">
                        <span className="font-sans text-secondary">Rule 3 · Service Hours</span>
                        <span className="text-primary font-medium">
                          every {c.pmTrigger.intervalHours.toLocaleString()} hrs
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-muted pt-2">
                      <span className="font-sans text-secondary">Trigger Logic</span>
                      <span className="text-teal font-semibold">Whichever-First</span>
                    </div>
                  </div>
                </Panel>
              ))}
          </div>
        )}

        {tab === "Standards Compliance" && (
          <Panel
            title="Railway Standards & Regulatory Compliance Matrix"
            action={
              <span className="text-caption text-quaternary">
                RAMS (EN 50126), LCC (IEC 60300), Asset Mgmt (ISO 55000)
              </span>
            }
            padded={false}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-container border-b border-muted">
                  <tr>
                    {[
                      "Standard Code",
                      "Regulatory Framework",
                      "Compliance Status",
                      "Coverage Progress",
                      "Score",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-3 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase whitespace-nowrap",
                          i === 4 && "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted font-mono-data text-body-sm">
                  {STANDARDS_COMPLIANCE.map((s) => {
                    const tone =
                      s.status === "Aligned"
                        ? "success"
                        : s.status === "Partial"
                          ? "warning"
                          : "neutral";
                    return (
                      <tr key={s.standard} className="transition-colors hover:bg-hover">
                        <td className="px-3 py-2.5 font-bold text-teal font-mono-data">
                          {s.standard}
                        </td>
                        <td className="px-3 py-2.5 font-sans font-medium text-primary">{s.name}</td>
                        <td className="px-3 py-2.5">
                          <StatusBadge tone={tone}>{s.status}</StatusBadge>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-hover">
                            <div
                              className="h-full rounded-full bg-teal"
                              style={{ width: `${s.coverage}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-primary">
                          {s.coverage}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="p-3 text-caption text-quaternary border-t border-muted">
              Audited in accordance with EN 50126 reliability apportionment, IEC 60300 life cycle
              costing, and ISO 55000 asset management governance.
            </p>
          </Panel>
        )}
      </PageBody>
    </div>
  );
}
