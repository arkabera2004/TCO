"use client";

import { useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, KpiTile, StatusBadge, PriorityBadge } from "@/components/ui/primitives";
import { HealthRing } from "@/components/shared/HealthRing";
import { LOCOMOTIVES, SYSTEMS, ASSEMBLIES, COMPONENTS, healthColor } from "@/data/syntheticData";
import { weibullFailureProb } from "@/utils/simulationEngine";
import { cn } from "@/lib/utils";

export default function AssetHealthPage() {
  const [locoId, setLocoId] = useState("loco-001");
  const totalFleetCount = LOCOMOTIVES.reduce((s, l) => s + l.fleetCount, 0);
  const fleetHealth =
    LOCOMOTIVES.reduce((s, l) => s + l.currentHealthScore * l.fleetCount, 0) / totalFleetCount;

  const systems = SYSTEMS.filter((s) => s.locomotiveId === locoId);
  const loco = LOCOMOTIVES.find((l) => l.id === locoId)!;
  const criticalCount = COMPONENTS.filter((c) => c.rulYears < 1).length;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Asset Health Index — Fleet Hierarchy"
        description="Hierarchical condition monitoring: component → system → locomotive → fleet. Real-time sensor telemetry and Weibull failure risk modeling."
        actions={
          <div className="flex items-center gap-2">
            <label htmlFor="loco-select" className="text-caption text-tertiary">
              Active Platform:
            </label>
            <select
              id="loco-select"
              value={locoId}
              onChange={(e) => setLocoId(e.target.value)}
              className="h-8 rounded-full border border-muted bg-action px-3 text-label-sm text-secondary outline-none transition-colors hover:border-default focus-visible:ring-1 focus-visible:ring-active"
            >
              {LOCOMOTIVES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.model} ({l.fleetCount} units)
                </option>
              ))}
            </select>
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label="Fleet Health Index"
            value={`${fleetHealth.toFixed(1)}%`}
            delta={`${totalFleetCount} total locomotives`}
            tone="info"
            hint="Weighted average across fleet"
          />
          <KpiTile
            label="Selected Model Health"
            value={`${loco.currentHealthScore}%`}
            delta={loco.model}
            tone={loco.currentHealthScore >= 80 ? "success" : "warning"}
            hint="Active platform condition"
          />
          <KpiTile
            label="Monitored Subsystems"
            value={systems.length.toString()}
            delta={`${COMPONENTS.length} total components`}
            tone="neutral"
            hint="Telemetry coverage: 100%"
          />
          <KpiTile
            label="Urgent Interventions"
            value={criticalCount.toString()}
            delta={criticalCount > 0 ? "RUL < 1.0 year" : "All optimal"}
            tone={criticalCount > 0 ? "error" : "success"}
            hint="Immediate work orders"
          />
        </div>

        {/* Top Split: Fleet Model Selectors & System Health Breakdown */}
        <SplitRow from="xl" ratio="1.4/1" className="shrink-0">
          <Panel
            title="Locomotive Model Fleet Matrix"
            action={
              <span className="text-caption text-quaternary">
                Click a platform to inspect subsystems
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {LOCOMOTIVES.map((l) => {
                const isSelected = locoId === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => setLocoId(l.id)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all",
                      isSelected
                        ? "border-default bg-action-selected shadow-sm"
                        : "border-muted bg-container hover:border-default hover:bg-hover",
                    )}
                  >
                    <HealthRing score={l.currentHealthScore} size={80} stroke={7} color={l.color} />
                    <p className="mt-2 text-label-sm font-semibold text-primary">{l.model}</p>
                    <p className="text-caption text-tertiary">
                      {l.fleetCount} units · {l.fuelType}
                    </p>
                    <div className="mt-1.5">
                      {l.currentHealthScore >= 80 ? (
                        <StatusBadge tone="success">Optimal</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">Attention</StatusBadge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel
            title={`System Health Breakdown — ${loco.model}`}
            action={
              <span className="text-caption text-quaternary">
                {systems.length} major assemblies
              </span>
            }
          >
            <div className="space-y-3">
              {systems.map((s) => {
                const asmIds = ASSEMBLIES.filter((a) => a.systemId === s.id).map((a) => a.id);
                const comps = COMPONENTS.filter((c) => asmIds.includes(c.assemblyId));
                const topRisk = comps.sort((a, b) => a.rulYears - b.rulYears)[0];
                const tone =
                  s.healthScore >= 90
                    ? ("success" as const)
                    : s.healthScore >= 80
                      ? ("info" as const)
                      : ("warning" as const);
                return (
                  <div
                    key={s.id}
                    className="space-y-1 rounded-md border border-muted bg-container p-2.5"
                  >
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="font-medium text-primary">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-data font-semibold text-primary">
                          {s.healthScore}%
                        </span>
                        <StatusBadge tone={tone}>
                          {s.healthScore >= 90 ? "Optimal" : s.healthScore >= 80 ? "Good" : "Watch"}
                        </StatusBadge>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-hover">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${s.healthScore}%`,
                          background: healthColor(s.healthScore),
                        }}
                      />
                    </div>
                    {topRisk && (
                      <p className="text-caption text-quaternary truncate">
                        Top critical component:{" "}
                        <span className="text-secondary">{topRisk.name}</span> (RUL:{" "}
                        {topRisk.rulYears} yrs)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </SplitRow>

        {/* Component Health Detail Table */}
        <Panel
          title="Component Condition & Wear Analytics"
          action={
            <span className="text-caption text-quaternary">
              {COMPONENTS.length} telemetry-monitored parts
            </span>
          }
          padded={false}
          className="min-h-[380px]"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-container border-b border-muted">
                <tr>
                  {[
                    "Component Specification",
                    "Health Score",
                    "Service Hours",
                    "Remaining Life",
                    "1-Yr Failure Prob",
                    "Maintenance Action",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={cn(
                        "px-3 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase whitespace-nowrap",
                        i >= 1 && i <= 4 && "text-right",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-muted font-mono-data text-body-sm">
                {COMPONENTS.map((c) => {
                  const p =
                    (weibullFailureProb(c.currentHours + 5500, c.weibullBeta, c.weibullEta) -
                      weibullFailureProb(c.currentHours, c.weibullBeta, c.weibullEta)) *
                    100;
                  const isUrgent = c.rulYears < 1;
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-hover">
                      <td className="px-3 py-2.5 font-sans font-medium text-primary">{c.name}</td>
                      <td
                        className="px-3 py-2.5 text-right font-semibold"
                        style={{ color: healthColor(c.healthScore) }}
                      >
                        {c.healthScore}%
                      </td>
                      <td className="px-3 py-2.5 text-right text-secondary">
                        {c.currentHours.toLocaleString()} hrs
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-primary">
                        {c.rulYears} yrs
                      </td>
                      <td className="px-3 py-2.5 text-right text-tertiary">{p.toFixed(1)}%</td>
                      <td className="px-3 py-2.5">
                        {isUrgent ? (
                          <PriorityBadge priority="critical" />
                        ) : (
                          <StatusBadge tone="neutral">Monitor</StatusBadge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </PageBody>
    </div>
  );
}
