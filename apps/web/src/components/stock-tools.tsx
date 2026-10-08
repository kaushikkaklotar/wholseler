"use client";
import { SearchSelect } from "@/components/ui/search-select";
import Link from "next/link";
import { useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Download, FileSpreadsheet, LockKeyhole } from "lucide-react";
import type { StockVariant } from "@/lib/types";
import { date, errorMessage, send, time } from "@/lib/api";
import { downloadCsv, readImportFile } from "@/lib/import-file";
import { useSession } from "./session";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  BusyButton,
  DataTable,
  ErrorState,
  Field,
  FormError,
  Loading,
  Pill,
  Status,
} from "./common";
type StockRow = { sku: string; size: string; color: string; quantity: number };
type Preview = {
  errors: string[];
  rows: (StockRow & {
    name: string;
    before: number;
    after: number;
    reserved: number;
  })[];
};
export function StockImport({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<StockRow[]>([]),
    [type, setType] = useState("PURCHASE"),
    [note, setNote] = useState(""),
    [fileName, setFileName] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const requestKey = useRef("");
  function change() {
    setPreview(null);
    requestKey.current = "";
    setError("");
  }
  async function read(file?: File) {
    if (!file) return;
    setBusy(true);
    change();
    setRows([]);
    setFileName(file.name);
    try {
      const data = await readImportFile(file);
      if (!data.length) throw new Error("File has no stock rows");
      for (const h of ["sku", "quantity"])
        if (!(h in data[0])) throw new Error(`Missing column: ${h}`);
      setRows(
        data.map((r, i) => {
          const quantity = Number(r.quantity);
          if (
            !r.sku ||
            !r.quantity ||
            !Number.isInteger(quantity) ||
            quantity === 0
          )
            throw new Error(
              `Row ${i + 2}: enter a SKU and a non-zero whole quantity`,
            );
          return {
            sku: r.sku.trim().toUpperCase(),
            size: r.size || "Free size",
            color: r.color || "Mixed",
            quantity,
          };
        }),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const body = () => ({
    requestKey:
      requestKey.current || (requestKey.current = crypto.randomUUID()),
    type,
    note,
    rows,
  });
  async function review() {
    setBusy(true);
    setError("");
    try {
      setPreview(await send<Preview>("/inventory/import/preview", body()));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const result = await send<{ updated: number }>(
        "/inventory/import",
        body(),
      );
      toast.success(`${result.updated} variants updated with ledger entries`);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setPreview(null);
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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk stock entry</DialogTitle>
          <DialogDescription>
            Add or remove units from existing variants. Quantities are changes,
            not replacement balances.
          </DialogDescription>
        </DialogHeader>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadCsv("bulksaathi-stock-template.csv", [
              ["sku", "size", "color", "quantity"],
              ["KT-106", "M", "Sage", 25],
            ])
          }
        >
          <Download />
          Download stock template
        </Button>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-5">
          <FileSpreadsheet className="size-6 text-primary" />
          <span className="text-sm">
            {fileName || "Choose Excel / CSV · 500 rows · 5 MB"}
          </span>
          <input
            disabled={busy}
            type="file"
            className="sr-only"
            accept=".csv,.xlsx"
            onChange={(e) => {
              void read(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <Field label="Movement">
            <SearchSelect
              className="field"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                change();
              }}
            >
              <option value="PURCHASE">Purchase / stock in (+)</option>
              <option value="STOCK_OUT">Stock out (−)</option>
              <option value="ADJUSTMENT">Adjustment (+ or −)</option>
            </SearchSelect>
          </Field>
          <Field label="Reason / purchase reference" required>
            <Input
              minLength={3}
              maxLength={500}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                change();
              }}
              placeholder="Supplier purchase reference"
            />
          </Field>
        </fieldset>
        <FormError
          message={error || preview?.errors.slice(0, 20).join("\n") || ""}
        />
        {preview && (
          <>
            <Pill tone={preview.errors.length ? "warning" : "success"}>
              {preview.rows.length} valid rows
            </Pill>
            <DataTable
              rows={preview.rows}
              rowKey={(r) => `${r.sku}|${r.size}|${r.color}`}
              pageSize={5}
              columns={[
                {
                  key: "sku",
                  label: "SKU / variant",
                  render: (r) => (
                    <>
                      {r.sku}
                      <span className="block text-xs text-muted-foreground">
                        {r.size} / {r.color}
                      </span>
                    </>
                  ),
                },
                {
                  key: "change",
                  label: "Change",
                  render: (r) => (
                    <span className="numeric">
                      {r.quantity > 0 ? "+" : ""}
                      {r.quantity}
                    </span>
                  ),
                },
                {
                  key: "before",
                  label: "On hand now",
                  render: (r) => r.before,
                },
                { key: "after", label: "After", render: (r) => r.after },
                {
                  key: "reserved",
                  label: "Reserved",
                  render: (r) => r.reserved,
                },
              ]}
            />
          </>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          A failed row rejects the entire import. Stock is rechecked when
          saving; reserved units cannot be removed. Imports appear in the
          movement ledger.
        </p>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          {!preview || preview.errors.length ? (
            <BusyButton
              busy={busy}
              disabled={!rows.length || note.trim().length < 3}
              onClick={() => {
                void review();
              }}
            >
              Validate & preview
            </BusyButton>
          ) : (
            <BusyButton
              busy={busy}
              onClick={() => {
                void save();
              }}
            >
              Apply {preview.rows.length} stock changes
            </BusyButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export function ReserveStock({
  variant,
  onClose,
  onSaved,
}: {
  variant: StockVariant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const available = variant.stock - (variant.reserved || 0);
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [quantity, setQuantity] = useState(1),
    [hours, setHours] = useState(24),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const requestKey = useRef("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send("/inventory/reservations", {
        requestKey:
          requestKey.current || (requestKey.current = crypto.randomUUID()),
        variantId: variant.id,
        buyerName: name,
        buyerPhone: phone,
        quantity,
        hours,
        note,
      });
      toast.success("Stock held for this buyer");
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
          <DialogTitle>Reserve stock for a buyer</DialogTitle>
          <DialogDescription>
            {variant.product.name} · {variant.size} / {variant.color} ·{" "}
            {available} available
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <Field label="Buyer name" required>
              <Input
                required
                minLength={2}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  requestKey.current = "";
                }}
              />
            </Field>
            <Field label="Buyer mobile" required>
              <Input
                required
                inputMode="numeric"
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ""));
                  requestKey.current = "";
                }}
              />
            </Field>
            <Field label="Units to hold" required>
              <Input
                type="number"
                required
                min={1}
                max={available}
                value={quantity}
                onChange={(e) => {
                  setQuantity(Number(e.target.value));
                  requestKey.current = "";
                }}
              />
            </Field>
            <Field label="Hold duration">
              <SearchSelect
                className="field"
                value={hours}
                onChange={(e) => {
                  setHours(Number(e.target.value));
                  requestKey.current = "";
                }}
              >
                {[1, 4, 24, 48, 72, 168].map((n) => (
                  <option key={n} value={n}>
                    {n} hours
                  </option>
                ))}
              </SearchSelect>
            </Field>
          </fieldset>
          <Field label="Reason" required>
            <Textarea
              required
              minLength={3}
              maxLength={500}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                requestKey.current = "";
              }}
            />
          </Field>
          <p className="text-xs leading-5 text-muted-foreground">
            Held units are excluded from discovery and other buyers’ bills. The
            hold expires automatically or can be released. Billing the hold
            consumes its full quantity.
          </p>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <BusyButton busy={busy} type="submit">
              <LockKeyhole />
              Reserve stock
            </BusyButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
type Reservation = {
  id: string;
  variantId: string;
  buyerName: string;
  buyerPhone: string;
  quantity: number;
  status: string;
  expiresAt: string;
  note: string;
  invoiceId: string | null;
  variant: {
    size: string;
    color: string;
    product: { name: string; sku: string };
  };
};
export function ReservationList({ onChanged }: { onChanged: () => void }) {
  const { user, can } = useSession(),
    { data, error, mutate } = useSWR<Reservation[]>("/inventory/reservations", {
      refreshInterval: 15000,
    });
  const [busy, setBusy] = useState("");
  async function release(id: string) {
    setBusy(id);
    try {
      await send(`/inventory/reservations/${id}/release`, {});
      toast.success("Hold released");
      await mutate();
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy("");
    }
  }
  if (error)
    return (
      <ErrorState
        error={error}
        retry={() => {
          void mutate();
        }}
      />
    );
  if (!data) return <Loading />;
  return (
    <DataTable
      rows={data}
      rowKey={(r) => r.id}
      pageSize={10}
      emptyTitle="No stock holds"
      emptyDescription="Use the hold action beside a stock variant to reserve units for a buyer."
      columns={[
        {
          key: "product",
          label: "Product",
          render: (r) => (
            <>
              {r.variant.product.name}
              <span className="block text-xs text-muted-foreground">
                {r.variant.size} / {r.variant.color}
              </span>
            </>
          ),
        },
        {
          key: "buyer",
          label: "Buyer",
          render: (r) => (
            <>
              {r.buyerName}
              <span className="block text-xs text-muted-foreground">
                +91 {r.buyerPhone}
              </span>
            </>
          ),
        },
        { key: "units", label: "Held units", render: (r) => r.quantity },
        {
          key: "expires",
          label: "Expires",
          render: (r) => (
            <>
              {date(r.expiresAt)}
              <span className="block text-xs text-muted-foreground">
                {time(r.expiresAt)}
              </span>
            </>
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (r) => <Status value={r.status} />,
        },
        {
          key: "action",
          label: "Actions",
          render: (r) => (
            <div className="flex flex-wrap gap-2">
              {r.status === "ACTIVE" && (
                <>
                  {can("BILLING:CREATE") &&
                    new Date(r.expiresAt) > new Date() && (
                      <Button size="sm" asChild>
                        <Link
                          href={`/dashboard/billing/new?${new URLSearchParams({ reservationId: r.id, variantId: r.variantId, buyerName: r.buyerName, buyerPhone: r.buyerPhone, sku: r.variant.product.sku })}`}
                        >
                          Bill hold
                        </Link>
                      </Button>
                    )}
                  {user?.permissions.includes("INVENTORY:EDIT") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => {
                        void release(r.id);
                      }}
                    >
                      {busy === r.id ? "Releasing…" : "Release"}
                    </Button>
                  )}
                </>
              )}
              {r.invoiceId && can("BILLING:VIEW") && (
                <Link
                  className="text-primary"
                  href={`/dashboard/billing/${r.invoiceId}`}
                >
                  View bill
                </Link>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
