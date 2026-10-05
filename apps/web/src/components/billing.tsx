"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  FileText,
  IndianRupee,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { invoiceTotals, money, returnValue, toPaise } from "@wholesale/shared";
import type { BillVariant, Invoice } from "@/lib/types";
import { date, errorMessage, send, time } from "@/lib/api";
import { useSession } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Empty,
  ErrorState,
  Field,
  FormError,
  Loading,
  Metric,
  PageHeader,
  Panel,
  Pill,
  Status,
  Thumb,
} from "@/components/common";
export function Billing() {
  const { can } = useSession();
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  const { data, error, mutate } = useSWR<{
    invoices: Invoice[];
    total: number;
    summary: { netPaise: number; paidPaise: number; duePaise: number };
  }>(
    `/billing/invoices?q=${encodeURIComponent(query)}&status=${status}&page=${page}`,
  );
  const invoices = data?.invoices || [];
  return (
    <>
      <PageHeader
        title="Billing & invoices"
        description="Counter bills, recorded payments and returns. Connected to stock."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href="/api/v1/billing/export" download>
                <Download />
                Export invoices
              </a>
            </Button>
            {can("BILLING:CREATE") && (
              <Button asChild>
                <Link href="/dashboard/billing/new">
                  <Plus />
                  Create a bill
                </Link>
              </Button>
            )}
          </>
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
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Metric
              label="Net invoice value"
              value={money(data.summary.netPaise, true)}
              icon={<IndianRupee />}
              detail="Across the invoices below"
            />
            <Metric
              label="Payment received"
              value={money(data.summary.paidPaise, true)}
              icon={<Wallet />}
              detail="Recorded manually by your team"
            />
            <Metric
              label="Outstanding amount"
              value={money(data.summary.duePaise, true)}
              icon={<FileText />}
              detail="Unpaid and partially paid invoices"
            />
          </div>
          <Panel>
            <div className="flex flex-wrap gap-3 p-4">
              <div className="relative min-w-48 flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-3 size-3.5 text-muted-foreground" />
                <Input
                  aria-label="Search invoices"
                  className="h-9 pl-9 text-xs"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Invoice number, buyer or mobile"
                />
              </div>
              <select
                aria-label="Payment status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="field !w-auto !text-xs"
              >
                <option value="">All payment statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partially paid</option>
                <option value="UNPAID">Unpaid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <DataTable<Invoice>
              rows={invoices}
              pageSize={15}
              pagination={{ page, total: data.total, onPage: setPage }}
              rowKey={(i) => i.id}
              columns={[
                {
                  key: "invoice",
                  label: "Invoice",
                  render: (i) => (
                    <Link
                      href={`/dashboard/billing/${i.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {i.number}
                      <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                        {date(i.createdAt)} · {time(i.createdAt)}
                      </span>
                    </Link>
                  ),
                },
                {
                  key: "buyer",
                  label: "Buyer",
                  render: (i) => (
                    <>
                      <span className="font-medium">{i.buyerName}</span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        +91 {i.buyerPhone}
                      </span>
                    </>
                  ),
                },
                {
                  key: "amount",
                  label: "Net amount",
                  className: "text-right",
                  render: (i) => (
                    <span className="numeric font-medium">
                      {money(i.netPaise)}
                    </span>
                  ),
                },
                {
                  key: "due",
                  label: "Due",
                  className: "text-right",
                  render: (i) => (
                    <span
                      className={`numeric ${i.duePaise ? "text-amber-600" : "text-muted-foreground"}`}
                    >
                      {money(i.duePaise)}
                    </span>
                  ),
                },
                {
                  key: "payment",
                  label: "Payment",
                  render: (i) => <Status value={i.paymentStatus} />,
                },
                {
                  key: "staff",
                  label: "Issued by",
                  render: (i) => (
                    <span className="text-muted-foreground">
                      {i.actor.name}
                    </span>
                  ),
                },
                {
                  key: "open",
                  label: "",
                  render: (i) => (
                    <Button
                      asChild
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Open ${i.number}`}
                    >
                      <Link href={`/dashboard/billing/${i.id}`}>
                        <ChevronRight />
                      </Link>
                    </Button>
                  ),
                },
              ]}
              emptyTitle="No invoices yet"
              emptyDescription="Create a counter bill to record the sale and deduct stock."
            />
          </Panel>
        </>
      )}
    </>
  );
}
type CartLine = { variant: BillVariant; quantity: number; price: string };
export function NewBill() {
  const router = useRouter(),
    params = useSearchParams(),
    { user } = useSession();
  const formRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState(params.get("sku") || ""),
    [cart, setCart] = useState<CartLine[]>([]),
    [buyerName, setBuyerName] = useState(params.get("buyerName") || ""),
    [buyerPhone, setBuyerPhone] = useState(params.get("buyerPhone") || ""),
    [buyerAddress, setBuyerAddress] = useState(""),
    [buyerGst, setBuyerGst] = useState(""),
    [buyerDetails, setBuyerDetails] = useState(false),
    [discount, setDiscount] = useState("0"),
    [taxMode, setTaxMode] = useState("NONE"),
    [taxRate, setTaxRate] = useState("0"),
    [paymentMode, setPaymentMode] = useState("UPI"),
    [paidAll, setPaidAll] = useState(true),
    [received, setReceived] = useState("0"),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [requestKey] = useState(() => crypto.randomUUID());
  const {
    data: variants,
    error: variantsError,
    mutate,
  } = useSWR<BillVariant[]>(`/billing/variants?q=${encodeURIComponent(query)}`);
  let totals = {
      subtotalPaise: 0,
      discountPaise: 0,
      taxPaise: 0,
      totalPaise: 0,
    },
    calculationError = "";
  try {
    if (cart.length)
      totals = invoiceTotals(
        cart.map((l) => ({
          quantity: l.quantity,
          unitPricePaise: toPaise(l.price),
        })),
        toPaise(discount || "0"),
        taxMode === "NONE" ? 0 : Math.round(Number(taxRate) * 100),
      );
  } catch (e) {
    calculationError = errorMessage(e);
  }
  let paid = 0;
  try {
    paid =
      paymentMode === "CREDIT"
        ? 0
        : paidAll
          ? totals.totalPaise
          : toPaise(received || "0");
  } catch {}
  function add(variant: BillVariant) {
    setCart((lines) => {
      const old = lines.find((l) => l.variant.id === variant.id);
      if (old && old.quantity >= variant.stock) {
        toast.error("All available units are already on this bill");
        return lines;
      }
      return old
        ? lines.map((l) =>
            l.variant.id === variant.id
              ? { ...l, quantity: l.quantity + 1 }
              : l,
          )
        : [
            ...lines,
            {
              variant,
              quantity: 1,
              price: String(variant.product.pricePaise / 100),
            },
          ];
    });
  }
  function lineChange(id: string, change: Partial<CartLine>) {
    setCart((lines) =>
      lines.map((l) => (l.variant.id === id ? { ...l, ...change } : l)),
    );
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  async function issue(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!cart.length)
        throw new Error("Add at least one variant to this bill");
      if (calculationError) throw new Error(calculationError);
      const invoice = await send<Invoice>("/billing/invoices", {
        requestKey,
        buyerName,
        buyerPhone,
        buyerAddress,
        buyerGst,
        ...(params.get("inquiryId")
          ? { inquiryId: params.get("inquiryId") }
          : {}),
        items: cart.map((l) => ({
          variantId: l.variant.id,
          quantity: l.quantity,
          unitPricePaise: toPaise(l.price),
        })),
        discountPaise: toPaise(discount || "0"),
        taxMode,
        taxRateBps: taxMode === "NONE" ? 0 : Math.round(Number(taxRate) * 100),
        paymentMode,
        paidPaise: paid,
        note,
      });
      toast.success("Invoice issued. Stock updated.");
      router.push(`/dashboard/billing/${invoice.id}`);
    } catch (e) {
      setError(errorMessage(e));
      void mutate();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link
        href="/dashboard/billing"
        className="mb-5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-3" />
        Back to invoices
      </Link>
      <PageHeader
        title="Create a bill"
        description="Select variants, add the buyer, and issue the invoice."
        actions={<Pill>⌘ / Ctrl + Enter to issue</Pill>}
      />
      <form ref={formRef} onSubmit={issue}>
        <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_1fr]">
          <div className="space-y-5">
            <Panel>
              <div className="flex items-center justify-between px-5 py-4">
                <h2 className="text-sm font-semibold">Add products</h2>
                <Pill tone="success" dot>
                  Available stock
                </Pill>
              </div>
              <div className="relative mx-5 mb-4">
                <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
                <Input
                  autoFocus
                  aria-label="Search billing products"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or SKU…"
                  className="h-11 pl-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (variants?.length === 1) add(variants[0]);
                    }
                  }}
                />
              </div>
              <div className="scrollbar-thin max-h-[270px] overflow-y-auto border-t">
                {variantsError ? (
                  <ErrorState
                    error={variantsError}
                    retry={() => {
                      void mutate();
                    }}
                  />
                ) : !variants ? (
                  <div className="p-6 text-xs text-muted-foreground">
                    Loading available stock…
                  </div>
                ) : variants.length ? (
                  <div className="grid gap-px bg-border sm:grid-cols-2">
                    {variants.map((v) => {
                      const added =
                        cart.find((l) => l.variant.id === v.id)?.quantity || 0;
                      return (
                        <button
                          type="button"
                          key={v.id}
                          onClick={() => add(v)}
                          disabled={added >= v.stock}
                          className="flex items-center gap-3 bg-white px-4 py-3 text-left hover:bg-violet-50/40 disabled:opacity-40"
                        >
                          <Thumb
                            src={
                              v.product.images[0]
                                ? `/api/v1/media/${v.product.images[0].id}`
                                : undefined
                            }
                            name={v.product.name}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-medium">
                              {v.product.name}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {v.size} · {v.color} · {v.stock - added} available
                            </p>
                            <p className="numeric mt-1 text-[11px] font-medium text-primary">
                              {money(v.product.pricePaise, true)}
                            </p>
                          </div>
                          <Plus className="size-3.5 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <Empty
                    title="No available variants"
                    description="Try another SKU or receive stock through inventory."
                  />
                )}
              </div>
            </Panel>
            <Panel
              title="Bill items"
              action={
                <Pill tone="primary">
                  {cart.reduce((s, l) => s + l.quantity, 0)} units
                </Pill>
              }
            >
              {cart.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[570px] text-left">
                    <thead className="table-header border-t bg-muted/30">
                      <tr>
                        <th className="px-5 py-3">Product / variant</th>
                        <th className="px-2 py-3">Quantity</th>
                        <th className="px-2 py-3">Unit price ₹</th>
                        <th className="px-3 py-3 text-right">Amount</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((l) => (
                        <tr key={l.variant.id} className="border-t">
                          <td className="px-5 py-4">
                            <p className="text-[11px] font-medium">
                              {l.variant.product.name}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {l.variant.size} · {l.variant.color}
                            </p>
                          </td>
                          <td className="px-2">
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={l.quantity <= 1}
                                aria-label={`Reduce quantity of ${l.variant.product.name}`}
                                onClick={() =>
                                  lineChange(l.variant.id, {
                                    quantity: l.quantity - 1,
                                  })
                                }
                              >
                                <Minus />
                              </Button>
                              <Input
                                className="h-8 w-14 px-1 text-center text-xs"
                                aria-label={`Quantity of ${l.variant.product.name} ${l.variant.size} ${l.variant.color}`}
                                type="number"
                                min={1}
                                max={l.variant.stock}
                                required
                                value={l.quantity}
                                onChange={(e) =>
                                  lineChange(l.variant.id, {
                                    quantity: Number(e.target.value),
                                  })
                                }
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                disabled={l.quantity >= l.variant.stock}
                                aria-label={`Increase quantity of ${l.variant.product.name}`}
                                onClick={() =>
                                  lineChange(l.variant.id, {
                                    quantity: l.quantity + 1,
                                  })
                                }
                              >
                                <Plus />
                              </Button>
                            </div>
                          </td>
                          <td className="px-2">
                            <Input
                              className="h-8 w-20 text-xs"
                              required
                              inputMode="decimal"
                              aria-label={`Unit price of ${l.variant.product.name}`}
                              value={l.price}
                              onChange={(e) =>
                                lineChange(l.variant.id, {
                                  price: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td className="numeric px-3 text-right text-xs font-medium">
                            {Number.isFinite(Number(l.price))
                              ? money(
                                  Math.round(Number(l.price || 0) * 100) *
                                    l.quantity,
                                  true,
                                )
                              : "—"}
                          </td>
                          <td>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remove ${l.variant.product.name}`}
                              onClick={() =>
                                setCart((c) =>
                                  c.filter(
                                    (v) => v.variant.id !== l.variant.id,
                                  ),
                                )
                              }
                            >
                              <X className="size-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Your bill is empty"
                  description="Tap an available variant above to add it. Its stock will be deducted when you issue the bill."
                />
              )}
            </Panel>
            <Field label="Invoice note (optional)">
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Packing, dispatch or counter note"
              />
            </Field>
          </div>
          <Panel className="xl:sticky xl:top-24">
            <div className="flex items-center gap-2 border-b px-5 py-4">
              <UserRound className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Buyer & payment</h2>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-3">
                <Field label="Buyer name" required>
                  <Input
                    required
                    minLength={2}
                    maxLength={100}
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Business / customer name"
                  />
                </Field>
                <Field label="Buyer mobile number" required>
                  <Input
                    required
                    inputMode="numeric"
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    value={buyerPhone}
                    onChange={(e) =>
                      setBuyerPhone(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="10 digit mobile"
                  />
                </Field>
                <button
                  type="button"
                  className="text-left text-[11px] font-medium text-primary"
                  onClick={() => setBuyerDetails((v) => !v)}
                >
                  {buyerDetails ? "Hide" : "Add"} GSTIN & address details
                </button>
                {buyerDetails && (
                  <>
                    <Field label="Buyer GSTIN">
                      <Input
                        value={buyerGst}
                        onChange={(e) =>
                          setBuyerGst(e.target.value.toUpperCase())
                        }
                        maxLength={15}
                      />
                    </Field>
                    <Field label="Buyer address">
                      <Textarea
                        rows={2}
                        value={buyerAddress}
                        onChange={(e) => setBuyerAddress(e.target.value)}
                      />
                    </Field>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-4">
                <Field label="Discount (₹)">
                  <Input
                    inputMode="decimal"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    aria-label="Invoice discount"
                  />
                </Field>
                <Field label="Tax mode">
                  <select
                    value={taxMode}
                    disabled={!user?.hasGst}
                    onChange={(e) => setTaxMode(e.target.value)}
                    className="field !text-xs"
                  >
                    <option value="NONE">Non-GST</option>
                    <option value="CGST_SGST">CGST + SGST</option>
                    <option value="IGST">IGST</option>
                  </select>
                </Field>
              </div>
              {taxMode !== "NONE" && (
                <Field
                  label="GST rate (%)"
                  hint="Use the rate applicable to the goods on this invoice."
                >
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    step="0.01"
                    required
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </Field>
              )}
              {!user?.hasGst && (
                <p className="text-[10px] leading-4 text-muted-foreground">
                  GST invoices become available after your business GSTIN is
                  added in settings.
                </p>
              )}
              <div className="space-y-2.5 border-y py-4 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="numeric">{money(totals.subtotalPaise)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount</span>
                  <span className="numeric">
                    − {money(totals.discountPaise)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span className="numeric">{money(totals.taxPaise)}</span>
                </div>
                <div className="flex justify-between pt-1 text-lg font-semibold">
                  <span>Total</span>
                  <span className="numeric text-primary">
                    {money(totals.totalPaise)}
                  </span>
                </div>
              </div>
              <Field label="Payment mode">
                <select
                  className="field"
                  value={paymentMode}
                  onChange={(e) => {
                    setPaymentMode(e.target.value);
                    if (e.target.value === "CREDIT") setPaidAll(false);
                  }}
                >
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank transfer</option>
                  <option value="CREDIT">Unpaid / credit</option>
                </select>
              </Field>
              {paymentMode !== "CREDIT" && (
                <>
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={paidAll}
                      onCheckedChange={(value) => setPaidAll(value === true)}
                    />
                    Payment received in full
                  </label>
                  {!paidAll && (
                    <Field label="Amount received (₹)">
                      <Input
                        inputMode="decimal"
                        value={received}
                        onChange={(e) => setReceived(e.target.value)}
                      />
                    </Field>
                  )}
                </>
              )}
              <div className="flex justify-between rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                <span>Balance due</span>
                <span className="numeric font-semibold">
                  {money(Math.max(0, totals.totalPaise - paid))}
                </span>
              </div>
              <FormError message={error || calculationError} />
              <BusyButton
                type="submit"
                busy={busy}
                disabled={
                  !cart.length || !!calculationError || paid > totals.totalPaise
                }
                className="h-11 w-full"
              >
                <Check />
                Issue invoice
              </BusyButton>
              <p className="text-center text-[10px] leading-4 text-muted-foreground">
                Invoice and stock movement save together.
                <br />
                Payments are recorded manually.
              </p>
            </div>
          </Panel>
        </div>
      </form>
    </>
  );
}
export function InvoiceDetail({ id }: { id: string }) {
  const { can } = useSession();
  const {
    data: invoice,
    error,
    mutate,
  } = useSWR<Invoice>(`/billing/invoices/${id}`);
  const [paymentOpen, setPaymentOpen] = useState(false),
    [returnOpen, setReturnOpen] = useState(false),
    [cancelOpen, setCancelOpen] = useState(false);
  if (error)
    return (
      <ErrorState
        error={error}
        retry={() => {
          void mutate();
        }}
      />
    );
  if (!invoice) return <Loading />;
  return (
    <>
      <div className="no-print">
        <Link
          href="/dashboard/billing"
          className="mb-5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-3" />
          Back to invoices
        </Link>
        <PageHeader
          title={invoice.number}
          description={`${date(invoice.createdAt, { year: "numeric" })} at ${time(invoice.createdAt)} · Issued by ${invoice.actor.name}`}
          actions={
            <>
              <Status value={invoice.paymentStatus} />
              <Button variant="outline" onClick={() => window.print()}>
                <Printer />
                Print invoice
              </Button>
              {can("BILLING:EDIT") &&
                invoice.status === "ISSUED" &&
                invoice.duePaise > 0 && (
                  <Button onClick={() => setPaymentOpen(true)}>
                    <Plus />
                    Record payment
                  </Button>
                )}
            </>
          }
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <section className="receipt panel p-7 sm:p-9">
          <div className="flex flex-wrap justify-between gap-5">
            <div>
              <p className="text-xl font-semibold tracking-tight">
                {invoice.businessSnapshot.name}
              </p>
              <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">
                {invoice.businessSnapshot.address}
                <br />
                {invoice.businessSnapshot.city} · +91{" "}
                {invoice.businessSnapshot.phone}
              </p>
              {invoice.businessSnapshot.gstNumber && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  GSTIN: {invoice.businessSnapshot.gstNumber}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">
                {invoice.taxMode === "NONE" ? "Sales invoice" : "Tax invoice"}
              </p>
              <p className="mt-2 font-mono text-sm font-semibold">
                {invoice.number}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {date(invoice.createdAt, { year: "numeric" })}
              </p>
            </div>
          </div>
          <div className="my-7 border-y py-5">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Billed to
            </p>
            <p className="text-sm font-semibold">{invoice.buyerName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              +91 {invoice.buyerPhone}
            </p>
            {invoice.buyerAddress && (
              <p className="mt-1 text-xs text-muted-foreground">
                {invoice.buyerAddress}
              </p>
            )}
            {invoice.buyerGst && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                GSTIN: {invoice.buyerGst}
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead className="table-header">
                <tr>
                  <th>Item / variant</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th className="!text-right">Line value*</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <p className="font-medium">{item.productName}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {item.sku} · {item.size} · {item.color}
                      </p>
                      {item.returnedQuantity > 0 && (
                        <p className="mt-1 text-[10px] text-amber-600">
                          {item.returnedQuantity} units returned
                        </p>
                      )}
                    </td>
                    <td className="numeric">{item.quantity}</td>
                    <td className="numeric">{money(item.unitPricePaise)}</td>
                    <td className="numeric !text-right font-medium">
                      {money(item.lineTotalPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[9px] text-muted-foreground">
            * Line values include allocated discount and tax.
          </p>
          <div className="ml-auto mt-6 max-w-64 space-y-3 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="numeric">{money(invoice.subtotalPaise)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span className="numeric">− {money(invoice.discountPaise)}</span>
            </div>
            {invoice.taxMode === "CGST_SGST" ? (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>CGST ({invoice.taxRateBps / 200}%)</span>
                  <span className="numeric">
                    {money(Math.floor(invoice.taxPaise / 2))}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>SGST ({invoice.taxRateBps / 200}%)</span>
                  <span className="numeric">
                    {money(invoice.taxPaise - Math.floor(invoice.taxPaise / 2))}
                  </span>
                </div>
              </>
            ) : (
              invoice.taxMode === "IGST" && (
                <div className="flex justify-between text-muted-foreground">
                  <span>IGST ({invoice.taxRateBps / 100}%)</span>
                  <span className="numeric">{money(invoice.taxPaise)}</span>
                </div>
              )
            )}
            <div className="flex justify-between border-t pt-4 text-base font-semibold">
              <span>Invoice total</span>
              <span className="numeric">{money(invoice.totalPaise)}</span>
            </div>
            {invoice.returnedPaise > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Returns</span>
                <span className="numeric">
                  − {money(invoice.returnedPaise)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Received</span>
              <span className="numeric">{money(invoice.paidPaise)}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-muted p-3 font-medium">
              <span>
                {invoice.creditPaise > 0 ? "Buyer credit" : "Balance due"}
              </span>
              <span className="numeric">
                {money(invoice.creditPaise || invoice.duePaise)}
              </span>
            </div>
          </div>
          {invoice.note && (
            <div className="mt-7 border-t pt-4">
              <p className="text-[10px] font-medium text-muted-foreground">
                Invoice note
              </p>
              <p className="mt-1 text-xs">{invoice.note}</p>
            </div>
          )}
          {invoice.status === "CANCELLED" && (
            <div className="mt-5 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
              Cancelled: {invoice.cancellationReason}
            </div>
          )}
          <p className="mt-8 border-t pt-4 text-[10px] text-muted-foreground">
            Thank you for your business. · Payment mode:{" "}
            {invoice.paymentMode.toLowerCase()}
          </p>
        </section>
        <div className="no-print space-y-5">
          <Panel
            title="Payment history"
            description="Manual payment entries against this invoice"
          >
            {invoice.payments.length ? (
              <div className="px-5 pb-2">
                {invoice.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between gap-3 border-t py-4"
                  >
                    <div>
                      <p className="text-xs font-medium">{p.mode}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {date(p.createdAt)} · {time(p.createdAt)}
                      </p>
                      <p className="mt-1 max-w-48 text-[10px] text-muted-foreground">
                        {p.note}
                      </p>
                    </div>
                    <span className="numeric text-xs font-semibold">
                      {money(p.amountPaise)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="Payment not recorded"
                description="Record money only after you have received it."
              />
            )}
          </Panel>
          {invoice.creditPaise > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              <p className="font-semibold">
                Buyer credit: {money(invoice.creditPaise)}
              </p>
              <p className="mt-2 leading-5">
                Received payments exceed the current net invoice value. Settle
                this amount with the buyer separately.
              </p>
            </div>
          )}
          <Panel
            title="Returns & corrections"
            description="Each stock change is retained in the ledger"
          >
            {invoice.returns.length > 0 && (
              <div className="px-5">
                {invoice.returns.map((r) => (
                  <div key={r.id} className="border-t py-3">
                    <div className="flex justify-between text-xs">
                      <span>{date(r.createdAt)}</span>
                      <span className="numeric font-medium">
                        {money(r.amountPaise)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {r.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2 border-t p-5">
              {invoice.status === "ISSUED" && can("BILLING:EDIT") && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={
                    !invoice.items.some((i) => i.returnedQuantity < i.quantity)
                  }
                  onClick={() => setReturnOpen(true)}
                >
                  <RotateCcw />
                  Record a return
                </Button>
              )}
              {invoice.status === "ISSUED" && can("BILLING:DELETE") && (
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setCancelOpen(true)}
                >
                  <Trash2 />
                  Cancel invoice
                </Button>
              )}
              <p className="text-[10px] leading-5 text-muted-foreground">
                Returns and cancellations restore eligible units. Payment
                entries are retained for settlement.
              </p>
            </div>
          </Panel>
        </div>
      </div>
      {paymentOpen && (
        <PaymentDialog
          invoice={invoice}
          onClose={() => setPaymentOpen(false)}
          onSaved={() => {
            setPaymentOpen(false);
            void mutate();
          }}
        />
      )}
      {returnOpen && (
        <ReturnDialog
          invoice={invoice}
          onClose={() => setReturnOpen(false)}
          onSaved={() => {
            setReturnOpen(false);
            void mutate();
          }}
        />
      )}
      {cancelOpen && (
        <CancelDialog
          invoice={invoice}
          onClose={() => setCancelOpen(false)}
          onSaved={() => {
            setCancelOpen(false);
            void mutate();
          }}
        />
      )}
    </>
  );
}
function PaymentDialog({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(invoice.duePaise / 100)),
    [mode, setMode] = useState("UPI"),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [requestKey] = useState(() => crypto.randomUUID());
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(`/billing/invoices/${invoice.id}/payments`, {
        requestKey,
        amountPaise: toPaise(amount),
        mode,
        note,
      });
      toast.success("Payment recorded");
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
          <DialogTitle>Record a received payment</DialogTitle>
          <DialogDescription>
            {invoice.number} · Outstanding: {money(invoice.duePaise)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <Field label="Amount received (₹)" required>
            <Input
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Payment mode">
            <select
              className="field"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank transfer</option>
            </select>
          </Field>
          <Field label="Reference / note">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="UPI reference or counter note"
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
              Record payment
            </BusyButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function ReturnDialog({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({}),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [requestKey] = useState(() => crypto.randomUUID());
  const amount = invoice.items.reduce(
    (s, i) =>
      s +
      returnValue(
        i.lineTotalPaise,
        i.quantity,
        i.returnedQuantity,
        quantities[i.id] || 0,
      ),
    0,
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(`/billing/invoices/${invoice.id}/returns`, {
        requestKey,
        reason,
        items: Object.entries(quantities)
          .filter(([, q]) => q > 0)
          .map(([itemId, quantity]) => ({ itemId, quantity })),
      });
      toast.success("Return recorded. Eligible stock restored.");
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Record returned goods</DialogTitle>
          <DialogDescription>
            {invoice.number} · Choose only the units received back.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="max-h-64 overflow-y-auto rounded-lg border">
            {invoice.items
              .filter((i) => i.quantity > i.returnedQuantity)
              .map((i) => (
                <div
                  key={i.id}
                  className="flex items-center gap-3 border-b p-3 last:border-0"
                >
                  <div className="flex-1">
                    <p className="text-xs font-medium">{i.productName}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {i.size} · {i.color} · {i.quantity - i.returnedQuantity}{" "}
                      eligible units
                    </p>
                  </div>
                  <Input
                    aria-label={`Return quantity for ${i.productName}`}
                    type="number"
                    min={0}
                    max={i.quantity - i.returnedQuantity}
                    value={quantities[i.id] || 0}
                    onChange={(e) =>
                      setQuantities((q) => ({
                        ...q,
                        [i.id]: Number(e.target.value),
                      }))
                    }
                    className="w-20"
                  />
                </div>
              ))}
          </div>
          <Field label="Return reason" required>
            <Textarea
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for the return"
            />
          </Field>
          <div className="flex justify-between text-xs">
            <span>Return value</span>
            <span className="numeric font-semibold">{money(amount)}</span>
          </div>
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
            <BusyButton
              type="submit"
              busy={busy}
              disabled={!Object.values(quantities).some((q) => q > 0)}
            >
              Save return
            </BusyButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function CancelDialog({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(`/billing/invoices/${invoice.id}/cancel`, { reason });
      toast.success("Invoice cancelled and remaining stock restored");
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
          <DialogTitle>Cancel {invoice.number}?</DialogTitle>
          <DialogDescription>
            Unreturned units will go back into stock. Received payments remain
            recorded and may need settlement with the buyer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <Field label="Cancellation reason" required>
            <Textarea
              minLength={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
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
              Keep invoice
            </Button>
            <BusyButton type="submit" busy={busy} variant="destructive">
              Cancel invoice
            </BusyButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
