"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, KpiTile, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { FilterChips } from "@/components/ui/data-table";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { COMPONENTS, CHART_COLORS } from "@/data/syntheticData";
import type { Part } from "@/data/bomData";
import { usePartsStore } from "@/store/partsStore";
import {
  maintenanceEvents,
  partTCO,
  formatInterval,
  partIntervalYears,
  DEFAULT_DUTY,
  type MaintenanceEvent,
} from "@/utils/tcoEngine";
import { fmtCompact, fmtUSD } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/icons/AppIcon";
import { useLocomotives } from "@/hooks/use-locomotives";
import {
  listMaintenanceSchedules,
  listCostRecords,
  createMaintenanceSchedule,
  updateMaintenanceSchedule,
  deleteMaintenanceSchedule,
  type BackendMaintenanceSchedule,
  type BackendCostRecord,
  type MaintenanceScheduleInput,
  type MaintenanceScheduleType,
} from "@/lib/api/costs";
import { ApiError } from "@/lib/api/client";
import { getSession } from "@/lib/api/session";

function fmtKm(km: number): string {
  return km >= 1e6 ? `${(km / 1e6).toFixed(2)}M km` : `${(km / 1000).toFixed(0)}k km`;
}

type WarrantyStatus = "covered" | "partial" | "expired";

interface VisitLine {
  part: Part;
  occurrences: number;
  qty: number;
  partsCost: number;
  laborCost: number;
  totalCost: number;
  warrantyCovered: number;
  status: WarrantyStatus;
}

interface ServiceVisit {
  label: string;
  atYear: number;
  atKm: number;
  lines: VisitLine[];
  partsCost: number;
  laborCost: number;
  totalCost: number;
  warrantyCovered: number;
  customerCost: number;
}

function buildVisits(parts: Part[], horizon: number, laborPct: number): ServiceVisit[] {
  const buckets = new Map<number, Map<string, { part: Part; events: MaintenanceEvent[] }>>();

  for (const part of parts) {
    for (const event of maintenanceEvents(part, horizon, laborPct)) {
      const key = Math.max(0.5, Math.round(event.atYear * 2) / 2);
      const byPart = buckets.get(key) ?? new Map();
      const entry = byPart.get(part.id) ?? { part, events: [] };
      entry.events.push(event);
      byPart.set(part.id, entry);
      buckets.set(key, byPart);
    }
  }

  const sortedKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

  return sortedKeys.map((atYear, index) => {
    const byPart = buckets.get(atYear)!;
    const lines: VisitLine[] = [];

    let visitParts = 0;
    let visitLabor = 0;
    let visitTotal = 0;
    let visitWarranty = 0;
    let visitCustomer = 0;

    for (const { part, events } of byPart.values()) {
      const occurrences = events.length;
      const qty = part.maintQty * occurrences;
      const partsCost = events.reduce((s, e) => s + e.partsCost, 0);
      const laborCost = events.reduce((s, e) => s + e.laborCost, 0);
      const totalCost = events.reduce((s, e) => s + e.totalCost, 0);

      const warrantyCovered = events.reduce((s, e) => s + (e.underWarranty ? e.totalCost : 0), 0);

      const coveredCount = events.filter((e) => e.underWarranty).length;
      const status: WarrantyStatus =
        coveredCount === occurrences ? "covered" : coveredCount > 0 ? "partial" : "expired";

      visitParts += partsCost;
      visitLabor += laborCost;
      visitTotal += totalCost;
      visitWarranty += warrantyCovered;
      visitCustomer += totalCost - warrantyCovered;

      lines.push({
        part,
        occurrences,
        qty,
        partsCost,
        laborCost,
        totalCost,
        warrantyCovered,
        status,
      });
    }

    lines.sort((a, b) => b.totalCost - a.totalCost);

    return {
      label: `Service Visit ${index + 1}`,
      atYear,
      atKm: atYear * DEFAULT_DUTY.annualKm,
      lines,
      partsCost: visitParts,
      laborCost: visitLabor,
      totalCost: visitTotal,
      warrantyCovered: visitWarranty,
      customerCost: visitCustomer,
    };
  });
}

