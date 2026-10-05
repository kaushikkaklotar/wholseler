"use client";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Check, Pencil, Plus, ShieldCheck, UsersRound } from "lucide-react";
import {
  actions,
  moduleLabels,
  modules,
  staffPresets,
  type Permission,
} from "@wholesale/shared";
import type { Plan, Staff } from "@/lib/types";
import { date, errorMessage, send } from "@/lib/api";
import { useSession } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BusyButton,
  DataTable,
  ErrorState,
  Field,
  FormError,
  Initials,
  Loading,
  PageHeader,
  Panel,
  Pill,
  Status,
} from "@/components/common";
export function Team() {
  const { can } = useSession();
  const { data, error, mutate } = useSWR<{
    staff: Staff[];
    activeCount: number;
    plan: Plan;
  }>("/team");
  const [editing, setEditing] = useState<Staff | null | undefined>(undefined);
  return (
    <>
      <PageHeader
        title="Team & access"
        description="Give every team member the access they need. Keep business control with you."
        actions={
          can("STAFF:CREATE") ? (
            <Button
              disabled={!!data && data.activeCount >= data.plan.staffLimit}
              onClick={() => setEditing(null)}
            >
              <Plus />
              Add team member
            </Button>
          ) : undefined
        }
      />
      {error ? (
        <ErrorState
          error={error}
          retry={() => {
            void mutate();
          }}
        />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <div className="mb-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Panel>
              <div className="flex gap-4 p-5">
                <span className="flex size-11 items-center justify-center rounded-xl bg-violet-50 text-primary">
                  <UsersRound className="size-5" />
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">
                      {data.activeCount} of {data.plan.staffLimit} accounts
                      active
                    </h2>
                    <Pill tone="primary">{data.plan.name}</Pill>
                  </div>
                  <div className="my-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.min(100, (data.activeCount / data.plan.staffLimit) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] leading-5 text-muted-foreground">
                    {data.activeCount >= data.plan.staffLimit
                      ? "Your staff limit is reached. Disable an account or ask the platform team to upgrade."
                      : `${data.plan.staffLimit - data.activeCount} more active staff accounts available. Disabled accounts do not consume the limit.`}
                  </p>
                </div>
              </div>
            </Panel>
            <Panel>
              <div className="flex gap-3 p-5">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <h2 className="text-xs font-semibold">
                    Permissions apply immediately
                  </h2>
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                    Accounts sign in with mobile OTP. Disabled members lose
                    access, and every change is recorded.
                  </p>
                  {can("STAFF:EDIT") && (
                    <Link
                      href="/support?category=SUBSCRIPTION"
                      className="mt-2 block text-[11px] font-medium text-primary"
                    >
                      Manage plan limits →
                    </Link>
                  )}
                </div>
              </div>
            </Panel>
          </div>
          <Panel
            title="Your team"
            description="Owner access is separate from the subscription's staff allowance"
          >
            <DataTable<Staff>
              rows={data.staff}
              rowKey={(s) => s.id}
              columns={[
                {
                  key: "name",
                  label: "Member",
                  render: (s) => (
                    <div className="flex items-center gap-3">
                      <Initials name={s.user.name} />
                      <span>
                        <span className="block font-medium">{s.user.name}</span>
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          +91 {s.user.phone}
                        </span>
                      </span>
                    </div>
                  ),
                },
                {
                  key: "designation",
                  label: "Role",
                  render: (s) => s.designation,
                },
                {
                  key: "permissions",
                  label: "Access",
                  render: (s) => (
                    <span className="text-muted-foreground">
                      {s.permissions.filter((p) => p.endsWith(":VIEW")).length}{" "}
                      modules · {s.permissions.length} permissions
                    </span>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (s) => (
                    <Status value={s.active ? "ACTIVE" : "DISABLED"} />
                  ),
                },
                {
                  key: "joined",
                  label: "Added",
                  render: (s) => (
                    <span className="text-muted-foreground">
                      {date(s.createdAt)}
                    </span>
                  ),
                },
                {
                  key: "edit",
                  label: "",
                  className: "text-right",
                  render: (s) =>
                    can("STAFF:EDIT") ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(s)}
                      >
                        <Pencil className="size-3" />
                        Manage
                      </Button>
                    ) : null,
                },
              ]}
              emptyTitle="Build your counter team"
              emptyDescription="Add a cashier or catalog manager and choose their permissions."
            />
          </Panel>
        </>
      )}
      {editing !== undefined && (
        <StaffEditor
          key={editing?.id || "new"}
          member={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void mutate();
          }}
        />
      )}
    </>
  );
}
function StaffEditor({
  member,
  onClose,
  onSaved,
}: {
  member: Staff | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const [name, setName] = useState(member?.user.name || ""),
    [phone, setPhone] = useState(member?.user.phone || ""),
    [designation, setDesignation] = useState(member?.designation || "Cashier"),
    [permissions, setPermissions] = useState<Permission[]>(
      member?.permissions || staffPresets.Cashier,
    ),
    [active, setActive] = useState(member?.active ?? true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function toggle(permission: Permission, checked: boolean) {
    setPermissions((old) => {
      const [module, action] = permission.split(":");
      let next = checked
        ? [...new Set([...old, permission])]
        : old.filter((p) => p !== permission);
      if (checked && action !== "VIEW")
        next = [...new Set([...next, `${module}:VIEW` as Permission])];
      if (!checked && action === "VIEW")
        next = next.filter((p) => !p.startsWith(module + ":"));
      return next;
    });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(
        member ? `/team/${member.id}` : "/team",
        { name, phone, designation, permissions, active },
        member ? "PATCH" : "POST",
      );
      toast.success(
        member
          ? "Team access updated"
          : "Team member added. They can sign in with mobile OTP.",
      );
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>
            {member ? "Manage team access" : "Add a team member"}
          </DialogTitle>
          <DialogDescription>
            Start with a role preset, then adjust module permissions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-5 overflow-y-auto p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Member name" required>
                <Input
                  minLength={2}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field
                label="Login mobile number"
                required
                hint={
                  member
                    ? "The login number cannot be changed. Invite a new account to replace it."
                    : undefined
                }
              >
                <Input
                  required
                  disabled={!!member}
                  inputMode="numeric"
                  maxLength={10}
                  pattern="[6-9][0-9]{9}"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                />
              </Field>
              <Field label="Designation" required>
                <Input
                  required
                  minLength={2}
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                />
              </Field>
              <Field label="Permission preset">
                <select
                  className="field"
                  defaultValue=""
                  onChange={(e) => {
                    const preset = staffPresets[e.target.value];
                    if (preset) {
                      setPermissions(
                        preset.filter(
                          (p) =>
                            user?.role === "WHOLESALER_OWNER" ||
                            user?.permissions.includes(p),
                        ),
                      );
                      setDesignation(e.target.value);
                    }
                  }}
                >
                  <option value="">Choose a preset</option>
                  {Object.keys(staffPresets).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[500px] text-left">
                <thead className="table-header bg-muted/40">
                  <tr>
                    <th className="px-4 py-3">Module</th>
                    {actions.map((a) => (
                      <th key={a} className="p-3 text-center">
                        {a.toLowerCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m} className="border-t">
                      <td className="px-4 py-3 text-xs font-medium">
                        {moduleLabels[m]}
                      </td>
                      {actions.map((a) => {
                        const permission = `${m}:${a}` as Permission;
                        return (
                          <td key={a} className="p-3 text-center">
                            <Checkbox
                              aria-label={`${moduleLabels[m]} ${a.toLowerCase()} permission`}
                              checked={permissions.includes(permission)}
                              disabled={
                                user?.role !== "WHOLESALER_OWNER" &&
                                !user?.permissions.includes(permission)
                              }
                              onCheckedChange={(v) =>
                                toggle(permission, v === true)
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={active}
                onCheckedChange={(v) => setActive(v === true)}
              />
              Account enabled
            </label>
            <p className="text-[10px] leading-5 text-muted-foreground">
              Create, edit and delete permissions require view access. Disable
              an account to revoke its active sessions.
            </p>
            <FormError message={error} />
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <BusyButton type="submit" busy={busy}>
              <Check />
              {member ? "Save access" : "Add member"}
            </BusyButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
