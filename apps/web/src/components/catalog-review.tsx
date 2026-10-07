"use client";
import Image from "next/image";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { date, time, errorMessage, send, type ApiError } from "@/lib/api";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { BusyButton, ErrorState, Field, FormError, Loading } from "./common";
type Change = { field: string; label: string; before: string; after: string };
type Photos = { added: string[]; removed: string[]; retained: string[] };
type ReviewData = {
  name: string; version: number; moderation: string; note: string;
  business: { name: string; verificationStatus: string };
  comparisonLabel: string; baselineAvailable: boolean; changes: Change[];
  details: { label: string; value: string }[]; currentImages: string[]; images: Photos;
  history: { id: string; version: number; summary: string; actor: string; createdAt: string;
    decision: string | null; reviewer?: string; reviewedAt: string | null; note: string;
    changes: Change[]; images: Photos }[];
};
function Changes({ rows }: { rows: Change[] }) {
  return <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-xs"><thead className="bg-muted"><tr>{["Changed field", "Before", "Now"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.field} className="border-t"><th className="p-3 align-top font-medium">{row.label}</th><td className="min-w-32 whitespace-pre-wrap break-words p-3 align-top text-muted-foreground">{row.before}</td><td className="min-w-32 whitespace-pre-wrap break-words p-3 align-top">{row.after}</td></tr>)}</tbody></table></div>;
}
function Photos({ title, ids, added = [] }: { title: string; ids: string[]; added?: string[] }) {
  return <section className="min-w-0"><h3 className="mb-3 text-sm font-semibold">{title} · {ids.length}</h3>{!ids.length ? <p className="text-xs text-muted-foreground">No photos</p> : <div className="grid grid-cols-2 gap-3">{ids.map((id, index) => <div key={id}><a href={`/api/v1/media/${id}`} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border"><Image src={`/api/v1/media/${id}`} alt={`${title}, photo ${index + 1}`} width={240} height={240} unoptimized className="aspect-square w-full object-contain" /></a>{added.includes(id) && <p className="mt-1 text-xs font-medium text-emerald-700">Added</p>}</div>)}</div>}</section>;
}
export function CatalogReviewDialog({ id, readOnly, onClose, onSaved }: { id: string; readOnly: boolean; onClose: () => void; onSaved: () => void }) {
  const { data, error, mutate } = useSWR<ReviewData, ApiError>(`/platform/products/${id}/review`, { revalidateOnMount: true, revalidateOnFocus: false, revalidateOnReconnect: false, revalidateIfStale: false });
  const [decision, setDecision] = useState(""), [note, setNote] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [stale, setStale] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!data || stale || busy) return;
    setBusy(true); setMessage("");
    try {
      await send(`/platform/products/${id}/review`, { status: decision, note, expectedVersion: data.version }, "PATCH");
      toast.success("Review saved. Supplier notified."); onSaved();
    } catch (e) { setMessage(errorMessage(e)); if ((e as ApiError).status === 409) setStale(true); }
    finally { setBusy(false); }
  }
  async function reload() { setDecision(""); setNote(""); setStale(false); setMessage(""); await mutate(); }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[88dvh] min-w-0 overflow-y-auto sm:max-w-4xl [&>*]:min-w-0">
    <DialogHeader><DialogTitle className="break-words pr-6">{readOnly ? "Catalog changes" : "Review catalog changes"}{data ? ` · ${data.name}` : ""}</DialogTitle><DialogDescription>Compare the submitted details and photos before deciding. Operations can inspect changes; administrators save approval decisions.</DialogDescription></DialogHeader>
    {error ? <ErrorState error={error} retry={() => void reload()} /> : !data ? <Loading /> : <>
      <div className="rounded-xl bg-muted p-4 text-sm"><p className="font-medium">{data.business.name} · {data.moderation.toLowerCase()}</p><p className="mt-1 text-xs text-muted-foreground">Business: {data.business.verificationStatus.toLowerCase()} · Revision {data.version}</p>{data.history[0] && <p className="mt-2 text-xs">{data.history[0].actor} · {date(data.history[0].createdAt)} {time(data.history[0].createdAt)}<br />{data.history[0].summary}</p>}</div>
      <section><h2 className="mb-3 text-base font-semibold">{data.comparisonLabel}</h2>{data.changes.length ? <Changes rows={data.changes} /> : <p className="text-sm text-muted-foreground">{data.baselineAvailable ? "No differences from the comparison snapshot." : "No earlier snapshot was recorded for this submission. Review the current details and photos below."}</p>}</section>
      <div className="grid gap-6 sm:grid-cols-2">{data.baselineAvailable && <Photos title="Before" ids={[...data.images.retained, ...data.images.removed]} />}<Photos title="Current photos" ids={data.currentImages} added={data.baselineAvailable ? data.images.added : []} /></div>
      {!!data.images.removed.length && <Photos title="Removed photos" ids={data.images.removed} />}
      <details className="rounded-lg border p-4" open={!data.baselineAvailable}><summary className="cursor-pointer text-sm font-semibold">All submitted product details</summary><dl className="mt-3 divide-y">{data.details.map(row => <div key={row.label} className="grid grid-cols-[110px_1fr] gap-3 py-2 text-xs sm:grid-cols-[150px_1fr]"><dt className="text-muted-foreground">{row.label}</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{row.value}</dd></div>)}</dl></details>
      <section><h2 className="mb-3 text-base font-semibold">Recent submission history</h2>{!data.history.length ? <p className="text-xs text-muted-foreground">History starts with the next catalog update. Previous changes cannot be reconstructed.</p> : <div className="space-y-3">{data.history.map(row => <details key={row.id} className="rounded-lg border p-4"><summary className="cursor-pointer text-sm">Revision {row.version} · {row.summary}<span className="mt-1 block text-xs text-muted-foreground">{row.actor} · {date(row.createdAt)} {time(row.createdAt)}{row.decision ? ` · ${row.decision.toLowerCase()} by ${row.reviewer || "former administrator"}` : ""}</span></summary><div className="mt-3 space-y-3">{!!row.changes.length && <Changes rows={row.changes} />}{!!row.images.added.length && <Photos title="Added in this update" ids={row.images.added} />}{!!row.images.removed.length && <Photos title="Removed in this update" ids={row.images.removed} />}{row.note && <p className="text-xs">Review note: {row.note}</p>}</div></details>)}</div>}</section>
      {readOnly ? <Button variant="outline" onClick={onClose}>Close comparison</Button> : <form onSubmit={save} className="space-y-4 border-t pt-4"><Field label="Review decision" required><select required value={decision} onChange={event => setDecision(event.target.value)} className="field" disabled={busy || stale}><option value="">Choose a decision</option><option value="APPROVED">Approve</option><option value="REJECTED">Reject</option><option value="PENDING">Keep pending</option></select></Field><Field label="Review note" required={decision === "REJECTED"}><Textarea value={note} onChange={event => setNote(event.target.value)} required={decision === "REJECTED"} minLength={decision === "REJECTED" ? 3 : undefined} maxLength={1000} disabled={busy || stale} placeholder="Reason or next steps for the supplier" /></Field><FormError message={message} />{stale && <Button type="button" variant="outline" onClick={() => void reload()}>Reload latest comparison</Button>}<div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><BusyButton type="submit" busy={busy} disabled={!decision || stale}>Save review</BusyButton></div></form>}
    </>}
  </DialogContent></Dialog>;
}
