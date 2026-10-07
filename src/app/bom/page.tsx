"use client";

import { Fragment, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import Link from "next/link";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, KpiTile, EmptyState } from "@/components/ui/primitives";
import { DataTable, FilterChips, type Column } from "@/components/ui/data-table";
import { GlassCard, SectionTitle } from "@/components/shared/GlassCard";
import { KPICard } from "@/components/shared/KPICard";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import {
  LOCOMOTIVES,
  SYSTEMS,
  ASSEMBLIES,
  COMPONENTS,
  CHART_COLORS,
  healthColor,
} from "@/data/syntheticData";
import { BOM_CONVENTIONS, type Part } from "@/data/bomData";
import { usePartsStore } from "@/store/partsStore";
import { partTCO, companyBuffer, eventPartsCost, eventTotalCost } from "@/utils/tcoEngine";
import {
  extendedCost,
  salvageValue,
  annualDepreciation,
  annualMaintenanceCost,
  depreciationSchedule,
  netBookValue,
  carryingCost,
  inventoryTurns,
  stockStatus,
  abcClassify,
} from "@/utils/bomEngine";
import { fmtUSD, fmtCompact, fmtNum } from "@/utils/formatters";
import { alpha, cn } from "@/lib/utils";
import { AppIcon } from "@/components/icons/AppIcon";

const LOCO_ID = "loco-001"; // ES44AC — the fully-detailed BOM
const TCO_HORIZON = 20;
const { laborRatePerHour, carryingCostRatePct } = BOM_CONVENTIONS;

const CRIT_COLOR: Record<string, string> = {
  Vital: CHART_COLORS.red,
  Essential: CHART_COLORS.yellow,
  Desirable: CHART_COLORS.teal,
};
const STOCK_COLOR: Record<string, string> = {
  Critical: CHART_COLORS.red,
  Reorder: CHART_COLORS.orange,
  Healthy: CHART_COLORS.green,
  Excess: CHART_COLORS.purple,
};
const PROC_LABEL: Record<string, string> = {
  "unit-exchange": "Unit Exchange",
  reman: "Reman",
  new: "New Buy",
  consumable: "Consumable",
};

export default function BomExplorer() {
  const { parts, laborPct } = usePartsStore();
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([LOCO_ID, "sys-eng", "asm-ep"]),
  );
  const [selectedId, setSelectedId] = useState<string | null>(parts[4]?.id ?? null); // turbocharger
  const [view, setView] = useState<"tree" | "inventory" | "depreciation">("tree");

  // Resolve from the store each render so live edits reach the detail panel.
  const selectedPart = parts.find((p) => p.id === selectedId) ?? null;
  const setSelectedPart = (p: Part) => setSelectedId(p.id);

  const abc = useMemo(() => abcClassify(parts), [parts]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ── Fleet-wide roll-ups ──
  const totals = useMemo(() => {
    const fleet = BOM_CONVENTIONS.fleetCount;
    let bomValue = 0;
    let annualMaint = 0;
    let annualDep = 0;
    let inventoryValue = 0;
    let carrying = 0;
    let buffer = 0;
    for (const p of parts) {
      bomValue += extendedCost(p);
      annualMaint += annualMaintenanceCost(p, laborRatePerHour) * fleet;
      annualDep += annualDepreciation(p);
      inventoryValue += p.onHandQty * p.unitPriceNew;
      carrying += carryingCost(p, carryingCostRatePct);
      buffer += companyBuffer(p);
    }
    return {
      bomValuePerLoco: bomValue,
      bomValueFleet: bomValue * fleet,
      annualMaint,
      annualDep,
      inventoryValue,
      carrying,
      buffer,
    };
  }, [parts]);

  const systems = SYSTEMS.filter((s) => s.locomotiveId === LOCO_ID);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Bill of Materials — Part-Level Explorer"
        description="Part-level Bill of Materials mapping locomotive → system → assembly → component → part with extended costs, lifecycle depreciation, inventory positioning and TCO."
        actions={
          <div className="flex items-center gap-2">
            <FilterChips
              value={view}
              onChange={(k) => setView(k as "tree" | "inventory" | "depreciation")}
              options={[
                { id: "tree", label: "5-Level Hierarchy Tree" },
                { id: "inventory", label: "Inventory & Criticality" },
                { id: "depreciation", label: "Depreciation & Capital" },
              ]}
            />
            <Link
              href="/library"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-muted bg-action px-3 text-label-sm text-secondary transition-colors hover:border-default hover:bg-raised-2 hover:text-primary"
            >
              <AppIcon name="add" size="xs" />
              <span>Library</span>
            </Link>
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Summary Tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label="BOM Value / Loco"
            value={fmtUSD(totals.bomValuePerLoco)}
            delta={`${parts.length} parts`}
            tone="neutral"
            hint="ES44AC fully indented roll-up"
          />
          <KpiTile
            label="Fleet Parts Capital"
            value={`$${(totals.bomValueFleet / 1e6).toFixed(2)}M`}
            delta={`Across ${BOM_CONVENTIONS.fleetCount} units`}
            tone="info"
            hint="Total active capital asset"
          />
          <KpiTile
            label="Annual Maintenance"
            value={`$${(totals.annualMaint / 1e6).toFixed(2)}M`}
            delta={`Labour @ ${laborPct}%`}
            tone="warning"
            hint="Cycle execution cost"
          />
          <KpiTile
            label="Company Buffer"
            value={`$${(totals.buffer / 1e3).toFixed(1)}k`}
            delta="Warranty reserve"
            tone="neutral"
            hint="Failure variance coverage"
          />
        </div>

        {/* Dynamic Views */}
        {view === "tree" && (
          <SplitRow from="xl" ratio="1.6/1" className="min-h-[460px] shrink-0">
            <Panel title="Indented Bill of Materials — ES44AC" padded={false}>
              <BomTree
                parts={parts}
                systems={systems}
                expanded={expanded}
                toggle={toggle}
                selectedId={selectedPart?.id ?? null}
                onSelectPart={setSelectedPart}
                abc={abc}
              />
            </Panel>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
              {selectedPart ? (
                <PartDetail part={selectedPart} abc={abc.get(selectedPart.id)!} />
              ) : (
                <Panel title="Part Inspector">
                  <EmptyState
                    title="Select a part in the tree"
                    detail="Inspect component hierarchy, inventory turns, VED criticality and maintenance parameters."
                  />
                </Panel>
              )}
            </div>
          </SplitRow>
        )}

        {view === "inventory" && (
          <InventoryView
            parts={parts}
            abc={abc}
            onSelect={setSelectedPart}
            selected={selectedPart}
          />
        )}
        {view === "depreciation" && (
          <DepreciationView parts={parts} selected={selectedPart} onSelect={setSelectedPart} />
        )}

        {/* Part-level TCO table */}
        <PartTCOTable
          parts={parts}
          laborPct={laborPct}
          onSelect={setSelectedPart}
          selected={selectedPart}
        />
      </PageBody>
    </div>
  );
}

