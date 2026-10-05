"use client";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  ArrowRight,
  ContactRound,
  FileText,
  MessageCircle,
  Search,
  ShieldCheck,
} from "lucide-react";
import { money } from "@wholesale/shared";
import type { Buyer, Inquiry } from "@/lib/types";
import { date, errorMessage, send } from "@/lib/api";
import { useSession } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Metric,
  PageHeader,
  Panel,
  Pill,
  Status,
} from "@/components/common";
export function Buyers() {
  const { can } = useSession();
  const [tab, setTab] = useState("inquiries"),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Inquiry | null>(null),
    [buyer, setBuyer] = useState<Buyer | null>(null);
  const { data, error, mutate } = useSWR<{
    buyers: Buyer[];
    inquiries: Inquiry[];
  }>("/buyers");
  async function grant(inquiry: Inquiry) {
    try {
      await send(`/buyers/price-access/${inquiry.seller.id}`, {
        approved: !inquiry.priceAccess,
      });
      toast.success(
        inquiry.priceAccess
          ? "Private price access revoked"
          : "Private price access approved",
      );
      await mutate();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <>
      <PageHeader
        title="Buyers & inquiries"
        description="Turn sourcing contacts into lasting buyer relationships."
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
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Metric
              label="Known buyers"
              value={data.buyers.length}
              icon={<ContactRound />}
              detail="Grouped by mobile number"
            />
            <Metric
              label="New inquiries"
              value={data.inquiries.filter((i) => i.status === "NEW").length}
              icon={<MessageCircle />}
              detail="Waiting for your team"
            />
            <Metric
              label="Inquiry conversions"
              value={data.inquiries.filter((i) => i.invoice).length}
              icon={<FileText />}
              detail="Linked to a issued invoice"
            />
          </div>
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="inquiries">
                    Sourcing inquiries
                  </TabsTrigger>
                  <TabsTrigger value="buyers">Buyer history</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-3 size-3.5 text-muted-foreground" />
                <Input
                  aria-label="Search buyers and inquiries"
                  className="h-9 pl-9 text-xs"
                  placeholder="Buyer, product or mobile"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            {tab === "inquiries" ? (
              <DataTable<Inquiry>
                rows={data.inquiries.filter((i) =>
                  `${i.seller.businessName} ${i.seller.user.name} ${i.seller.user.phone} ${i.product.name}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )}
                rowKey={(i) => i.id}
                columns={[
                  {
                    key: "buyer",
                    label: "Buyer",
                    render: (i) => (
                      <div className="flex items-center gap-3">
                        <Initials name={i.seller.businessName} />
                        <span>
                          <span className="block font-medium">
                            {i.seller.businessName}
                          </span>
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {i.seller.city} · {i.seller.user.phone}
                          </span>
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "product",
                    label: "Interested in",
                    render: (i) => (
                      <>
                        <p className="font-medium">{i.product.name}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {i.quantity} units · {i.channel.toLowerCase()} ·{" "}
                          {date(i.createdAt)}
                        </p>
                      </>
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (i) => <Status value={i.status} />,
                  },
                  {
                    key: "access",
                    label: "Private prices",
                    render: (i) =>
                      can("SELLERS:EDIT") ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={
                            i.priceAccess
                              ? "text-emerald-600"
                              : "text-muted-foreground"
                          }
                          onClick={() => {
                            void grant(i);
                          }}
                        >
                          <ShieldCheck className="size-3" />
                          {i.priceAccess ? "Approved" : "Grant access"}
                        </Button>
                      ) : (
                        <Pill tone={i.priceAccess ? "success" : "neutral"}>
                          {i.priceAccess ? "Approved" : "Not approved"}
                        </Pill>
                      ),
                  },
                  {
                    key: "open",
                    label: "",
                    className: "text-right",
                    render: (i) => (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(i)}
                      >
                        View inquiry
                        <ArrowRight className="size-3" />
                      </Button>
                    ),
                  },
                ]}
                emptyTitle="No sourcing inquiries yet"
                emptyDescription="Seller contacts from your published catalog appear here."
              />
            ) : (
              <DataTable<Buyer>
                rows={data.buyers.filter((b) =>
                  `${b.name} ${b.phone}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )}
                rowKey={(b) => b.phone}
                columns={[
                  {
                    key: "buyer",
                    label: "Buyer",
                    render: (b) => (
                      <>
                        <p className="font-medium">{b.name}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          +91 {b.phone}
                        </p>
                      </>
                    ),
                  },
                  {
                    key: "invoices",
                    label: "Bills",
                    render: (b) => b.invoiceCount,
                  },
                  {
                    key: "sales",
                    label: "Net purchases",
                    className: "text-right",
                    render: (b) => (
                      <span className="numeric font-medium">
                        {money(b.salesPaise, true)}
                      </span>
                    ),
                  },
                  {
                    key: "due",
                    label: "Outstanding",
                    className: "text-right",
                    render: (b) => (
                      <span
                        className={`numeric ${b.duePaise ? "text-amber-600" : "text-muted-foreground"}`}
                      >
                        {money(b.duePaise, true)}
                      </span>
                    ),
                  },
                  {
                    key: "last",
                    label: "Last purchase",
                    render: (b) => date(b.lastPurchase),
                  },
                  {
                    key: "open",
                    label: "",
                    render: (b) => (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBuyer(b)}
                      >
                        History
                        <ArrowRight className="size-3" />
                      </Button>
                    ),
                  },
                ]}
                emptyTitle="Your buyer history grows with billing"
                emptyDescription="Every invoice adds to the buyer's record."
              />
            )}
          </Panel>
        </>
      )}
      {editing && (
        <InquiryDialog
          key={editing.id}
          inquiry={editing}
          editable={can("SELLERS:EDIT")}
          canBill={can("BILLING:CREATE")}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void mutate();
          }}
        />
      )}
      <Dialog
        open={!!buyer}
        onOpenChange={(v) => {
          if (!v) setBuyer(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{buyer?.name}</DialogTitle>
            <DialogDescription>
              +91 {buyer?.phone} · Purchase history
            </DialogDescription>
          </DialogHeader>
          {buyer && (
            <DataTable
              rows={buyer.invoices}
              rowKey={(i) => i.id}
              pageSize={5}
              columns={[
                {
                  key: "number",
                  label: "Invoice",
                  render: (i) =>
                    can("BILLING:VIEW") ? (
                      <Link
                        className="text-primary"
                        href={`/dashboard/billing/${i.id}`}
                      >
                        {i.number}
                      </Link>
                    ) : (
                      i.number
                    ),
                },
                {
                  key: "date",
                  label: "Date",
                  render: (i) => date(i.createdAt),
                },
                {
                  key: "total",
                  label: "Net value",
                  render: (i) => money(i.totalPaise),
                },
                { key: "due", label: "Due", render: (i) => money(i.duePaise) },
              ]}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function InquiryDialog({
  inquiry,
  editable,
  canBill,
  onClose,
  onSaved,
}: {
  inquiry: Inquiry;
  editable: boolean;
  canBill: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(inquiry.status),
    [note, setNote] = useState(inquiry.ownerNote),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(
        `/buyers/inquiries/${inquiry.id}`,
        { status, ownerNote: note },
        "PATCH",
      );
      toast.success("Inquiry updated");
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
          <DialogTitle>{inquiry.seller.businessName}</DialogTitle>
          <DialogDescription>
            {inquiry.seller.user.name} · +91 {inquiry.seller.user.phone}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-xs font-semibold">{inquiry.product.name}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {inquiry.product.sku} · {inquiry.quantity} units ·{" "}
            {inquiry.channel.toLowerCase()}
          </p>
          <p className="mt-3 text-xs leading-5">
            {inquiry.note || "No sourcing note added."}
          </p>
        </div>
        <form onSubmit={save} className="space-y-4">
          <Field label="Inquiry stage">
            <select
              disabled={!editable}
              className="field"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {["NEW", "CONTACTED", "QUOTED", "WON", "LOST"].map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Team note">
            <Textarea
              disabled={!editable}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Quote, follow-up or dispatch note"
            />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            {inquiry.invoice ? (
              <Button asChild variant="outline">
                <Link href={`/dashboard/billing/${inquiry.invoice.id}`}>
                  {inquiry.invoice.number}
                </Link>
              </Button>
            ) : (
              canBill && (
                <Button asChild variant="outline">
                  <Link
                    href={`/dashboard/billing/new?buyerName=${encodeURIComponent(inquiry.seller.businessName)}&buyerPhone=${inquiry.seller.user.phone}&inquiryId=${inquiry.id}&sku=${encodeURIComponent(inquiry.product.sku)}`}
                  >
                    Create bill
                  </Link>
                </Button>
              )
            )}
            {editable && (
              <BusyButton type="submit" busy={busy}>
                Save inquiry
              </BusyButton>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
