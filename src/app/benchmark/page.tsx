"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, KpiTile, StatusBadge } from "@/components/ui/primitives";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { COMPETITORS, CHART_COLORS } from "@/data/syntheticData";
import { fmtCompact } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/icons/AppIcon";

export default function Benchmark() {
  const ranked = [...COMPETITORS].sort((a, b) => a.tco20yr - b.tco20yr);
  const colors: Record<string, string> = {
    "comp-wabtec": CHART_COLORS.blue,
    "comp-ge": CHART_COLORS.orange,
    "comp-alstom": CHART_COLORS.teal,
    "comp-siemens": CHART_COLORS.purple,
  };

  const radarData = [
    {
      axis: "TCO Score",
      ...Object.fromEntries(
        COMPETITORS.map((c) => [c.name, Math.round(100 * (3820000 / c.tco20yr))]),
      ),
    },
    {
      axis: "Maint Cost",
      ...Object.fromEntries(
        COMPETITORS.map((c) => [c.name, Math.round(100 * (0.17 / c.maintenanceCostPerKm))]),
      ),
    },
    {
      axis: "MTBF",
      ...Object.fromEntries(
        COMPETITORS.map((c) => [c.name, Math.round(100 * (c.mtbfHoursEngine / 90000))]),
      ),
    },
    {
      axis: "PM Interval",
      ...Object.fromEntries(
        COMPETITORS.map((c) => [c.name, Math.round(100 * (c.pmIntervalDays / 200))]),
      ),
    },
    {
      axis: "Warranty",
      ...Object.fromEntries(
        COMPETITORS.map((c) => [c.name, Math.round(100 * (c.warrantyYears / 3))]),
      ),
    },
    {
      axis: "Availability",
      ...Object.fromEntries(COMPETITORS.map((c) => [c.name, Math.round(c.availabilityPct)])),
    },
  ];

  const rows: {
    label: string;
    get: (c: (typeof COMPETITORS)[0]) => string;
    best: (c: (typeof COMPETITORS)[0]) => boolean;
  }[] = [
    {
      label: "Purchase Price",
      get: (c) => fmtCompact(c.purchaseCost),
      best: (c) => c.purchaseCost === Math.min(...COMPETITORS.map((x) => x.purchaseCost)),
    },
    {
      label: "20-Year TCO",
      get: (c) => fmtCompact(c.tco20yr),
      best: (c) => c.tco20yr === Math.min(...COMPETITORS.map((x) => x.tco20yr)),
    },
    {
      label: "Maint Cost / km",
      get: (c) => `$${c.maintenanceCostPerKm.toFixed(2)}`,
      best: (c) =>
        c.maintenanceCostPerKm === Math.min(...COMPETITORS.map((x) => x.maintenanceCostPerKm)),
    },
    {
      label: "PM Cycle Interval",
      get: (c) => `${c.pmIntervalDays} days`,
      best: (c) => c.pmIntervalDays === Math.max(...COMPETITORS.map((x) => x.pmIntervalDays)),
    },
    {
      label: "Standard Warranty",
      get: (c) => `${c.warrantyYears} yrs`,
      best: (c) => c.warrantyYears === Math.max(...COMPETITORS.map((x) => x.warrantyYears)),
    },
    {
      label: "Engine MTBF",
      get: (c) => `${c.mtbfHoursEngine.toLocaleString()} hrs`,
      best: (c) => c.mtbfHoursEngine === Math.max(...COMPETITORS.map((x) => x.mtbfHoursEngine)),
    },
    {
      label: "10-Year Overhaul",
      get: (c) => fmtCompact(c.overhaul10YrCost),
      best: (c) => c.overhaul10YrCost === Math.min(...COMPETITORS.map((x) => x.overhaul10YrCost)),
    },
    {
      label: "Brake Lining Life",
      get: (c) => `${c.brakeLifeYears} yrs`,
      best: (c) => c.brakeLifeYears === Math.max(...COMPETITORS.map((x) => x.brakeLifeYears)),
    },
    {
      label: "Availability Rating",
      get: (c) => `${c.availabilityPct}%`,
      best: (c) => c.availabilityPct === Math.max(...COMPETITORS.map((x) => x.availabilityPct)),
    },
    {
      label: "CO₂ Emission / km",
      get: (c) => `${Math.round(c.co2PerKm * 1000)} g/km`,
      best: (c) => c.co2PerKm === Math.min(...COMPETITORS.map((x) => x.co2PerKm)),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Benchmark Arena — Competitive OEM Intelligence"
        description="Head-to-head lifecycle economics and technical comparison across major freight locomotive platforms: Wabtec, GE, Alstom, and Siemens."
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label="Wabtec Fleet Rank"
            value="#1 Lowest TCO"
            delta="$3.82M vs $4.10M peer avg"
            tone="success"
            hint="Lowest total lifecycle expenditure"
          />
          <KpiTile
            label="Fleet Advantage (12 units)"
            value="-$1.92M"
            delta="Cumulative savings vs GE"
            tone="success"
            hint="Over 20-year horizon"
          />
          <KpiTile
            label="Availability Differential"
            value="+2.8%"
            delta="94.2% vs 91.4% peer mean"
            tone="info"
            hint="Operational availability score"
          />
          <KpiTile
            label="Maintenance $/km"
            value="$0.17/km"
            delta="-$0.04/km lower than peer avg"
            tone="neutral"
            hint="Consumables & PM labor combined"
          />
        </div>

        {/* OEM Leaderboard Panel */}
        <Panel
          title="OEM Lifecycle TCO Leaderboard"
          action={
            <span className="text-caption text-quaternary">Ranked by 20-Year Cumulative Cost</span>
          }
        >
          <div className="space-y-2.5">
            {ranked.map((c, i) => (
              <div
                key={c.id}
                className={cn(
                  "flex items-center gap-4 rounded-lg border p-3 transition-colors",
                  c.isOwn
                    ? "border-default bg-action-selected shadow-sm"
                    : "border-muted bg-container hover:border-default hover:bg-hover",
                )}
              >
                <span className="font-mono-data w-6 text-center text-body-sm font-bold text-quaternary">
                  0{i + 1}
                </span>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: colors[c.id] }}
                  />
                  <span className="text-body-sm font-semibold text-primary truncate">{c.name}</span>
                  {c.isOwn && <StatusBadge tone="success">Active Baseline</StatusBadge>}
                  {i === 0 && <StatusBadge tone="info">Lowest TCO</StatusBadge>}
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p
                      className="font-mono-data text-body-sm font-bold"
                      style={{ color: colors[c.id] }}
                    >
                      {fmtCompact(c.tco20yr)}
                    </p>
                    <p className="text-caption text-quaternary">20-yr total</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="font-mono-data text-body-sm font-semibold text-secondary">
                      {c.availabilityPct}%
                    </p>
                    <p className="text-caption text-quaternary">Availability</p>
                  </div>
                  <div className="text-right hidden md:block">
                    <p className="font-mono-data text-body-sm font-medium text-tertiary">
                      ${c.maintenanceCostPerKm.toFixed(2)}
                    </p>
                    <p className="text-caption text-quaternary">Maint / km</p>
                  </div>
                  <div className="flex items-center gap-0.5 text-warning text-xs">
                    {Array.from({ length: 5 }, (_, starIndex) => (
                      <AppIcon
                        key={starIndex}
                        name="star"
                        size="xs"
                        className={
                          starIndex < Math.round(c.reliabilityAt10yr / 20)
                            ? "text-warning"
                            : "text-muted opacity-30"
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Bottom Split: Six-Axis Radar & Comparison Table */}
        <SplitRow from="xl" ratio="1/1" className="shrink-0">
          <Panel
            title="Six-Axis Competitive Radar"
            action={
              <span className="text-caption text-quaternary">
                Normalized score across 6 key metrics
              </span>
            }
          >
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke={CHART_COLORS.grid} />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fontSize: 10, fill: CHART_COLORS.textSecondary }}
                  />
                  <Tooltip content={<ChartTooltip formatter={(v) => `${v}`} />} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 5 }} />
                  {COMPETITORS.map((c) => (
                    <Radar
                      key={c.id}
                      name={c.name}
                      dataKey={c.name}
                      stroke={colors[c.id]}
                      fill={colors[c.id]}
                      fillOpacity={0.12}
                      strokeWidth={c.isOwn ? 2.5 : 1.5}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel
            title="Comprehensive Specification Matrix"
            action={<span className="text-caption text-quaternary">★ marks top performer</span>}
            padded={false}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-container border-b border-muted">
                  <tr>
                    <th className="px-3 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase">
                      Metric / Property
                    </th>
                    {COMPETITORS.map((c) => (
                      <th
                        key={c.id}
                        className="px-3 py-2 text-right text-caption font-semibold uppercase tracking-[0.08em]"
                        style={{ color: colors[c.id] }}
                      >
                        {c.name.split(" ")[0]}
                        {c.isOwn ? " (Wabtec)" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted font-mono-data text-body-sm">
                  {rows.map((r) => (
                    <tr key={r.label} className="transition-colors hover:bg-hover">
                      <td className="px-3 py-2 font-sans font-medium text-secondary">{r.label}</td>
                      {COMPETITORS.map((c) => {
                        const isBest = r.best(c);
                        return (
                          <td
                            key={c.id}
                            className={cn(
                              "px-3 py-2 text-right",
                              isBest ? "font-bold text-teal" : "text-tertiary",
                            )}
                          >
                            {r.get(c)}
                            {isBest ? " ★" : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-muted bg-container/30">
              <p className="text-caption text-secondary">
                <span className="font-semibold text-teal">Lifecycle Savings:</span> Over 20 years
                with 12 locomotives, Wabtec saves{" "}
                <span className="font-mono-data font-bold text-teal">$1.92M</span> in total
                lifecycle cost compared to the closest competitor.
              </p>
            </div>
          </Panel>
        </SplitRow>
      </PageBody>
    </div>
  );
}
