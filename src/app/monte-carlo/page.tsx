"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, KpiTile, StatusBadge } from "@/components/ui/primitives";
import { FilterChips } from "@/components/ui/data-table";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { MONTE_CARLO_RESULTS, CHART_COLORS } from "@/data/syntheticData";
import { fmtCompact } from "@/utils/formatters";
import { AppIcon } from "@/components/icons/AppIcon";
import { cn } from "@/lib/utils";
import { useLocomotives } from "@/hooks/use-locomotives";
import {
  createSimulationRun,
  listSimulationRunsForLocomotive,
  type BackendSimulationRun,
} from "@/lib/api/simulation";
import { ApiError } from "@/lib/api/client";

const MC = MONTE_CARLO_RESULTS;

export default function MonteCarloPage() {
  const locomotives = useLocomotives();
  const [locoId, setLocoId] = useState<string | null>(null);
  const activeLocoId =
    locoId ?? (locomotives.status === "success" ? (locomotives.data[0]?.id ?? null) : null);

  const [run, setRun] = useState<BackendSimulationRun | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<BackendSimulationRun[] | null>(null);

  const loadHistory = (locoId: string) => {
    listSimulationRunsForLocomotive(locoId)
      .then(setHistory)
      .catch(() => setHistory(null));
  };

  useEffect(() => {
    setRun(null);
    if (activeLocoId) loadHistory(activeLocoId);
  }, [activeLocoId]);

  const rerun = async () => {
    if (running || !activeLocoId) return;
    setRunning(true);
    setError(null);
    try {
      const result = await createSimulationRun({
        locomotiveId: activeLocoId,
        iterations: 1000,
        horizonYears: 20,
      });
      setRun(result);
      loadHistory(activeLocoId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Simulation run failed.");
    } finally {
      setRunning(false);
    }
  };

  const histogram = useMemo(() => {
    if (!run) return MC.histogram.map((b) => ({ bin: b.bin, count: b.count }));
    return run.histogram.map((b) => ({
      bin: `${fmtCompact(b.rangeStart)}–${fmtCompact(b.rangeEnd)}`,
      count: b.count,
    }));
  }, [run]);

  const barColor = (i: number) => {
    if (i <= 1) return CHART_COLORS.green;
    if (i <= 4) return CHART_COLORS.blue;
    if (i <= 6) return CHART_COLORS.orange;
    return CHART_COLORS.red;
  };

  const percentiles = run
    ? [
        { p: "P10 (Best 10%)", v: run.percentiles.p10, tone: "success" as const },
        { p: "P50 (Median)", v: run.percentiles.p50, tone: "neutral" as const },
        { p: "P90 (Worst 10%)", v: run.percentiles.p90, tone: "warning" as const },
        { p: "P95 (Worst Case)", v: run.percentiles.p95, tone: "error" as const },
      ]
    : [
        { p: "P5 (Best Case)", v: MC.p5, tone: "success" as const },
        { p: "P10", v: MC.p10, tone: "success" as const },
        { p: "P25", v: MC.p25, tone: "info" as const },
        { p: "P50 (Median Baseline)", v: MC.p50, tone: "neutral" as const },
        { p: "P75", v: MC.p75, tone: "warning" as const },
        { p: "P90", v: MC.p90, tone: "error" as const },
        { p: "P95 (Worst Case)", v: MC.p95, tone: "error" as const },
      ];
  const medianForDelta = run ? run.percentiles.p50 : MC.p50;

  const inputRanges = [
    { input: "Fuel & Power Cost", dist: "Log-normal", min: "$1.10", max: "$2.80", sd: "$0.35" },
    { input: "BOM Failure Rate", dist: "Gamma", min: "0.5×", max: "3.0×", sd: "0.4×" },
    { input: "Maintenance Labor Rate", dist: "Normal", min: "$75", max: "$145", sd: "$18" },
    { input: "Labor Escalation Inflation", dist: "Normal", min: "1.5%", max: "6.5%", sd: "1.0%" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Monte Carlo Risk Simulation"
        description={
          run
            ? `Real backend simulation run (${run.iterations.toLocaleString()} iterations, seed ${run.seed}) for the selected locomotive.`
            : "Showing illustrative reference data below — run a real simulation against a locomotive to see persisted backend results."
        }
        actions={
          <div className="flex items-center gap-2">
            {locomotives.status === "success" && locomotives.data.length > 0 && (
              <FilterChips
                options={locomotives.data.map((l) => ({ id: l.id, label: l.model }))}
                value={activeLocoId ?? ""}
                onChange={(id) => {
                  setLocoId(id);
                  setRun(null);
                }}
              />
            )}
            <button
              onClick={rerun}
              disabled={running || !activeLocoId}
              className="inline-flex h-8 items-center gap-2 rounded-full bg-action-primary px-3 text-label-sm font-medium text-on-color transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <AppIcon name="power" size="xs" />
              <span>{running ? "Simulating…" : "Run 1,000 Draws"}</span>
            </button>
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {error && (
          <div className="shrink-0 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-caption text-error">
            {error}
          </div>
        )}
        {/* KPI Tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label="P50 Median TCO"
            value={fmtCompact(medianForDelta)}
            delta="Most probable outcome"
            tone="neutral"
            hint="50th percentile expectation"
          />
          <KpiTile
            label="P90 (Worst 10%)"
            value={fmtCompact(run ? run.percentiles.p90 : MC.p90)}
            delta={`vs P50: ${fmtCompact((run ? run.percentiles.p90 : MC.p90) - medianForDelta)}`}
            tone="error"
            hint="Extreme adverse risk limit"
          />
          <KpiTile
            label="P10 (Best 10%)"
            value={fmtCompact(run ? run.percentiles.p10 : MC.p10)}
            delta={`vs P50: ${fmtCompact((run ? run.percentiles.p10 : MC.p10) - medianForDelta)}`}
            tone="success"
            hint="High-reliability outcome"
          />
          <KpiTile
            label="Risk Range (P10→P90)"
            value={fmtCompact(
              (run ? run.percentiles.p90 : MC.p90) - (run ? run.percentiles.p10 : MC.p10),
            )}
            delta={
              run
                ? `variance = ${fmtCompact(run.summary.variance)} · n=${run.iterations.toLocaleString()}`
                : `σ = ${fmtCompact(MC.stdDev)} · n=1,000`
            }
            tone="info"
            hint="80% confidence interval width"
          />
        </div>

        {/* Top Split: Histogram & Variance Drivers */}
        <SplitRow from="xl" ratio="1.6/1" className="shrink-0">
          <Panel
            title={
              run
                ? `TCO Outcome Distribution (${run.iterations.toLocaleString()} Runs)`
                : "TCO Outcome Distribution (reference data)"
            }
            action={
              <span className="text-caption text-quaternary">
                {run ? `${run.horizonYears}-Year Horizon` : "20-Year Lifecycle"} · Frequency
                Distribution
              </span>
            }
          >
            <div className="space-y-3">
              {running && (
                <div className="rounded-md border border-muted bg-container p-2 text-caption text-tertiary">
                  Submitting simulation request to the backend…
                </div>
              )}
              <div className="h-[310px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={histogram}
                    style={{ opacity: running ? 0.35 : 1, transition: "opacity 0.3s" }}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                    <XAxis
                      dataKey="bin"
                      stroke={CHART_COLORS.textMuted}
                      fontSize={9}
                      angle={-20}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis stroke={CHART_COLORS.textMuted} fontSize={10} />
                    <Tooltip content={<ChartTooltip formatter={(v) => `${v} runs`} />} />
                    <ReferenceLine
                      x={histogram[Math.floor(histogram.length / 2)]?.bin}
                      stroke="var(--ref-gray-300)"
                      strokeDasharray="3 3"
                      label={{
                        value: "P50 MEDIAN",
                        fill: "var(--ref-gray-300)",
                        fontSize: 9,
                        position: "top",
                      }}
                    />
                    <Bar dataKey="count" name="Simulation runs" radius={[3, 3, 0, 0]}>
                      {histogram.map((_, i) => (
                        <Cell key={i} fill={barColor(i)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-center text-caption text-quaternary">
                {run
                  ? "Bins from the backend's persisted histogram for this run."
                  : "Reference data — run a simulation above to see real backend results."}
              </p>
            </div>
          </Panel>

          <Panel
            title="Risk Contribution to TCO Variance (illustrative)"
            action={
              <span className="text-caption text-quaternary">
                Not computed by the backend — static reference only
              </span>
            }
          >
            <div className="space-y-3">
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={MC.varianceDrivers}
                    layout="vertical"
                    margin={{ left: 10, right: 10, top: 10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={CHART_COLORS.grid}
                      horizontal={false}
                    />
                    <XAxis type="number" stroke={CHART_COLORS.textMuted} fontSize={10} unit="%" />
                    <YAxis
                      type="category"
                      dataKey="param"
                      stroke={CHART_COLORS.textMuted}
                      fontSize={10}
                      width={95}
                    />
                    <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
                    <Bar dataKey="contribution" name="Variance share" radius={[0, 4, 4, 0]}>
                      {MC.varianceDrivers.map((_, i) => (
                        <Cell
                          key={i}
                          fill={
                            i === 0
                              ? CHART_COLORS.red
                              : i < 3
                                ? CHART_COLORS.orange
                                : CHART_COLORS.blue
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-caption leading-relaxed text-tertiary">
                Failure-rate uncertainty accounts for{" "}
                <span className="text-primary font-medium">22%</span> of total lifecycle spread.
                Predictive condition-based maintenance and reman programs compress this risk
                interval by up to 40%.
              </p>
            </div>
          </Panel>
        </SplitRow>

        {/* Bottom Split: Percentile Table & Input Distributions */}
        <SplitRow from="xl" ratio="1/1" className="shrink-0">
          <Panel
            title="Confidence Percentile Bands"
            action={
              <span className="text-caption text-quaternary">
                {run ? "Backend-persisted run" : "Reference data"} baseline:{" "}
                {fmtCompact(medianForDelta)}
              </span>
            }
            padded={false}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-container border-b border-muted">
                  <tr>
                    <th className="px-3 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase">
                      Percentile Band
                    </th>
                    <th className="px-3 py-2 text-right text-caption font-medium tracking-[0.08em] text-quaternary uppercase">
                      Simulated TCO
                    </th>
                    <th className="px-3 py-2 text-right text-caption font-medium tracking-[0.08em] text-quaternary uppercase">
                      Delta vs Median
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted font-mono-data text-body-sm">
                  {percentiles.map((row) => {
                    const d = row.v - medianForDelta;
                    return (
                      <tr key={row.p} className="transition-colors hover:bg-hover">
                        <td className="px-3 py-2 font-sans font-medium text-secondary">{row.p}</td>
                        <td className="px-3 py-2 text-right font-semibold text-primary">
                          {fmtCompact(row.v)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {d === 0 ? (
                            <span className="text-tertiary">Baseline</span>
                          ) : (
                            <StatusBadge tone={row.tone}>
                              {d > 0 ? "+" : "−"}
                              {fmtCompact(Math.abs(d))} ({d > 0 ? "+" : "−"}
                              {Math.abs((d / medianForDelta) * 100).toFixed(0)}%)
                            </StatusBadge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Stochastic Input Parameters & Distributions (illustrative)"
            action={
              <span className="text-caption text-quaternary">
                Not returned by the backend — static reference only
              </span>
            }
            padded={false}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-container border-b border-muted">
                  <tr>
                    {["Input Parameter", "Distribution", "Min", "Max", "Std Dev"].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-3 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase whitespace-nowrap",
                          i >= 2 && "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted font-mono-data text-body-sm">
                  {inputRanges.map((r) => (
                    <tr key={r.input} className="transition-colors hover:bg-hover">
                      <td className="px-3 py-2.5 font-sans font-medium text-secondary">
                        {r.input}
                      </td>
                      <td className="px-3 py-2.5 text-tertiary">{r.dist}</td>
                      <td className="px-3 py-2.5 text-right text-primary">{r.min}</td>
                      <td className="px-3 py-2.5 text-right text-primary">{r.max}</td>
                      <td className="px-3 py-2.5 text-right text-secondary">{r.sd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="p-3 text-caption text-quaternary border-t border-muted">
              Each iteration draws independently from the assigned continuous probability density
              functions.
            </p>
          </Panel>
        </SplitRow>

        {history && history.length > 0 && (
          <Panel
            title={`Run History — ${history.length} persisted run${history.length === 1 ? "" : "s"}`}
            padded={false}
          >
            <ul className="divide-y divide-muted">
              {history.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setRun(r)}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-left text-body-sm",
                      run?.id === r.id ? "bg-action-selected" : "hover:bg-hover",
                    )}
                  >
                    <span className="text-secondary">
                      {new Date(r.createdAt).toLocaleString()} · {r.iterations.toLocaleString()}{" "}
                      iterations · seed {r.seed.slice(0, 8)}
                    </span>
                    <span className="font-mono-data text-primary">
                      P50 {fmtCompact(r.percentiles.p50)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </PageBody>
    </div>
  );
}
