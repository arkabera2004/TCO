"use client";

import { useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  ScatterChart,
  Scatter,
} from "recharts";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, KpiTile, StatusBadge } from "@/components/ui/primitives";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { HISTORICAL_TCO, FORECAST_TCO, CHART_COLORS } from "@/data/syntheticData";
import { fmtCompact } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/icons/AppIcon";
import type { IconName } from "@/components/icons/registry";

const METHODS = ["Linear Trend", "Exponential", "Moving Avg"] as const;

interface CategoryMeta {
  key: string;
  label: string;
  icon: IconName;
  conf: number;
}

const CATEGORY_META: CategoryMeta[] = [
  { key: "maintenance", label: "Maintenance", icon: "maintenance", conf: 91 },
  { key: "labor", label: "Labor Costs", icon: "tools", conf: 93 },
  { key: "consumables", label: "Consumables", icon: "fluid", conf: 95 },
  { key: "failures", label: "Unplanned Failures", icon: "warning", conf: 74 },
  { key: "downtime", label: "Out-of-Service Downtime", icon: "clock", conf: 78 },
];

function cagr(a: number, b: number, years: number) {
  return (Math.pow(b / a, 1 / years) - 1) * 100;
}

export default function ForecastingEngine() {
  const [method, setMethod] = useState<(typeof METHODS)[number]>("Linear Trend");
  const [withInflation, setWithInflation] = useState(true);
  const [showCompetitors, setShowCompetitors] = useState(false);

  const methodMult = method === "Exponential" ? 1.05 : method === "Moving Avg" ? 0.97 : 1;
  const infMult = withInflation ? 1 : 0.94;

  const data = [
    ...HISTORICAL_TCO.map((h) => ({
      year: h.year,
      total: h.maintenance + h.consumables + h.labor + h.failures + h.fuel + h.downtime,
      p10: undefined as number | undefined,
      p90: undefined as number | undefined,
      geForecast: undefined as number | undefined,
      siemensForecast: undefined as number | undefined,
    })),
    ...FORECAST_TCO.map((f) => {
      const total =
        (f.maintenance + f.consumables + f.labor + f.failures + f.fuel + f.downtime) *
        methodMult *
        infMult;
      return {
        year: f.year,
        total,
        p10: f.p10 * methodMult * infMult,
        p90: f.p90 * methodMult * infMult,
        geForecast: showCompetitors ? total * 1.07 : undefined,
        siemensForecast: showCompetitors ? total * 1.04 : undefined,
      };
    }),
  ];

  const calibration = [
    { metric: "2023 Total Cost", forecast: 848000, actual: 834000 },
    { metric: "2023 Maintenance", forecast: 162000, actual: 165000 },
    { metric: "2023 Fuel Cost", forecast: 428000, actual: 435000 },
    { metric: "2024 Total Cost", forecast: 821000, actual: 881000 },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Forecasting Engine — Lifecycle Operating Cost"
        description="Statistical lifecycle cost projections with calibrated uncertainty bands, historical backtesting, and multi-model trend estimation."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Method Segmented Group */}
            <div className="flex items-center gap-1 rounded-full border border-muted bg-container p-0.5">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-label-sm font-medium transition-colors",
                    method === m
                      ? "bg-action-selected text-primary shadow-sm"
                      : "text-tertiary hover:bg-action hover:text-secondary",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Inflation Toggle */}
            <button
              onClick={() => setWithInflation((v) => !v)}
              className={cn(
                "rounded-full border px-3 py-1 text-label-sm font-medium transition-colors",
                withInflation
                  ? "border-default bg-action-selected text-primary"
                  : "border-muted bg-container text-tertiary hover:border-default hover:text-secondary",
              )}
            >
              {withInflation ? "Inflation Escalated" : "Real / Constant USD"}
            </button>

            {/* Competitor Toggle */}
            <button
              onClick={() => setShowCompetitors((v) => !v)}
              className={cn(
                "rounded-full border px-3 py-1 text-label-sm font-medium transition-colors",
                showCompetitors
                  ? "border-warning bg-warning-badge text-warning"
                  : "border-muted bg-container text-tertiary hover:border-default hover:text-secondary",
              )}
            >
              Competitor Benchmark
            </button>
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label="Historical Calibration"
            value="94.2%"
            delta="2023-2024 backtested"
            tone="success"
            hint="MAPE error < 5.8%"
          />
          <KpiTile
            label="2025 Projected Run-rate"
            value="$892k"
            delta="+3.2% vs 2024 actual"
            tone="neutral"
            hint="Estimated baseline per loco"
          />
          <KpiTile
            label="5-Year Cost CAGR"
            value="+4.1%"
            delta={withInflation ? "Escalation included" : "Base rate"}
            tone="warning"
            hint="2024 to 2029 projection"
          />
          <KpiTile
            label="Uncertainty Range"
            value="P90 / P10"
            delta="±8.4% variance interval"
            tone="info"
            hint="90% statistical confidence envelope"
          />
        </div>

        {/* Main Historical vs Forecast Chart Panel */}
        <Panel
          title="Historical vs Forecast — Annual Operating Cost Horizon"
          action={
            <div className="flex items-center gap-3 text-caption text-quaternary">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-3 rounded-sm bg-teal" />
                Actual / Projected Mean
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-3 rounded-sm bg-blue/30" />
                90% Confidence Interval
              </span>
            </div>
          }
        >
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis dataKey="year" stroke={CHART_COLORS.textMuted} fontSize={11} />
                <YAxis
                  stroke={CHART_COLORS.textMuted}
                  fontSize={11}
                  tickFormatter={(v: number) => fmtCompact(v)}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <ReferenceLine
                  x={2024.5}
                  stroke={CHART_COLORS.blue}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{ value: "TODAY", fill: CHART_COLORS.blue, fontSize: 10, position: "top" }}
                />
                <Area
                  type="monotone"
                  dataKey="p90"
                  name="90% Confidence (P90)"
                  stroke="none"
                  fill={CHART_COLORS.blue}
                  fillOpacity={0.15}
                />
                <Area
                  type="monotone"
                  dataKey="p10"
                  name="10% Confidence (P10)"
                  legendType="none"
                  stroke="none"
                  fill="var(--ref-black)"
                  fillOpacity={0.5}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total Annual Run-Rate"
                  stroke={CHART_COLORS.teal}
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                {showCompetitors && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="geForecast"
                      name="GE T4 Forecast"
                      stroke={CHART_COLORS.orange}
                      strokeDasharray="5 3"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="siemensForecast"
                      name="Siemens Forecast"
                      stroke={CHART_COLORS.purple}
                      strokeDasharray="5 3"
                      dot={false}
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Bottom Split: Category Forecasts & Model Calibration */}
        <SplitRow from="xl" ratio="1.4/1" className="shrink-0">
          <Panel
            title="Per-Category 5-Year Projections"
            action={
              <span className="text-caption text-quaternary">
                5 operational cost drivers (2024 actual vs 2029 forecast)
              </span>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORY_META.map((c) => {
                const h2024 = HISTORICAL_TCO[4][
                  c.key as keyof (typeof HISTORICAL_TCO)[0]
                ] as number;
                const f2025 = FORECAST_TCO[0][c.key as keyof (typeof FORECAST_TCO)[0]] as number;
                const f2026 = FORECAST_TCO[1][c.key as keyof (typeof FORECAST_TCO)[0]] as number;
                const f2029 = FORECAST_TCO[4][c.key as keyof (typeof FORECAST_TCO)[0]] as number;
                const g = cagr(h2024, f2029, 5);
                return (
                  <div
                    key={c.key}
                    className="flex flex-col justify-between rounded-lg border border-muted bg-container p-3 transition-colors hover:border-default"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-label-sm font-semibold text-primary">
                          <AppIcon name={c.icon} size="xs" className="text-tertiary" />
                          {c.label}
                        </span>
                        <span className="text-caption text-quaternary">{c.conf}% conf</span>
                      </div>
                      <div className="font-mono-data mt-2.5 space-y-1 text-caption">
                        <div className="flex justify-between">
                          <span className="text-tertiary">2024 Actual:</span>
                          <span className="font-medium text-secondary">{fmtCompact(h2024)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-tertiary">2025 Forecast:</span>
                          <span className="font-medium text-primary">{fmtCompact(f2025)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-tertiary">2026 Forecast:</span>
                          <span className="font-medium text-primary">{fmtCompact(f2026)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-muted pt-2 text-caption">
                      <span className="text-quaternary">5-Yr CAGR</span>
                      <span
                        className={cn(
                          "font-mono-data font-semibold",
                          g > 8 ? "text-error" : g > 4 ? "text-warning" : "text-teal",
                        )}
                      >
                        ↑ {g.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="Model Calibration & Backtest Validation"
            action={
              <span className="text-caption text-quaternary">
                Backtested against known fleet data
              </span>
            }
            padded={false}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-container border-b border-muted">
                  <tr>
                    {["Metric", "Model Forecast", "Historical Actual", "Accuracy"].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-3 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase whitespace-nowrap",
                          i >= 1 && "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted font-mono-data text-body-sm">
                  {calibration.map((c) => {
                    const acc = 100 - Math.abs((c.forecast - c.actual) / c.actual) * 100;
                    return (
                      <tr key={c.metric} className="transition-colors hover:bg-hover">
                        <td className="px-3 py-2 font-sans font-medium text-primary">{c.metric}</td>
                        <td className="px-3 py-2 text-right text-secondary">
                          {fmtCompact(c.forecast)}
                        </td>
                        <td className="px-3 py-2 text-right text-secondary">
                          {fmtCompact(c.actual)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <StatusBadge tone={acc > 97 ? "success" : "warning"}>
                            {acc.toFixed(1)}%
                          </StatusBadge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-muted">
              <p className="text-caption font-medium text-tertiary mb-2">
                Residual Scatter vs Actuals
              </p>
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                    <XAxis
                      type="number"
                      dataKey="forecast"
                      name="Forecast"
                      stroke={CHART_COLORS.textMuted}
                      fontSize={9}
                      tickFormatter={(v: number) => fmtCompact(v)}
                      domain={[100000, 900000]}
                    />
                    <YAxis
                      type="number"
                      dataKey="actual"
                      name="Actual"
                      stroke={CHART_COLORS.textMuted}
                      fontSize={9}
                      tickFormatter={(v: number) => fmtCompact(v)}
                      domain={[100000, 900000]}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Scatter data={calibration} fill={CHART_COLORS.teal} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-caption text-quaternary text-center">
                Close clustering along diagonal confirms minimal algorithmic drift
              </p>
            </div>
          </Panel>
        </SplitRow>
      </PageBody>
    </div>
  );
}
