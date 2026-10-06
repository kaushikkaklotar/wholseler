"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Download, FileSpreadsheet, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { productSchema, toPaise, type ProductInput } from "@wholesale/shared";
import { api, errorMessage, send } from "@/lib/api";
import { downloadCsv, readImageFiles, readImportFile } from "@/lib/import-file";
import { useSession } from "./session";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { BusyButton, DataTable, FormError, Pill } from "./common";
const headers = [
  "name",
  "sku",
  "category",
  "price_inr",
  "carton_price_inr",
  "carton_units",
  "moq",
  "visibility",
  "size",
  "color",
  "opening_stock",
  "low_stock_at",
  "tags",
  "images",
];
type ImportProduct = ProductInput & { imageNames: string[] };
export function CatalogImport({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useSession();
  const [products, setProducts] = useState<ImportProduct[]>([]),
    [errors, setErrors] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [fileName, setFileName] = useState(""),
    [images, setImages] = useState<File[]>([]),
    [progress, setProgress] = useState("");
  const requestKey = useRef("");
  const uploaded = useRef(new Map<string, string>());
  function template() {
    downloadCsv("wholseler-catalog-template.csv", [
      headers,
      [
        "Cotton printed kurti",
        "KT-106",
        "Kurtis",
        "385",
        "4500",
        "12",
        "6",
        "PUBLIC",
        "M",
        "Sage",
        "120",
        "10",
        "Cotton",
        "KT-106-1.jpg|KT-106-2.jpg",
      ],
      [
        "Cotton printed kurti",
        "KT-106",
        "Kurtis",
        "385",
        "4500",
        "12",
        "6",
        "PUBLIC",
        "L",
        "Sage",
        "80",
        "10",
        "Cotton",
        "",
      ],
    ]);
  }
  async function cleanup() {
    const ids = [...uploaded.current.values()];
    uploaded.current.clear();
    await Promise.allSettled(
      ids.map((id) => api(`/media/${id}`, { method: "DELETE" })),
    );
  }
  async function read(file?: File) {
    if (!file) return;
    setBusy(true);
    setProducts([]);
    setErrors([]);
    setFileName(file.name);
    requestKey.current = crypto.randomUUID();
    try {
      await cleanup();
      const rows = await readImportFile(file),
        issues: string[] = [],
        grouped = new Map<string, ImportProduct>();
      if (!rows.length) throw new Error("The file has no product rows");
      for (const h of ["name", "sku", "category", "price_inr"])
        if (!(h in rows[0])) throw new Error(`Missing column: ${h}`);
      for (const [index, row] of rows.entries()) {
        try {
          const input = productSchema.parse({
            name: row.name,
            sku: row.sku,
            category: row.category,
            pricePaise: toPaise(row.price_inr || ""),
            cartonPricePaise: row.carton_price_inr
              ? toPaise(row.carton_price_inr)
              : null,
            cartonUnits: Number(row.carton_units || 12),
            moq: Number(row.moq || 1),
            visibility: row.visibility || "PUBLIC",
            tags: (row.tags || "")
              .split("|")
              .map((s) => s.trim())
              .filter(Boolean),
            variants: [
              {
                size: row.size || "Free size",
                color: row.color || "Mixed",
                stock: Number(row.opening_stock || 0),
                lowStockAt: Number(row.low_stock_at || 10),
              },
            ],
          });
          const imageNames = (row.images || "")
            .split("|")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          if (
            imageNames.length > 8 ||
            new Set(imageNames).size !== imageNames.length
          )
            throw new Error("Use up to eight unique image names per SKU");
          const old = grouped.get(input.sku);
          if (old) {
            const details = (p: ProductInput) =>
              JSON.stringify({
                ...p,
                variants: undefined,
                imageIds: undefined,
                imageNames: undefined,
              });
            if (details(old) !== details(input))
              throw new Error(
                "Product details differ across rows with the same SKU",
              );
            if (
              imageNames.length &&
              old.imageNames.length &&
              imageNames.join("|") !== old.imageNames.join("|")
            )
              throw new Error(
                "Image names differ across rows with the same SKU",
              );
            if (imageNames.length) old.imageNames = imageNames;
            old.variants.push(input.variants[0]);
          } else grouped.set(input.sku, { ...input, imageNames });
        } catch (e) {
          issues.push(`Row ${index + 2}: ${errorMessage(e)}`);
        }
      }
      for (const p of grouped.values()) {
        const result = productSchema.safeParse(p);
        if (!result.success)
          issues.push(
            `${p.sku}: ${result.error.issues.map((i) => i.message).join(", ")}`,
          );
      }
      setErrors(issues.slice(0, 20));
      if (!issues.length) setProducts([...grouped.values()]);
    } catch (e) {
      setErrors([errorMessage(e)]);
    } finally {
      setBusy(false);
    }
  }
  async function pickImages(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    setErrors([]);
    try {
      await cleanup();
      setImages(await readImageFiles(files));
      requestKey.current = crypto.randomUUID();
    } catch (e) {
      setImages([]);
      setErrors([errorMessage(e)]);
    } finally {
      setBusy(false);
    }
  }
  const byName = new Map(images.map((f) => [f.name.toLowerCase(), f]));
  const matchedNames = (p: ImportProduct) =>
    p.imageNames.length
      ? p.imageNames
      : images
          .filter(
            (f) =>
              f.name.replace(/\.[^.]+$/, "").toUpperCase() === p.sku ||
              f.name
                .replace(/\.[^.]+$/, "")
                .toUpperCase()
                .startsWith(`${p.sku}-`),
          )
          .map((f) => f.name.toLowerCase());
  const missing = products.flatMap((p) =>
    matchedNames(p)
      .filter((n) => !byName.has(n))
      .map((n) => `${p.sku}: missing image ${n}`),
  );
  const tooMany = products
    .filter((p) => matchedNames(p).length > 8)
    .map((p) => `${p.sku}: more than eight matching images`);
  const reused = new Map<string, string>();
  const duplicateImages: string[] = [];
  for (const p of products)
    for (const name of matchedNames(p)) {
      if (reused.has(name))
        duplicateImages.push(
          `${name} is assigned to both ${reused.get(name)} and ${p.sku}`,
        );
      else reused.set(name, p.sku);
    }
  const issues = [...errors, ...missing, ...tooMany, ...duplicateImages];
  async function save() {
    setBusy(true);
    setErrors([]);
    try {
      const payload: ProductInput[] = [];
      let count = 0;
      for (const p of products) {
        const ids: string[] = [];
        for (const name of matchedNames(p)) {
          let id = uploaded.current.get(name);
          if (!id) {
            setProgress(`Uploading image ${++count} of ${reused.size}…`);
            const form = new FormData();
            form.append("file", byName.get(name)!);
            const result = await api<{ id: string }>("/uploads?kind=PRODUCT", {
              method: "POST",
              body: form,
            });
            id = result.id;
            uploaded.current.set(name, id);
          }
          ids.push(id);
        }
        payload.push(productSchema.parse({ ...p, imageIds: ids }));
      }
      setProgress("Saving catalog and opening stock…");
      await send("/products/import", {
        requestKey: requestKey.current,
        products: payload,
      });
      uploaded.current.clear();
      toast.success(
        `${products.length} products imported with stock and matched images`,
      );
      setProducts([]);
      setImages([]);
      setFileName("");
      onSaved();
    } catch (e) {
      setErrors([errorMessage(e)]);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  function close() {
    if (!busy) {
      void cleanup();
      onClose();
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import catalog & images</DialogTitle>
          <DialogDescription>
            Excel or CSV, one row per variant. Matching SKUs become one product.
            Existing SKUs are rejected.
          </DialogDescription>
        </DialogHeader>
        {!user?.plan?.bulkImport ? (
          <div className="rounded-xl bg-muted p-5 text-sm">
            Bulk upload is included in Growth and Pro.
            <Button asChild className="mt-4">
              <Link href="/dashboard/subscription">View plans</Link>
            </Button>
          </div>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={template}>
              <Download />
              Download template
            </Button>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed bg-muted/20 p-5">
                <FileSpreadsheet className="size-5 text-primary" />
                <span className="text-sm font-medium">
                  {fileName || "1. Choose Excel / CSV"}
                </span>
                <span className="text-xs text-muted-foreground">
                  500 variant rows · 5 MB · first Excel sheet
                </span>
                <input
                  disabled={busy}
                  type="file"
                  accept=".csv,.xlsx"
                  className="sr-only"
                  onChange={(e) => {
                    void read(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed bg-muted/20 p-5">
                <ImagePlus className="size-5 text-primary" />
                <span className="text-sm font-medium">
                  {images.length
                    ? `${images.length} images selected`
                    : "2. Choose images / ZIP"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Optional · JPEG, PNG, WebP · 8 MB each
                </span>
                <input
                  disabled={busy}
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.zip"
                  className="sr-only"
                  onChange={(e) => {
                    void pickImages(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Use the <strong>images</strong> column for filenames separated by
              |, or name files SKU.jpg, SKU-1.jpg, SKU-2.jpg. Each image belongs
              to one product. Without images, products remain drafts until
              photos are added and approved.
            </p>
            {issues.length > 0 && (
              <FormError message={issues.slice(0, 20).join("\n")} />
            )}
            {!!products.length && (
              <>
                <Pill tone={issues.length ? "warning" : "success"}>
                  {products.length} products ·{" "}
                  {products.reduce((s, p) => s + p.variants.length, 0)} variants
                </Pill>
                <DataTable
                  rows={products}
                  rowKey={(p) => p.sku}
                  pageSize={5}
                  columns={[
                    { key: "sku", label: "SKU", render: (p) => p.sku },
                    { key: "name", label: "Product", render: (p) => p.name },
                    {
                      key: "stock",
                      label: "Opening units",
                      render: (p) =>
                        p.variants.reduce((s, v) => s + v.stock, 0),
                    },
                    {
                      key: "images",
                      label: "Matched images",
                      render: (p) => matchedNames(p).length,
                    },
                  ]}
                />
              </>
            )}
            {progress && (
              <p role="status" className="text-xs text-primary">
                {progress}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={close}>
                Cancel
              </Button>
              <BusyButton
                busy={busy}
                disabled={!products.length || !!issues.length}
                onClick={() => {
                  void save();
                }}
              >
                Import {products.length || ""} products
              </BusyButton>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
