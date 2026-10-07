"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, SplitRow, KpiTile, StatusBadge, PriorityBadge } from "@/components/ui/primitives";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import {
  CONNECTORS,
  DATA_STANDARDS,
  PIPELINE_STAGES,
  GOLDEN_RECORDS,
  INGEST_TREND,
  type Connector,
  type ConnectorCategory,
  type ConnectorStatus,
} from "@/data/integrationsData";
import { CHART_COLORS } from "@/data/syntheticData";
import { fmtNum, fmtCompact } from "@/utils/formatters";
import { alpha, cn } from "@/lib/utils";
import { AppIcon } from "@/components/icons/AppIcon";
import type { IconName } from "@/components/icons/registry";

const STATUS_TONE: Record<ConnectorStatus, "success" | "warning" | "error" | "neutral"> = {
  connected: "success",
  degraded: "warning",
  down: "error",
  paused: "neutral",
};

const CAT_ICON: Record<ConnectorCategory, IconName> = {
  ERP: "organization",
  EAM: "bom",
  RailOEM: "cpu",
  Telematics: "signal",
  Wayside: "gauge",
  Historian: "server",
  Fuel: "fuel",
  PTC: "warrantyActive",
  Registry: "database",
};

function lastSyncLabel(mins: number): string {
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export default function Integrations() {
  const [selected, setSelected] = useState<Connector>(CONNECTORS[1]); // SAP PM
  const [catFilter, setCatFilter] = useState<ConnectorCategory | "All">("All");
  const [view, setView] = useState<"connectors" | "topology" | "quality">("connectors");

  const stats = useMemo(() => {
    const total = CONNECTORS.length;
    const connected = CONNECTORS.filter((c) => c.status === "connected").length;
    const degraded = CONNECTORS.filter(
      (c) => c.status === "degraded" || c.status === "down",
    ).length;
    const records = CONNECTORS.reduce((s, c) => s + c.recordsPerDay, 0);
    const avgErr = CONNECTORS.reduce((s, c) => s + c.errorRatePct, 0) / total;
    return { total, connected, degraded, records, avgErr };
  }, []);

  const filtered =
    catFilter === "All" ? CONNECTORS : CONNECTORS.filter((c) => c.category === catFilter);
  const categories = Array.from(new Set(CONNECTORS.map((c) => c.category)));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Data Integration Hub — Telemetry & Enterprise Feeds"
        description="Data ingestion pipelines and enterprise connectors linking SAP PM, IBM Maximo, Wabtec Edge, Railinc Umler, and wayside sensors into the canonical SAHAY engine."
        actions={
          <div className="flex items-center gap-1 rounded-full border border-muted bg-container p-0.5">
            {[
              ["connectors", "Connector Catalog"],
              ["topology", "Data Flow & MDM"],
              ["quality", "Pipeline & Quality"],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setView(k as typeof view)}
                className={cn(
                  "rounded-full px-3 py-1 text-label-sm font-medium transition-colors",
                  view === k
                    ? "bg-action-selected text-primary shadow-sm"
                    : "text-tertiary hover:bg-action hover:text-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      <PageBody className="flex flex-col gap-4">
        {/* KPI Tiles */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
          <KpiTile
            label="Active Connectors"
            value={`${stats.connected} / ${stats.total}`}
            delta={stats.degraded > 0 ? `${stats.degraded} degraded/down` : "All feeds healthy"}
            tone={stats.degraded > 0 ? "warning" : "success"}
            hint="Enterprise data sources"
          />
          <KpiTile
            label="Daily Ingest Volume"
            value={`${(stats.records / 1e6).toFixed(1)}M`}
            delta="Records / 24 hours"
            tone="info"
            hint="Aggregated pipeline ingress"
          />
          <KpiTile
            label="Mean Pipeline Error"
            value={`${stats.avgErr.toFixed(2)}%`}
            delta="DLQ threshold: 1.0%"
            tone={stats.avgErr > 1 ? "warning" : "neutral"}
            hint="24h rolling error rate"
          />
          <KpiTile
            label="Industry Standards"
            value={DATA_STANDARDS.length.toString()}
            delta="AAR · Railinc · IEC · ISO"
            tone="neutral"
            hint="Interoperability compliance"
          />
        </div>

        {/* View Content */}
        {view === "connectors" && (
          <div className="flex flex-col gap-4">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <span className="text-caption text-tertiary mr-1">Category:</span>
              {(["All", ...categories] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCatFilter(c)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-label-sm font-medium transition-colors",
                    catFilter === c
                      ? "border-default bg-action-selected text-primary shadow-sm"
                      : "border-muted bg-container text-tertiary hover:border-default hover:text-secondary",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* SplitRow: Left Cards, Right Detail */}
            <SplitRow from="xl" ratio="1.6/1" className="shrink-0">
              <Panel
                title="Registered Enterprise Data Connectors"
                action={
                  <span className="text-caption text-quaternary">
                    {filtered.length} feeds active
                  </span>
                }
              >
                <div className="grid content-start gap-2.5 sm:grid-cols-2">
                  {filtered.map((c) => (
                    <ConnectorCard
                      key={c.id}
                      connector={c}
                      selected={selected.id === c.id}
                      onClick={() => setSelected(c)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel
                title={
                  <div className="flex items-center gap-2">
                    <span>Connector Inspector — {selected.name}</span>
                    <StatusBadge tone={STATUS_TONE[selected.status]}>{selected.status}</StatusBadge>
                  </div>
                }
              >
                <ConnectorDetail connector={selected} />
              </Panel>
            </SplitRow>
          </div>
        )}

        {view === "topology" && <TopologyView onSelect={setSelected} />}
        {view === "quality" && <QualityView />}
      </PageBody>
    </div>
  );
}

function ConnectorCard({
  connector,
  selected,
  onClick,
}: {
  connector: Connector;
  selected: boolean;
  onClick: () => void;
}) {
  const iconName = CAT_ICON[connector.category];
  const tone = STATUS_TONE[connector.status];

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 text-left transition-all",
        selected
          ? "border-default bg-action-selected shadow-sm ring-1 ring-default"
          : "border-muted bg-container hover:border-default hover:bg-hover",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-muted bg-action text-secondary">
            <AppIcon name={iconName} size="sm" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-body-sm font-semibold text-primary">{connector.name}</p>
            <p className="truncate text-caption text-tertiary">
              {connector.vendor} · {connector.category}
            </p>
          </div>
        </div>
        <StatusBadge tone={tone}>{connector.status}</StatusBadge>
      </div>
      <p className="mt-2 line-clamp-1 text-caption text-secondary">{connector.dataDomain}</p>
      <div className="mt-2.5 flex items-center justify-between text-caption text-quaternary font-mono-data">
        <span>{fmtCompact(connector.recordsPerDay).replace("$", "")} rec/d</span>
        <span>Synced {lastSyncLabel(connector.lastSyncMinsAgo)}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-hover">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-error",
          )}
          style={{ width: `${connector.uptimePct}%` }}
        />
      </div>
    </button>
  );
}

function ConnectorDetail({ connector: c }: { connector: Connector }) {
  return (
    <div className="space-y-4">
      {/* 4 Quick Stat Tiles */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-md border border-muted bg-container p-2">
          <p className="text-caption uppercase text-quaternary">Frequency</p>
          <p className="font-mono-data mt-0.5 text-body-sm font-semibold text-primary">
            {c.syncFrequency.split(" ")[0]}
          </p>
        </div>
        <div className="rounded-md border border-muted bg-container p-2">
          <p className="text-caption uppercase text-quaternary">Latency</p>
          <p className="font-mono-data mt-0.5 text-body-sm font-semibold text-primary">
            {c.latencyMs}ms
          </p>
        </div>
        <div className="rounded-md border border-muted bg-container p-2">
          <p className="text-caption uppercase text-quaternary">Error Rate</p>
          <p
            className={cn(
              "font-mono-data mt-0.5 text-body-sm font-semibold",
              c.errorRatePct > 1 ? "text-warning" : "text-success",
            )}
          >
            {c.errorRatePct}%
          </p>
        </div>
        <div className="rounded-md border border-muted bg-container p-2">
          <p className="text-caption uppercase text-quaternary">Uptime</p>
          <p className="font-mono-data mt-0.5 text-body-sm font-semibold text-teal">
            {c.uptimePct}%
          </p>
        </div>
      </div>

      {/* Protocol & Throughput Specs */}
      <div className="font-mono-data space-y-1.5 rounded-lg border border-muted bg-container p-3 text-body-sm">
        <div className="flex justify-between">
          <span className="font-sans text-secondary">Protocols:</span>
          <span className="text-primary">{c.protocol.join(", ")}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-sans text-secondary">Authentication:</span>
          <span className="text-primary">{c.auth}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-sans text-secondary">Freshness SLA:</span>
          <span className="text-primary">{c.freshnessSlaMins} mins</span>
        </div>
        <div className="flex justify-between">
          <span className="font-sans text-secondary">Throughput:</span>
          <span className="text-primary">{fmtNum(c.throughputPerMin)} / min</span>
        </div>
        <div className="flex justify-between">
          <span className="font-sans text-secondary">DLQ Dead-Letter Depth:</span>
          <span className={cn(c.dlqDepth > 50 ? "text-warning font-semibold" : "text-secondary")}>
            {c.dlqDepth} records
          </span>
        </div>
      </div>

      {/* Field Mappings */}
      <div>
        <p className="text-caption font-semibold uppercase tracking-wider text-tertiary mb-2">
          Canonical Field Mappings ({c.mappings.length})
        </p>
        <div className="space-y-1.5 max-h-[160px] overflow-auto">
          {c.mappings.map((m, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md border border-muted bg-container px-2.5 py-1.5 font-mono-data text-caption"
            >
              <span className="flex-1 truncate text-tertiary">{m.source}</span>
              <AppIcon name="arrowRight" size="xs" className="shrink-0 text-quaternary" />
              <span className="flex-1 truncate text-right text-primary font-medium">
                {m.canonical}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Modules Powered */}
      <div>
        <p className="text-caption font-semibold uppercase tracking-wider text-tertiary mb-2">
          Platform Subsystems Powered
        </p>
        <div className="flex flex-wrap gap-1.5">
          {c.feeds.map((f) => (
            <span
              key={f}
              className="rounded-full border border-muted bg-action px-2.5 py-0.5 text-caption font-medium text-secondary"
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function TopologyView({ onSelect }: { onSelect: (c: Connector) => void }) {
  const groups: { cat: ConnectorCategory; label: string }[] = [
    { cat: "ERP", label: "ERP / Finance" },
    { cat: "EAM", label: "EAM / Maintenance" },
    { cat: "RailOEM", label: "Rail OEM Cloud" },
    { cat: "Telematics", label: "Telematics & IoT" },
    { cat: "Wayside", label: "Wayside Sensors" },
    { cat: "Historian", label: "OT Historians" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Source → Pipeline → Platform Ingest Architecture"
        action={
          <span className="text-caption text-quaternary">
            Real-time event streaming and batch micro-extracts
          </span>
        }
      >
        <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
          {/* Sources */}
          <div className="space-y-2">
            {groups.map((g) => {
              const conns = CONNECTORS.filter(
                (c) => c.category === g.cat || (g.cat === "Wayside" && c.category === "Registry"),
              );
              if (conns.length === 0) return null;
              return (
                <div key={g.cat} className="rounded-lg border border-muted bg-container p-2.5">
                  <p className="mb-1.5 text-caption font-semibold uppercase tracking-wider text-tertiary">
                    {g.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {conns.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onSelect(c)}
                        className="flex items-center gap-1.5 rounded-full border border-muted bg-action px-2 py-0.5 text-caption text-secondary hover:border-default hover:text-primary transition-colors"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pipeline stages */}
          <div className="flex flex-col items-center gap-1.5 px-3">
            {PIPELINE_STAGES.map((s, i) => (
              <div key={s.id} className="w-full min-w-[140px]">
                <div className="rounded-lg border border-default bg-action-selected px-3 py-2 text-center shadow-sm">
                  <p className="text-body-sm font-semibold text-primary">{s.name}</p>
                  <p className="font-mono-data text-caption text-tertiary">
                    {s.healthPct}% health · {fmtCompact(s.recordsPerDay).replace("$", "")}/d
                  </p>
                </div>
                {i < PIPELINE_STAGES.length - 1 && <div className="mx-auto h-2 w-px bg-muted" />}
              </div>
            ))}
          </div>

          {/* Destination Platform Modules */}
          <div className="space-y-2">
            {[
              "TCO Lifecycle Engine & Depreciation",
              "Predictive Asset Health & Reliability",
              "BOM Cost Hierarchy & Parts Inventory",
              "Forecasting & Monte Carlo Simulation",
              "Decarbonization & ESG Compliance",
            ].map((m) => (
              <div
                key={m}
                className="rounded-lg border border-muted bg-container p-3 text-body-sm font-medium text-teal"
              >
                {m}
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Master Data Management / Golden Record */}
      <Panel
        title="Master Data Management — Locomotive Unified Golden Record"
        action={
          <span className="text-caption text-quaternary">
            Single locomotive survivorship model reconciled across source system keys
          </span>
        }
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-container border-b border-muted">
              <tr>
                {[
                  "Golden Asset ID",
                  "Locomotive Platform",
                  "SAP EQUNR",
                  "Maximo ASSETNUM",
                  "Umler Registration",
                  "OEM Serial Number",
                  "UIC EVN Identifier",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-muted font-mono-data text-body-sm">
              {GOLDEN_RECORDS.map((r) => (
                <tr key={r.assetId} className="transition-colors hover:bg-hover">
                  <td className="px-3 py-2.5 font-sans font-medium text-primary">{r.assetId}</td>
                  <td className="px-3 py-2.5 text-secondary">{r.model}</td>
                  <td className="px-3 py-2.5 text-tertiary">{r.sapEqunr}</td>
                  <td className="px-3 py-2.5 text-tertiary">{r.maximoAssetnum}</td>
                  <td className="px-3 py-2.5 text-tertiary">{r.umlerMark}</td>
                  <td className="px-3 py-2.5 text-tertiary">{r.oemSerial}</td>
                  <td className="px-3 py-2.5 text-tertiary">{r.uicEvn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function QualityView() {
  const concepts = [
    {
      name: "Schema & Field Mapping",
      desc: "Source schema mapped to canonical OpenRail model with per-field validation.",
      metric: "98.2% mapped",
    },
    {
      name: "Lineage Provenance Graph",
      desc: "End-to-end audit trace from raw sensor ingestion to aggregated TCO ledger.",
      metric: "Full Graph Active",
    },
    {
      name: "Freshness SLA Monitor",
      desc: "Max allowable staleness thresholds per feed with automated breach paging.",
      metric: "Zero Breaches",
    },
    {
      name: "Cross-System Reconciliation",
      desc: "Automated work-order and fuel volume reconciliation across SAP and Maximo.",
      metric: "99.1% tie-out",
    },
    {
      name: "Dead-Letter Queue (DLQ)",
      desc: "Isolated quarantine for malformed or schema-invalid messages with replay hooks.",
      metric: "412 held",
    },
    {
      name: "Idempotent Event Delivery",
      desc: "Deduplication on natural keys ensures zero double-counting on network retries.",
      metric: "Enforced",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="24-Hour Telemetry & Ingestion Throughput"
        action={
          <span className="text-caption text-quaternary">
            Rolling 24h ingress velocity (thousands of records)
          </span>
        }
      >
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={INGEST_TREND} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="ingest" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.teal} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CHART_COLORS.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="hour"
                stroke={CHART_COLORS.textMuted}
                fontSize={9}
                tickFormatter={(v) => `${v}:00`}
              />
              <YAxis
                stroke={CHART_COLORS.textMuted}
                fontSize={9}
                tickFormatter={(v: number) => `${v}k`}
              />
              <Tooltip content={<ChartTooltip formatter={(v: number) => `${v}k records`} />} />
              <Area
                type="monotone"
                dataKey="kRecords"
                name="Ingested Records"
                stroke={CHART_COLORS.teal}
                strokeWidth={2}
                fill="url(#ingest)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <SplitRow from="xl" ratio="1/1" className="shrink-0">
        <Panel title="Data Governance & Pipeline Hygiene">
          <div className="space-y-2.5">
            {concepts.map((c) => (
              <div
                key={c.name}
                className="flex items-start justify-between gap-3 rounded-md border border-muted bg-container p-2.5"
              >
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-primary">{c.name}</p>
                  <p className="text-caption text-secondary mt-0.5">{c.desc}</p>
                </div>
                <span className="font-mono-data shrink-0 rounded-full border border-muted bg-action px-2 py-0.5 text-caption font-semibold text-teal">
                  {c.metric}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Rail Industry Interoperability Standards">
          <div className="space-y-3">
            {DATA_STANDARDS.map((s) => (
              <div key={s.code} className="rounded-md border border-muted bg-container p-2.5">
                <div className="flex items-center justify-between text-body-sm">
                  <span className="font-semibold text-primary">
                    <span className="font-mono-data text-teal mr-1">{s.code}</span> · {s.name}
                  </span>
                  <span className="font-mono-data text-caption font-semibold text-secondary">
                    {s.adoptionPct}% adoption
                  </span>
                </div>
                <p className="text-caption text-tertiary mt-1">
                  {s.body} — {s.scope}
                </p>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-hover">
                  <div
                    className="h-full rounded-full bg-teal"
                    style={{ width: `${s.adoptionPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </SplitRow>
    </div>
  );
}
