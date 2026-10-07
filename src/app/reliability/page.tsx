"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, KpiTile, StatusBadge, PriorityBadge } from "@/components/ui/primitives";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import {
  COMPONENTS,
  RELIABILITY_CURVE_DATA,
  CHART_COLORS,
  healthColor,
} from "@/data/syntheticData";
import { weibullFailureProb } from "@/utils/simulationEngine";
import { fmtCompact } from "@/utils/formatters";
import { alpha, cn } from "@/lib/utils";

const TABS = [
  "RAMS Dashboard",
  "Remaining Useful Life",
  "Warranty Analytics",
  "Failure Heatmap",
] as const;

export default function ReliabilityPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("RAMS Dashboard");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Reliability & Warranty Analytics"
        description="RAMS dashboard, remaining useful life, warranty analytics and failure heatmaps aligned with EN 50126, ISO 55000, and IEC 60300 frameworks."
        actions={
          <div className="flex items-center gap-1 rounded-full border border-muted bg-container p-1">
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
        {tab === "RAMS Dashboard" && <RamsTab />}
        {tab === "Remaining Useful Life" && <RulTab />}
        {tab === "Warranty Analytics" && <WarrantyTab />}
        {tab === "Failure Heatmap" && <HeatmapTab />}
      </PageBody>
    </div>
  );
}

