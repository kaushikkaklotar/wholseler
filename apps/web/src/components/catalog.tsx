"use client";
import { SearchSelect } from "@/components/ui/search-select";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { CatalogImport as ImportDialog } from "./catalog-import";
import { toast } from "sonner";
import {
  Copy,
  Grid2X2,
  ImagePlus,
  List,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  categories,
  money,
  productSchema,
  toPaise,
  type ProductInput,
} from "@wholesale/shared";
import type { Product, ImageAsset } from "@/lib/types";
import { api, errorMessage, send } from "@/lib/api";
import { useSession } from "@/components/session";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BusyButton,
  ConfirmDialog,
  DataTable,
  Empty,
  ErrorState,
  Field,
  FormError,
  Loading,
  PageHeader,
  Panel,
  Pagination,
  Pill,
  Status,
  Thumb,
} from "@/components/common";
type CatalogResponse = {
  products: Product[];
  total: number;
  allCount: number;
  limit: number;
};
type Draft = {
  name: string;
  sku: string;
  category: string;
  description: string;
  price: string;
  cartonPrice: string;
  cartonUnits: number;
  moq: number;
  visibility: ProductInput["visibility"];
  tags: string;
  images: ImageAsset[];
  variants: {
    id?: string;
    size: string;
    color: string;
    stock: number;
    lowStockAt: number;
  }[];
};
const makeDraft = (p?: Product): Draft => ({
  name: p?.name || "",
  sku: p?.sku || "",
  category: p?.category || "Kurtis",
  description: p?.description || "",
  price: p ? String(p.pricePaise / 100) : "",
  cartonPrice: p?.cartonPricePaise ? String(p.cartonPricePaise / 100) : "",
  cartonUnits: p?.cartonUnits || 12,
  moq: p?.moq || 1,
  visibility: p?.visibility || "PUBLIC",
  tags: p?.tags.join(", ") || "",
  images: p?.images || [],
  variants: p?.variants.map((v) => ({ ...v })) || [
    { size: "Free size", color: "Mixed", stock: 0, lowStockAt: 10 },
  ],
});
export function Catalog() {
  const params = useSearchParams(),
    { can, user } = useSession();
  const [query, setQuery] = useState(params.get("q") || ""),
    [category, setCategory] = useState(""),
    [view, setView] = useState("list"),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<Product | null | undefined>(undefined),
    [details, setDetails] = useState<Product | null>(null),
    [archive, setArchive] = useState<Product | null>(null),
    [archiveBusy, setArchiveBusy] = useState(false),
    [importOpen, setImportOpen] = useState(false);
  const { data, error, mutate } = useSWR<CatalogResponse>(
    `/products?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&page=${page}`,
  );
  async function duplicate(p: Product) {
    try {
      await send(`/products/${p.id}/duplicate`, {});
      toast.success(
        "Product duplicated. Add photos and opening stock to the copy.",
      );
      await mutate();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function remove() {
    setArchiveBusy(true);
    try {
      await api(`/products/${archive!.id}`, { method: "DELETE" });
      setArchive(null);
      toast.success("Product archived");
      await mutate();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setArchiveBusy(false);
    }
  }
  const actions = (p: Product) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${p.name}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setDetails(p)}>
          <Package />
          View product
        </DropdownMenuItem>
        {can("PRODUCTS:EDIT") && (
          <DropdownMenuItem onClick={() => setEdit(p)}>
            Edit product
          </DropdownMenuItem>
        )}
        {can("PRODUCTS:CREATE") && (
          <DropdownMenuItem
            onClick={() => {
              void duplicate(p);
            }}
          >
            <Copy />
            Duplicate product
          </DropdownMenuItem>
        )}
        {can("PRODUCTS:DELETE") && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setArchive(p)}
            >
              <Trash2 />
              Archive product
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <>
      <PageHeader
        title="Product catalog"
        description="Every product, variant and price in one place."
        actions={
          <>
            {can("PRODUCTS:CREATE") && (
              <>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload />
                  Bulk import
                  {!user?.plan?.bulkImport && (
                    <span className="text-[9px] text-muted-foreground">
                      Growth
                    </span>
                  )}
                </Button>
                <Button onClick={() => setEdit(null)}>
                  <Plus />
                  Add product
                </Button>
              </>
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
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Pill tone="primary">{data.allCount} active products</Pill>
            <span className="text-xs text-muted-foreground">
              {data.allCount.toLocaleString()} / {data.limit.toLocaleString()}{" "}
              plan limit
            </span>
            <div className="ml-auto h-1.5 w-28 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary/60"
                style={{
                  width: `${Math.min(100, (data.allCount / data.limit) * 100)}%`,
                }}
              />
            </div>
          </div>
          <Panel>
            <div className="flex flex-wrap items-center gap-3 p-4">
              <div className="relative min-w-48 flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-3 size-3.5 text-muted-foreground" />
                <Input
                  className="h-9 pl-9 text-xs"
                  placeholder="Search by name, SKU or tag"
                  aria-label="Search products"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <SearchSelect
                aria-label="Product category"
                className="field !min-h-9 !w-auto !py-1.5 !text-xs"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </SearchSelect>
              <div className="ml-auto flex gap-1 rounded-lg bg-muted p-1">
                <Button
                  variant={view === "list" ? "outline" : "ghost"}
                  size="icon-xs"
                  aria-label="List view"
                  onClick={() => setView("list")}
                >
                  <List />
                </Button>
                <Button
                  variant={view === "grid" ? "outline" : "ghost"}
                  size="icon-xs"
                  aria-label="Grid view"
                  onClick={() => setView("grid")}
                >
                  <Grid2X2 />
                </Button>
              </div>
            </div>
            {view === "list" ? (
              <DataTable<Product>
                rows={data.products}
                pageSize={12}
                pagination={{ page, total: data.total, onPage: setPage }}
                rowKey={(p) => p.id}
                columns={[
                  {
                    key: "product",
                    label: "Product",
                    render: (p) => (
                      <div className="flex items-center gap-3">
                        <Thumb src={p.images[0]?.url} name={p.name} />
                        <button
                          onClick={() => setDetails(p)}
                          className="text-left"
                        >
                          <span className="block font-medium hover:text-primary">
                            {p.name}
                          </span>
                          <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                            {p.sku}
                          </span>
                        </button>
                      </div>
                    ),
                  },
                  {
                    key: "category",
                    label: "Category",
                    render: (p) => (
                      <span className="text-muted-foreground">
                        {p.category}
                      </span>
                    ),
                  },
                  {
                    key: "price",
                    label: "Unit price",
                    render: (p) => (
                      <>
                        <span className="numeric font-medium">
                          {money(p.pricePaise, true)}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {p.visibility === "PUBLIC"
                            ? "Public price"
                            : p.visibility === "INQUIRY"
                              ? "Price on inquiry"
                              : "Approved sellers"}
                        </span>
                      </>
                    ),
                  },
                  {
                    key: "stock",
                    label: "Available",
                    render: (p) => (
                      <>
                        <span
                          className={`numeric font-medium ${p.stock === 0 ? "text-rose-500" : ""}`}
                        >
                          {p.stock} units
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {p.variants.length} variants · MOQ {p.moq}
                        </span>
                      </>
                    ),
                  },
                  {
                    key: "status",
                    label: "Catalog status",
                    render: (p) => <Status value={p.moderation} />,
                  },
                  {
                    key: "actions",
                    label: "",
                    className: "text-right",
                    render: actions,
                  },
                ]}
                emptyTitle="Your catalog starts here"
                emptyDescription="Add a product or import a CSV to begin tracking its stock."
              />
            ) : (
              <div className="grid gap-4 border-t p-4 sm:grid-cols-2 xl:grid-cols-4">
                {data.products.map((p) => (
                  <div key={p.id} className="overflow-hidden rounded-xl border">
                    <button
                      className="block w-full text-left"
                      onClick={() => setDetails(p)}
                    >
                      <div className="flex aspect-[5/4] items-center justify-center bg-muted">
                        <Thumb
                          src={p.images[0]?.url}
                          name={p.name}
                          size={190}
                        />
                      </div>
                      <div className="p-4 pb-0">
                        <p className="truncate text-[13px] font-medium">
                          {p.name}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          {p.sku}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="numeric text-sm font-semibold">
                            {money(p.pricePaise, true)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {p.stock} units
                          </span>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center justify-between px-4 py-3">
                      <Status value={p.moderation} />
                      {actions(p)}
                    </div>
                  </div>
                ))}
                {!data.products.length && (
                  <div className="col-span-full">
                    <Empty
                      title="No matching products"
                      description="Try another search or category."
                    />
                  </div>
                )}
              </div>
            )}
            {view === "grid" && (
              <Pagination
                page={page}
                pageSize={12}
                total={data.total}
                onPage={setPage}
              />
            )}
          </Panel>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Catalog changes enter platform review before seller discovery.
            Internal billing can use active products immediately.
          </p>
        </>
      )}
      {edit !== undefined && (
        <ProductEditor
          key={edit?.id || "new"}
          product={edit}
          onClose={() => setEdit(undefined)}
          onSaved={() => {
            setEdit(undefined);
            void mutate();
          }}
        />
      )}
      <Dialog
        open={!!details}
        onOpenChange={(v) => {
          if (!v) setDetails(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{details?.name}</DialogTitle>
            <DialogDescription>
              {details?.sku} · {details?.category}
            </DialogDescription>
          </DialogHeader>
          {details && (
            <>
              <div className="flex gap-5">
                <Thumb
                  src={details.images[0]?.url}
                  name={details.name}
                  size={128}
                />
                <div className="flex-1">
                  <Status value={details.moderation} />
                  <p className="numeric mt-4 text-2xl font-semibold">
                    {money(details.pricePaise)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Unit price · MOQ {details.moq}
                  </p>
                  {details.cartonPricePaise && (
                    <p className="mt-2 text-xs">
                      Carton of {details.cartonUnits}:{" "}
                      {money(details.cartonPricePaise)}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs leading-6 text-muted-foreground">
                {details.description || "No product description added."}
              </p>
              {details.moderationNote && (
                <FormError message={details.moderationNote} />
              )}
              <DataTable
                rows={details.variants}
                rowKey={(v) => v.id}
                columns={[
                  { key: "size", label: "Size", render: (v) => v.size },
                  { key: "color", label: "Colour", render: (v) => v.color },
                  { key: "stock", label: "Units", render: (v) => v.stock },
                  {
                    key: "alert",
                    label: "Alert at",
                    render: (v) => v.lowStockAt,
                  },
                ]}
              />
              <DialogFooter>
                {can("INVENTORY:VIEW") && (
                  <Button asChild variant="outline">
                    <Link
                      href={`/dashboard/inventory?q=${encodeURIComponent(details.sku)}`}
                    >
                      View stock ledger
                    </Link>
                  </Button>
                )}
                {can("PRODUCTS:EDIT") && (
                  <Button
                    onClick={() => {
                      setEdit(details);
                      setDetails(null);
                    }}
                  >
                    Edit product
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!archive}
        onOpenChange={(v) => {
          if (!v) setArchive(null);
        }}
        title={`Archive ${archive?.name}?`}
        description="This removes it from active catalog and seller discovery. Its stock ledger and invoice history are retained."
        confirm="Archive product"
        busy={archiveBusy}
        onConfirm={() => {
          void remove();
        }}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSaved={() => {
          setImportOpen(false);
          void mutate();
        }}
      />
    </>
  );
}
export function ProductEditor({
  product,
  onClose,
  onSaved,
  endpoint,
  businessId,
  allowStock = false,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
  endpoint?: string;
  businessId?: string;
  allowStock?: boolean;
}) {
  const { can } = useSession();
  const [draft, setDraft] = useState(() => makeDraft(product || undefined)),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const updateVariant = (
    index: number,
    key: "size" | "color" | "stock" | "lowStockAt",
    value: string | number,
  ) =>
    setDraft((d) => ({
      ...d,
      variants: d.variants.map((v, i) =>
        i === index ? { ...v, [key]: value } : v,
      ),
    }));
  async function upload(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    setError("");
    try {
      if (draft.images.length + files.length > 8)
        throw new Error("A product can have up to 8 images");
      for (const file of Array.from(files)) {
        if (file.size > 8 * 1024 * 1024)
          throw new Error(`${file.name} exceeds 8 MB`);
        const form = new FormData();
        form.append("file", file);
        const image = await api<ImageAsset>(
          `/uploads?kind=PRODUCT${businessId ? `&businessId=${businessId}` : ""}`,
          { method: "POST", body: form },
        );
        setDraft((d) => ({ ...d, images: [...d.images, image] }));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = productSchema.parse({
        name: draft.name,
        sku: draft.sku,
        category: draft.category,
        description: draft.description,
        pricePaise: toPaise(draft.price),
        cartonPricePaise: draft.cartonPrice ? toPaise(draft.cartonPrice) : null,
        cartonUnits: draft.cartonUnits,
        moq: draft.moq,
        visibility: draft.visibility,
        tags: draft.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        imageIds: draft.images.map((i) => i.id),
        variants: draft.variants,
      });
      const saved = await send<Product>(
        endpoint || (product ? `/products/${product.id}` : "/products"),
        input,
        product ? "PATCH" : "POST",
      );
      toast.success(
        product
          ? saved.catalogVersion !== product.catalogVersion ? "Catalog changes saved and queued for review" : "Product saved; catalog approval unchanged"
          : "Product created with an opening stock ledger",
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
        if (!v && !busy && !uploading) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>
            {product ? "Edit product" : "Add a product"}
          </DialogTitle>
          <DialogDescription>
            {product
              ? "Prices and catalog details update here. Adjust stock through inventory."
              : "Add the details, variants and opening stock. Publish after catalog review."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <div className="scrollbar-thin space-y-6 overflow-y-auto p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product name" required>
                <Input
                  required
                  minLength={2}
                  maxLength={160}
                  value={draft.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="e.g. Cotton printed kurti"
                />
              </Field>
              <Field label="SKU / product code" required>
                <Input
                  required
                  value={draft.sku}
                  onChange={(e) => update("sku", e.target.value.toUpperCase())}
                  placeholder="ST-KT-106"
                  className="font-mono"
                />
              </Field>
              <Field label="Category" required>
                <SearchSelect
                  className="field"
                  value={draft.category}
                  onChange={(e) => update("category", e.target.value)}
                >
                  {[...new Set([...categories, draft.category])].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </SearchSelect>
              </Field>
              <Field label="Minimum order quantity" required>
                <Input
                  type="number"
                  min={1}
                  required
                  value={draft.moq}
                  onChange={(e) => update("moq", Number(e.target.value))}
                />
              </Field>
              <Field label="Wholesale unit price (₹)" required>
                <Input
                  required
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => update("price", e.target.value)}
                  placeholder="385.00"
                />
              </Field>
              <Field label="Price visibility">
                <SearchSelect
                  className="field"
                  value={draft.visibility}
                  onChange={(e) =>
                    update("visibility", e.target.value as Draft["visibility"])
                  }
                >
                  <option value="PUBLIC">Public price</option>
                  <option value="APPROVED_SELLERS">
                    Approved sellers only
                  </option>
                  <option value="INQUIRY">Price on inquiry</option>
                </SearchSelect>
              </Field>
              <Field
                label="Carton price (₹)"
                hint="Optional price for one full carton"
              >
                <Input
                  inputMode="decimal"
                  value={draft.cartonPrice}
                  onChange={(e) => update("cartonPrice", e.target.value)}
                  placeholder="4,500.00"
                />
              </Field>
              <Field label="Units per carton">
                <Input
                  type="number"
                  min={1}
                  required
                  value={draft.cartonUnits}
                  onChange={(e) =>
                    update("cartonUnits", Number(e.target.value))
                  }
                />
              </Field>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold">Product images</h3>
                <span className="text-[11px] text-muted-foreground">
                  {draft.images.length}/8 · JPEG, PNG, WebP · Up to 8 MB
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {draft.images.map((image, index) => (
                  <div key={image.id} className="relative">
                    <Thumb
                      src={image.url}
                      name={`Product image ${index + 1}`}
                      size={88}
                    />
                    <button
                      type="button"
                      aria-label={`Remove image ${index + 1}`}
                      onClick={() =>
                        update(
                          "images",
                          draft.images.filter((i) => i.id !== image.id),
                        )
                      }
                      className="absolute -right-1 -top-1 rounded-full border bg-white p-1"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {draft.images.length < 8 && (
                  <label className="flex size-[88px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 text-[11px] text-muted-foreground">
                    <ImagePlus className="mb-1 size-5" />
                    {uploading ? "Uploading…" : "Add images"}
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={uploading}
                      onChange={(e) => {
                        void upload(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            <Field label="Description">
              <Textarea
                rows={3}
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Material, fit, packaging and sourcing details…"
              />
            </Field>
            <Field label="Search tags" hint="Separate tags with commas">
              <Input
                value={draft.tags}
                onChange={(e) => update("tags", e.target.value)}
                placeholder="Cotton, Printed, New arrival"
              />
            </Field>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold">
                  Variants & opening stock
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    update("variants", [
                      ...draft.variants,
                      { size: "", color: "", stock: 0, lowStockAt: 10 },
                    ])
                  }
                >
                  <Plus />
                  Add variant
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <div className="grid min-w-[580px] grid-cols-[1fr_1fr_100px_100px_36px] gap-2 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                  <span>SIZE</span>
                  <span>COLOUR</span>
                  <span>{product ? "CURRENT STOCK" : "OPENING STOCK"}</span>
                  <span>LOW STOCK AT</span>
                  <span />
                </div>
                {draft.variants.map((v, index) => (
                  <div
                    key={v.id || `new-${index}`}
                    className="grid min-w-[580px] grid-cols-[1fr_1fr_100px_100px_36px] gap-2 border-t px-3 py-2"
                  >
                    <Input
                      aria-label={`Variant ${index + 1} size`}
                      required
                      value={v.size}
                      onChange={(e) =>
                        updateVariant(index, "size", e.target.value)
                      }
                      placeholder="M"
                    />
                    <Input
                      aria-label={`Variant ${index + 1} colour`}
                      required
                      value={v.color}
                      onChange={(e) =>
                        updateVariant(index, "color", e.target.value)
                      }
                      placeholder="Sage"
                    />
                    <Input
                      aria-label={`Variant ${index + 1} stock`}
                      type="number"
                      min={0}
                      required
                      disabled={
                        !!product || (!allowStock && !can("INVENTORY:CREATE"))
                      }
                      value={v.stock}
                      onChange={(e) =>
                        updateVariant(index, "stock", Number(e.target.value))
                      }
                    />
                    <Input
                      aria-label={`Variant ${index + 1} stock alert`}
                      type="number"
                      min={0}
                      required
                      value={v.lowStockAt}
                      onChange={(e) =>
                        updateVariant(
                          index,
                          "lowStockAt",
                          Number(e.target.value),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={
                        draft.variants.length === 1 || (!!v.id && v.stock > 0)
                      }
                      aria-label={`Remove variant ${index + 1}`}
                      onClick={() =>
                        update(
                          "variants",
                          draft.variants.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              {product && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  New variants start with zero stock. Variants with remaining
                  stock cannot be removed.
                </p>
              )}
            </div>
            <FormError message={error} />
          </div>
          <DialogFooter className="border-t bg-muted/20 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={busy || uploading}
              onClick={onClose}
            >
              Cancel
            </Button>
            <BusyButton busy={busy || uploading} type="submit">
              {product ? "Save product" : "Create product"}
            </BusyButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