export default function MaintenancePage() {
  const { parts, laborPct } = usePartsStore();
  const [range, setRange] = useState(20);
  const [componentId, setComponentId] = useState<string>("all");
  const [openVisit, setOpenVisit] = useState<number>(0);

  const scoped = useMemo(
    () => (componentId === "all" ? parts : parts.filter((p) => p.componentId === componentId)),
    [parts, componentId],
  );

  const visits = useMemo(() => buildVisits(scoped, range, laborPct), [scoped, range, laborPct]);

  const costPerYear = useMemo(() => {
    const customer = new Map<number, number>();
    const company = new Map<number, number>();
    for (const v of visits) {
      const y = Math.max(1, Math.ceil(v.atYear));
      customer.set(y, (customer.get(y) ?? 0) + v.customerCost);
      company.set(y, (company.get(y) ?? 0) + v.warrantyCovered);
    }
    return Array.from({ length: range }, (_, i) => ({
      year: i + 1,
      customer: customer.get(i + 1) ?? 0,
      company: company.get(i + 1) ?? 0,
    }));
  }, [visits, range]);

  const drivers = useMemo(
    () =>
      scoped
        .map((p) => ({ part: p, tco: partTCO(p, range, laborPct) }))
        .filter((d) => d.tco.eventCount > 0)
        .sort((a, b) => b.tco.totalCost - a.tco.totalCost)
        .slice(0, 12),
    [scoped, range, laborPct],
  );

  const totals = visits.reduce(
    (acc, v) => ({
      total: acc.total + v.totalCost,
      warranty: acc.warranty + v.warrantyCovered,
      customer: acc.customer + v.customerCost,
      labor: acc.labor + v.laborCost,
    }),
    { total: 0, warranty: 0, customer: 0, labor: 0 },
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Maintenance Schedule & Rule Engine"
        description="Depot-level service events and visit intervals showing parts replaced, labor charges, and warranty-covered vs customer costs. (Reference data below — real persisted schedules and cost records are managed in the Live Maintenance panel.)"
        actions={
          <div className="flex items-center gap-2">
            <FilterChips
              value={String(range)}
              onChange={(v) => {
                setRange(Number(v));
                setOpenVisit(0);
              }}
              options={[
                { id: "5", label: "5 yr" },
                { id: "10", label: "10 yr" },
                { id: "20", label: "20 yr" },
                { id: "30", label: "30 yr" },
              ]}
            />
            <select
              value={componentId}
              onChange={(e) => {
                setComponentId(e.target.value);
                setOpenVisit(0);
              }}
              className="h-8 rounded-full border border-muted bg-action px-3 text-label-sm text-secondary outline-none transition-colors hover:border-default focus-visible:ring-1 focus-visible:ring-active"
            >
              <option value="all">All Components ({parts.length} parts)</option>
              {COMPONENTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({parts.filter((p) => p.componentId === c.id).length})
                </option>
              ))}
            </select>
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label={`Total Maintenance (${range}yr)`}
            value={fmtCompact(totals.total)}
            delta={`${visits.length} service visits`}
            tone="neutral"
            hint="Full lifecycle cycle sum"
          />
          <KpiTile
            label="Labour Surcharge"
            value={fmtCompact(totals.labor)}
            delta={`Rate @ ${laborPct}% of parts`}
            tone="info"
            hint="Depot technician allocation"
          />
          <KpiTile
            label="Warranty Covered"
            value={fmtCompact(totals.warranty)}
            delta="OEM liability"
            tone="success"
            hint="Covered under standard warranty"
          />
          <KpiTile
            label="Customer Responsibility"
            value={fmtCompact(totals.customer)}
            delta="Owner payment"
            tone="warning"
            hint="Post-warranty cycle expense"
          />
        </div>

        {/* Service Events Accordion / Table */}
        <Panel
          title="Service Events & Visit Schedule"
          action={
            <div className="flex items-center gap-3 text-caption text-quaternary">
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-info" />
                Under warranty (Company)
              </span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-warning" />
                Expired (Customer)
              </span>
            </div>
          }
          className="shrink-0"
        >
          <div className="space-y-2">
            {visits.slice(0, 24).map((v, i) => (
              <div
                key={v.label}
                className="overflow-hidden rounded-lg border border-muted bg-container transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenVisit(openVisit === i ? -1 : i)}
                  className={cn(
                    "flex w-full flex-wrap items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-raised outline-none focus-visible:bg-raised",
                    openVisit === i && "bg-raised border-b border-muted",
                  )}
                >
                  <span className="font-display w-36 shrink-0 text-body-sm font-semibold text-primary">
                    {v.label}
                  </span>
                  <span className="font-mono-data w-36 shrink-0 text-caption text-quaternary tabular">
                    Yr {v.atYear.toFixed(1)} · {fmtKm(v.atKm)}
                  </span>
                  <span className="text-caption text-secondary">
                    {v.lines.length} parts replaced
                  </span>
                  <div className="ml-auto flex items-center gap-3 text-body-sm">
                    <span className="font-mono-data text-quaternary text-caption tabular">
                      parts {fmtCompact(v.partsCost)}
                    </span>
                    <span className="font-mono-data text-secondary text-caption tabular">
                      labour {fmtCompact(v.laborCost)}
                    </span>
                    {v.warrantyCovered > 0 && (
                      <span className="font-mono-data rounded-full bg-info-badge px-2 py-0.5 text-caption font-medium text-badge">
                        warranty {fmtCompact(v.warrantyCovered)}
                      </span>
                    )}
                    <span className="font-mono-data font-bold tabular text-primary">
                      {fmtCompact(v.totalCost)}
                    </span>
                  </div>
                </button>

                {openVisit === i && (
                  <div className="overflow-x-auto bg-container p-2">
                    <table className="w-max min-w-full text-left text-body-sm">
                      <thead>
                        <tr className="border-b border-muted text-caption font-medium tracking-[0.08em] uppercase text-quaternary">
                          {[
                            "Part",
                            "Interval",
                            "Qty",
                            "Unit",
                            "Price",
                            "Parts cost",
                            "Labour",
                            "Total",
                            "Warranty",
                          ].map((h) => (
                            <th key={h} className="px-3 py-1.5 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {v.lines.map((l) => (
                          <tr
                            key={l.part.id}
                            className="border-b border-muted last:border-b-0 hover:bg-raised transition-colors"
                          >
                            <td className="px-3 py-2">
                              <span
                                className="block max-w-[220px] truncate font-medium text-primary"
                                title={l.part.name}
                              >
                                {l.part.name}
                                {l.occurrences > 1 && (
                                  <span className="ml-1.5 rounded bg-raised-2 px-1 text-caption text-secondary">
                                    ×{l.occurrences} due
                                  </span>
                                )}
                              </span>
                              <span className="text-caption text-quaternary">
                                {COMPONENTS.find((c) => c.id === l.part.componentId)?.name ?? "—"}
                              </span>
                            </td>
                            <td className="font-mono-data px-3 py-2 text-secondary tabular text-caption">
                              {formatInterval(l.part)}
                            </td>
                            <td className="font-mono-data px-3 py-2 text-primary tabular text-caption">
                              {l.qty}
                            </td>
                            <td className="px-3 py-2 text-secondary text-caption">{l.part.uom}</td>
                            <td className="font-mono-data px-3 py-2 text-secondary tabular text-caption">
                              {fmtUSD(l.part.unitPriceNew)}
                            </td>
                            <td className="font-mono-data px-3 py-2 text-secondary tabular text-caption">
                              {fmtUSD(l.partsCost)}
                            </td>
                            <td className="font-mono-data px-3 py-2 text-secondary tabular text-caption">
                              {fmtUSD(l.laborCost)}
                            </td>
                            <td className="font-mono-data px-3 py-2 font-semibold text-primary tabular text-caption">
                              {fmtUSD(l.totalCost)}
                            </td>
                            <td className="px-3 py-2 text-caption">
                              {l.status === "covered" && (
                                <StatusBadge tone="info">
                                  Covered ({l.part.warrantyYears}yr)
                                </StatusBadge>
                              )}
                              {l.status === "partial" && (
                                <StatusBadge tone="warning">Partly covered</StatusBadge>
                              )}
                              {l.status === "expired" && (
                                <StatusBadge tone="neutral">Expired</StatusBadge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
            {visits.length === 0 && (
              <EmptyState
                title="No maintenance visits due"
                detail={`No maintenance falls inside a ${range}-year horizon for this component selection.`}
              />
            )}
          </div>
          {visits.length > 24 && (
            <p className="mt-2 text-caption text-quaternary">
              Showing first 24 of {visits.length} scheduled visits. Narrow horizon to isolate
              specific events.
            </p>
          )}
        </Panel>

        {/* Cost Calendar and Drivers Split Row */}
        <SplitRow from="xl" ratio="1/1" className="min-h-[340px] shrink-0">
          <Panel title="Cost Calendar — Customer vs Company Split">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costPerYear} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis
                    dataKey="year"
                    stroke={CHART_COLORS.textMuted}
                    fontSize={10}
                    tickFormatter={(v) => `Y${v}`}
                  />
                  <YAxis
                    stroke={CHART_COLORS.textMuted}
                    fontSize={10}
                    tickFormatter={(v: number) => fmtCompact(v)}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                  <Bar
                    dataKey="company"
                    name="Company (Warranty)"
                    stackId="a"
                    fill={CHART_COLORS.blue}
                  />
                  <Bar
                    dataKey="customer"
                    name="Customer Responsibility"
                    stackId="a"
                    fill={CHART_COLORS.orange}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title={`Maintenance Drivers — Top Cost Parts (${range}yr)`}>
            <div className="space-y-2 overflow-y-auto max-h-[260px] pr-1">
              {drivers.map(({ part, tco }) => {
                const max = drivers[0].tco.totalCost;
                const every = partIntervalYears(part);
                return (
                  <div
                    key={part.id}
                    className="rounded-lg border border-muted bg-container p-2.5 transition-colors hover:bg-raised"
                  >
                    <div className="flex items-center gap-2 text-body-sm">
                      <span className="flex-1 truncate font-medium text-primary" title={part.name}>
                        {part.name}
                      </span>
                      <span className="font-mono-data text-caption text-quaternary">
                        every {every < 1 ? `${(every * 12).toFixed(0)}mo` : `${every.toFixed(1)}y`}{" "}
                        · {tco.eventCount}×
                      </span>
                      <span className="font-mono-data w-16 text-right tabular text-primary font-semibold">
                        {fmtCompact(tco.totalCost)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-raised-2">
                      <div
                        className="h-full bg-info"
                        style={{ width: `${(tco.warrantyCoveredCost / max) * 100}%` }}
                        title={`Warranty: ${fmtCompact(tco.warrantyCoveredCost)}`}
                      />
                      <div
                        className="h-full bg-warning"
                        style={{ width: `${(tco.customerCost / max) * 100}%` }}
                        title={`Customer: ${fmtCompact(tco.customerCost)}`}
                      />
                    </div>
                  </div>
                );
              })}
              {drivers.length === 0 && <EmptyState title="No parts due in this horizon" />}
            </div>
          </Panel>
        </SplitRow>

        <LiveMaintenancePanel />
      </PageBody>
    </div>
  );
}

/* ────────────────────────── LIVE MAINTENANCE (real backend) ────────────────────────── */

const liveInputCls =
  "w-full rounded-md border border-muted bg-action px-2.5 py-1.5 text-body-sm text-primary outline-none placeholder:text-quaternary focus-visible:border-default focus-visible:ring-1 focus-visible:ring-active";

const EMPTY_SCHEDULE_INPUT: MaintenanceScheduleInput = {
  name: "",
  rule: "Whichever first",
  laborHours: 8,
  laborRatePerHour: 95,
  partsEstimate: 1000,
  type: "PREVENTIVE",
};

function LiveMaintenancePanel() {
  const locomotives = useLocomotives();
  const [locoId, setLocoId] = useState<string | null>(null);
  const activeLocoId =
    locoId ?? (locomotives.status === "success" ? (locomotives.data[0]?.id ?? null) : null);

  const [schedules, setSchedules] = useState<BackendMaintenanceSchedule[] | null>(null);
  const [costRecords, setCostRecords] = useState<BackendCostRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BackendMaintenanceSchedule | null>(null);

  const canWrite = getSession()?.role === "ADMIN" || getSession()?.role === "MANAGER";
  const canDelete = getSession()?.role === "ADMIN";

  const load = (id: string) => {
    setError(null);
    Promise.all([listMaintenanceSchedules(id), listCostRecords(id)])
      .then(([s, c]) => {
        setSchedules(s);
        setCostRecords(c);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load maintenance data."),
      );
  };

  useEffect(() => {
    if (activeLocoId) load(activeLocoId);
  }, [activeLocoId]);

  const removeSchedule = async (id: string) => {
    try {
      await deleteMaintenanceSchedule(id);
      if (activeLocoId) load(activeLocoId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete schedule.");
    }
  };

  if (locomotives.status === "loading") {
    return (
      <Panel title="Live Maintenance & Cost Ledger">
        <p className="p-4 text-body-sm text-tertiary">Loading fleet…</p>
      </Panel>
    );
  }
  if (locomotives.status === "error") {
    return (
      <Panel title="Live Maintenance & Cost Ledger">
        <EmptyState title="Couldn't load the fleet" detail={locomotives.error} />
      </Panel>
    );
  }
  if (locomotives.data.length === 0) {
    return (
      <Panel title="Live Maintenance & Cost Ledger">
        <EmptyState title="No locomotives yet" detail="Add a locomotive to manage its schedules." />
      </Panel>
    );
  }

  return (
    <Panel
      title="Live Maintenance & Cost Ledger"
      action={
        <div className="flex items-center gap-2">
          <select
            value={activeLocoId ?? ""}
            onChange={(e) => setLocoId(e.target.value)}
            className={cn(liveInputCls, "w-48")}
          >
            {locomotives.data.map((l) => (
              <option key={l.id} value={l.id}>
                {l.model}
              </option>
            ))}
          </select>
          {canWrite && (
            <button
              onClick={() => {
                setEditing(null);
                setShowForm((v) => !v);
              }}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-muted bg-action px-3 text-label-sm text-secondary hover:border-default hover:text-primary"
            >
              <AppIcon name="add" size="xs" />
              New schedule
            </button>
          )}
        </div>
      }
    >
      {error && <p className="mb-2 text-caption text-error">{error}</p>}
      {(showForm || editing) && activeLocoId && (
        <ScheduleForm
          locomotiveId={activeLocoId}
          editing={editing}
          onDone={() => {
            setShowForm(false);
            setEditing(null);
            load(activeLocoId);
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
      {schedules === null ? (
        <p className="text-body-sm text-tertiary">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-caption uppercase tracking-[0.08em] text-quaternary">
              Maintenance Schedules
            </h4>
            {schedules.length === 0 ? (
              <p className="text-caption text-quaternary">No persisted schedules yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {schedules.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-md border border-muted px-2.5 py-1.5 text-body-sm"
                  >
                    <span className="text-primary">
                      {s.name} <span className="text-caption text-quaternary">({s.type})</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono-data text-caption text-secondary">
                        {fmtUSD(s.partsEstimate + s.laborHours * s.laborRatePerHour)}
                      </span>
                      {canWrite && (
                        <button
                          onClick={() => {
                            setShowForm(false);
                            setEditing(s);
                          }}
                          className="text-caption text-quaternary hover:text-primary"
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => removeSchedule(s.id)}
                          className="text-caption text-quaternary hover:text-error"
                        >
                          Remove
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-caption uppercase tracking-[0.08em] text-quaternary">
              Cost Records (ledger — append only)
            </h4>
            {costRecords === null || costRecords.length === 0 ? (
              <p className="text-caption text-quaternary">No persisted cost records yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {costRecords.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-md border border-muted px-2.5 py-1.5 text-body-sm"
                  >
                    <span className="text-primary">
                      {c.year} <span className="text-caption text-quaternary">({c.category})</span>
                    </span>
                    <span className="font-mono-data text-caption text-secondary">
                      {fmtUSD(c.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

function ScheduleForm({
  locomotiveId,
  editing,
  onDone,
  onCancel,
}: {
  locomotiveId: string;
  editing?: BackendMaintenanceSchedule | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<MaintenanceScheduleInput>(
    editing
      ? {
          name: editing.name,
          triggerMonths: editing.triggerMonths ?? undefined,
          triggerKm: editing.triggerKm ?? undefined,
          triggerHours: editing.triggerHours ?? undefined,
          rule: editing.rule,
          laborHours: editing.laborHours,
          laborRatePerHour: editing.laborRatePerHour,
          partsEstimate: editing.partsEstimate,
          type: editing.type,
        }
      : EMPTY_SCHEDULE_INPUT,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof MaintenanceScheduleInput>(
    key: K,
    value: MaintenanceScheduleInput[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        await updateMaintenanceSchedule(editing.id, form);
      } else {
        await createMaintenanceSchedule(locomotiveId, form);
      }
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : `Couldn't ${editing ? "update" : "create"} schedule.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-dashed border-muted p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="col-span-2 text-caption text-quaternary">
          Name
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className={cn(liveInputCls, "mt-1")}
          />
        </label>
        <label className="text-caption text-quaternary">
          Type
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value as MaintenanceScheduleType)}
            className={cn(liveInputCls, "mt-1")}
          >
            <option value="PREVENTIVE">Preventive</option>
            <option value="OVERHAUL">Overhaul</option>
            <option value="REBUILD">Rebuild</option>
          </select>
        </label>
        <label className="col-span-2 sm:col-span-3 text-caption text-quaternary">
          Rule
          <input
            value={form.rule}
            onChange={(e) => set("rule", e.target.value)}
            className={cn(liveInputCls, "mt-1")}
          />
        </label>
        <label className="text-caption text-quaternary">
          Trigger (months)
          <input
            type="number"
            value={form.triggerMonths ?? ""}
            onChange={(e) =>
              set("triggerMonths", e.target.value ? Number(e.target.value) : undefined)
            }
            className={cn(liveInputCls, "mt-1")}
          />
        </label>
        <label className="text-caption text-quaternary">
          Labor Hours
          <input
            type="number"
            value={form.laborHours}
            onChange={(e) => set("laborHours", Number(e.target.value))}
            className={cn(liveInputCls, "mt-1")}
          />
        </label>
        <label className="text-caption text-quaternary">
          Parts Estimate ($)
          <input
            type="number"
            value={form.partsEstimate}
            onChange={(e) => set("partsEstimate", Number(e.target.value))}
            className={cn(liveInputCls, "mt-1")}
          />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={submitting}
          className="rounded-md bg-action-primary px-3 py-1.5 text-label-sm text-on-color disabled:opacity-50"
        >
          {submitting ? "Saving…" : editing ? "Save changes" : "Create schedule"}
        </button>
        <button onClick={onCancel} className="text-label-sm text-tertiary">
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-caption text-error">{error}</p>}
    </div>
  );
}
