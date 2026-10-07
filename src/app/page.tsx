"use client";

import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import Link from "next/link";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, KpiTile, StatusBadge } from "@/components/ui/primitives";
import { DataTable, FilterChips, type Column } from "@/components/ui/data-table";
import { HealthRing } from "@/components/shared/HealthRing";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { HISTORICAL_TCO, FORECAST_TCO, LOCOMOTIVES, CHART_COLORS } from "@/data/syntheticData";
import { usePartsStore } from "@/store/partsStore";
import { useSimulationStore, formatHorizon } from "@/store/simulationStore";
import { fleetTCO } from "@/utils/tcoEngine";
import { fmtCompact } from "@/utils/formatters";
import { AppIcon } from "@/components/icons/AppIcon";

const INFLATION_FACTOR = 1.032;

interface PartRowItem {
  part: {
    id: string;
    name: string;
    maintIntervalValue: number;
    maintIntervalUnit: string;
    maintQty: number;
    uom: string;
    warrantyYears: number;
    warrantyKm: number;
    failureProbabilityPct: number;
  };
  totalCost: number;
  eventCount: number;
  buffer: number;
  customerCost: number;
  companyCost: number;
}

export default function Dashboard() {
  const [withInflation, setWithInflation] = useState(true);
  const { params, horizonUnit } = useSimulationStore();
  const horizon = params.N;
  const { parts, laborPct } = usePartsStore();

  const horizonLabel = (h: number) => formatHorizon(h, horizonUnit);

  const roll = useMemo(() => fleetTCO(parts, horizon, laborPct), [parts, horizon, laborPct]);

  const partRows = useMemo(() => [...roll.rows].sort((a, b) => b.totalCost - a.totalCost), [roll]);

  const timeline = useMemo(() => {
    const all = [
      ...HISTORICAL_TCO.map((h) => ({
        year: h.year,
        maintenance: h.maintenance,
        labor: h.labor,
        consumables: h.consumables,
        failures: h.failures,
        downtime: h.downtime,
        forecast: false,
      })),
      ...FORECAST_TCO.map((f, i) => {
        const mult = withInflation ? Math.pow(INFLATION_FACTOR, i + 1) : 1;
        return {
          year: f.year,
          maintenance: f.maintenance * mult,
          labor: f.labor * mult,
          consumables: f.consumables * mult,
          failures: f.failures * mult,
          downtime: f.downtime * mult,
          p10: f.p10 * mult,
          p90: f.p90 * mult,
          forecast: true,
        };
      }),
    ];
    const lastHistorical = HISTORICAL_TCO[HISTORICAL_TCO.length - 1].year;
    return all.filter((d) => d.year <= lastHistorical + horizon);
  }, [withInflation, horizon]);

  const partColumns: Column<PartRowItem>[] = [
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
        <div className="font-mono-data tabular text-primary">
          {fmtCompact(r.totalCost)}
          <span className="text-quaternary ml-1 text-caption">({r.eventCount}×)</span>
        </div>
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
          <span className="bg-raised-2 h-1.5 w-14 overflow-hidden rounded-full">
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Command Center"
        description="Fleet-wide lifecycle cost intelligence, forecast accuracy and availability across planning horizons."
        actions={
          <div className="flex items-center gap-2">
            <FilterChips
              value={withInflation ? "with" : "without"}
              onChange={(val) => setWithInflation(val === "with")}
              options={[
                { id: "with", label: "With Inflation (3.2%)" },
                { id: "without", label: "Nominal Baseline" },
              ]}
            />
            <Link
              href="/simulation"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-muted bg-action px-3 text-label-sm text-secondary transition-colors hover:border-default hover:bg-raised-2 hover:text-primary"
            >
              <span>Playground</span>
              <AppIcon name="arrowRight" size="xs" />
            </Link>
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Summary Tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label={`Customer TCO (${horizonLabel(horizon)})`}
            value={`$${(roll.customerTCO / 1e6).toFixed(2)}M`}
            delta="-2.1%"
            tone="success"
            hint="Warranty-covered excluded"
          />
          <KpiTile
            label="Organization TCO"
            value={`$${(roll.organizationTCO / 1e6).toFixed(2)}M`}
            delta="+1.4%"
            tone="info"
            hint="Warranty replacement + reserve"
          />
          <KpiTile
            label="Company Buffer"
            value={`$${(roll.buffer / 1e3).toFixed(1)}k`}
            delta={`Across ${parts.length} parts`}
            tone="warning"
            hint="Reserve variance pool"
          />
          <KpiTile
            label="Fleet Availability"
            value="93.6%"
            delta="-1.4%"
            tone="error"
            hint="Target threshold: 95.0%"
          />
        </div>

        {/* Charts and Fleet Status Split Row */}
        <SplitRow from="xl" ratio="1.6/1" className="min-h-[380px] shrink-0">
          {/* Historical + Forecast Cost Timeline */}
          <Panel
            title="Historical + Forecast Cost Timeline"
            action={
              <span className="text-caption text-quaternary font-mono-data tabular">
                {horizonLabel(horizon)} horizon · P10-P90 band
              </span>
            }
          >
            <div className="h-[300px] w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={timeline}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="year" stroke={CHART_COLORS.textMuted} fontSize={11} />
                  <YAxis
                    stroke={CHART_COLORS.textMuted}
                    fontSize={11}
                    tickFormatter={(v: number) => fmtCompact(v)}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  <ReferenceLine
                    x={2024.5}
                    stroke={CHART_COLORS.blue}
                    strokeDasharray="4 4"
                    label={{
                      value: "FORECAST →",
                      fill: CHART_COLORS.blue,
                      fontSize: 10,
                      position: "top",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="p90"
                    name="P90 band"
                    stroke="none"
                    fill={CHART_COLORS.blue}
                    fillOpacity={0.08}
                  />
                  <Area
                    type="monotone"
                    dataKey="p10"
                    name="P10 band"
                    stroke="none"
                    fill={CHART_COLORS.page}
                    fillOpacity={0.4}
                  />
                  <Bar
                    dataKey="maintenance"
                    name="Maintenance"
                    stackId="a"
                    fill={CHART_COLORS.teal}
                  />
                  <Bar dataKey="labor" name="Labor" stackId="a" fill={CHART_COLORS.purple} />
                  <Bar
                    dataKey="consumables"
                    name="Consumables"
                    stackId="a"
                    fill={CHART_COLORS.yellow}
                  />
                  <Bar dataKey="failures" name="Failures" stackId="a" fill={CHART_COLORS.red} />
                  <Bar dataKey="downtime" name="Downtime" stackId="a" fill={CHART_COLORS.orange} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Fleet Status & Health */}
          <Panel
            title="Fleet Status & Health"
            action={
              <Link
                href="/asset-health"
                className="text-caption text-tertiary hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-[0.08em]"
              >
                Inspect All <AppIcon name="arrowRight" size="xs" />
              </Link>
            }
            padded={false}
          >
            <div className="flex flex-col divide-y divide-muted overflow-y-auto">
              {LOCOMOTIVES.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3.5 p-3.5 transition-colors hover:bg-raised"
                >
                  <HealthRing score={l.currentHealthScore} size={54} stroke={5} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-body-md text-primary truncate">{l.model}</p>
                    <p className="text-caption text-tertiary tabular-nums">
                      {l.type} · {l.fleetCount} units · {l.availabilityPct}% availability
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge tone={l.status === "Active" ? "success" : "warning"}>
                        {l.status === "Active" ? "Active" : "Maintenance"}
                      </StatusBadge>
                      <span className="text-caption text-quaternary font-mono-data tabular">
                        Score: {l.currentHealthScore}/100
                      </span>
                    </div>
                  </div>
                  <Link
                    href={l.status === "Active" ? "/simulation" : "/asset-health"}
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-muted bg-action px-2.5 text-caption text-secondary hover:border-default hover:bg-raised-2 hover:text-primary transition-colors shrink-0"
                  >
                    <span>{l.status === "Active" ? "Simulate" : "Health"}</span>
                    <AppIcon name="arrowRight" size="xs" />
                  </Link>
                </div>
              ))}
            </div>
          </Panel>
        </SplitRow>

        {/* Part-Level Cost Breakdown Table with Chronos-standard DataTable */}
        <Panel
          title={`Part-Level Cost Breakdown — ${horizonLabel(horizon)}`}
          action={
            <div className="flex items-center gap-3">
              <span className="font-mono-data text-caption text-quaternary tabular flex gap-3">
                <span>
                  Customer: <strong className="text-warning">{fmtCompact(roll.customerTCO)}</strong>
                </span>
                <span>
                  Company: <strong className="text-info">{fmtCompact(roll.organizationTCO)}</strong>
                </span>
              </span>
              <Link
                href="/bom"
                className="text-caption text-tertiary hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-[0.08em]"
              >
                BOM Explorer <AppIcon name="arrowRight" size="xs" />
              </Link>
            </div>
          }
          padded={false}
          className="min-h-[420px]"
        >
          <DataTable
            rows={partRows}
            columns={partColumns}
            rowKey={(r) => r.part.id}
            searchPlaceholder="Filter parts, intervals or systems..."
            exportName="command-center-parts"
            pageSize={10}
            defaultSort={{ key: "totalCost", dir: "desc" }}
          />
        </Panel>
      </PageBody>
    </div>
  );
}
