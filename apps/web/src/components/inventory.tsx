"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Clock3,
  Download,
  History,
  Search,
  Warehouse,
  AlertTriangle,
  Upload,
  LockKeyhole,
} from "lucide-react";
import { money } from "@wholesale/shared";
import type { StockVariant } from "@/lib/types";
import { date, errorMessage, send, time } from "@/lib/api";
import { useSession } from "@/components/session";
import { ReservationList, ReserveStock, StockImport } from "./stock-tools";
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
  Loading,
  Metric,
  PageHeader,
  Panel,
  Pill,
  Thumb,
} from "@/components/common";
type InventoryData = {
  variants: StockVariant[];
  totalUnits: number;
  reservedUnits: number;
  total: number;
  lowCount: number;
  stockValuePaise: number;
};
type Movement = {
  id: string;
  type: string;
  quantity: number;
  balanceAfter: number;
  reservedDelta: number;
  reservedAfter: number;
  note: string;
  reference: string | null;
  createdAt: string;
  product: { name: string; sku: string };
  variant: { size: string; color: string };
  actor: { name: string };
};
export function Inventory() {
  const params = useSearchParams(),
    { can, user } = useSession();
  const [importOpen, setImportOpen] = useState(false),
    [reserve, setReserve] = useState<StockVariant | null>(null);
  const [query, setQuery] = useState(params.get("q") || ""),
    [low, setLow] = useState(params.get("low") === "true"),
    [tab, setTab] = useState(params.get("variantId") ? "ledger" : "stock"),
    [variantId, setVariantId] = useState(params.get("variantId") || ""),
    [page, setPage] = useState(1),
    [stockPage, setStockPage] = useState(1),
    [move, setMove] = useState<{ variant: StockVariant; type: string } | null>(
      null,
    );
  const { data, error, mutate } = useSWR<InventoryData>(
    `/inventory?q=${encodeURIComponent(query)}&low=${low}&page=${stockPage}`,
  );
  const {
    data: ledger,
    error: ledgerError,
    mutate: refreshLedger,
  } = useSWR<{ movements: Movement[]; total: number; page: number }>(
    tab === "ledger"
      ? `/inventory/ledger?variantId=${variantId}&page=${page}`
      : null,
  );

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Know what’s available. See exactly how stock moved."
        actions={
          <>
            {can("INVENTORY:EDIT") && user?.plan?.bulkImport && (
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload />
                Bulk stock upload
              </Button>
            )}
            <Button variant="outline" asChild>
              <a
                href={`/api/v1/inventory/export?q=${encodeURIComponent(query)}&low=${low}`}
                download
              >
                <Download />
                Export stock
              </a>
            </Button>
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
              label="Available units"
              value={data.totalUnits.toLocaleString("en-IN")}
              icon={<Warehouse />}
              detail={`${data.reservedUnits} reserved · across active variants`}
            />
            <Metric
              label="Low stock variants"
              value={data.lowCount}
              icon={<AlertTriangle />}
              detail="At or below the alert quantity"
            />
            <Metric
              label="Stock value"
              value={money(data.stockValuePaise, true)}
              icon={<ArrowLeftRight />}
              detail="At current wholesale unit prices"
            />
          </div>
          <Panel>
            <div className="flex flex-wrap items-center gap-3 p-4">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="stock">Stock levels</TabsTrigger>
                  <TabsTrigger value="ledger">Movement ledger</TabsTrigger>
                  <TabsTrigger value="holds">Buyer holds</TabsTrigger>
                </TabsList>
              </Tabs>
              {tab === "stock" ? (
                <>
                  <div className="relative min-w-48 flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-3 size-3.5 text-muted-foreground" />
                    <Input
                      aria-label="Search inventory"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setStockPage(1);
                      }}
                      placeholder="Name or SKU"
                      className="h-9 pl-9 text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant={low ? "secondary" : "outline"}
                    onClick={() => {
                      setLow((v) => !v);
                      setStockPage(1);
                    }}
                  >
                    <AlertTriangle className="size-3.5" />
                    {low ? "Low stock only" : "Low stock"}
                  </Button>
                </>
              ) : (
                <div className="ml-auto flex items-center gap-2">
                  <Clock3 className="size-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">
                    {variantId ? "Selected variant" : "All inventory movements"}
                  </span>
                  {variantId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setVariantId("");
                        setPage(1);
                      }}
                    >
                      Show all
                    </Button>
                  )}
                </div>
              )}
            </div>
            {tab === "holds" ? (
              <ReservationList
                onChanged={() => {
                  void mutate();
                  void refreshLedger();
                }}
              />
            ) : tab === "stock" ? (
              <DataTable<StockVariant>
                rows={data.variants}
                pageSize={20}
                pagination={{
                  page: stockPage,
                  total: data.total,
                  onPage: setStockPage,
                }}
                rowKey={(v) => v.id}
                columns={[
                  {
                    key: "product",
                    label: "Product",
                    render: (v) => (
                      <div className="flex items-center gap-3">
                        <Thumb
                          src={
                            v.product.images[0]
                              ? `/api/v1/media/${v.product.images[0].id}`
                              : undefined
                          }
                          name={v.product.name}
                        />
                        <span>
                          <span className="block font-medium">
                            {v.product.name}
                          </span>
                          <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                            {v.product.sku}
                          </span>
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "variant",
                    label: "Variant",
                    render: (v) => (
                      <>
                        {v.size}
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          {v.color}
                        </span>
                      </>
                    ),
                  },
                  {
                    key: "stock",
                    label: "Available units",
                    render: (v) => (
                      <span className="numeric text-sm font-semibold">
                        {(v.stock - (v.reserved || 0)).toLocaleString()}
                        <span className="block text-[10px] font-normal text-muted-foreground">
                          {v.stock} on hand · {v.reserved || 0} held
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: "alert",
                    label: "Status",
                    render: (v) => (
                      <Pill
                        tone={
                          v.stock - (v.reserved || 0) === 0
                            ? "danger"
                            : v.stock - (v.reserved || 0) <= v.lowStockAt
                              ? "warning"
                              : "success"
                        }
                        dot
                      >
                        {v.stock - (v.reserved || 0) === 0
                          ? "Out of stock"
                          : v.stock - (v.reserved || 0) <= v.lowStockAt
                            ? "Low stock"
                            : "Healthy"}
                      </Pill>
                    ),
                  },
                  {
                    key: "actions",
                    label: "Stock actions",
                    className: "text-right",
                    render: (v) => (
                      <div className="flex justify-end gap-1">
                        {can("INVENTORY:EDIT") && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setMove({ variant: v, type: "PURCHASE" })
                              }
                            >
                              <ArrowDownToLine className="size-3.5" />
                              Add
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={v.stock - (v.reserved || 0) <= 0}
                              aria-label={`Reserve ${v.product.name} ${v.size} ${v.color}`}
                              onClick={() => setReserve(v)}
                            >
                              <LockKeyhole />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Adjust ${v.product.name} ${v.size} ${v.color}`}
                              onClick={() =>
                                setMove({ variant: v, type: "ADJUSTMENT" })
                              }
                            >
                              <ArrowLeftRight />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Stock history for ${v.product.name} ${v.size} ${v.color}`}
                          onClick={() => {
                            setVariantId(v.id);
                            setPage(1);
                            setTab("ledger");
                          }}
                        >
                          <History />
                        </Button>
                      </div>
                    ),
                  },
                ]}
                emptyTitle="No stock to show"
                emptyDescription="Add catalog variants, or change your stock filter."
              />
            ) : ledgerError ? (
              <ErrorState
                error={ledgerError}
                retry={() => {
                  void refreshLedger();
                }}
              />
            ) : !ledger ? (
              <div className="p-6">
                <Loading />
              </div>
            ) : (
              <>
                <DataTable<Movement>
                  rows={ledger.movements}
                  pageSize={50}
                  rowKey={(m) => m.id}
                  columns={[
                    {
                      key: "date",
                      label: "When",
                      render: (m) => (
                        <>
                          <span>{date(m.createdAt)}</span>
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {time(m.createdAt)}
                          </span>
                        </>
                      ),
                    },
                    {
                      key: "product",
                      label: "Product / variant",
                      render: (m) => (
                        <>
                          <span className="font-medium">{m.product.name}</span>
                          <span className="mt-1 block text-[10px] text-muted-foreground">
                            {m.product.sku} · {m.variant.size} ·{" "}
                            {m.variant.color}
                          </span>
                        </>
                      ),
                    },
                    {
                      key: "type",
                      label: "Movement",
                      render: (m) => (
                        <Pill tone={m.quantity > 0 ? "success" : "neutral"}>
                          {m.type.toLowerCase().replaceAll("_", " ")}
                        </Pill>
                      ),
                    },
                    {
                      key: "quantity",
                      label: "Change",
                      className: "text-right",
                      render: (m) => (
                        <span
                          className={`numeric font-semibold ${m.quantity > 0 ? "text-emerald-600" : "text-rose-500"}`}
                        >
                          {m.quantity > 0 ? "+" : ""}
                          {m.quantity}
                          {!!m.reservedDelta && (
                            <span className="block text-[10px]">
                              Hold {m.reservedDelta > 0 ? "+" : ""}
                              {m.reservedDelta}
                            </span>
                          )}
                        </span>
                      ),
                    },
                    {
                      key: "balance",
                      label: "After",
                      className: "text-right",
                      render: (m) => (
                        <span className="numeric">{m.balanceAfter}</span>
                      ),
                    },
                    {
                      key: "reason",
                      label: "Reason / actor",
                      render: (m) => (
                        <div className="max-w-52">
                          <p className="text-[11px]">{m.note}</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {m.actor.name}
                          </p>
                        </div>
                      ),
                    },
                  ]}
                  emptyTitle="No stock movements yet"
                  emptyDescription="Opening stock, bills, purchases and returns will appear here."
                />
                {ledger.total > 50 && (
                  <div className="flex items-center justify-end gap-3 border-t p-3 text-[11px] text-muted-foreground">
                    <span>
                      Movement page {page} · {ledger.total} entries
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page * 50 >= ledger.total}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </Panel>
        </>
      )}
      {importOpen && (
        <StockImport
          onClose={() => setImportOpen(false)}
          onSaved={() => {
            setImportOpen(false);
            void mutate();
            void refreshLedger();
          }}
        />
      )}
      {reserve && (
        <ReserveStock
          variant={reserve}
          onClose={() => setReserve(null)}
          onSaved={() => {
            setReserve(null);
            void mutate();
            void refreshLedger();
          }}
        />
      )}
      {move && (
        <MovementDialog
          key={move.variant.id + move.type}
          variant={move.variant}
          initialType={move.type}
          onClose={() => setMove(null)}
          onSaved={() => {
            setMove(null);
            void mutate();
            void refreshLedger();
          }}
        />
      )}
    </>
  );
}
function MovementDialog({
  variant,
  initialType,
  onClose,
  onSaved,
}: {
  variant: StockVariant;
  initialType: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState(initialType),
    [direction, setDirection] = useState("add"),
    [quantity, setQuantity] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const reducing =
      type === "STOCK_OUT" || (type === "ADJUSTMENT" && direction === "remove"),
    delta = Number(quantity) * (reducing ? -1 : 1);
  const [requestKey] = useState(() => crypto.randomUUID());
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send("/inventory/movements", {
        variantId: variant.id,
        type,
        quantity: delta,
        note,
        requestKey,
      });
      toast.success("Stock movement recorded");
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
          <DialogTitle>Record a stock movement</DialogTitle>
          <DialogDescription>
            {variant.product.name} · {variant.size} / {variant.color}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 text-xs">
            <span>Currently available</span>
            <span className="numeric font-semibold">{variant.stock} units</span>
          </div>
          <Field label="Movement type">
            <select
              className="field"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="PURCHASE">Purchase / stock received</option>
              <option value="ADJUSTMENT">Stock adjustment</option>
              <option value="STOCK_OUT">Manual stock out</option>
            </select>
          </Field>
          {type === "ADJUSTMENT" && (
            <Field label="Direction">
              <select
                className="field"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              >
                <option value="add">Increase stock</option>
                <option value="remove">Reduce stock</option>
              </select>
            </Field>
          )}
          <Field label="Number of units" required>
            <Input
              aria-label="Movement quantity"
              type="number"
              min={1}
              max={1000000}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Reason / purchase reference" required>
            <Textarea
              required
              minLength={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Purchase received from supplier, batch 104"
            />
          </Field>
          {quantity && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {reducing ? (
                <ArrowUpFromLine className="size-4" />
              ) : (
                <ArrowDownToLine className="size-4" />
              )}
              Expected balance:{" "}
              <span
                className={`font-semibold ${variant.stock + delta < 0 ? "text-destructive" : "text-foreground"}`}
              >
                {variant.stock + delta} units
              </span>
            </p>
          )}
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
              disabled={!quantity || variant.stock + delta < 0}
            >
              Save movement
            </BusyButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