function RamsTab() {
  return (
    <div className="flex flex-col gap-4">
      {/* 4 Standard KPI Tiles */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
        <KpiTile
          label="Reliability (R)"
          value="87.4%"
          delta="Fleet mean, current age"
          tone="neutral"
          hint="EN 50126 standard"
        />
        <KpiTile
          label="Availability (A)"
          value="94.2%"
          delta="MTBF / (MTBF + MTTR)"
          tone="info"
          hint="Operational availability"
        />
        <KpiTile
          label="Maintainability (M)"
          value="96.1%"
          delta="Completed in planned window"
          tone="success"
          hint="Service efficiency"
        />
        <KpiTile
          label="Safety Integrity"
          value="99.2%"
          delta="Critical failures avoided"
          tone="success"
          hint="Zero catastrophic events"
        />
      </div>

      {/* Chart Panel */}
      <Panel
        title="Weibull Reliability Curves — Fleet vs Competitors"
        action={
          <span className="text-caption text-quaternary">
            Multi-platform comparison (β shape factor & η scale factor)
          </span>
        }
      >
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={RELIABILITY_CURVE_DATA}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="year" stroke={CHART_COLORS.textMuted} fontSize={11} />
              <YAxis stroke={CHART_COLORS.textMuted} fontSize={11} unit="%" domain={[0, 100]} />
              <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              <Line
                type="monotone"
                dataKey="es44ac"
                name="ES44AC (β=2.2, η=88k)"
                stroke={CHART_COLORS.blue}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="flxdrive"
                name="FLXdrive (β=1.8, η=90k)"
                stroke={CHART_COLORS.teal}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="ac4400"
                name="AC4400 (β=2.0, η=70k)"
                stroke={CHART_COLORS.orange}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="ge_t4"
                name="GE T4"
                stroke={CHART_COLORS.red}
                strokeDasharray="5 3"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="siemens"
                name="Siemens"
                stroke={CHART_COLORS.purple}
                strokeDasharray="5 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Component MTBF Table */}
      <Panel
        title="Component MTBF & Health Matrix"
        action={
          <span className="text-caption text-quaternary">
            {COMPONENTS.length} subsystems tracked
          </span>
        }
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-container border-b border-muted">
              <tr>
                {[
                  "Component",
                  "MTBF (hrs)",
                  "MTTR (hrs)",
                  "Service Hours",
                  "RUL (yrs)",
                  "Confidence",
                  "Health Score",
                  "Status",
                ].map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "px-3 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase whitespace-nowrap",
                      i >= 1 && i <= 6 && "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-muted font-mono-data text-body-sm">
              {COMPONENTS.map((c) => {
                const status =
                  c.healthScore >= 80
                    ? { label: "Optimal", tone: "success" as const }
                    : c.healthScore >= 60
                      ? { label: "Fair", tone: "warning" as const }
                      : { label: "Critical", tone: "error" as const };
                return (
                  <tr key={c.id} className="transition-colors hover:bg-hover">
                    <td className="px-3 py-2 font-sans font-medium text-primary">{c.name}</td>
                    <td className="px-3 py-2 text-right text-secondary">
                      {c.mtbfHours.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-secondary">{c.mttrHours}h</td>
                    <td className="px-3 py-2 text-right text-tertiary">
                      {c.currentHours.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-primary">
                      {c.rulYears} yrs
                    </td>
                    <td className="px-3 py-2 text-right text-secondary">{c.rulConfidence}%</td>
                    <td
                      className="px-3 py-2 text-right font-semibold"
                      style={{ color: healthColor(c.healthScore) }}
                    >
                      {c.healthScore}%
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function RulTab() {
  const sorted = [...COMPONENTS].sort((a, b) => a.rulYears - b.rulYears);
  const maxRul = Math.max(...sorted.map((c) => c.rulYears));

  return (
    <Panel
      title="Remaining Useful Life — Ranked by Urgency"
      action={
        <span className="text-caption text-quaternary">
          Predictive maintenance horizon based on current operating wear
        </span>
      }
    >
      <div className="space-y-3">
        {sorted.map((c) => {
          const pct = (c.rulYears / maxRul) * 100;
          const urgent = c.rulYears < 1;
          return (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-lg border border-muted bg-container p-2.5 transition-colors hover:border-default"
            >
              <div className="w-56 shrink-0">
                <span className="text-body-sm font-medium text-primary block truncate">
                  {c.name}
                </span>
                <span className="text-caption text-quaternary font-mono-data">
                  {c.currentHours.toLocaleString()} hrs logged
                </span>
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-hover">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(4, pct)}%`, background: healthColor(pct) }}
                />
              </div>
              <div className="w-24 text-right font-mono-data">
                <span className="text-body-sm font-semibold text-primary block">
                  {c.rulYears} yrs
                </span>
                <span className="text-caption text-quaternary">{c.rulConfidence}% conf</span>
              </div>
              <div className="w-24 shrink-0 text-right">
                {urgent ? (
                  <PriorityBadge priority="critical" />
                ) : c.rulYears < 3 ? (
                  <PriorityBadge priority="high" />
                ) : (
                  <StatusBadge tone="success">HEALTHY</StatusBadge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function WarrantyTab() {
  const YEARS = 10;
  return (
    <div className="flex flex-col gap-4">
      {/* 3 Summary KPI Tiles */}
      <div className="grid gap-3 md:grid-cols-3 shrink-0">
        <KpiTile
          label="Standard Warranty (3yr)"
          value="$420,000"
          delta="Base manufacturer cover"
          tone="neutral"
          hint="Total parts saved"
        />
        <KpiTile
          label="Extended Warranty (5yr)"
          value="$680,000"
          delta="Option premium: $85k"
          tone="info"
          hint="Gross savings potential"
        />
        <KpiTile
          label="Net Financial Benefit"
          value="$595,000"
          delta="+700% ROI on warranty spend"
          tone="success"
          hint="Recommended package"
        />
      </div>

      <Panel
        title="Warranty Coverage Timeline (Years 0–10)"
        action={
          <div className="flex items-center gap-3 text-caption text-tertiary">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm bg-primary" />
              Full Warranty
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm bg-primary/40" />
              Extended Option
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm bg-muted" />
              Owner Cost
            </span>
          </div>
        }
      >
        <div className="space-y-2">
          {COMPONENTS.map((c) => (
            <div key={c.id} className="flex items-center gap-3 text-caption">
              <span className="w-52 shrink-0 truncate font-medium text-secondary">{c.name}</span>
              <div className="flex h-5 flex-1 overflow-hidden rounded border border-muted bg-container">
                {Array.from({ length: YEARS }, (_, y) => {
                  const covered = y < c.warrantyYears;
                  const extended = !covered && y < c.warrantyYears + 2;
                  return (
                    <div
                      key={y}
                      className="flex-1 border-r border-background last:border-r-0 transition-opacity hover:opacity-80"
                      style={{
                        background: covered
                          ? CHART_COLORS.blue
                          : extended
                            ? alpha(CHART_COLORS.blue, 33)
                            : "var(--ref-gray-850)",
                      }}
                      title={
                        covered
                          ? `Year ${y + 1}: Full warranty cover`
                          : extended
                            ? `Year ${y + 1}: Extended option cover`
                            : `Year ${y + 1}: Owner cost on failure (~${fmtCompact(c.replacementCost * 1.3)})`
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function HeatmapTab() {
  const YEARS = 20;
  return (
    <Panel
      title="Failure Probability Heatmap — 1 − R(t) per Year"
      action={
        <div className="flex items-center gap-2 text-caption text-tertiary">
          <span>Low risk</span>
          <div
            className="h-2 w-28 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${alpha(CHART_COLORS.blue, 40)}, ${alpha(CHART_COLORS.yellow, 70)}, ${alpha(CHART_COLORS.red, 90)})`,
            }}
          />
          <span>High risk</span>
          <span className="ml-2 text-quaternary">(Assumes 5,500 hrs/yr)</span>
        </div>
      }
    >
      <div className="space-y-1.5">
        {COMPONENTS.map((c) => (
          <div key={c.id} className="flex items-center gap-3 text-caption">
            <span className="w-52 shrink-0 truncate font-medium text-secondary">{c.name}</span>
            <div className="flex h-6 flex-1 gap-0.5">
              {Array.from({ length: YEARS }, (_, y) => {
                const p = weibullFailureProb((y + 1) * 5500, c.weibullBeta, c.weibullEta);
                const color =
                  p < 0.25
                    ? alpha(CHART_COLORS.blue, (0.15 + p) * 100)
                    : p < 0.6
                      ? alpha(CHART_COLORS.yellow, (0.3 + p * 0.5) * 100)
                      : alpha(CHART_COLORS.red, (0.35 + p * 0.5) * 100);
                return (
                  <div
                    key={y}
                    className="flex-1 rounded-[2px] transition-transform hover:scale-105"
                    style={{ background: color }}
                    title={`Year ${y + 1}: ${(p * 100).toFixed(0)}% probability of failure`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
