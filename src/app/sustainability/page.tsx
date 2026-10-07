"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, KpiTile, StatusBadge } from "@/components/ui/primitives";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { SUSTAINABILITY_DATA, CHART_COLORS } from "@/data/syntheticData";
import { cn } from "@/lib/utils";

const EMISSIONS_TIMELINE = [
  { year: 2020, es44ac: 2930, ac4400: 1980, flxdrive: 0 },
  { year: 2021, es44ac: 2950, ac4400: 1995, flxdrive: 0 },
  { year: 2022, es44ac: 2933, ac4400: 1981, flxdrive: 262 },
  { year: 2023, es44ac: 2910, ac4400: 1960, flxdrive: 262 },
  { year: 2024, es44ac: 2933, ac4400: 1981, flxdrive: 262 },
  { year: 2026, es44ac: 2850, ac4400: 1500, flxdrive: 520 },
  { year: 2028, es44ac: 2700, ac4400: 990, flxdrive: 790 },
  { year: 2030, es44ac: 2550, ac4400: 500, flxdrive: 1050 },
];

const CO2_PER_KM = [
  { name: "FLXdrive (Battery)", v: 233, color: CHART_COLORS.teal },
  { name: "Siemens Vectron", v: 890, color: CHART_COLORS.purple },
  { name: "Alstom Prima", v: 960, color: CHART_COLORS.yellow },
  { name: "Wabtec ES44AC", v: 970, color: CHART_COLORS.blue },
  { name: "AC4400 (Legacy)", v: 1005, color: CHART_COLORS.orange },
  { name: "GE Tier 4", v: 1020, color: CHART_COLORS.red },
];

