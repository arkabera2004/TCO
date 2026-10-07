"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, KpiTile, StatusBadge } from "@/components/ui/primitives";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { useSimulationStore } from "@/store/simulationStore";
import { OPERATING_PROFILES, CHART_COLORS } from "@/data/syntheticData";
import { fmtCompact, fmtUSD } from "@/utils/formatters";
import { AppIcon } from "@/components/icons/AppIcon";
import { cn } from "@/lib/utils";

export default function TenderMode() {
  const { result } = useSimulationStore();
  const [customer, setCustomer] = useState("XYZ Rail Freight Ltd");
  const [qty, setQty] = useState(12);
  const [profileId, setProfileId] = useState("heavy-freight");
  const [budget, setBudget] = useState(48000000);

  const unitPrice = 2800000;
  const fleetTco = result.totalTCO * qty;
  const vsBudget = ((budget - fleetTco) / budget) * 100;

  const donut = [
    { name: "Capital", value: result.breakdown.capital, color: CHART_COLORS.blue },
    { name: "Maintenance", value: result.breakdown.maintenance, color: CHART_COLORS.teal },
    { name: "Failures", value: result.breakdown.failures, color: CHART_COLORS.red },
    {
      name: "Other",
      value:
        result.breakdown.consumables + result.breakdown.replacements + result.breakdown.downtime,
      color: CHART_COLORS.purple,
    },
  ].filter((d) => d.value > 0);

  const inputCls =
    "w-full rounded-md border border-muted bg-action px-2.5 py-1.5 text-body-sm text-primary outline-none transition-colors hover:border-default focus-visible:border-default focus-visible:ring-1 focus-visible:ring-active";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Tender Optimization — Commercial Bid Architect"
        description="Configure client requirements, tender volume, target budget, and generate commercial lifecycle guarantees directly from live simulation models."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCustomer("XYZ Rail Freight Ltd");
                setQty(12);
                setProfileId("heavy-freight");
                setBudget(48000000);
              }}
              className="rounded-full border border-muted bg-action px-3 py-1 text-label-sm text-tertiary transition-colors hover:border-default hover:text-primary"
            >
              Reset RFP Preset
            </button>
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label="Fleet TCO Total"
            value={fmtCompact(fleetTco)}
            delta={`${qty} locomotives over 20yr`}
            tone="neutral"
            hint="Full operational contract value"
          />
          <KpiTile
            label="Budget Variance"
            value={`${vsBudget >= 0 ? "-" : "+"}${Math.abs(vsBudget).toFixed(1)}%`}
            delta={vsBudget >= 0 ? "Under customer target" : "Exceeds customer target"}
            tone={vsBudget >= 0 ? "success" : "error"}
            hint={`Target: ${fmtCompact(budget)}`}
          />
          <KpiTile
            label="Unit Price (Acquisition)"
            value={fmtCompact(unitPrice)}
            delta={`Total Capital: ${fmtCompact(unitPrice * qty)}`}
            tone="info"
            hint="ES44AC Evolution Series"
          />
          <KpiTile
            label="Guaranteed Maint Rate"
            value={`$${result.financials.costPerKm.toFixed(2)}/km`}
            delta="Best in class guarantee"
            tone="success"
            hint="SLA availability ≥ 94%"
          />
        </div>

        {/* Requirements Form Panel */}
        <Panel title="Customer RFP & Fleet Specification">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-caption font-medium text-tertiary block mb-1">
                Client Organization
              </label>
              <input
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                placeholder="e.g. Union Pacific"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-caption font-medium text-tertiary block mb-1">
                Locomotives Required (Units)
              </label>
              <input
                type="number"
                value={qty}
                min={1}
                max={100}
                onChange={(e) => setQty(Number(e.target.value) || 1)}
                className={cn(inputCls, "font-mono-data")}
              />
            </div>
            <div>
              <label className="text-caption font-medium text-tertiary block mb-1">
                Operating Duty Profile
              </label>
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className={inputCls}
              >
                {OPERATING_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-caption font-medium text-tertiary block mb-1">
                Target Budget Ceiling ($)
              </label>
              <input
                type="number"
                value={budget}
                step={1000000}
                onChange={(e) => setBudget(Number(e.target.value) || 0)}
                className={cn(inputCls, "font-mono-data")}
              />
            </div>
          </div>
        </Panel>

        {/* Bottom Split: Simulation Breakdown & Proposal Summary */}
        <SplitRow from="xl" ratio="1/1" className="shrink-0">
          <Panel
            title={`Lifecycle Allocation — ${customer}`}
            action={
              <span className="text-caption text-quaternary">Aggregated for {qty} units</span>
            }
          >
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: "Unit TCO", v: fmtCompact(result.totalTCO) },
                  { l: "Fleet 20yr TCO", v: fmtCompact(fleetTco) },
                  { l: "Service $/km", v: `$${result.financials.costPerKm.toFixed(2)}` },
                ].map((k) => (
                  <div
                    key={k.l}
                    className="rounded-md border border-muted bg-container p-2.5 text-center"
                  >
                    <p className="text-caption text-quaternary uppercase">{k.l}</p>
                    <p className="font-mono-data mt-1 text-body-sm font-bold text-primary">{k.v}</p>
                  </div>
                ))}
              </div>

              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donut}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {donut.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div
                className={cn(
                  "rounded-md border p-3 text-caption",
                  vsBudget >= 0
                    ? "border-success/30 bg-success-badge text-success"
                    : "border-error/30 bg-error-badge text-error",
                )}
              >
                {vsBudget >= 0
                  ? `Your proposed fleet TCO is ${vsBudget.toFixed(1)}% below the customer target ceiling.`
                  : `Fleet TCO exceeds target budget by ${Math.abs(vsBudget).toFixed(1)}% — optimize PM frequency or customize extended warranty scope.`}
              </div>
            </div>
          </Panel>

          <Panel
            title="Commercial Proposal Guarantee Summary"
            action={
              <div className="flex items-center gap-1.5">
                <button className="inline-flex items-center gap-1 rounded-full border border-muted bg-action px-2.5 py-1 text-label-sm text-secondary hover:border-default hover:text-primary transition-colors">
                  <AppIcon name="download" size="xs" />
                  <span>PDF Export</span>
                </button>
                <button className="inline-flex items-center gap-1 rounded-full border border-muted bg-action px-2.5 py-1 text-label-sm text-secondary hover:border-default hover:text-primary transition-colors">
                  <AppIcon name="table" size="xs" />
                  <span>Excel Model</span>
                </button>
              </div>
            }
          >
            <div className="font-mono-data space-y-2 text-body-sm">
              {[
                ["Client Name", customer],
                ["Platform Selected", "ES44AC Evolution Series"],
                ["Procurement Quantity", `${qty} units`],
                ["Unit Price (New)", fmtUSD(unitPrice)],
                ["Total Acquisition Capital", fmtUSD(unitPrice * qty)],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between border-b border-muted pb-1.5">
                  <span className="font-sans text-secondary">{l}</span>
                  <span className="font-semibold text-primary">{v}</span>
                </div>
              ))}

              <p className="pt-2 text-caption font-semibold uppercase tracking-wider text-primary">
                Included Warranty &amp; Service Commitments
              </p>
              <div className="flex justify-between border-b border-muted pb-1.5">
                <span className="font-sans text-secondary">Manufacturer Standard Warranty</span>
                <span className="text-primary font-medium">3 years / 720,000 km</span>
              </div>
              <div className="flex justify-between border-b border-muted pb-1.5">
                <span className="font-sans text-secondary">Optional Extended Protection</span>
                <span className="text-secondary">+2 yr coverage ($85k / loco)</span>
              </div>

              <p className="pt-2 text-caption font-semibold uppercase tracking-wider text-primary">
                Performance &amp; Cost Guarantees
              </p>
              <div className="flex justify-between border-b border-muted pb-1.5">
                <span className="font-sans text-secondary">20-Year Fleet TCO Guarantee</span>
                <span className="text-teal font-bold">{fmtCompact(fleetTco)}</span>
              </div>
              <div className="flex justify-between border-b border-muted pb-1.5">
                <span className="font-sans text-secondary">Maintenance Cost / km SLA</span>
                <span className="text-primary font-medium">$0.18 / km</span>
              </div>
              <div className="flex justify-between border-b border-muted pb-1.5">
                <span className="font-sans text-secondary">Fleet Operational Availability</span>
                <span className="text-success font-semibold">≥ 94.0%</span>
              </div>

              <p className="pt-2 text-caption font-semibold uppercase tracking-wider text-primary">
                Competitive Advantage
              </p>
              <div className="flex justify-between">
                <span className="font-sans text-secondary">Projected Savings vs GE Tier 4</span>
                <span className="text-success font-medium">−{fmtCompact(160000 * qty)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-secondary">Projected Savings vs Alstom</span>
                <span className="text-success font-medium">−{fmtCompact(230000 * qty)}</span>
              </div>
            </div>
          </Panel>
        </SplitRow>
      </PageBody>
    </div>
  );
}
