"use client";

import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, KpiTile, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { FilterChips } from "@/components/ui/data-table";
import {
  LOCOMOTIVES,
  SYSTEMS,
  ASSEMBLIES,
  COMPONENTS,
  healthColor,
  CHART_COLORS,
  type Component,
} from "@/data/syntheticData";
import { weibullReliability } from "@/utils/simulationEngine";
import { fmtUSD, fmtCompact } from "@/utils/formatters";
import { AppIcon } from "@/components/icons/AppIcon";

type NodeKind = "loco" | "system" | "assembly" | "component";

interface RadialNode {
  id: string;
  name: string;
  kind: NodeKind;
  ring: number;
  angle: number;
  color: string;
  dim: boolean;
  parentId?: string;
  component?: Component;
}

function buildRadial(locoId: string, search: string): RadialNode[] {
  const loco = LOCOMOTIVES.find((l) => l.id === locoId)!;
  const systems = SYSTEMS.filter((s) => s.locomotiveId === locoId);
  const nodes: RadialNode[] = [
    {
      id: loco.id,
      name: loco.model,
      kind: "loco",
      ring: 0,
      angle: 0,
      color: CHART_COLORS.blue,
      dim: false,
    },
  ];

  const q = search.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);
  const sectorPer = 360 / Math.max(1, systems.length);

  systems.forEach((s, si) => {
    const sysStart = si * sectorPer;
    nodes.push({
      id: s.id,
      name: s.name,
      kind: "system",
      ring: 1,
      angle: sysStart + sectorPer / 2,
      color: healthColor(s.healthScore),
      dim: !matches(s.name),
      parentId: loco.id,
    });

    const asms = ASSEMBLIES.filter((a) => a.systemId === s.id);
    const asmPer = sectorPer / Math.max(1, asms.length);

    asms.forEach((a, ai) => {
      const asmStart = sysStart + ai * asmPer;
      nodes.push({
        id: a.id,
        name: a.name,
        kind: "assembly",
        ring: 2,
        angle: asmStart + asmPer / 2,
        color: CHART_COLORS.textSecondary,
        dim: !matches(a.name),
        parentId: s.id,
      });

      const comps = COMPONENTS.filter((c) => c.assemblyId === a.id);
      const cmpPer = asmPer / Math.max(1, comps.length);

      comps.forEach((c, ci) => {
        nodes.push({
          id: c.id,
          name: c.name,
          kind: "component",
          ring: 3,
          angle: asmStart + ci * cmpPer + cmpPer / 2,
          color: healthColor(c.healthScore),
          dim: !matches(c.name),
          parentId: a.id,
          component: c,
        });
      });
    });
  });

  return nodes;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const RING_R = [0, 70, 130, 195];