/* ────────────────────────── 5-LEVEL TREE ────────────────────────── */

function rowCost(parts: Part[]): number {
  return parts.reduce((s, p) => s + extendedCost(p), 0);
}

function BomTree({
  parts,
  systems,
  expanded,
  toggle,
  selectedId,
  onSelectPart,
  abc,
}: {
  parts: Part[];
  systems: typeof SYSTEMS;
  expanded: Set<string>;
  toggle: (id: string) => void;
  selectedId: string | null;
  onSelectPart: (p: Part) => void;
  abc: Map<string, "A" | "B" | "C">;
}) {
  const loco = LOCOMOTIVES.find((l) => l.id === LOCO_ID)!;
  const locoParts = parts; // all parts belong to this loco's components
  const locoExpanded = expanded.has(loco.id);

  return (
    <div className="max-h-[620px] overflow-auto pr-1 font-mono-data text-xs">
      {/* Header */}
      <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-border bg-surface-1 px-2 py-1.5 text-micro uppercase text-text-muted">
        <span>Hierarchy</span>
        <span className="w-14 text-right">Qty</span>
        <span className="w-20 text-right">Ext. Cost</span>
        <span className="w-14 text-right">Life</span>
      </div>

      {/* L0 Locomotive */}
      <TreeRow
        depth={0}
        open={locoExpanded}
        hasChildren
        onToggle={() => toggle(loco.id)}
        icon={<AppIcon name="package" size="sm" />}
        name={loco.model}
        tag="LOCO"
        tagColor={CHART_COLORS.blue}
        qty={loco.fleetCount}
        cost={rowCost(locoParts)}
        life={`${loco.plannedLifeYears}y`}
      />

      {locoExpanded &&
        systems.map((s) => {
          const asms = ASSEMBLIES.filter((a) => a.systemId === s.id);
          const sysParts = locoParts.filter((p) =>
            COMPONENTS.some(
              (c) => c.id === p.componentId && asms.some((a) => a.id === c.assemblyId),
            ),
          );
          const sysOpen = expanded.has(s.id);
          return (
            <div key={s.id}>
              <TreeRow
                depth={1}
                open={sysOpen}
                hasChildren
                onToggle={() => toggle(s.id)}
                icon={<AppIcon name="layers" size="sm" />}
                name={s.name}
                tag="SYS"
                tagColor={healthColor(s.healthScore)}
                qty={1}
                cost={rowCost(sysParts)}
                life="—"
              />

              {sysOpen &&
                asms.map((a) => {
                  const comps = COMPONENTS.filter((c) => c.assemblyId === a.id);
                  const asmParts = locoParts.filter((p) =>
                    comps.some((c) => c.id === p.componentId),
                  );
                  const asmOpen = expanded.has(a.id);
                  return (
                    <div key={a.id}>
                      <TreeRow
                        depth={2}
                        open={asmOpen}
                        hasChildren
                        onToggle={() => toggle(a.id)}
                        icon={<AppIcon name="bom" size="sm" />}
                        name={a.name}
                        tag="ASM"
                        tagColor={CHART_COLORS.textSecondary}
                        qty={1}
                        cost={rowCost(asmParts)}
                        life="—"
                      />

                      {asmOpen &&
                        comps.map((c) => {
                          const cParts = locoParts.filter((p) => p.componentId === c.id);
                          const cOpen = expanded.has(c.id);
                          return (
                            <div key={c.id}>
                              <TreeRow
                                depth={3}
                                open={cOpen}
                                hasChildren={cParts.length > 0}
                                onToggle={() => toggle(c.id)}
                                icon={<AppIcon name="maintenance" size="xs" />}
                                name={c.name}
                                tag="CMP"
                                tagColor={healthColor(c.healthScore)}
                                qty={1}
                                cost={rowCost(cParts)}
                                life={`${c.lifeYears}y`}
                              />

                              {cOpen &&
                                cParts.map((p) => (
                                  <TreeRow
                                    key={p.id}
                                    depth={4}
                                    isPart
                                    open={false}
                                    hasChildren={false}
                                    selected={p.id === selectedId}
                                    onToggle={() => onSelectPart(p)}
                                    icon={
                                      <span
                                        className="text-micro font-bold"
                                        style={{ color: CRIT_COLOR[p.criticality] }}
                                      >
                                        ◆
                                      </span>
                                    }
                                    name={p.name}
                                    tag={abc.get(p.id)}
                                    tagColor={CHART_COLORS.purple}
                                    qty={p.qtyPerComponent}
                                    cost={extendedCost(p)}
                                    life={`${p.lifeYears}y`}
                                  />
                                ))}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
            </div>
          );
        })}
    </div>
  );
}

function TreeRow({
  depth,
  name,
  icon,
  tag,
  tagColor,
  qty,
  cost,
  life,
  open,
  hasChildren,
  onToggle,
  isPart,
  selected,
}: {
  depth: number;
  name: string;
  icon: React.ReactNode;
  tag?: string;
  tagColor?: string;
  qty: number;
  cost: number;
  life: string;
  open: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  isPart?: boolean;
  selected?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-border/30 px-2 py-1.5 text-left transition-colors hover:bg-surface-2/60",
        selected && "bg-primary/10 ring-1 ring-inset ring-primary/40",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: depth * 16 }}>
        {hasChildren ? (
          <AppIcon
            name="chevronRight"
            size="xs"
            className={cn("shrink-0 text-text-muted transition-transform", open && "rotate-90")}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="shrink-0">{icon}</span>
        <span
          className={cn(
            "truncate",
            isPart ? "text-text-secondary" : "font-semibold text-foreground",
          )}
        >
          {name}
        </span>
        {tag && (
          <span
            className="ml-1 shrink-0 rounded px-1 py-0.5 text-micro font-bold"
            style={{ background: tagColor ? alpha(tagColor, 13) : undefined, color: tagColor }}
          >
            {tag}
          </span>
        )}
      </span>
      <span className="w-14 text-right text-text-secondary tabular-nums">×{qty}</span>
      <span className="w-20 text-right tabular-nums">{fmtCompact(cost)}</span>
      <span className="w-14 text-right text-mini text-text-muted tabular-nums">{life}</span>
    </button>
  );
}

/* ────────────────────────── PART DETAIL ────────────────────────── */

function PartDetail({ part, abc }: { part: Part; abc: "A" | "B" | "C" }) {
  const laborPct = usePartsStore((s) => s.laborPct);
  const comp = COMPONENTS.find((c) => c.id === part.componentId);
  const ext = extendedCost(part);
  const salvage = salvageValue(part);
  const annualMaint = annualMaintenanceCost(part, laborRatePerHour);
  const status = stockStatus(part);
  const turns = inventoryTurns(part);
  const schedule = depreciationSchedule(part, part.usefulLifeYears);

  const eventParts = eventPartsCost(part);
  const eventTotal = eventTotalCost(part, laborPct);
  const buffer = companyBuffer(part);
  const tco = partTCO(part, TCO_HORIZON, laborPct);

  return (
    <>
      <GlassCard scanline>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-mini uppercase tracking-wider text-text-muted">{comp?.name}</p>
            <h2 className="font-display text-base font-bold leading-tight">{part.name}</h2>
            <p className="font-mono-data mt-0.5 flex items-center gap-1.5 text-mini text-text-secondary">
              {part.partNumber}
              {part.pnVerified ? (
                <span className="rounded bg-green/15 px-1 text-micro font-bold text-green">
                  OEM PN
                </span>
              ) : (
                <span className="rounded bg-surface-3 px-1 text-micro text-text-muted">FORMAT</span>
              )}
            </p>
          </div>
          <span
            className="shrink-0 rounded-md px-2 py-1 text-mini font-bold"
            style={{
              background: alpha(CRIT_COLOR[part.criticality], 13),
              color: CRIT_COLOR[part.criticality],
            }}
          >
            {part.criticality}
          </span>
        </div>

        <p className="mt-2 text-mini text-text-secondary">
          {part.vendor} · {part.partClass}
        </p>
      </GlassCard>

      {/* Maintenance — the fields that actually drive the schedule and the TCO */}
      <GlassCard>
        <SectionTitle className="mb-2 flex items-center gap-1.5">
          <AppIcon name="maintenance" size="xs" /> Maintenance
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2 text-center">
          <MiniStat
            label="Interval"
            value={part.maintIntervalValue.toLocaleString()}
            unit={part.maintIntervalUnit}
          />
          <MiniStat label="Quantity" value={`${part.maintQty}`} unit={part.uom} />
          <MiniStat label="Price" value={fmtUSD(part.unitPriceNew)} />
          <MiniStat label="Cost / event" value={fmtCompact(eventTotal)} accent />
        </div>
        <p className="mt-2 flex items-center justify-between text-mini">
          <span className="text-text-secondary">Labour @ {laborPct}% of parts</span>
          <span className="font-mono-data text-purple">{fmtUSD(eventTotal - eventParts)}</span>
        </p>
        <p className="mt-1 flex items-center justify-between text-mini">
          <span className="text-text-secondary">Extended (qty × unit price)</span>
          <span className="font-mono-data">{fmtUSD(ext)}</span>
        </p>
      </GlassCard>

      {/* Warranty, failure risk and the reserve held against it */}
      <GlassCard>
        <SectionTitle className="mb-2 flex items-center gap-1.5">
          <AppIcon name="warrantyActive" size="xs" /> Warranty & Risk
        </SectionTitle>
        <div className="grid grid-cols-2 gap-2 text-center">
          <MiniStat label="Warranty (Years)" value={`${part.warrantyYears}`} unit="yr" />
          <MiniStat
            label="Warranty (Km)"
            value={`${(part.warrantyKm / 1000).toFixed(0)}k`}
            unit="km"
          />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-mini">
            <span className="text-text-secondary">Failure probability</span>
            <span className="font-mono-data font-semibold text-orange">
              {part.failureProbabilityPct}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, part.failureProbabilityPct)}%`,
                background: CHART_COLORS.orange,
              }}
            />
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-surface-2/70 p-2.5">
          <div className="flex items-center justify-between text-mini">
            <span className="text-text-secondary">Company buffer</span>
            <span className="font-mono-data font-bold text-orange">{fmtUSD(buffer)}</span>
          </div>
          <p className="font-mono-data mt-1 text-micro text-text-muted">
            {fmtUSD(eventParts)} × {part.failureProbabilityPct}% — expected warranty reserve
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <MiniStat label="Customer Cost" value={fmtCompact(tco.customerCost)} />
          <MiniStat label="Company Cost" value={fmtCompact(tco.companyCost)} accent />
        </div>
        <p className="mt-1.5 text-micro text-text-muted">
          Over 20 years · {tco.eventCount} maintenance events
        </p>
      </GlassCard>

      {/* Procurement + reman economics */}
      <GlassCard>
        <SectionTitle className="mb-2 flex items-center gap-1.5">
          {part.procurementType === "unit-exchange" || part.procurementType === "reman" ? (
            <AppIcon name="recycle" size="xs" />
          ) : (
            <AppIcon name="refresh" size="xs" />
          )}
          Procurement · {PROC_LABEL[part.procurementType]}
        </SectionTitle>
        {part.unitPriceReman > 0 ? (
          <>
            <div className="mb-2 flex items-end gap-2 text-xs">
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-mini text-text-muted">
                  <span>Reman {fmtUSD(part.unitPriceReman)}</span>
                  <span>New {fmtUSD(part.unitPriceNew)}</span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="rounded-l-full bg-teal"
                    style={{ width: `${(part.unitPriceReman / part.unitPriceNew) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-mini text-text-secondary">
              Reman ={" "}
              <span className="font-mono-data text-teal">
                {Math.round((part.unitPriceReman / part.unitPriceNew) * 100)}%
              </span>{" "}
              of new
              {part.coreCredit > 0 && (
                <>
                  {" "}
                  · core credit{" "}
                  <span className="font-mono-data text-green">{fmtUSD(part.coreCredit)}</span>/unit
                </>
              )}
            </p>
          </>
        ) : (
          <p className="text-mini text-text-secondary">
            {part.repairable ? "Repairable" : "Throwaway consumable"} · new-buy only
            {part.coreCredit > 0 && <> · scrap/core credit {fmtUSD(part.coreCredit)}</>}
          </p>
        )}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-mini">
          <MiniStat label="Lead Time" value={`${part.leadTimeWeeks}w`} />
          <MiniStat label="Replace Ivl" value={`${part.replacementIntervalYears}y`} />
          <MiniStat label="Labor / Job" value={`${part.laborHoursPerReplacement}h`} />
        </div>
      </GlassCard>

      {/* Depreciation */}
      <GlassCard>
        <SectionTitle className="mb-2">
          Depreciation —{" "}
          {part.depreciationMethod === "units-of-production"
            ? "Units of Production"
            : "Straight-Line"}
        </SectionTitle>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={schedule} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="nbv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.5} />
                <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="year"
              stroke={CHART_COLORS.textMuted}
              fontSize={9}
              tickFormatter={(v) => `${v}y`}
            />
            <YAxis
              stroke={CHART_COLORS.textMuted}
              fontSize={9}
              width={38}
              tickFormatter={(v: number) => fmtCompact(v)}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="nbv"
              name="Net book value"
              stroke={CHART_COLORS.blue}
              strokeWidth={2}
              fill="url(#nbv)"
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-1 grid grid-cols-3 gap-2 text-center text-mini">
          <MiniStat label="Useful Life" value={`${part.usefulLifeYears}y`} />
          <MiniStat label="Salvage" value={fmtCompact(salvage)} />
          <MiniStat label="Annual Dep." value={fmtCompact(annualDepreciation(part))} accent />
        </div>
      </GlassCard>

      {/* Inventory */}
      <GlassCard>
        <SectionTitle className="mb-2">Inventory Position</SectionTitle>
        <StockBar part={part} status={status} />
        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-mini">
          <MiniStat label="On Hand" value={fmtNum(part.onHandQty)} />
          <MiniStat label="Reorder Pt" value={fmtNum(part.reorderPoint)} />
          <MiniStat label="Turns/yr" value={turns.toFixed(1)} />
          <MiniStat label="ABC / VED" value={`${abc}${part.vedClass}`} accent />
        </div>
        <p className="mt-2 flex items-center justify-between text-mini">
          <span className="text-text-secondary">Annual carrying cost</span>
          <span className="font-mono-data">
            {fmtUSD(carryingCost(part, carryingCostRatePct))}/yr
          </span>
        </p>
        <p className="mt-1 flex items-center justify-between text-mini">
          <span className="text-text-secondary">Annualized maintenance</span>
          <span className="font-mono-data text-orange">{fmtUSD(annualMaint)}/yr</span>
        </p>
      </GlassCard>
    </>
  );
}

function MiniStat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface-2/70 p-2">
      <p className="text-micro uppercase tracking-wider text-text-muted">{label}</p>
      <p
        className={cn(
          "font-mono-data mt-0.5 text-sm font-semibold tabular-nums",
          accent && "text-primary",
        )}
      >
        {value}
        {unit && <span className="ml-0.5 text-micro text-text-muted">{unit}</span>}
      </p>
    </div>
  );
}

function StockBar({ part, status }: { part: Part; status: string }) {
  const scaleMax = Math.max(part.maxStock, part.onHandQty) * 1.1;
  const pct = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  return (
    <div>
      <div className="mb-1 flex justify-between text-mini">
        <span className="text-text-secondary">On-hand vs thresholds</span>
        <span className="font-semibold" style={{ color: STOCK_COLOR[status] }}>
          {status}
        </span>
      </div>
      <div className="relative h-4 overflow-hidden rounded-md bg-surface-3">
        <div
          className="absolute inset-y-0 left-0 bg-red/25"
          style={{ width: pct(part.safetyStock) }}
          title="Safety stock"
        />
        <div
          className="absolute inset-y-0 bg-orange/20"
          style={{ left: pct(part.safetyStock), width: pct(part.reorderPoint - part.safetyStock) }}
          title="Reorder buffer"
        />
        <div
          className="absolute inset-y-0 rounded-full"
          style={{
            left: 0,
            width: pct(part.onHandQty),
            background: STOCK_COLOR[status],
            opacity: 0.85,
          }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: pct(part.maxStock) }}
          title="Max stock"
        />
      </div>
      <div className="mt-1 flex justify-between text-micro text-text-muted">
        <span>SS {part.safetyStock}</span>
        <span>ROP {part.reorderPoint}</span>
        <span>Max {part.maxStock}</span>
      </div>
    </div>
  );
}

/* ────────────────────────── INVENTORY VIEW ────────────────────────── */

function InventoryView({
  parts,
  abc,
  onSelect,
  selected,
}: {
  parts: Part[];
  abc: Map<string, "A" | "B" | "C">;
  onSelect: (p: Part) => void;
  selected: Part | null;
}) {
  const [sort, setSort] = useState<"spend" | "turns" | "status">("spend");

  const rows = useMemo(() => {
    const withMetrics = parts.map((p) => ({
      p,
      spend: p.annualUsageQty * p.unitPriceNew,
      turns: inventoryTurns(p),
      status: stockStatus(p),
      abc: abc.get(p.id)!,
    }));
    return withMetrics.sort((a, b) => {
      if (sort === "spend") return b.spend - a.spend;
      if (sort === "turns") return a.turns - b.turns;
      const order = { Critical: 0, Reorder: 1, Excess: 2, Healthy: 3 };
      return order[a.status] - order[b.status];
    });
  }, [parts, sort, abc]);

  // ABC/VED matrix counts
  const matrix = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of parts) {
      const key = `${abc.get(p.id)}-${p.vedClass}`;
      m[key] = (m[key] ?? 0) + 1;
    }
    return m;
  }, [parts, abc]);

  const alerts = rows.filter((r) => r.status === "Critical" || r.status === "Reorder");

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <GlassCard className="xl:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Spare Parts Inventory</SectionTitle>
          <div className="flex overflow-hidden rounded-md border border-border text-mini">
            {(
              [
                ["spend", "By Spend"],
                ["turns", "By Turns"],
                ["status", "By Status"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={cn(
                  "px-2 py-1",
                  sort === k
                    ? "bg-raised-2 font-medium text-fg-primary"
                    : "transition-ui bg-action text-fg-tertiary hover:text-fg-secondary",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-1">
              <tr className="border-b border-border text-micro uppercase text-text-muted">
                {["Part", "Class", "On Hand", "ROP", "Turns", "Annual Spend", "Status"].map((h) => (
                  <th key={h} className="px-2 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, spend, turns, status, abc: cls }) => (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className={cn(
                    "cursor-pointer border-b border-border/40 hover:bg-surface-2/60",
                    selected?.id === p.id && "bg-primary/10",
                  )}
                >
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-1.5">
                      <span style={{ color: CRIT_COLOR[p.criticality] }}>◆</span>
                      <span className="truncate">{p.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span className="font-mono-data rounded bg-surface-3 px-1 text-micro">
                      {cls}
                      {p.vedClass}
                    </span>
                  </td>
                  <td className="font-mono-data px-2 py-2 tabular-nums">{p.onHandQty}</td>
                  <td className="font-mono-data px-2 py-2 tabular-nums text-text-muted">
                    {p.reorderPoint}
                  </td>
                  <td className="font-mono-data px-2 py-2 tabular-nums">{turns.toFixed(1)}</td>
                  <td className="font-mono-data px-2 py-2 tabular-nums">{fmtCompact(spend)}</td>
                  <td className="px-2 py-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-micro font-semibold"
                      style={{
                        background: alpha(STOCK_COLOR[status], 13),
                        color: STOCK_COLOR[status],
                      }}
                    >
                      {status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <div className="space-y-5">
        {/* ABC × VED matrix */}
        <GlassCard>
          <SectionTitle className="mb-3">ABC × VED Criticality Matrix</SectionTitle>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-1 text-center text-mini">
            <span />
            {["V", "E", "D"].map((v) => (
              <span key={v} className="font-semibold text-text-secondary">
                {v}
              </span>
            ))}
            {(["A", "B", "C"] as const).map((a) => (
              <Fragment key={a}>
                <span className="flex items-center font-semibold text-text-secondary">{a}</span>
                {["V", "E", "D"].map((v) => {
                  const n = matrix[`${a}-${v}`] ?? 0;
                  const critical = a === "A" && v === "V";
                  return (
                    <div
                      key={`${a}-${v}`}
                      className="rounded p-2 font-mono-data font-bold tabular-nums"
                      style={{
                        background:
                          n === 0
                            ? "var(--surface-2)"
                            : critical
                              ? alpha(CHART_COLORS.red, 20)
                              : alpha(CHART_COLORS.blue, Math.min(60, 10 + n * 7)),
                        color: n === 0 ? "var(--text-muted)" : "var(--ref-gray-50)",
                      }}
                    >
                      {n}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
          <p className="mt-3 text-mini text-text-muted">
            A-V parts (high spend, vital) get 99% fill-rate targets & safety stock; C-D parts run
            lean.
          </p>
        </GlassCard>

        {/* Replenishment alerts */}
        <GlassCard>
          <SectionTitle className="mb-2 flex items-center gap-1.5">
            <AppIcon name="warning" size="sm" className="text-orange" /> Replenishment Signals
          </SectionTitle>
          <div className="max-h-[220px] space-y-1.5 overflow-auto">
            {alerts.length === 0 && (
              <p className="text-mini text-text-muted">All parts above reorder point.</p>
            )}
            {alerts.map(({ p, status }) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="flex w-full items-center gap-2 rounded-md bg-surface-2/60 px-2 py-1.5 text-left text-mini hover:bg-surface-2"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: STOCK_COLOR[status] }}
                />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="font-mono-data text-text-muted">
                  {p.onHandQty}/{p.reorderPoint}
                </span>
                <span
                  className="font-mono-data w-16 text-right"
                  style={{ color: STOCK_COLOR[status] }}
                >
                  {status}
                </span>
              </button>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

/* ────────────────────────── DEPRECIATION VIEW ────────────────────────── */

function DepreciationView({
  parts,
  selected,
  onSelect,
}: {
  parts: Part[];
  selected: Part | null;
  onSelect: (p: Part) => void;
}) {
  const HORIZON = 20;

  // Top capitalized parts by extended cost
  const capitalParts = useMemo(
    () => parts.filter((p) => p.capitalized).sort((a, b) => extendedCost(b) - extendedCost(a)),
    [parts],
  );

  // Fleet NBV decline (sum of all capitalized parts) over horizon
  const fleetNbv = useMemo(() => {
    return Array.from({ length: HORIZON + 1 }, (_, year) => {
      let nbv = 0;
      let dep = 0;
      for (const p of capitalParts) {
        nbv += netBookValue(p, Math.min(year, p.usefulLifeYears));
        dep += annualDepreciation(p);
      }
      return { year, nbv: +nbv.toFixed(0), annualDep: +dep.toFixed(0) };
    });
  }, [capitalParts]);

  const active = selected ?? capitalParts[0];
  const schedule = depreciationSchedule(active, active.usefulLifeYears);

  // Cost contribution by part class
  const byClass = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of parts) m.set(p.partClass, (m.get(p.partClass) ?? 0) + extendedCost(p));
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [parts]);

  const classColors = [
    CHART_COLORS.blue,
    CHART_COLORS.teal,
    CHART_COLORS.purple,
    CHART_COLORS.orange,
    CHART_COLORS.yellow,
    CHART_COLORS.green,
    CHART_COLORS.red,
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <GlassCard>
          <SectionTitle className="mb-3">
            Fleet Parts — Net Book Value Decline (SL, {HORIZON}yr)
          </SectionTitle>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={fleetNbv}>
              <defs>
                <linearGradient id="fleetnbv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.purple} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={CHART_COLORS.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="year"
                stroke={CHART_COLORS.textMuted}
                fontSize={10}
                tickFormatter={(v) => `${v}y`}
              />
              <YAxis
                stroke={CHART_COLORS.textMuted}
                fontSize={10}
                tickFormatter={(v: number) => fmtCompact(v)}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="nbv"
                name="Net book value"
                stroke={CHART_COLORS.purple}
                strokeWidth={2}
                fill="url(#fleetnbv)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard>
          <SectionTitle className="mb-3">Capital Cost Contribution by Part Class</SectionTitle>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={byClass} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis
                type="number"
                stroke={CHART_COLORS.textMuted}
                fontSize={9}
                tickFormatter={(v: number) => fmtCompact(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke={CHART_COLORS.textMuted}
                fontSize={9}
                width={92}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "var(--ref-gray-850)", fillOpacity: 0.6 }}
              />
              <Bar dataKey="value" name="Extended cost" radius={[0, 3, 3, 0]}>
                {byClass.map((_, i) => (
                  <Cell key={i} fill={classColors[i % classColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <GlassCard className="xl:col-span-2">
          <SectionTitle className="mb-3">Depreciation Schedule — {active.name}</SectionTitle>
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-1">
                <tr className="border-b border-border text-micro uppercase text-text-muted">
                  {["Year", "Depreciation", "Accumulated", "Net Book Value"].map((h) => (
                    <th key={h} className="px-2 py-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((r) => (
                  <tr key={r.year} className="border-b border-border/40">
                    <td className="font-mono-data px-2 py-1.5">Y{r.year}</td>
                    <td className="font-mono-data px-2 py-1.5 text-orange">
                      {r.charge ? fmtUSD(r.charge) : "—"}
                    </td>
                    <td className="font-mono-data px-2 py-1.5 text-text-secondary">
                      {fmtUSD(r.accumulated)}
                    </td>
                    <td className="font-mono-data px-2 py-1.5">{fmtUSD(r.nbv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-mini text-text-muted">
            IAS 16 component approach — each part depreciated separately over its own useful life.
            {active.depreciationMethod === "units-of-production" &&
              " Units-of-production: charge scales with utilisation."}
          </p>
        </GlassCard>

        <GlassCard>
          <SectionTitle className="mb-2">Top Capital Parts</SectionTitle>
          <div className="max-h-[300px] space-y-1 overflow-auto">
            {capitalParts.slice(0, 12).map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-mini hover:bg-surface-2/60",
                  active.id === p.id && "bg-primary/10",
                )}
              >
                <span className="flex-1 truncate">{p.name}</span>
                <span className="font-mono-data text-text-secondary">
                  {fmtCompact(extendedCost(p))}
                </span>
              </button>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

/* ────────────────────────── PART-LEVEL TCO TABLE ────────────────────────── */

/**
 * The part-by-part cost breakdown the dashboard was missing: what each part
 * costs to maintain, what its warranty covers, how likely it is to fail, the
 * reserve held against that, and who ends up paying.
 */
function PartTCOTable({
  parts,
  laborPct,
  onSelect,
  selected,
}: {
  parts: Part[];
  laborPct: number;
  onSelect: (p: Part) => void;
  selected: Part | null;
}) {
  const rows = useMemo(() => {
    return parts.map((p) => partTCO(p, TCO_HORIZON, laborPct));
  }, [parts, laborPct]);

  const totals = useMemo(() => {
    return rows.reduce(
      (a, r) => ({
        maintenance: a.maintenance + r.totalCost,
        buffer: a.buffer + r.buffer,
        customer: a.customer + r.customerCost,
        company: a.company + r.companyCost,
      }),
      { maintenance: 0, buffer: 0, customer: 0, company: 0 },
    );
  }, [rows]);

  const columns: Column<ReturnType<typeof partTCO>>[] = [
    {
      key: "name",
      header: "Part Specification",
      card: "title",
      value: (r) => r.part.name,
      render: (r) => (
        <div className="min-w-0">
          <span
            className="text-primary block truncate font-medium text-body-sm"
            title={r.part.name}
          >
            {r.part.name}
          </span>
          <span className="font-mono-data text-caption text-quaternary block">
            every {r.part.maintIntervalValue.toLocaleString()} {r.part.maintIntervalUnit} · ×
            {r.part.maintQty} {r.part.uom}
          </span>
        </div>
      ),
    },
    {
      key: "totalCost",
      header: "Maintenance Cost",
      align: "right",
      card: "metric",
      value: (r) => r.totalCost,
      render: (r) => (
        <span className="font-mono-data tabular text-primary">
          {fmtCompact(r.totalCost)}
          <span className="text-quaternary ml-1 text-caption">({r.eventCount}×)</span>
        </span>
      ),
    },
    {
      key: "warranty",
      header: "Warranty Coverage",
      hide: "md",
      value: (r) => r.part.warrantyYears,
      render: (r) => (
        <span className="font-mono-data text-secondary text-body-sm">
          {r.part.warrantyYears}yr / {(r.part.warrantyKm / 1000).toFixed(0)}k km
        </span>
      ),
    },
    {
      key: "failureProbability",
      header: "Failure Risk",
      value: (r) => r.part.failureProbabilityPct,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="bg-raised-2 h-1.5 w-12 overflow-hidden rounded-full">
            <span
              className="bg-error block h-full rounded-full"
              style={{ width: `${Math.min(100, r.part.failureProbabilityPct * 2)}%` }}
            />
          </span>
          <span className="font-mono-data tabular text-secondary text-body-sm">
            {r.part.failureProbabilityPct}%
          </span>
        </div>
      ),
    },
    {
      key: "buffer",
      header: "Company Buffer",
      align: "right",
      hide: "lg",
      value: (r) => r.buffer,
      render: (r) => (
        <span className="font-mono-data tabular text-secondary text-body-sm">
          {fmtCompact(r.buffer)}
        </span>
      ),
    },
    {
      key: "customerCost",
      header: "Customer Cost",
      align: "right",
      value: (r) => r.customerCost,
      render: (r) => (
        <span className="font-mono-data tabular text-warning text-body-sm font-medium">
          {fmtCompact(r.customerCost)}
        </span>
      ),
    },
    {
      key: "companyCost",
      header: "Company Cost",
      align: "right",
      value: (r) => r.companyCost,
      render: (r) => (
        <span className="font-mono-data tabular text-info text-body-sm font-medium">
          {fmtCompact(r.companyCost)}
        </span>
      ),
    },
  ];

  return (
    <Panel
      title={`Part-Level TCO Breakdown (${TCO_HORIZON}yr)`}
      action={
        <div className="flex items-center gap-3">
          <span className="font-mono-data text-caption text-quaternary tabular flex gap-3">
            <span>
              Customer: <strong className="text-warning">{fmtCompact(totals.customer)}</strong>
            </span>
            <span>
              Company: <strong className="text-info">{fmtCompact(totals.company)}</strong>
            </span>
            <span>
              Buffer: <strong className="text-secondary">{fmtCompact(totals.buffer)}</strong>
            </span>
          </span>
        </div>
      }
      padded={false}
      className="min-h-[420px]"
    >
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.part.id}
        onRowClick={(r) => onSelect(r.part)}
        isRowSelected={(r) => selected?.id === r.part.id}
        searchPlaceholder="Filter parts by name, interval or specification..."
        exportName="bom-parts-tco"
        pageSize={12}
        defaultSort={{ key: "totalCost", dir: "desc" }}
      />
    </Panel>
  );
}
