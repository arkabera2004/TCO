"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/layout/page-header";
import { Panel, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { getSession } from "@/lib/api/session";
import {
  getMyOrganization,
  renameMyOrganization,
  type BackendOrganization,
} from "@/lib/api/organizations";
import {
  listMembers,
  inviteMember,
  updateMemberRole,
  deactivateMember,
  type BackendMember,
  type MemberRole,
} from "@/lib/api/users";

const ROLES: MemberRole[] = ["ADMIN", "MANAGER", "ANALYST", "VIEWER"];

const ROLE_TONE: Record<MemberRole, "success" | "info" | "neutral" | "warning"> = {
  ADMIN: "success",
  MANAGER: "info",
  ANALYST: "neutral",
  VIEWER: "warning",
};

const inputCls =
  "w-full rounded-md border border-muted bg-action px-2.5 py-1.5 text-body-sm text-primary outline-none placeholder:text-quaternary focus-visible:border-default focus-visible:ring-1 focus-visible:ring-active";

export default function SettingsPage() {
  const isAdmin = getSession()?.role === "ADMIN";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="Organization & Team Settings"
        description="Organization profile and member access — ADMIN only."
      />
      <PageBody className="flex flex-col gap-4">
        {!isAdmin ? (
          <Panel title="Organization">
            <EmptyState
              title="Admin access required"
              detail="Only an organization ADMIN can view or change organization and member settings."
            />
          </Panel>
        ) : (
          <>
            <OrganizationPanel />
            <MembersPanel />
          </>
        )}
      </PageBody>
    </div>
  );
}

type OrgState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: BackendOrganization };

function OrganizationPanel() {
  const [state, setState] = useState<OrgState>({ status: "loading" });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(() => {
    setState({ status: "loading" });
    getMyOrganization()
      .then((data) => {
        setState({ status: "success", data });
        setName(data.name);
      })
      .catch((err) => {
        setState({
          status: "error",
          error: err instanceof ApiError ? err.message : "Unable to reach the server.",
        });
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await renameMyOrganization(name.trim());
      setState({ status: "success", data: updated });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Couldn't rename organization.");
    } finally {
      setSaving(false);
    }
  };

  if (state.status === "loading") {
    return (
      <Panel title="Organization">
        <p className="p-4 text-body-sm text-tertiary">Loading…</p>
      </Panel>
    );
  }
  if (state.status === "error") {
    return (
      <Panel title="Organization">
        <EmptyState title="Couldn't load organization" detail={state.error} />
      </Panel>
    );
  }

  const dirty = name.trim() !== state.data.name;

  return (
    <Panel title="Organization">
      <div className="flex items-end gap-2 p-1">
        <label className="flex-1 space-y-1">
          <span className="text-caption font-medium text-tertiary">Organization name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </label>
        <button
          onClick={save}
          disabled={saving || !dirty || !name.trim()}
          className="rounded-md bg-action-primary px-3 py-1.5 text-label-sm text-on-color disabled:opacity-50"
        >
          Save
        </button>
      </div>
      {saveError && <p className="mt-1 px-1 text-caption text-error">{saveError}</p>}
    </Panel>
  );
}

type MembersState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: BackendMember[] };

function MembersPanel() {
  const [state, setState] = useState<MembersState>({ status: "loading" });
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<MemberRole>("VIEWER");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setState({ status: "loading" });
    listMembers()
      .then((data) => setState({ status: "success", data }))
      .catch((err) => {
        setState({
          status: "error",
          error: err instanceof ApiError ? err.message : "Unable to reach the server.",
        });
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitInvite = async () => {
    if (!email.trim() || password.length < 8) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await inviteMember({ email: email.trim(), password, role });
      setEmail("");
      setPassword("");
      setRole("VIEWER");
      setInviting(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't invite member.");
    } finally {
      setSubmitting(false);
    }
  };

  const changeRole = async (userId: string, newRole: MemberRole) => {
    setBusyId(userId);
    setRowError(null);
    try {
      await updateMemberRole(userId, newRole);
      load();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "Couldn't update role.");
    } finally {
      setBusyId(null);
    }
  };

  const deactivate = async (userId: string) => {
    setBusyId(userId);
    setRowError(null);
    try {
      await deactivateMember(userId);
      load();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "Couldn't deactivate member.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel
      title="Members"
      action={
        !inviting && (
          <button onClick={() => setInviting(true)} className="text-caption text-action-primary">
            + Invite member
          </button>
        )
      }
      padded={false}
    >
      {inviting && (
        <div className="flex flex-wrap items-end gap-2 border-b border-muted p-3">
          <label className="space-y-1">
            <span className="text-caption font-medium text-tertiary">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="name@company.com"
              className={cn(inputCls, "w-56")}
            />
          </label>
          <label className="space-y-1">
            <span className="text-caption font-medium text-tertiary">Temporary password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="min. 8 characters"
              className={cn(inputCls, "w-48")}
            />
          </label>
          <label className="space-y-1">
            <span className="text-caption font-medium text-tertiary">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className={cn(inputCls, "w-32")}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={submitInvite}
            disabled={submitting || !email.trim() || password.length < 8}
            className="rounded-md bg-action-primary px-3 py-1.5 text-label-sm text-on-color disabled:opacity-50"
          >
            Invite
          </button>
          <button
            onClick={() => {
              setInviting(false);
              setFormError(null);
            }}
            className="text-label-sm text-tertiary"
          >
            Cancel
          </button>
          {formError && <p className="w-full text-caption text-error">{formError}</p>}
        </div>
      )}

      {state.status === "loading" && (
        <p className="p-4 text-body-sm text-tertiary">Loading members…</p>
      )}
      {state.status === "error" && (
        <EmptyState title="Couldn't load members" detail={state.error} />
      )}
      {state.status === "success" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="border-b border-muted bg-container">
              <tr>
                {["Email", "Role", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-caption font-medium tracking-[0.08em] text-quaternary uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-muted text-body-sm">
              {state.data.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2.5 text-primary">{m.email}</td>
                  <td className="px-3 py-2.5">
                    <select
                      value={m.role}
                      disabled={busyId === m.id}
                      onChange={(e) => changeRole(m.id, e.target.value as MemberRole)}
                      className={cn(inputCls, "w-32 py-1")}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge
                      tone={
                        m.deactivatedAt ? "neutral" : (ROLE_TONE[m.role as MemberRole] ?? "neutral")
                      }
                    >
                      {m.deactivatedAt ? "Deactivated" : "Active"}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {!m.deactivatedAt && (
                      <button
                        onClick={() => deactivate(m.id)}
                        disabled={busyId === m.id}
                        className="text-caption text-quaternary hover:text-error disabled:opacity-50"
                        aria-label={`Deactivate ${m.email}`}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rowError && <p className="p-3 text-caption text-error">{rowError}</p>}
    </Panel>
  );
}
