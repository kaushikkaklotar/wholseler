"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Bell, CheckCheck, CircleHelp, Plus, Send } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { date, errorMessage, send, time } from "@/lib/api";
import { useSession } from "@/components/session";
import { NotificationSettings } from "./notification-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Empty,
  ErrorState,
  Field,
  FormError,
  Initials,
  Loading,
  PageHeader,
  Panel,
  Status,
} from "@/components/common";
export function Support() {
  const { user } = useSession(),
    params = useSearchParams();
  const platform =
    !!user && ["PLATFORM_ADMIN", "PLATFORM_OPERATIONS"].includes(user.role);
  const { data, error, mutate } = useSWR<Ticket[]>("/support", {
    refreshInterval: 20000,
  });
  const [creating, setCreating] = useState(false),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data?.find((t) => t.id === selectedId) || data?.[0];
  return (
    <>
      <PageHeader
        title={platform ? "Support desk" : "Help & support"}
        description={
          platform
            ? "Respond to businesses and sellers. Keep the full conversation on record."
            : "Get help with catalog, billing, verification or your subscription."
        }
        actions={
          !platform ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              New support request
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
      ) : !data.length ? (
        <Panel>
          <Empty
            title="No open conversations"
            description={
              platform
                ? "New support requests from businesses and sellers appear here."
                : "Your support requests and replies will appear here."
            }
            action={
              !platform ? (
                <Button variant="outline" onClick={() => setCreating(true)}>
                  <CircleHelp />
                  Ask the platform team
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[.75fr_1.5fr]">
          <Panel title="Support conversations">
            <div className="divide-y border-t">
              {data.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`block w-full px-5 py-4 text-left ${selected?.id === t.id ? "bg-violet-50/70" : "hover:bg-muted/40"}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {t.category.toLowerCase()}
                    </span>
                    <Status value={t.status} />
                  </div>
                  <p className="text-xs font-medium">{t.subject}</p>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {platform
                      ? t.business?.name || t.user.name
                      : date(t.createdAt)}{" "}
                    · {t.messages.length} messages
                  </p>
                </button>
              ))}
            </div>
          </Panel>
          {selected && (
            <TicketThread
              key={selected.id}
              ticket={selected}
              platform={platform}
              onSaved={() => {
                void mutate();
              }}
            />
          )}
        </div>
      )}
      {creating && (
        <NewTicket
          initialCategory={params.get("category") || "OTHER"}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void mutate();
          }}
        />
      )}
    </>
  );
}
function NewTicket({
  initialCategory,
  onClose,
  onSaved,
}: {
  initialCategory: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const options = ["CATALOG", "BILLING", "ACCOUNT", "SUBSCRIPTION", "OTHER"];
  const [subject, setSubject] = useState(""),
    [category, setCategory] = useState(
      options.includes(initialCategory) ? initialCategory : "OTHER",
    ),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send("/support", { subject, category, message });
      toast.success("Support request created");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask the platform team</DialogTitle>
          <DialogDescription>
            Include enough detail to help the team understand your request.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <Field label="Category">
            <select
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {options.map((c) => (
                <option key={c} value={c}>
                  {c.toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subject" required>
            <Input
              required
              minLength={3}
              maxLength={150}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Your request" required>
            <Textarea
              required
              minLength={5}
              maxLength={2000}
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <BusyButton type="submit" busy={busy}>
              <Send />
              Submit request
            </BusyButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function TicketThread({
  ticket,
  platform,
  onSaved,
}: {
  ticket: Ticket;
  platform: boolean;
  onSaved: () => void;
}) {
  const [message, setMessage] = useState(""),
    [status, setStatus] = useState(ticket.status),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function reply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(`/support/${ticket.id}/replies`, {
        message,
        ...(platform ? { status } : {}),
      });
      setMessage("");
      toast.success("Support reply saved");
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title={ticket.subject}
      description={`${ticket.user.name} · ${ticket.business?.name || ticket.user.phone}`}
      action={<Status value={ticket.status} />}
    >
      <div className="scrollbar-thin max-h-[480px] space-y-5 overflow-y-auto border-t p-5">
        {ticket.messages.map((m) => (
          <div key={m.id} className="flex gap-3">
            <Initials name={m.user.name} />
            <div className="flex-1">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-medium">
                  {m.user.name}
                  {["PLATFORM_ADMIN", "PLATFORM_OPERATIONS"].includes(
                    m.user.role,
                  ) && (
                    <span className="ml-2 text-[9px] text-primary">
                      Platform team
                    </span>
                  )}
                </p>
                <span className="text-[9px] text-muted-foreground">
                  {date(m.createdAt)} · {time(m.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap rounded-lg bg-muted/50 px-4 py-3 text-xs leading-6">
                {m.text}
              </p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={reply} className="space-y-3 border-t p-5">
        <Textarea
          aria-label="Support reply"
          required
          maxLength={2000}
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a reply…"
        />
        <FormError message={error} />
        <div className="flex items-center justify-between gap-3">
          {platform ? (
            <select
              aria-label="Ticket status"
              className="field !w-auto !text-xs"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              Replies stay in this support record.
            </span>
          )}
          <BusyButton busy={busy} type="submit">
            <Send />
            Save reply
          </BusyButton>
        </div>
      </form>
    </Panel>
  );
}
type Notification = {
  id: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
};
export function Notifications() {
  const { data, error, mutate } = useSWR<{
    notifications: Notification[];
    unread: number;
  }>("/notifications", { refreshInterval: 30000 });
  async function mark(id: string) {
    try {
      await send(`/notifications/${id}/read`, {}, "PATCH");
      await mutate();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Inquiries, low stock, verification decisions and support updates."
        actions={
          data && data.unread > 0 ? (
            <span className="text-xs text-muted-foreground">
              {data.unread} unread
            </span>
          ) : undefined
        }
      />
      <NotificationSettings />
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
        <Panel>
          {data.notifications.length ? (
            <div className="divide-y">
              {data.notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-4 p-5 ${n.read ? "" : "bg-violet-50/30"}`}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-primary">
                    <Bell className="size-4" />
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap justify-between gap-2">
                      <Link
                        href={n.href}
                        onClick={() => {
                          void mark(n.id);
                        }}
                        className="text-xs font-medium hover:text-primary"
                      >
                        {n.title}
                      </Link>
                      <span className="text-[9px] text-muted-foreground">
                        {date(n.createdAt)} · {time(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                      {n.body}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <Link
                        href={n.href}
                        onClick={() => {
                          void mark(n.id);
                        }}
                        className="text-[10px] font-medium text-primary"
                      >
                        Open workspace →
                      </Link>
                      {!n.read && (
                        <button
                          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                          onClick={() => {
                            void mark(n.id);
                          }}
                        >
                          <CheckCheck className="size-3" />
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                  {!n.read && (
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="You’re all caught up"
              description="Workspace updates will appear here."
            />
          )}
        </Panel>
      )}
    </>
  );
}
