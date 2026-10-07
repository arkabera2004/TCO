"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Treemap,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, KpiTile, StatusBadge } from "@/components/ui/primitives";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { SliderRow, ToggleRow } from "@/components/shared/Controls";
import {
  MaintenanceAnalytics,
  MaintDriverSummary,
} from "@/components/simulation/MaintenanceAnalytics";
import { useSimulationStore } from "@/store/simulationStore";
import {
  LOCOMOTIVES,
  OPERATING_PROFILES,
  COMPONENTS,
  SYSTEMS,
  ASSEMBLIES,
  RELIABILITY_CURVE_DATA,
  CHART_COLORS,
} from "@/data/syntheticData";
import { SENSITIVITY_DATA, runTCOSimulation, weibullFailureProb } from "@/utils/simulationEngine";
import { usePartsStore } from "@/store/partsStore";
import { partTCO, fleetTCO, eventPartsCost, formatInterval } from "@/utils/tcoEngine";
import { fmtCompact, fmtUSD } from "@/utils/formatters";
import { cn } from "@/lib/utils";

const TABS = [
  "Cumulative TCO",
  "Annual Breakdown",
  "By Component",
  "Sensitivity",
  "Inflation Impact",
] as const;

export default function SimulationPlayground() {
  const { params, setParams, result } = useSimulationStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Cumulative TCO");
  const profile =
    OPERATING_PROFILES.find((p) => p.id === params.operatingProfile) ?? OPERATING_PROFILES[0];

  const donutData = [
    { name: "Capital", value: result.breakdown.capital, color: CHART_COLORS.blue },
    { name: "Maintenance", value: result.breakdown.maintenance, color: CHART_COLORS.teal },
    { name: "Replacements", value: result.breakdown.replacements, color: CHART_COLORS.purple },
    { name: "Consumables", value: result.breakdown.consumables, color: CHART_COLORS.yellow },
    { name: "Failures", value: result.breakdown.failures, color: CHART_COLORS.red },
    { name: "Downtime", value: result.breakdown.downtime, color: CHART_COLORS.green },
  ].filter((d) => d.value > 0);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="TCO Simulation Playground"
        description="Interactive parametric lifecycle cost modeling with Weibull reliability curves, downtime costs, and operator vs manufacturer risk allocation."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setParams({
                  N: 20,
                  laborRatePerHour: 95,
                  maintenanceIntervalMultiplier: 1.0,
                  failureRateMultiplier: 1.0,
                  mttrMultiplier: 1.0,
                  warrantyExtendedYears: 0,
                  consumableQtyMultiplier: 1.0,
                  inflationEnabled: true,
                  includeDowntime: true,
                })
              }
              className="rounded-full border border-muted bg-action px-3 py-1 text-label-sm text-tertiary transition-colors hover:border-default hover:text-primary"
            >
              Reset Simulation Defaults
            </button>
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Row (6 Tiles) */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 shrink-0">
          <KpiTile
            label="Total TCO"
            value={fmtCompact(result.totalTCO)}
            delta={`${params.N}yr horizon`}
            tone="neutral"
            hint="Full lifecycle expenditure"
          />
          <KpiTile
            label="Customer TCO"
            value={fmtCompact(result.split.customerTCO)}
            delta="Operator carried"
            tone="info"
            hint="Post-warranty share"
          />
          <KpiTile
            label="Manufacturer TCO"
            value={fmtCompact(result.split.organizationTCO)}
            delta="Warranty reserve"
            tone="warning"
            hint="OEM risk obligation"
          />
          <KpiTile
            label="Annual Avg Cost"
            value={fmtCompact(result.financials.annualAvg)}
            delta="Per locomotive"
            tone="neutral"
            hint="Annual operational run-rate"
          />
          <KpiTile
            label="Lifecycle Cost / km"
            value={`$${result.financials.costPerKm.toFixed(2)}`}
            delta="All-in rate"
            tone="neutral"
            hint="Normalized distance cost"
          />
          <KpiTile
            label="Fleet Availability"
            value={`${result.availability.availabilityPct.toFixed(1)}%`}
            delta={`MTTR: ${result.availability.mttrAvg.toFixed(1)}h`}
            tone="success"
            hint="MTBF / (MTBF + MTTR)"
          />
        </div>

        {/* Two-Column Workspace: Left Control Tower, Right Canvas */}
        <div className="grid gap-4 xl:grid-cols-[300px_1fr] 2xl:grid-cols-[340px_1fr] items-start">
          {/* ───── LEFT: Control Tower ───── */}
          <div className="space-y-4">
            <Panel title="Platform & Operating Profile">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-caption font-medium text-tertiary">
                    Select Locomotive
                  </label>
                  <div className="space-y-1.5">
                    {LOCOMOTIVES.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => setParams({ locomotiveId: l.id })}
                        className={cn(
                          "w-full rounded-md border p-2 text-left transition-colors",
                          params.locomotiveId === l.id
                            ? "border-default bg-action-selected text-primary shadow-sm"
                            : "border-muted bg-container text-secondary hover:border-default hover:bg-hover",
                        )}
                      >
                        <p className="text-body-sm font-semibold">{l.model}</p>
                        <p className="text-caption text-tertiary">
                          {l.horsepower}hp · {fmtCompact(l.purchaseCost)} · {l.fuelType}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-muted">
                  <label className="text-caption font-medium text-tertiary">Duty Profile</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {OPERATING_PROFILES.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setParams({ operatingProfile: p.id })}
                        className={cn(
                          "rounded-md border px-2 py-1.5 text-caption font-medium transition-colors",
                          params.operatingProfile === p.id
                            ? "border-default bg-action-selected text-primary shadow-sm"
                            : "border-muted bg-container text-tertiary hover:border-default hover:text-secondary",
                        )}
                        title={p.description}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <div className="font-mono-data rounded-md border border-muted bg-container p-2 text-caption text-tertiary">
                    Wear ×{profile.wearMultiplier} · Maint ×{profile.maintenanceFreqMultiplier} ·
                    Risk ×{profile.failureProbMultiplier}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Planning Horizon & Labor">
              <div className="space-y-3">
                <SliderRow
                  label="Planning Horizon"
                  min={5}
                  max={30}
                  value={params.N}
                  display={`${params.N} yr`}
                  onChange={(v) => setParams({ N: v })}
                />
                <SliderRow
                  label="Labor Rate"
                  min={60}
                  max={180}
                  value={params.laborRatePerHour}
                  display={`$${params.laborRatePerHour}/hr`}
                  onChange={(v) => setParams({ laborRatePerHour: v })}
                />
              </div>
            </Panel>

            <MaintenancePartCard />

            <Panel title="Reliability & Service Modifiers">
              <div className="space-y-3">
                <SliderRow
                  label="Maint Interval ×"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={params.maintenanceIntervalMultiplier}
                  display={`${params.maintenanceIntervalMultiplier.toFixed(2)}×`}
                  onChange={(v) => setParams({ maintenanceIntervalMultiplier: v })}
                />
                <SliderRow
                  label="Failure Rate ×"
                  min={0.5}
                  max={3}
                  step={0.05}
                  value={params.failureRateMultiplier}
                  display={`${params.failureRateMultiplier.toFixed(2)}×`}
                  onChange={(v) => setParams({ failureRateMultiplier: v })}
                />
                <SliderRow
                  label="MTTR Multiplier"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={params.mttrMultiplier}
                  display={`${params.mttrMultiplier.toFixed(2)}×`}
                  onChange={(v) => setParams({ mttrMultiplier: v })}
                />
                <SliderRow
                  label="Extended Warranty"
                  min={0}
                  max={5}
                  value={params.warrantyExtendedYears}
                  display={`+${params.warrantyExtendedYears} yr`}
                  onChange={(v) => setParams({ warrantyExtendedYears: v })}
                />
                <SliderRow
                  label="Consumables ×"
                  min={0.5}
                  max={2}
                  step={0.05}
                  value={params.consumableQtyMultiplier}
                  display={`${params.consumableQtyMultiplier.toFixed(2)}×`}
                  onChange={(v) => setParams({ consumableQtyMultiplier: v })}
                />
              </div>
            </Panel>

            <Panel title="Inflation & Downtime Modeling">
              <div className="space-y-3">
                <ToggleRow
                  label="Inflation Escalation"
                  value={params.inflationEnabled}
                  onChange={(v) => setParams({ inflationEnabled: v })}
                />
                {params.inflationEnabled && (
                  <div className="space-y-2 rounded-md border border-muted bg-container p-2.5">
                    <SliderRow
                      label="Labor Inflation"
                      min={0}
                      max={8}
                      step={0.1}
                      value={params.inflationLabor}
                      display={`${params.inflationLabor.toFixed(1)}%/yr`}
                      onChange={(v) => setParams({ inflationLabor: v })}
                    />
                    <SliderRow
                      label="Spare Parts Inflation"
                      min={0}
                      max={6}
                      step={0.1}
                      value={params.inflationParts}
                      display={`${params.inflationParts.toFixed(1)}%/yr`}
                      onChange={(v) => setParams({ inflationParts: v })}
                    />
                    <p className="font-mono-data text-caption text-warning">
                      Labor: ${params.laborRatePerHour}/hr → $
                      {Math.round(
                        params.laborRatePerHour * Math.pow(1 + params.inflationLabor / 100, 10),
                      )}
                      /hr by Year 10
                    </p>
                  </div>
                )}
                <ToggleRow
                  label="Include Downtime Cost"
                  value={params.includeDowntime}
                  onChange={(v) => setParams({ includeDowntime: v })}
                />
              </div>
            </Panel>
          </div>

          {/* ───── RIGHT: Simulation Results Canvas ───── */}
          <div className="space-y-4 min-w-0">
            <TCOSplitCard />
            <MaintDriverSummary />

            {/* Primary Simulation Chart Panel */}
            <Panel
              title="Lifecycle Cost Dynamic Projection"
              action={
                <div className="flex items-center gap-1 rounded-full border border-muted bg-container p-0.5">
                  {TABS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-label-sm font-medium transition-colors",
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
            >
              <ChartArea tab={tab} />
            </Panel>

            {/* Output Intelligence Grid */}
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              <Panel title="Cost Breakdown Distribution">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {donutData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel title="Weibull Reliability vs Competitors">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={RELIABILITY_CURVE_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                      <XAxis dataKey="year" stroke={CHART_COLORS.textMuted} fontSize={10} />
                      <YAxis stroke={CHART_COLORS.textMuted} fontSize={10} unit="%" />
                      <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line
                        type="monotone"
                        dataKey="es44ac"
                        name="ES44AC"
                        stroke={CHART_COLORS.blue}
                        dot={false}
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="ge_t4"
                        name="GE T4"
                        stroke={CHART_COLORS.orange}
                        dot={false}
                        strokeDasharray="5 3"
                      />
                      <Line
                        type="monotone"
                        dataKey="siemens"
                        name="Siemens"
                        stroke={CHART_COLORS.purple}
                        dot={false}
                        strokeDasharray="5 3"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <CostBySystem />
              <RiskMatrix />

              <Panel
                title="Optimization Recommendation"
                action={
                  <span className="font-mono-data text-caption font-semibold text-teal">
                    92% CONFIDENCE
                  </span>
                }
              >
                <div className="space-y-3">
                  <p className="text-body-sm font-semibold text-primary">
                    Extend brake PM interval 6 → 8 months
                  </p>
                  <p className="text-caption leading-relaxed text-secondary">
                    <span className="font-semibold text-primary">Root Cause:</span> Weibull β=3.5
                    shows wear-out begins at 7,200 hrs. Current 5,500hr trigger is 24% earlier than
                    required.
                  </p>
                  <div className="font-mono-data space-y-1 rounded-md border border-muted bg-container p-2.5 text-caption">
                    <p className="text-teal font-medium">Impact: save $84,000 over 20 years</p>
                    <p className="text-tertiary">Reliability delta: −0.8% (within tolerance)</p>
                    <p className="text-tertiary">Availability delta: +0.3%</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setParams({
                          maintenanceIntervalMultiplier: Math.min(
                            2,
                            params.maintenanceIntervalMultiplier * 1.33,
                          ),
                        })
                      }
                      className="flex-1 rounded-md bg-action-primary px-2 py-1.5 text-label-sm font-medium text-on-color transition-opacity hover:opacity-90"
                    >
                      Apply Optimization
                    </button>
                  </div>
                </div>
              </Panel>

              <Panel title="Availability Indices">
                <div className="font-mono-data space-y-2.5 text-body-sm">
                  <div className="flex justify-between">
                    <span className="text-secondary">MTTR (Average)</span>
                    <span className="font-semibold text-primary">
                      {result.availability.mttrAvg.toFixed(1)} hrs
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">MTBF (Fleet Average)</span>
                    <span className="font-semibold text-primary">
                      {Math.round(result.availability.mtbfFleetAvg).toLocaleString()} hrs
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-muted pt-2">
                    <span className="text-secondary">Fleet Availability</span>
                    <span className="font-bold text-teal">
                      {result.availability.availabilityPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-caption text-quaternary">
                  Calculated via A = MTBF / (MTBF + MTTR)
                </p>
              </Panel>
            </div>

            {/* Component & consumable analytics */}
            <MaintenanceAnalytics />
          </div>
        </div>
      </PageBody>
    </div>
  );
}

function ChartArea({ tab }: { tab: string }) {
  const { params, result } = useSimulationStore();

  if (tab === "Cumulative TCO") {
    return (
      <ResponsiveContainer width="100%" height={340}>
        <AreaChart data={result.yearlyBreakdown}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="year" stroke={CHART_COLORS.textMuted} fontSize={11} />
          <YAxis
            stroke={CHART_COLORS.textMuted}
            fontSize={11}
            tickFormatter={(v: number) => fmtCompact(v)}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area
            type="monotone"
            dataKey="maintenance"
            name="Maintenance"
            stackId="1"
            stroke={CHART_COLORS.teal}
            fill={CHART_COLORS.teal}
            fillOpacity={0.5}
          />
          <Area
            type="monotone"
            dataKey="replacement"
            name="Replacements"
            stackId="1"
            stroke={CHART_COLORS.purple}
            fill={CHART_COLORS.purple}
            fillOpacity={0.5}
          />
          <Area
            type="monotone"
            dataKey="consumables"
            name="Consumables"
            stackId="1"
            stroke={CHART_COLORS.yellow}
            fill={CHART_COLORS.yellow}
            fillOpacity={0.5}
          />
          <Area
            type="monotone"
            dataKey="failures"
            name="Failures"
            stackId="1"
            stroke={CHART_COLORS.red}
            fill={CHART_COLORS.red}
            fillOpacity={0.5}
          />
          <Area
            type="monotone"
            dataKey="downtime"
            name="Downtime"
            stackId="1"
            stroke={CHART_COLORS.blue}
            fill={CHART_COLORS.blue}
            fillOpacity={0.4}
          />
          <Area
            type="monotone"
            dataKey="warranty"
            name="Warranty offset"
            stroke={CHART_COLORS.green}
            fill={CHART_COLORS.green}
            fillOpacity={0.25}
            strokeDasharray="4 3"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (tab === "Annual Breakdown") {
    return (
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={result.yearlyBreakdown}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="year" stroke={CHART_COLORS.textMuted} fontSize={11} />
          <YAxis
            stroke={CHART_COLORS.textMuted}
            fontSize={11}
            tickFormatter={(v: number) => fmtCompact(v)}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="maintenance" name="Maintenance" stackId="a" fill={CHART_COLORS.teal} />
          <Bar dataKey="replacement" name="Replacements" stackId="a" fill={CHART_COLORS.purple} />
          <Bar dataKey="consumables" name="Consumables" stackId="a" fill={CHART_COLORS.yellow} />
          <Bar dataKey="failures" name="Failures" stackId="a" fill={CHART_COLORS.red} />
          <Bar dataKey="downtime" name="Downtime" stackId="a" fill={CHART_COLORS.blue} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (tab === "By Component") {
    const treeData = COMPONENTS.map((c) => ({
      name: c.name,
      size: c.replacementCost * Math.max(1, Math.floor(params.N / c.lifeYears)),
    }));
    return (
      <ResponsiveContainer width="100%" height={340}>
        <Treemap
          data={treeData}
          dataKey="size"
          stroke="var(--ref-black)"
          fill={CHART_COLORS.blue}
        />
      </ResponsiveContainer>
    );
  }

  if (tab === "Sensitivity") {
    return (
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={SENSITIVITY_DATA} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis type="number" stroke={CHART_COLORS.textMuted} fontSize={11} unit="%" />
          <YAxis
            type="category"
            dataKey="param"
            stroke={CHART_COLORS.textMuted}
            fontSize={10}
            width={110}
          />
          <Tooltip content={<ChartTooltip formatter={(v) => `±${v}%`} />} />
          <Bar dataKey="impact" name="TCO impact" fill={CHART_COLORS.blue} radius={[0, 4, 4, 0]}>
            {SENSITIVITY_DATA.map((d, i) => (
              <Cell key={i} fill={i < 3 ? CHART_COLORS.orange : CHART_COLORS.blue} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Inflation impact
  const withInf = result;
  const withoutInf = runTCOSimulation({ ...params, inflationEnabled: false });
  const merged = withInf.yearlyBreakdown.map((y, i) => ({
    year: y.year,
    inflated: y.cumulative,
    nominal: withoutInf.yearlyBreakdown[i]?.cumulative ?? 0,
  }));
  const delta = withInf.totalTCO - withoutInf.totalTCO;
  return (
    <div>
      <ResponsiveContainer width="100%" height={310}>
        <LineChart data={merged}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="year" stroke={CHART_COLORS.textMuted} fontSize={11} />
          <YAxis
            stroke={CHART_COLORS.textMuted}
            fontSize={11}
            tickFormatter={(v: number) => fmtCompact(v)}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="inflated"
            name="With inflation"
            stroke={CHART_COLORS.yellow}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="nominal"
            name="Without inflation"
            stroke={CHART_COLORS.blue}
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 3"
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="font-mono-data mt-2 text-center text-body-sm text-warning font-medium">
        Inflation adds {fmtCompact(Math.abs(delta))} over {params.N} years
      </p>
    </div>
  );
}

function MaintenancePartCard() {
  const { parts, laborPct } = usePartsStore();
  const { params } = useSimulationStore();
  const [partId, setPartId] = useState<string>(parts[0]?.id ?? "");

  const part = parts.find((p) => p.id === partId) ?? parts[0];
  if (!part) return null;

  const tco = partTCO(part, params.N, laborPct);
  const partsCost = eventPartsCost(part);

  return (
    <Panel title="Part Definition Detail">
      <div className="space-y-3">
        <select
          value={part.id}
          onChange={(e) => setPartId(e.target.value)}
          className="w-full rounded-md border border-muted bg-action px-2.5 py-1.5 text-body-sm text-primary outline-none transition-colors hover:border-default focus-visible:ring-1 focus-visible:ring-active"
        >
          {COMPONENTS.map((c) => {
            const group = parts.filter((p) => p.componentId === c.id);
            if (group.length === 0) return null;
            return (
              <optgroup key={c.id} label={c.name}>
                {group.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>

        <div className="font-mono-data space-y-1.5 rounded-md border border-muted bg-container p-2.5 text-body-sm">
          <SimRow label="Interval" value={formatInterval(part)} />
          <SimRow label="Quantity" value={`${part.maintQty} ${part.uom}`} />
          <SimRow label="Unit Price" value={fmtUSD(part.unitPriceNew)} />
          <SimRow label="Parts / Event" value={fmtUSD(partsCost)} />
          <SimRow
            label={`Labour @ ${laborPct}%`}
            value={fmtUSD(partsCost * (laborPct / 100))}
            accent
          />
          <div className="border-t border-muted pt-1.5">
            <SimRow label="Total / Event" value={fmtUSD(partsCost * (1 + laborPct / 100))} bold />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-md border border-muted bg-container p-2">
            <p className="text-caption uppercase tracking-wider text-quaternary">Warranty</p>
            <p className="font-mono-data mt-0.5 text-body-sm font-semibold text-primary">
              {part.warrantyYears}yr · {(part.warrantyKm / 1000).toFixed(0)}k km
            </p>
          </div>
          <div className="rounded-md border border-muted bg-container p-2">
            <p className="text-caption uppercase tracking-wider text-quaternary">Failure Prob.</p>
            <p className="font-mono-data mt-0.5 text-body-sm font-semibold text-warning">
              {part.failureProbabilityPct}%
            </p>
          </div>
        </div>

        <p className="text-caption text-quaternary">
          {tco.eventCount} cycles over {params.N}yr · {fmtCompact(tco.customerCost)} customer /{" "}
          {fmtCompact(tco.companyCost)} OEM
        </p>
      </div>
    </Panel>
  );
}

function SimRow({
  label,
  value,
  accent,
  bold,
}: {
  label: string;
  value: string;
  accent?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-secondary">{label}</span>
      <span
        className={cn(
          "tabular-nums text-secondary",
          accent && "text-teal font-medium",
          bold && "font-bold text-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function TCOSplitCard() {
  const { params, result } = useSimulationStore();
  const { parts, laborPct } = usePartsStore();
  const partRoll = useMemo(() => fleetTCO(parts, params.N, laborPct), [parts, params.N, laborPct]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel
        title="Customer TCO Obligation"
        action={
          <span className="font-mono-data text-body-lg font-bold text-teal">
            {fmtCompact(result.split.customerTCO)}
          </span>
        }
      >
        <div className="space-y-2">
          <p className="text-caption text-tertiary">
            Operator lifecycle expenditure — warranty-covered replacements deducted.
          </p>
          <div className="font-mono-data space-y-1.5 rounded-md border border-muted bg-container p-2.5 text-body-sm">
            <div className="flex justify-between">
              <span className="text-secondary">Gross lifecycle cost</span>
              <span className="text-primary">
                {fmtCompact(result.totalTCO + result.split.warrantyCovered)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Less warranty covered</span>
              <span className="text-success font-medium">
                -{fmtCompact(result.split.warrantyCovered)}
              </span>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Organization TCO Obligation"
        action={
          <span className="font-mono-data text-body-lg font-bold text-purple-400">
            {fmtCompact(result.split.organizationTCO)}
          </span>
        }
      >
        <div className="space-y-2">
          <p className="text-caption text-tertiary">
            Manufacturer warranty exposure and contingency risk reserve.
          </p>
          <div className="font-mono-data space-y-1.5 rounded-md border border-muted bg-container p-2.5 text-body-sm">
            <div className="flex justify-between">
              <span className="text-secondary">Warranty replacement</span>
              <span className="text-primary">{fmtCompact(result.split.warrantyCovered)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Company warranty reserve</span>
              <span className="text-primary">{fmtCompact(result.split.warrantyReserve)}</span>
            </div>
          </div>
          <p className="text-caption text-quaternary">
            Reserve = Σ(part cost × failure prob) across {parts.length} parts · part-level maint{" "}
            {fmtCompact(partRoll.totalCost)}
          </p>
        </div>
      </Panel>
    </div>
  );
}

function CostBySystem() {
  const sys = SYSTEMS.filter((s) => s.locomotiveId === "loco-001").map((s) => {
    const asmIds = ASSEMBLIES.filter((a) => a.systemId === s.id).map((a) => a.id);
    const cost = COMPONENTS.filter((c) => asmIds.includes(c.assemblyId)).reduce(
      (sum, c) => sum + c.replacementCost * Math.max(1, Math.floor(20 / c.lifeYears)),
      0,
    );
    return { ...s, cost };
  });
  const max = Math.max(...sys.map((s) => s.cost));
  return (
    <Panel title="Cost by Subsystem (20yr)">
      <div className="space-y-2.5">
        {sys
          .sort((a, b) => b.cost - a.cost)
          .map((s) => (
            <div key={s.id}>
              <div className="flex justify-between text-caption font-medium">
                <span className="text-secondary">{s.name}</span>
                <span className="font-mono-data text-primary">{fmtCompact(s.cost)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-hover">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(s.cost / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
      </div>
    </Panel>
  );
}

function RiskMatrix() {
  const data = COMPONENTS.map((c) => ({
    x: weibullFailureProb(c.currentHours + 5500, c.weibullBeta, c.weibullEta) * 100,
    y: c.replacementCost * (1 + c.laborCostPct / 100),
    name: c.name,
  }));
  return (
    <Panel
      title="Failure Probability Risk Matrix"
      action={<span className="text-caption text-quaternary">{COMPONENTS.length} subsystems</span>}
    >
      <div className="h-[190px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis
              type="number"
              dataKey="x"
              name="Failure prob"
              stroke={CHART_COLORS.textMuted}
              fontSize={9}
              unit="%"
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Cost impact"
              stroke={CHART_COLORS.textMuted}
              fontSize={9}
              tickFormatter={(v: number) => fmtCompact(v)}
              width={48}
            />
            <ZAxis range={[40, 41]} />
            <Tooltip
              content={
                <ChartTooltip formatter={(v) => (v > 1000 ? fmtUSD(v) : `${v.toFixed(1)}%`)} />
              }
            />
            <Scatter data={data} fill={CHART_COLORS.orange} fillOpacity={0.85} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-caption text-quaternary">
        Failure prob (next year) × cost impact across active BOM components
      </p>
    </Panel>
  );
}
