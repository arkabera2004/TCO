"use client";

import { useMemo, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, KpiTile, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { COMPONENTS, CHART_COLORS } from "@/data/syntheticData";
import type { MaintIntervalUnit, Part } from "@/data/bomData";
import { usePartsStore, type NewPartInput } from "@/store/partsStore";
import { fmtUSD, fmtCompact } from "@/utils/formatters";
import { fleetTCO, partTCO, formatInterval, DEFAULT_DUTY } from "@/utils/tcoEngine";
import { cn } from "@/lib/utils";
import { AppIcon } from "@/components/icons/AppIcon";

const HORIZON = 20;
const INTERVAL_UNITS: MaintIntervalUnit[] = ["hrs", "km", "months"];

const EMPTY_FORM: NewPartInput = {
  name: "",
  componentId: COMPONENTS[0].id,
  maintIntervalValue: 500,
  maintIntervalUnit: "hrs",
  maintQty: 1,
  uom: "ea",
  unitPriceNew: 0,
  warrantyYears: 2,
  warrantyKm: 480000,
  failureProbabilityPct: 10,
};

export default function MaintenanceLibrary() {
  const { parts, laborPct, addPart, updatePart, removePart, setLaborPct } = usePartsStore();
  const [componentId, setComponentId] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewPartInput>(EMPTY_FORM);

  const visible = useMemo(
    () => (componentId === "all" ? parts : parts.filter((p) => p.componentId === componentId)),
    [parts, componentId],
  );

  const totals = useMemo(() => fleetTCO(visible, HORIZON, laborPct), [visible, laborPct]);
  const avgPerPart = visible.length > 0 ? totals.totalCost / visible.length : 0;

  const submit = () => {
    if (!form.name.trim() || form.unitPriceNew <= 0) return;
    addPart(form);
    setForm(EMPTY_FORM);
    setShowForm(false);
  };

  const inputCls =
    "w-full rounded-md border border-muted bg-action px-2.5 py-1.5 text-body-sm text-primary outline-none placeholder:text-quaternary focus-visible:border-default focus-visible:ring-1 focus-visible:ring-active";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Maintenance Library — Part Cost Definitions"
        description="Part maintenance intervals, replacement unit costs, warranties and failure rates. Every value below is editable and hot-recalculates fleet TCO in real-time."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={componentId}
              onChange={(e) => setComponentId(e.target.value)}
              className="h-8 rounded-full border border-muted bg-action px-3 text-label-sm text-secondary outline-none transition-colors hover:border-default focus-visible:ring-1 focus-visible:ring-active"
            >
              <option value="all">All Components ({parts.length} parts)</option>
              {COMPONENTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({parts.filter((p) => p.componentId === c.id).length})
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-muted bg-action px-3 text-label-sm text-secondary transition-colors hover:border-default hover:bg-raised-2 hover:text-primary"
            >
              <AppIcon name="add" size="xs" />
              <span>{showForm ? "Close Form" : "Add Part"}</span>
            </button>
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label={`Overall TCO (${HORIZON}yr)`}
            value={`$${(totals.totalCost / 1e6).toFixed(2)}M`}
            delta={`${visible.length} parts in library`}
            tone="neutral"
            hint="Full lifecycle cost sum"
          />
          <KpiTile
            label="Average TCO / Part"
            value={`$${(avgPerPart / 1e3).toFixed(1)}k`}
            delta={`${fmtCompact(totals.avgAnnualCost)}/yr avg`}
            tone="info"
            hint="Across active selection"
          />
          <KpiTile
            label="Labour Charge"
            value={`$${(totals.laborCost / 1e3).toFixed(1)}k`}
            delta={`Rate @ ${laborPct}% of parts`}
            tone="warning"
            hint="Auto-applied to cycles"
          />
          <KpiTile
            label="Company Buffer"
            value={`$${(totals.buffer / 1e3).toFixed(1)}k`}
            delta="Warranty reserve"
            tone="neutral"
            hint="Failure variance coverage"
          />
        </div>

        {/* Add Part Form */}
        {showForm && (
          <Panel title="New Part Definition" className="shrink-0">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Field label="Part Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Traction Motor Brush"
                  className={inputCls}
                />
              </Field>
              <Field label="Component">
                <select
                  value={form.componentId}
                  onChange={(e) => setForm({ ...form, componentId: e.target.value })}
                  className={inputCls}
                >
                  {COMPONENTS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Maintenance Interval">
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={form.maintIntervalValue}
                    onChange={(e) =>
                      setForm({ ...form, maintIntervalValue: Number(e.target.value) })
                    }
                    className={inputCls}
                  />
                  <select
                    value={form.maintIntervalUnit}
                    onChange={(e) =>
                      setForm({ ...form, maintIntervalUnit: e.target.value as MaintIntervalUnit })
                    }
                    className={cn(inputCls, "w-20")}
                  >
                    {INTERVAL_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field label="Quantity / UOM">
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={form.maintQty}
                    onChange={(e) => setForm({ ...form, maintQty: Number(e.target.value) })}
                    className={inputCls}
                  />
                  <input
                    value={form.uom}
                    onChange={(e) => setForm({ ...form, uom: e.target.value })}
                    placeholder="ea / L"
                    className={cn(inputCls, "w-16")}
                  />
                </div>
              </Field>
              <Field label="Price (per unit)">
                <input
                  type="number"
                  value={form.unitPriceNew}
                  onChange={(e) => setForm({ ...form, unitPriceNew: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
              <Field label="Warranty (Yrs / Km)">
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={form.warrantyYears}
                    step={0.5}
                    onChange={(e) => setForm({ ...form, warrantyYears: Number(e.target.value) })}
                    className={inputCls}
                  />
                  <input
                    type="number"
                    value={form.warrantyKm}
                    step={50000}
                    onChange={(e) => setForm({ ...form, warrantyKm: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
              </Field>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 border-t border-muted pt-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-full border border-muted bg-action px-3 py-1 text-label-sm text-tertiary hover:border-default hover:text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!form.name.trim() || form.unitPriceNew <= 0}
                className="rounded-full border border-transparent bg-action-primary px-4 py-1 text-label-sm text-on-color font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Save Part Definition
              </button>
            </div>
          </Panel>
        )}

        {/* Live Editable Parts Table */}
        <Panel
          title="Maintenance Parts Catalog"
          action={
            <span className="text-caption text-quaternary">
              {visible.length} parts monitored · click cells to edit
            </span>
          }
          padded={false}
          className="min-h-[460px]"
        >
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-max min-w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-container border-b border-muted">
                <tr>
                  {[
                    "Part Specification",
                    "Interval",
                    "Qty",
                    "Unit",
                    "Price",
                    "Warr. Yrs",
                    "Warr. Km",
                    "Fail %",
                    `TCO (${HORIZON}yr)`,
                    "Avg/yr",
                    "Buffer",
                    "",
                  ].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={cn(
                        "px-3 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase whitespace-nowrap",
                        i === 0 && "sticky left-0 z-20 bg-container",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <LibraryRow
                    key={p.id}
                    part={p}
                    laborPct={laborPct}
                    onChange={updatePart}
                    onRemove={removePart}
                  />
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center">
                      <EmptyState
                        title="No parts registered for this component"
                        detail="Use the 'Add Part' button above to register maintenance definitions."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Labour Rate & Cost Split */}
        <SplitRow from="xl" ratio="1.6/1" className="shrink-0">
          <Panel title="Labour Rate Configuration">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm text-secondary">Labour rate:</span>
                  <input
                    type="number"
                    value={laborPct}
                    min={0}
                    max={100}
                    onChange={(e) => setLaborPct(Number(e.target.value))}
                    className="w-18 rounded-md border border-muted bg-action px-2 py-1 text-right text-body-sm font-semibold text-primary outline-none focus-visible:border-default focus-visible:ring-1 focus-visible:ring-active"
                  />
                  <span className="text-body-sm text-quaternary">% of parts cost</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={0.5}
                  value={laborPct}
                  onChange={(e) => setLaborPct(Number(e.target.value))}
                  className="min-w-[180px] flex-1"
                />
                <button
                  onClick={() => setLaborPct(18)}
                  className="rounded-full border border-muted bg-action px-3 py-1 text-label-sm text-tertiary hover:border-default hover:text-primary transition-colors"
                >
                  Reset to 18%
                </button>
              </div>

              <div className="font-mono-data space-y-1.5 rounded-lg border border-muted bg-container p-3 text-body-sm">
                <Row
                  label="Sum of part prices (maintenance)"
                  value={fmtUSD(totals.maintenanceCost)}
                />
                <Row
                  label={`Labour surcharge @ ${laborPct}%`}
                  value={fmtUSD(totals.laborCost)}
                  accent
                />
                <div className="border-t border-muted pt-1.5">
                  <Row
                    label="Combined maintenance lifecycle cost"
                    value={fmtUSD(totals.totalCost)}
                    bold
                  />
                </div>
              </div>
              <p className="text-caption text-quaternary">
                Labour Cost = Sum(Part Prices) × {laborPct}% — systematically applied to every
                scheduled maintenance event.
              </p>
            </div>
          </Panel>

          <Panel title="Customer vs Organization Cost Split">
            <div className="space-y-3.5">
              <BreakdownRow
                icon={<AppIcon name="maintenance" size="sm" />}
                label="Customer TCO"
                hint="Excludes warranty-covered failures"
                value={totals.customerTCO}
                color={CHART_COLORS.teal}
              />
              <BreakdownRow
                icon={<AppIcon name="warrantyActive" size="sm" />}
                label="Company Reserve"
                hint="Warranty replacements + buffer pool"
                value={totals.organizationTCO}
                color={CHART_COLORS.purple}
              />
              <BreakdownRow
                icon={<AppIcon name="cost" size="sm" />}
                label="Variance Buffer"
                hint="Risk variance across all parts"
                value={totals.buffer}
                color={CHART_COLORS.yellow}
              />
            </div>
          </Panel>
        </SplitRow>
      </PageBody>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-caption text-quaternary uppercase tracking-[0.08em]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Row({
  label,
  value,
  accent,
  bold,
}: {
  label: string;
  value: string;
  accent?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-secondary">{label}</span>
      <span
        className={cn(
          "tabular",
          accent && "text-info font-medium",
          bold && "font-bold text-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function BreakdownRow({
  icon,
  label,
  hint,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0" style={{ color }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-body-sm font-medium text-primary">{label}</span>
          <span className="font-mono-data tabular text-body-sm font-semibold" style={{ color }}>
            {fmtUSD(value)}
          </span>
        </div>
        <p className="text-caption text-quaternary">{hint}</p>
      </div>
    </div>
  );
}

function LibraryRow({
  part,
  laborPct,
  onChange,
  onRemove,
}: {
  part: Part;
  laborPct: number;
  onChange: (id: string, patch: Partial<Part>) => void;
  onRemove: (id: string) => void;
}) {
  const tco = useMemo(() => partTCO(part, HORIZON, laborPct), [part, laborPct]);
  const isUserPart = part.id.startsWith("usr-");

  return (
    <tr className="border-b border-muted transition-colors hover:bg-raised group">
      <td className="sticky left-0 z-10 bg-container group-hover:bg-raised px-3 py-2 whitespace-nowrap">
        <span
          className="block max-w-[200px] truncate text-body-sm font-medium text-primary"
          title={part.name}
        >
          {part.name}
        </span>
        <span className="text-caption text-quaternary font-mono-data block">
          {formatInterval(part)} · {part.partClass}
        </span>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <NumCell
            value={part.maintIntervalValue}
            onChange={(v) => onChange(part.id, { maintIntervalValue: v })}
            width="w-18"
          />
          <select
            value={part.maintIntervalUnit}
            onChange={(e) =>
              onChange(part.id, { maintIntervalUnit: e.target.value as MaintIntervalUnit })
            }
            className="rounded border border-muted bg-action px-1 py-0.5 text-caption text-secondary outline-none"
          >
            {INTERVAL_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <NumCell
          value={part.maintQty}
          onChange={(v) => onChange(part.id, { maintQty: v })}
          width="w-14"
        />
      </td>
      <td className="px-3 py-2 text-body-sm text-secondary whitespace-nowrap">{part.uom}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        <NumCell
          value={part.unitPriceNew}
          onChange={(v) => onChange(part.id, { unitPriceNew: v })}
          width="w-22"
          prefix="$"
        />
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <NumCell
          value={part.warrantyYears}
          step={0.5}
          onChange={(v) => onChange(part.id, { warrantyYears: v })}
          width="w-14"
        />
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <NumCell
          value={part.warrantyKm}
          step={10000}
          onChange={(v) => onChange(part.id, { warrantyKm: v })}
          width="w-22"
        />
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <NumCell
          value={part.failureProbabilityPct}
          onChange={(v) => onChange(part.id, { failureProbabilityPct: v })}
          width="w-14"
          suffix="%"
        />
      </td>
      <td className="font-mono-data px-3 py-2 tabular text-body-sm text-primary whitespace-nowrap">
        {fmtCompact(tco.totalCost)}
      </td>
      <td className="font-mono-data px-3 py-2 tabular text-body-sm text-secondary whitespace-nowrap">
        {fmtCompact(tco.avgAnnualCost)}
      </td>
      <td className="font-mono-data px-3 py-2 tabular text-body-sm text-warning whitespace-nowrap">
        {fmtCompact(tco.buffer)}
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-right">
        {isUserPart ? (
          <button
            onClick={() => onRemove(part.id)}
            className="text-quaternary hover:text-error transition-colors p-1"
            title="Remove part"
            aria-label="Remove part"
          >
            <AppIcon name="delete" size="xs" />
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function NumCell({
  value,
  onChange,
  width,
  step = 1,
  prefix,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  width: string;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <span className="font-mono-data inline-flex items-center text-body-sm">
      {prefix && <span className="text-quaternary mr-0.5">{prefix}</span>}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "rounded border border-muted bg-action px-1.5 py-0.5 text-right tabular text-primary outline-none transition-colors hover:border-default focus-visible:border-default focus-visible:ring-1 focus-visible:ring-active",
          width,
        )}
      />
      {suffix && <span className="text-quaternary ml-0.5">{suffix}</span>}
    </span>
  );
}