export default function Sustainability() {
  const rows = [
    {
      model: "FLXdrive (100% BEV)",
      co2: "233 g/km",
      eff: SUSTAINABILITY_DATA.flxdrive.energyEfficiencyScore,
      cost: SUSTAINABILITY_DATA.flxdrive.annualCarbonCost,
      score: SUSTAINABILITY_DATA.flxdrive.sustainabilityScore,
      tone: "success" as const,
    },
    {
      model: "ES44AC (Evolution Series)",
      co2: "970 g/km",
      eff: SUSTAINABILITY_DATA.es44ac.energyEfficiencyScore,
      cost: SUSTAINABILITY_DATA.es44ac.annualCarbonCost,
      score: SUSTAINABILITY_DATA.es44ac.sustainabilityScore,
      tone: "info" as const,
    },
    {
      model: "AC4400 (Legacy Fleet)",
      co2: "1,005 g/km",
      eff: SUSTAINABILITY_DATA.ac4400.energyEfficiencyScore,
      cost: SUSTAINABILITY_DATA.ac4400.annualCarbonCost,
      score: SUSTAINABILITY_DATA.ac4400.sustainabilityScore,
      tone: "warning" as const,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Sustainability & Decarbonization Intelligence"
        description="Fleet carbon trajectory, emissions per ton-km, carbon tax exposure, and ESG compliance aligned with EU Green Deal and EPA Tier 4 standards."
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label="Fleet CO₂ (Annual)"
            value="2,844 tonnes"
            delta="Target: 2,500 tonnes"
            tone="warning"
            hint="Gross annual greenhouse emissions"
          />
          <KpiTile
            label="FLXdrive Abatement"
            value="−192 t CO₂/yr"
            delta="vs diesel equivalent"
            tone="success"
            hint="100% battery-electric locomotive"
          />
          <KpiTile
            label="Annual Carbon Tax"
            value="$136,512"
            delta="@ $48 / tonne rate"
            tone="warning"
            hint="Regulatory compliance exposure"
          />
          <KpiTile
            label="ESG Sustainability Score"
            value="68 / 100"
            delta="EPA Tier 4 / EU Green Deal"
            tone="info"
            hint="Industry fleet benchmark"
          />
        </div>

        {/* Top Split: Trajectory Timeline & Competitor Benchmark */}
        <SplitRow from="xl" ratio="1/1" className="shrink-0">
          <Panel
            title="Fleet Emissions Trajectory & 2030 Roadmap"
            action={
              <span className="text-caption text-quaternary">Trajectory drops 22% by 2030</span>
            }
          >
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={EMISSIONS_TIMELINE}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="year" stroke={CHART_COLORS.textMuted} fontSize={11} />
                  <YAxis stroke={CHART_COLORS.textMuted} fontSize={11} />
                  <Tooltip
                    content={<ChartTooltip formatter={(v) => `${v.toLocaleString()} t`} />}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <ReferenceLine
                    y={2500}
                    stroke={CHART_COLORS.yellow}
                    strokeDasharray="4 4"
                    label={{
                      value: "2030 TARGET: 2,500t",
                      fill: CHART_COLORS.yellow,
                      fontSize: 9,
                      position: "top",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="es44ac"
                    name="ES44AC Fleet"
                    stackId="1"
                    stroke={CHART_COLORS.blue}
                    fill={CHART_COLORS.blue}
                    fillOpacity={0.4}
                  />
                  <Area
                    type="monotone"
                    dataKey="ac4400"
                    name="AC4400 Legacy"
                    stackId="1"
                    stroke={CHART_COLORS.orange}
                    fill={CHART_COLORS.orange}
                    fillOpacity={0.4}
                  />
                  <Area
                    type="monotone"
                    dataKey="flxdrive"
                    name="FLXdrive Battery"
                    stackId="1"
                    stroke={CHART_COLORS.teal}
                    fill={CHART_COLORS.teal}
                    fillOpacity={0.4}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel
            title="CO₂ Emissions per km — Fleet vs Competitor Benchmark"
            action={<span className="text-caption text-quaternary">Normalized grams CO₂ / km</span>}
          >
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={CO2_PER_KM}
                  layout="vertical"
                  margin={{ left: 20, right: 10, top: 10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_COLORS.grid}
                    horizontal={false}
                  />
                  <XAxis type="number" stroke={CHART_COLORS.textMuted} fontSize={10} unit="g" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke={CHART_COLORS.textMuted}
                    fontSize={10}
                    width={120}
                  />
                  <Tooltip content={<ChartTooltip formatter={(v) => `${v} g/km`} />} />
                  <Bar dataKey="v" name="CO₂ Intensity" radius={[0, 4, 4, 0]}>
                    {CO2_PER_KM.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </SplitRow>

        {/* Bottom Split: Sustainability Scoring Table & Calculator */}
        <SplitRow from="xl" ratio="1.4/1" className="shrink-0">
          <Panel
            title="Platform Environmental Scoring Matrix"
            action={
              <span className="text-caption text-quaternary">
                3 active fleet locomotive classes
              </span>
            }
            padded={false}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-container border-b border-muted">
                  <tr>
                    {[
                      "Locomotive Platform",
                      "CO₂ / km",
                      "Fuel Efficiency",
                      "Carbon Tax / yr",
                      "ESG Score",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-3 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase whitespace-nowrap",
                          i >= 1 && i <= 3 && "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted font-mono-data text-body-sm">
                  {rows.map((r) => (
                    <tr key={r.model} className="transition-colors hover:bg-hover">
                      <td className="px-3 py-2.5 font-sans font-medium text-primary">{r.model}</td>
                      <td className="px-3 py-2.5 text-right text-secondary">{r.co2}</td>
                      <td className="px-3 py-2.5 text-right text-secondary">{r.eff} / 100</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-primary">
                        ${r.cost.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-hover">
                            <div
                              className="h-full rounded-full bg-teal"
                              style={{ width: `${r.score}%` }}
                            />
                          </div>
                          <span className="text-caption text-secondary">{r.score}</span>
                          <StatusBadge tone={r.tone}>
                            {r.score >= 80 ? "Superior" : r.score >= 60 ? "Compliant" : "Lagging"}
                          </StatusBadge>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="Fleet Electrification & Transition Economics"
            action={
              <span className="text-caption text-teal font-semibold">RECOMMENDED UPGRADE</span>
            }
          >
            <div className="space-y-3">
              <p className="text-body-sm text-secondary">
                By replacing 4 legacy AC4400 diesel units with zero-emission FLXdrive battery
                locomotives:
              </p>
              <div className="font-mono-data space-y-2 rounded-lg border border-muted bg-container p-3 text-body-sm">
                <div className="flex justify-between">
                  <span className="text-secondary">Direct Fuel Cost Savings:</span>
                  <span className="text-success font-semibold">+$328,000 / yr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Gross CO₂ Abatement:</span>
                  <span className="text-teal font-semibold">780 tonnes / yr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Carbon Tax Avoided:</span>
                  <span className="text-success font-semibold">+$37,440 / yr</span>
                </div>
                <div className="border-t border-muted pt-2 flex justify-between">
                  <span className="text-primary font-medium">10-Year Combined Benefit:</span>
                  <span className="text-success font-bold text-base">+$3.65M</span>
                </div>
              </div>
              <p className="text-caption text-quaternary">
                Payback period: 4.8 years against battery capital premium with 10-year overhaul
                offsets.
              </p>
            </div>
          </Panel>
        </SplitRow>
      </PageBody>
    </div>
  );
}
