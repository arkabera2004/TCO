"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { useSimulationStore } from "@/store/simulationStore";
import { PREDEFINED_SCENARIOS, CHART_COLORS, type Scenario } from "@/data/syntheticData";
import { fmtCompact } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  createScenario,
  deleteScenario,
  listScenarios,
  type BackendScenario,
  type ScenarioInput,
} from "@/lib/api/scenarios";
import { ApiError } from "@/lib/api/client";
import { getSession } from "@/lib/api/session";

function scenarioYearly(s: Scenario) {
  const annual = (s.tco - 2800000) / s.planningHorizonYears;
  return Array.from({ length: 20 }, (_, i) => {
    const t = i + 1;
    const spike = t % 5 === 0 ? 1.55 : t % 2 === 0 ? 1.08 : 0.92;
    return annual * spike * (s.inflationEnabled ? Math.pow(1.032, t) : 1);
  });
}

export default function ScenarioComparator() {
  const { comparisonScenarios, addComparisonScenario, removeComparisonScenario } =
    useSimulationStore();

  const yearlySets = comparisonScenarios.map((s) => ({ s, yearly: scenarioYearly(s) }));
  const chartData = Array.from({ length: 20 }, (_, i) => {
    const row: Record<string, number | string> = { year: i + 1 };
    yearlySets.forEach(({ s, yearly }) => {
      row[s.name] = yearly[i];
      row[`${s.name} cum`] = yearly.slice(0, i + 1).reduce((a, b) => a + b, 2800000);
    });
    return row;
  });

  const deltaData = Array.from({ length: 20 }, (_, i) => {
    const row: Record<string, number | string> = { year: i + 1 };
    const base = yearlySets[0];
    yearlySets.slice(1).forEach(({ s, yearly }) => {
      const baseCum = base ? base.yearly.slice(0, i + 1).reduce((a, b) => a + b, 0) : 0;
      row[`${s.name} Δ`] = yearly.slice(0, i + 1).reduce((a, b) => a + b, 0) - baseCum;
    });
    return row;
  });

  const best = comparisonScenarios.reduce(
    (min, s) => (s.tco < min.tco ? s : min),
    comparisonScenarios[0] ?? PREDEFINED_SCENARIOS[0],
  );

  const kpiRows: { label: string; get: (s: Scenario) => string }[] = [
    { label: "Total TCO", get: (s) => fmtCompact(s.tco) },
    { label: "Annual O&M", get: (s) => fmtCompact((s.tco - 2800000) / s.planningHorizonYears) },
    { label: "Cost / km", get: (s) => `$${(s.tco / (240000 * 20)).toFixed(2)}` },
    { label: "Labor Rate", get: (s) => `$${s.laborRate}/hr` },
    { label: "Maint Interval ×", get: (s) => `${s.maintenanceIntervalMultiplier}×` },
    { label: "Failure Rate ×", get: (s) => `${s.failureRateMultiplier}×` },
    { label: "Extra Warranty", get: (s) => `${s.warrantyExtendedYears} yr` },
    { label: "Inflation", get: (s) => (s.inflationEnabled ? "Active" : "Disabled") },
    { label: "Downtime Costs", get: (s) => (s.includeDowntime ? "Included" : "Excluded") },
    { label: "Operating Profile", get: (s) => s.operatingProfile.replace("-", " ") },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Scenario Comparator — Multi-Track Evaluation"
        description="Side-by-side parametric trade-off comparison (reference data, not persisted). Evaluate up to three operational, maintenance, or inflation models concurrently. Persisted scenarios usable in TCO/simulation runs are managed below."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-caption text-tertiary mr-1">Predefined Scenarios:</span>
            {PREDEFINED_SCENARIOS.map((s) => {
              const active = comparisonScenarios.some((c) => c.id === s.id);
              return (
                <button
                  key={s.id}
                  onClick={() =>
                    active ? removeComparisonScenario(s.id) : addComparisonScenario(s)
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-label-sm font-medium transition-all",
                    active
                      ? "border-default bg-action-selected text-primary shadow-sm"
                      : "border-muted bg-container text-tertiary hover:border-default hover:text-secondary",
                  )}
                >
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.name}
                </button>
              );
            })}
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {/* Active Comparison Cards (up to 3) */}
        <div className="grid gap-3 md:grid-cols-3 shrink-0">
          {comparisonScenarios.map((s) => {
            const isBest = s.id === best.id;
            return (
              <Panel
                key={s.id}
                title={
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-body-sm font-semibold text-primary">{s.name}</span>
                    {isBest && <StatusBadge tone="success">Optimal</StatusBadge>}
                  </div>
                }
                action={
                  <button
                    onClick={() => removeComparisonScenario(s.id)}
                    className="text-tertiary transition-colors hover:text-primary"
                    title="Remove scenario"
                  >
                    <AppIcon name="close" size="xs" />
                  </button>
                }
              >
                <div>
                  <p
                    className="font-display font-mono-data text-2xl font-bold"
                    style={{ color: s.color }}
                  >
                    {fmtCompact(s.tco)}
                  </p>
                  <p className="font-mono-data mt-1 text-caption text-tertiary">
                    {s.planningHorizonYears}yr horizon · {s.discountRate}% discount · ${s.laborRate}
                    /hr · {s.operatingProfile.replace("-", " ")}
                  </p>
                </div>
              </Panel>
            );
          })}
          {comparisonScenarios.length < 3 && (
            <div className="flex min-h-[110px] items-center justify-center rounded-lg border border-dashed border-muted bg-container/40 p-4 text-caption text-quaternary text-center">
              Click a scenario pill in the header to activate ({3 - comparisonScenarios.length} free
              slot
              {comparisonScenarios.length === 2 ? "" : "s"})
            </div>
          )}
        </div>

        {/* Main Combined Chart */}
        <Panel
          className="shrink-0"
          title="Annual Operating Cost & Cumulative Lifecycle Projection"
          action={
            <div className="flex items-center gap-3 text-caption text-quaternary">
              <span>Bars: Annual Run-rate</span>
              <span>Dashed: Cumulative Horizon</span>
            </div>
          }
        >
          <div className="h-[340px] min-h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis dataKey="year" stroke={CHART_COLORS.textMuted} fontSize={11} />
                <YAxis
                  yAxisId="l"
                  stroke={CHART_COLORS.textMuted}
                  fontSize={11}
                  tickFormatter={(v: number) => fmtCompact(v)}
                />
                <YAxis
                  yAxisId="r"
                  orientation="right"
                  stroke={CHART_COLORS.textMuted}
                  fontSize={11}
                  tickFormatter={(v: number) => fmtCompact(v)}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                {comparisonScenarios.map((s) => (
                  <Bar key={s.id} yAxisId="l" dataKey={s.name} fill={s.color} fillOpacity={0.7} />
                ))}
                {comparisonScenarios.map((s) => (
                  <Line
                    key={`${s.id}-cum`}
                    yAxisId="r"
                    type="monotone"
                    dataKey={`${s.name} cum`}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 3"
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Bottom Split: Metric Grid and Delta Chart */}
        <SplitRow from="xl" ratio="1/1" className="shrink-0">
          <Panel title="Parameter & Financial Delta Comparison" padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-container border-b border-muted">
                  <tr>
                    <th className="px-3 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase">
                      Metric / Variable
                    </th>
                    {comparisonScenarios.map((s) => (
                      <th
                        key={s.id}
                        className="px-3 py-2 text-right text-caption font-semibold uppercase tracking-[0.08em]"
                        style={{ color: s.color }}
                      >
                        {s.name} {s.id === best.id ? "★" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted font-mono-data text-body-sm">
                  {kpiRows.map((row) => (
                    <tr key={row.label} className="transition-colors hover:bg-hover">
                      <td className="px-3 py-2 font-sans font-medium text-secondary">
                        {row.label}
                      </td>
                      {comparisonScenarios.map((s) => (
                        <td
                          key={s.id}
                          className={cn(
                            "px-3 py-2 text-right text-primary",
                            s.id === best.id && row.label === "Total TCO" && "font-bold text-teal",
                          )}
                        >
                          {row.get(s)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title={`Cumulative Variance vs ${comparisonScenarios[0]?.name ?? "Baseline"}`}
            action={
              <span className="text-caption text-quaternary">
                Net lifecycle savings / surplus over time
              </span>
            }
          >
            <div className="h-[300px] min-h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={deltaData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="year" stroke={CHART_COLORS.textMuted} fontSize={11} />
                  <YAxis
                    stroke={CHART_COLORS.textMuted}
                    fontSize={11}
                    tickFormatter={(v: number) => fmtCompact(v)}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  {comparisonScenarios.slice(1).map((s) => (
                    <Line
                      key={s.id}
                      type="monotone"
                      dataKey={`${s.name} Δ`}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </SplitRow>

        <BackendScenarioLibrary />
      </PageBody>
    </div>
  );
}

/* ────────────────────────── BACKEND SCENARIO LIBRARY (real backend) ────────────────────────── */

const EMPTY_SCENARIO_INPUT: ScenarioInput = {
  name: "",
  planningHorizonYears: 20,
  discountRate: 5,
  laborRate: 95,
  maintenanceIntervalMultiplier: 1,
  failureRateMultiplier: 1,
  warrantyExtendedYears: 0,
  fuelCostPerLiter: 1.42,
  inflationEnabled: false,
  includeDowntime: false,
};

const inputCls =
  "w-full rounded-md border border-muted bg-action px-2.5 py-1.5 text-body-sm text-primary outline-none placeholder:text-quaternary focus-visible:border-default focus-visible:ring-1 focus-visible:ring-active";

function BackendScenarioLibrary() {
  const [scenarios, setScenarios] = useState<BackendScenario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const canWrite = (() => {
    const role = getSession()?.role;
    return role === "ADMIN" || role === "MANAGER";
  })();
  const canDelete = getSession()?.role === "ADMIN";

  const load = () => {
    setError(null);
    listScenarios()
      .then(setScenarios)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load scenarios."));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    try {
      await deleteScenario(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete scenario.");
    }
  };

  return (
    <Panel
      title="Backend Scenario Library"
      action={
        canWrite && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-muted bg-action px-3 text-label-sm text-secondary hover:border-default hover:text-primary"
          >
            <AppIcon name="add" size="xs" />
            New scenario
          </button>
        )
      }
    >
      {error && <p className="mb-2 text-caption text-error">{error}</p>}
      {showForm && (
        <ScenarioForm
          onDone={() => {
            setShowForm(false);
            load();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {scenarios === null ? (
        <p className="text-body-sm text-tertiary">Loading scenarios…</p>
      ) : scenarios.length === 0 ? (
        <EmptyState
          title="No persisted scenarios yet"
          detail="Scenarios created here can be used in TCO and simulation runs."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-body-sm">
            <thead className="border-b border-muted">
              <tr className="text-caption uppercase tracking-[0.08em] text-quaternary">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Horizon</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Labor Rate</th>
                <th className="px-3 py-2 text-right">Maint ×</th>
                <th className="px-3 py-2 text-right">Downtime</th>
                {canDelete && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-muted">
              {scenarios.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 font-medium text-primary">{s.name}</td>
                  <td className="px-3 py-2 text-right font-mono-data">
                    {s.planningHorizonYears}yr
                  </td>
                  <td className="px-3 py-2 text-right font-mono-data">{s.discountRate}%</td>
                  <td className="px-3 py-2 text-right font-mono-data">${s.laborRate}/hr</td>
                  <td className="px-3 py-2 text-right font-mono-data">
                    {s.maintenanceIntervalMultiplier}×
                  </td>
                  <td className="px-3 py-2 text-right">{s.includeDowntime ? "Included" : "—"}</td>
                  {canDelete && (
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => remove(s.id)}
                        className="text-caption text-quaternary hover:text-error"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!canWrite && scenarios !== null && scenarios.length === 0 && (
        <p className="mt-2 text-caption text-quaternary">
          Your role doesn&apos;t permit creating scenarios.
        </p>
      )}
    </Panel>
  );
}

function ScenarioForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<ScenarioInput>(EMPTY_SCENARIO_INPUT);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof ScenarioInput>(key: K, value: ScenarioInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createScenario(form);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create scenario.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-dashed border-muted p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <label className="col-span-2 sm:col-span-3 lg:col-span-2 text-caption text-quaternary">
          Name
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className={cn(inputCls, "mt-1")}
          />
        </label>
        <label className="text-caption text-quaternary">
          Planning Horizon (yr)
          <input
            type="number"
            value={form.planningHorizonYears}
            onChange={(e) => set("planningHorizonYears", Number(e.target.value))}
            className={cn(inputCls, "mt-1")}
          />
        </label>
        <label className="text-caption text-quaternary">
          Discount Rate (%)
          <input
            type="number"
            value={form.discountRate}
            onChange={(e) => set("discountRate", Number(e.target.value))}
            className={cn(inputCls, "mt-1")}
          />
        </label>
        <label className="text-caption text-quaternary">
          Labor Rate ($/hr)
          <input
            type="number"
            value={form.laborRate}
            onChange={(e) => set("laborRate", Number(e.target.value))}
            className={cn(inputCls, "mt-1")}
          />
        </label>
        <label className="text-caption text-quaternary">
          Maint Interval ×
          <input
            type="number"
            step="0.1"
            value={form.maintenanceIntervalMultiplier}
            onChange={(e) => set("maintenanceIntervalMultiplier", Number(e.target.value))}
            className={cn(inputCls, "mt-1")}
          />
        </label>
        <label className="text-caption text-quaternary">
          Failure Rate ×
          <input
            type="number"
            step="0.1"
            value={form.failureRateMultiplier}
            onChange={(e) => set("failureRateMultiplier", Number(e.target.value))}
            className={cn(inputCls, "mt-1")}
          />
        </label>
        <label className="text-caption text-quaternary">
          Extra Warranty (yr)
          <input
            type="number"
            value={form.warrantyExtendedYears}
            onChange={(e) => set("warrantyExtendedYears", Number(e.target.value))}
            className={cn(inputCls, "mt-1")}
          />
        </label>
        <label className="text-caption text-quaternary">
          Fuel Cost ($/L)
          <input
            type="number"
            step="0.01"
            value={form.fuelCostPerLiter}
            onChange={(e) => set("fuelCostPerLiter", Number(e.target.value))}
            className={cn(inputCls, "mt-1")}
          />
        </label>
        <label className="flex items-center gap-1.5 text-caption text-quaternary">
          <input
            type="checkbox"
            checked={form.inflationEnabled}
            onChange={(e) => set("inflationEnabled", e.target.checked)}
          />
          Inflation enabled
        </label>
        <label className="flex items-center gap-1.5 text-caption text-quaternary">
          <input
            type="checkbox"
            checked={form.includeDowntime}
            onChange={(e) => set("includeDowntime", e.target.checked)}
          />
          Include downtime cost
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={submitting}
          className="rounded-md bg-action-primary px-3 py-1.5 text-label-sm text-on-color disabled:opacity-50"
        >
          Create scenario
        </button>
        <button onClick={onCancel} className="text-label-sm text-tertiary">
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-caption text-error">{error}</p>}
    </div>
  );
}