export default function FleetExplorer() {
  const [locoId, setLocoId] = useState("loco-001");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>("cmp-005");

  const nodes = useMemo(() => buildRadial(locoId, search), [locoId, search]);
  const selected = nodes.find((n) => n.id === selectedId);
  const selectedComp = selected?.component ?? COMPONENTS.find((c) => c.id === selectedId);

  const size = 440;
  const cx = size / 2;
  const cy = size / 2;

  const locoOptions = LOCOMOTIVES.map((l) => ({
    id: l.id,
    label: l.model.split(" ")[0],
    count: l.fleetCount,
  }));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Fleet & Product Hierarchy Explorer"
        description="Interactive radial topology mapping Locomotive → System → Assembly → Component with real-time health scores and Weibull reliability."
        actions={
          <div className="flex items-center gap-2">
            <FilterChips
              options={locoOptions}
              value={locoId}
              onChange={(id) => {
                setLocoId(id);
                setSelectedId(null);
              }}
            />
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        <SplitRow from="xl" ratio="1/1.4" className="min-h-0 flex-1">
          {/* Radial Tree Panel */}
          <Panel
            title="Radial Topology & Hierarchy"
            action={
              <div className="flex items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter hierarchy nodes..."
                  className="h-7 w-48 rounded-full border border-muted bg-action px-2.5 text-label-sm text-secondary outline-none placeholder:text-quaternary focus-visible:border-default focus-visible:ring-1 focus-visible:ring-active"
                />
              </div>
            }
          >
            <div className="flex flex-col items-center justify-center p-2">
              <svg viewBox={`0 0 ${size} ${size}`} className="max-h-[380px] w-full">
                {/* Ring guides */}
                {RING_R.slice(1).map((r) => (
                  <circle
                    key={r}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={CHART_COLORS.grid}
                    strokeDasharray="2 4"
                  />
                ))}
                {/* Structural links */}
                {nodes
                  .filter((n) => n.parentId)
                  .map((n) => {
                    const parent = nodes.find((p) => p.id === n.parentId);
                    if (!parent) return null;
                    const p1 = polar(cx, cy, RING_R[parent.ring], parent.angle);
                    const p2 = polar(cx, cy, RING_R[n.ring], n.angle);
                    return (
                      <line
                        key={`link-${n.id}`}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={CHART_COLORS.grid}
                        strokeWidth={1}
                      />
                    );
                  })}
                {/* Nodes */}
                {nodes.map((n) => {
                  const pos = polar(cx, cy, RING_R[n.ring], n.angle);
                  const rNode = n.ring === 0 ? 22 : n.ring === 1 ? 10 : n.ring === 2 ? 6 : 8;
                  const isSel = n.id === selectedId;
                  return (
                    <g
                      key={n.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(n.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={n.name}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(n.id);
                        }
                      }}
                    >
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={Math.max(rNode + 7, 13)}
                        fill="transparent"
                      />
                      {isSel && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={rNode + 5}
                          fill="none"
                          stroke={CHART_COLORS.blue}
                          strokeWidth={2}
                          opacity={0.8}
                        />
                      )}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={rNode}
                        fill={n.color}
                        opacity={n.dim ? 0.25 : n.ring === 2 ? 0.6 : 0.95}
                        style={{ transition: "all 0.2s" }}
                        className="pointer-events-none"
                      />
                      {n.ring === 0 && (
                        <text
                          x={pos.x}
                          y={pos.y + 3}
                          textAnchor="middle"
                          fontSize={9}
                          fill="var(--ref-black)"
                          fontWeight={700}
                          className="pointer-events-none font-display"
                        >
                          {n.name.split(" ")[0]}
                        </text>
                      )}
                      <title>{n.name}</title>
                    </g>
                  );
                })}
              </svg>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-caption text-secondary border-t border-muted pt-3 w-full">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-success" />
                  Health ≥85
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-yellow" />
                  70–84
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-warning" />
                  55–69
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-error" />
                  &lt;55
                </span>
              </div>
            </div>
          </Panel>

          {/* Node Detail Inspector */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            {selectedComp ? (
              <ComponentDetail comp={selectedComp} />
            ) : selected ? (
              <GroupDetail node={selected} onSelect={setSelectedId} />
            ) : (
              <Panel title="Node Inspector">
                <EmptyState
                  title="Select any node on the radial tree"
                  detail="Inspect system aggregates, component Weibull reliability curves, RUL and cost breakdowns."
                />
              </Panel>
            )}
          </div>
        </SplitRow>
      </PageBody>
    </div>
  );
}

