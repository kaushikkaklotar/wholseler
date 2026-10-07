"use client";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { date, errorMessage, send } from "@/lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { BusyButton, ConfirmDialog, DataTable, Empty, ErrorState, Field, FormError, Loading, PageHeader, Panel } from "./common";
type Member = { id: string; name: string; phone: string; disabled: boolean; createdAt: string; openTasks: number };
export function PlatformTeam() {
  const { data, error, mutate } = useSWR<Member[]>("/platform/team");
  const [editor, setEditor] = useState<Member | null | undefined>(undefined), [confirm, setConfirm] = useState<Member | null>(null), [busy, setBusy] = useState(false), [query, setQuery] = useState(""), [status, setStatus] = useState("all");
  async function toggle(member: Member) {
    setBusy(true);
    try { await send(`/platform/team/${member.id}`, { name: member.name, phone: member.phone, active: member.disabled }, "PATCH"); toast.success(member.disabled ? "Operations member enabled" : "Operations member disabled; active sessions revoked"); setConfirm(null); await mutate(); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  }
  const rows = (data || []).filter(member => `${member.name} ${member.phone}`.toLowerCase().includes(query.trim().toLowerCase()) && (status === "all" || member.disabled === (status === "disabled")));
  return <><PageHeader title="Platform Team" description="Create and manage Operations members who help suppliers onboard." actions={<Button onClick={() => setEditor(null)}><Plus />Add Operations Member</Button>} />
    <div className="mb-5 rounded-xl border bg-card p-5 text-sm"><p className="font-medium">{data ? `${data.filter(member => !member.disabled).length} active Operations members` : "Operations access"}</p><p className="mt-2 text-xs leading-6 text-muted-foreground">Members use their mobile and OTP at <Link href="/login/team" className="text-primary underline">Team Login</Link>. Assign onboarding tasks from a business in the Onboarding queue. Wholesaler subscription staff limits apply to each shop’s staff.</p></div>
    {error ? <ErrorState error={error} retry={() => void mutate()} /> : !data ? <Loading /> : <Panel><div className="flex flex-wrap gap-3 border-b p-4"><Input aria-label="Search Operations members" placeholder="Name or mobile" value={query} onChange={event => setQuery(event.target.value)} className="min-w-48 flex-1" /><select aria-label="Operations member status" className="field !w-auto" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All members</option><option value="active">Active</option><option value="disabled">Disabled</option></select></div>{!data.length ? <Empty title="Build your Operations team" description="Add a member with their name and mobile. They can sign in immediately with OTP." /> : <DataTable<Member> rows={rows} rowKey={member => member.id} emptyTitle="No matching members" columns={[
      { key: "name", label: "Member", render: member => <div><p className="font-medium">{member.name}</p><p className="mt-1 text-xs text-muted-foreground">Operations · Added {date(member.createdAt)}</p></div> },
      { key: "phone", label: "Login mobile", render: member => <span className="font-mono text-xs">+91 {member.phone}</span> },
      { key: "status", label: "Status", render: member => member.disabled ? "Disabled" : "Active" },
      { key: "tasks", label: "Open tasks", render: member => member.openTasks },
      { key: "actions", label: "Actions", render: member => <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditor(member)}>Edit {member.name}</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => member.disabled ? void toggle(member) : setConfirm(member)}>{member.disabled ? "Enable" : "Disable"} {member.name}</Button></div> },
    ]} />}</Panel>}
    {editor !== undefined && <MemberEditor key={editor?.id || "new"} member={editor} onClose={() => setEditor(undefined)} onSaved={() => { setEditor(undefined); void mutate(); }} />}
    {confirm && <ConfirmDialog open title={`Disable ${confirm.name}?`} description={`Their active sessions will be revoked and new login blocked. ${confirm.openTasks} open tasks remain assigned; reassign them from the Onboarding queue if needed.`} confirm="Disable member" busy={busy} onOpenChange={open => { if (!open && !busy) setConfirm(null); }} onConfirm={() => void toggle(confirm)} />}
  </>;
}
function MemberEditor({ member, onClose, onSaved }: { member: Member | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(member?.name || ""), [phone, setPhone] = useState(member?.phone || ""), [active, setActive] = useState(!member?.disabled), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await send(member ? `/platform/team/${member.id}` : "/platform/team", { name, phone, active }, member ? "PATCH" : "POST"); toast.success(member ? "Operations member updated" : "Operations member created. They can sign in using mobile OTP."); onSaved(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[88dvh] overflow-y-auto"><DialogHeader><DialogTitle>{member ? "Edit Operations Member" : "Add Operations Member"}</DialogTitle><DialogDescription>Operations members help with onboarding, catalog quality and support. Approval decisions and platform team management remain with Admin.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4"><Field label="Member name" required><Input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} /></Field><Field label="Login mobile number" required hint={member ? "Changing this number signs the member out." : "A unique 10-digit Indian mobile; login uses OTP."}><Input autoComplete="tel-national" inputMode="numeric" required pattern="[6-9][0-9]{9}" maxLength={10} value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, ""))} /></Field>{member && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />Active account</label>}<FormError message={error} /><DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><BusyButton type="submit" busy={busy}>{member ? "Save member" : "Create Operations Member"}</BusyButton></DialogFooter></form></DialogContent></Dialog>;
}
