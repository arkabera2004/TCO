"use client";

import { useState } from "react";
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
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { MONTE_CARLO_RESULTS, CHART_COLORS } from "@/data/syntheticData";
import { fmtCompact } from "@/utils/formatters";
import { AppIcon } from "@/components/icons/AppIcon";
import { cn } from "@/lib/utils";

const MC = MONTE_CARLO_RESULTS;

export default function MonteCarloPage() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(100);

  const rerun = () => {
    if (running) return;
    setRunning(true);
    setProgress(0);
    const start = Date.now();
    const iv = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / 2000) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(iv);
        setRunning(false);
      }
    }, 40);
  };

  const barColor = (i: number) => {
    if (i <= 1) return CHART_COLORS.green;
    if (i <= 4) return CHART_COLORS.blue;
    if (i <= 6) return CHART_COLORS.orange;
    return CHART_COLORS.red;
  };

  const percentiles = [
    { p: "P5 (Best Case)", v: MC.p5, tone: "success" as const },
    { p: "P10", v: MC.p10, tone: "success" as const },
    { p: "P25", v: MC.p25, tone: "info" as const },
    { p: "P50 (Median Baseline)", v: MC.p50, tone: "neutral" as const },
    { p: "P75", v: MC.p75, tone: "warning" as const },
    { p: "P90", v: MC.p90, tone: "error" as const },
    { p: "P95 (Worst Case)", v: MC.p95, tone: "error" as const },
  ];

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
        description="1,000-iteration stochastic lifecycle cost analysis with probability distributions, percentile confidence intervals, and sensitivity variance drivers."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={rerun}
              disabled={running}
              className="inline-flex h-8 items-center gap-2 rounded-full bg-action-primary px-3 text-label-sm font-medium text-on-color transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <AppIcon name="power" size="xs" />
              <span>{running ? "Simulating…" : "Re-run 1,000 Draws"}</span>
            </button>
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label="P50 Median TCO"
            value="$3.82M"
            delta="Most probable outcome"
            tone="neutral"
            hint="50th percentile expectation"
          />
          <KpiTile
            label="P90 (Worst 10%)"
            value="$4.35M"
            delta="+$530k exposure vs P50"
            tone="error"
            hint="Extreme adverse risk limit"
          />
          <KpiTile
            label="P10 (Best 10%)"
            value="$3.42M"
            delta="-$400k savings vs P50"
            tone="success"
            hint="High-reliability outcome"
          />
          <KpiTile
            label="Risk Range (P10→P90)"
            value="$930k"
            delta={`σ = ${fmtCompact(MC.stdDev)} · n=1,000`}
            tone="info"
            hint="80% confidence interval width"
          />
        </div>

        {/* Top Split: Histogram & Variance Drivers */}
        <SplitRow from="xl" ratio="1.6/1" className="shrink-0">
          <Panel
            title="TCO Outcome Distribution (1,000 Runs)"
            action={
              <span className="text-caption text-quaternary">
                20-Year Lifecycle · Frequency Distribution
              </span>
            }
          >
            <div className="space-y-3">
              {running && (
                <div className="rounded-md border border-muted bg-container p-2">
                  <div className="flex justify-between text-caption text-tertiary mb-1">
                    <span>Sampling stochastic draws...</span>
                    <span className="font-mono-data">
                      {Math.round((progress / 100) * 1000)} / 1,000
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-hover">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-100"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="h-[310px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={MC.histogram}
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
                      x="$3.8M – $4.0M"
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
                      {MC.histogram.map((_, i) => (
                        <Cell key={i} fill={barColor(i)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-center text-caption text-quaternary">
                Bins reflect full fleet replacement, fuel volatility, and Weibull random failure
                draws.
              </p>
            </div>
          </Panel>

          <Panel
            title="Risk Contribution to TCO Variance"
            action={<span className="text-caption text-quaternary">Sobol sensitivity index</span>}
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
              <span className="text-caption text-quaternary">Deterministic baseline: $3.82M</span>
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
                    const d = row.v - MC.p50;
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
                              {Math.abs((d / MC.p50) * 100).toFixed(0)}%)
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
            title="Stochastic Input Parameters & Distributions"
            action={
              <span className="text-caption text-quaternary">
                Monte Carlo parameter distributions
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
      </PageBody>
    </div>
  );
}