function GroupDetail({ node, onSelect }: { node: RadialNode; onSelect: (id: string) => void }) {
  const comps = useMemo(() => {
    if (node.kind === "assembly") return COMPONENTS.filter((c) => c.assemblyId === node.id);
    if (node.kind === "system") {
      const asmIds = ASSEMBLIES.filter((a) => a.systemId === node.id).map((a) => a.id);
      return COMPONENTS.filter((c) => asmIds.includes(c.assemblyId));
    }
    const sysIds = SYSTEMS.filter((s) => s.locomotiveId === node.id).map((s) => s.id);
    const asmIds = ASSEMBLIES.filter((a) => sysIds.includes(a.systemId)).map((a) => a.id);
    return COMPONENTS.filter((c) => asmIds.includes(c.assemblyId));
  }, [node]);

  const replacementValue = comps.reduce((s, c) => s + c.replacementCost, 0);
  const avgHealth = comps.length ? comps.reduce((s, c) => s + c.healthScore, 0) / comps.length : 0;
  const worst = [...comps].sort((a, b) => a.healthScore - b.healthScore).slice(0, 4);

  const kindLabel =
    node.kind === "loco" ? "Locomotive" : node.kind === "system" ? "System" : "Assembly";

  return (
    <>
      <Panel
        title={`${kindLabel} Overview — ${node.name}`}
        action={
          comps.length > 0 ? (
            <span
              className="font-mono-data rounded-full px-2.5 py-0.5 text-caption font-bold"
              style={{ background: `${healthColor(avgHealth)}22`, color: healthColor(avgHealth) }}
            >
              Avg Health {avgHealth.toFixed(0)}%
            </span>
          ) : null
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiTile label="Components" value={`${comps.length}`} tone="neutral" />
          <KpiTile label="Replacement Value" value={fmtCompact(replacementValue)} tone="info" />
          <KpiTile
            label="Shortest Life"
            value={comps.length ? `${Math.min(...comps.map((c) => c.lifeYears))} yrs` : "—"}
            tone="warning"
          />
        </div>
      </Panel>

      <Panel title="Sub-Components Breakdown" padded={false}>
        <div className="grid gap-1 p-2 sm:grid-cols-2 max-h-[300px] overflow-y-auto">
          {comps.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="flex items-center gap-2 rounded-lg border border-transparent p-2 text-left text-body-sm transition-colors hover:border-muted hover:bg-raised"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: healthColor(c.healthScore) }}
              />
              <span className="flex-1 truncate text-primary">{c.name}</span>
              <span className="font-mono-data text-caption text-secondary tabular">
                {c.healthScore}%
              </span>
              <span className="font-mono-data text-right text-caption text-quaternary tabular">
                {fmtCompact(c.replacementCost)}
              </span>
            </button>
          ))}
          {comps.length === 0 && (
            <div className="col-span-2 p-4 text-center text-caption text-quaternary">
              No components nested under this node.
            </div>
          )}
        </div>

        {worst.length > 0 && (
          <div className="border-t border-muted p-4">
            <h4 className="text-caption tracking-[0.08em] uppercase text-quaternary mb-3">
              Lowest Health Watchlist
            </h4>
            <div className="space-y-2">
              {worst.map((c) => (
                <div key={c.id}>
                  <div className="flex justify-between text-caption">
                    <span className="text-secondary">{c.name}</span>
                    <span
                      className="font-mono-data tabular"
                      style={{ color: healthColor(c.healthScore) }}
                    >
                      {c.healthScore}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised-2">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${c.healthScore}%`, background: healthColor(c.healthScore) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}

function ComponentDetail({ comp }: { comp: Component }) {
  const reliability =
    weibullReliability(comp.currentHours, comp.weibullBeta, comp.weibullEta) * 100;
  const rulPct = Math.min(100, (comp.rulYears / comp.lifeYears) * 100);
  const affected = comp.affectsIfFails
    .map((id) => COMPONENTS.find((c) => c.id === id)?.name)
    .filter(Boolean);
  const dependsOn = comp.dependsOn
    .map((id) => COMPONENTS.find((c) => c.id === id)?.name)
    .filter(Boolean);

  const triggers = [
    {
      label: "Calendar Trigger",
      value: comp.pmTrigger.intervalMonths ? `${comp.pmTrigger.intervalMonths} months` : "—",
      pct: 62,
    },
    {
      label: "Distance Interval",
      value: comp.pmTrigger.intervalKm ? `${comp.pmTrigger.intervalKm.toLocaleString()} km` : "—",
      pct: 48,
    },
    {
      label: "Operating Hours",
      value: comp.pmTrigger.intervalHours
        ? `${comp.pmTrigger.intervalHours.toLocaleString()} hrs`
        : "—",
      pct: 74,
    },
  ];

  const gaugeR = 60;
  const gaugeC = Math.PI * gaugeR;

  return (
    <>
      <Panel
        title={`Component Specification — ${comp.name}`}
        action={
          <span
            className="font-mono-data rounded-full px-2.5 py-0.5 text-caption font-bold"
            style={{
              background: `${healthColor(comp.healthScore)}22`,
              color: healthColor(comp.healthScore),
            }}
          >
            Health {comp.healthScore}%
          </span>
        }
      >
        <div className="mb-3">
          <p className="text-body-sm text-secondary">
            {comp.category} · Failure Impact Severity:{" "}
            <strong className="text-primary">{comp.failureImpact}</strong>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile label="Purchase Cost" value={fmtUSD(comp.purchaseCost)} tone="neutral" />
          <KpiTile label="Replace Cost" value={fmtUSD(comp.replacementCost)} tone="info" />
          <KpiTile label="Design Life" value={`${comp.lifeYears} yrs`} tone="neutral" />
          <KpiTile
            label="MTBF / MTTR"
            value={`${(comp.mtbfHours / 1000).toFixed(0)}k / ${comp.mttrHours}h`}
            tone="warning"
          />
        </div>
      </Panel>

      <SplitRow from="lg" ratio="1/1">
        {/* Reliability & RUL Gauge Panel */}
        <Panel title="Weibull Reliability & RUL">
          <div className="flex flex-col items-center justify-center py-2">
            <svg width={160} height={95} viewBox="0 0 160 95">
              <path
                d="M 20 85 A 60 60 0 0 1 140 85"
                fill="none"
                strokeWidth={12}
                className="stroke-muted"
                strokeLinecap="round"
              />
              <path
                d="M 20 85 A 60 60 0 0 1 140 85"
                fill="none"
                strokeWidth={12}
                stroke={healthColor(reliability)}
                strokeLinecap="round"
                strokeDasharray={gaugeC}
                strokeDashoffset={gaugeC * (1 - reliability / 100)}
                style={{
                  transition: "stroke-dashoffset 0.8s ease",
                  filter: `drop-shadow(0 0 6px ${healthColor(reliability)}66)`,
                }}
              />
              <text
                x={80}
                y={72}
                textAnchor="middle"
                fontSize={22}
                fontWeight={700}
                fill="var(--ref-gray-50)"
                fontFamily="Michroma"
              >
                {reliability.toFixed(1)}%
              </text>
              <text x={80} y={90} textAnchor="middle" fontSize={9} fill="var(--ref-gray-500)">
                β={comp.weibullBeta} · η={comp.weibullEta.toLocaleString()}h ·{" "}
                {comp.currentHours.toLocaleString()}h
              </text>
            </svg>
          </div>

          <div className="mt-4 border-t border-muted pt-3">
            <div className="flex justify-between text-caption mb-1">
              <span className="text-quaternary uppercase tracking-[0.08em]">
                Remaining Useful Life
              </span>
              <span className="font-mono-data text-secondary tabular">
                {comp.rulYears} yrs ({rulPct.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-raised-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${rulPct}%`,
                  background: healthColor(rulPct),
                  transition: "width 0.6s",
                }}
              />
            </div>
            <p className="font-mono-data text-caption text-quaternary mt-1.5">
              Confidence level: {comp.rulConfidence}% · based on fleet degradation model
            </p>
          </div>
        </Panel>

        {/* Maintenance Triggers & Dependencies */}
        <Panel title="Triggers & Dependencies">
          <div className="space-y-3">
            <h4 className="text-caption tracking-[0.08em] uppercase text-quaternary">
              Maintenance Triggers (whichever first)
            </h4>
            {triggers.map((t) => (
              <div key={t.label}>
                <div className="flex justify-between text-body-sm">
                  <span className="text-secondary">{t.label}</span>
                  <span className="font-mono-data tabular text-primary">{t.value}</span>
                </div>
                {t.value !== "—" && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised-2">
                    <div
                      className="h-full rounded-full bg-action-primary"
                      style={{ width: `${t.pct}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-muted pt-3 space-y-2">
            <h4 className="text-caption tracking-[0.08em] uppercase text-quaternary">
              Dependency Chain
            </h4>
            {dependsOn.length > 0 && (
              <p className="text-body-sm text-secondary">
                Depends on: <span className="text-primary font-medium">{dependsOn.join(", ")}</span>
              </p>
            )}
            {affected.length > 0 ? (
              <p className="text-body-sm text-secondary">
                Failure cascades to:{" "}
                <span className="text-warning font-medium">{affected.join(", ")}</span>
              </p>
            ) : (
              <p className="text-caption text-quaternary">No downstream cascade on failure</p>
            )}
          </div>
        </Panel>
      </SplitRow>
    </>
  );
}
