"use client";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Heart,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
} from "lucide-react";
import { categories, money } from "@wholesale/shared";
import type { Inquiry, SellerProduct, Supplier } from "@/lib/types";
import { date, errorMessage, send } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
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
  Initials,
  Loading,
  PageHeader,
  Panel,
  Pill,
  Status,
  Thumb,
} from "@/components/common";
type Discovery = {
  products: SellerProduct[];
  total: number;
  supplierCount: number;
  page: number;
};
export function Discover({ saved = false }: { saved?: boolean }) {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || ""),
    [category, setCategory] = useState(""),
    [city, setCity] = useState(""),
    [market, setMarket] = useState(""),
    [inStock, setInStock] = useState(false),
    [sort, setSort] = useState("new"),
    [filters, setFilters] = useState(false),
    [minPrice, setMinPrice] = useState(""),
    [maxPrice, setMaxPrice] = useState(""),
    [page, setPage] = useState(1);
  const searchQuery = useDebouncedValue(query);
  const { data: rankings } =
    useSWR<{ category: string; products: number; score: number }[]>(
      "/seller/categories",
    );
  const categoryNames = [
    ...new Set([...(rankings || []).map((r) => r.category), ...categories]),
  ];
  const key = `/seller/discover?${new URLSearchParams({ q: searchQuery, category, city, market, inStock: String(inStock), sort, favorites: String(saved), minPrice, maxPrice, page: String(page) })}`;
  const { data, error, mutate } = useSWR<Discovery>(key, {
    refreshInterval: 15000,
  });
  async function favorite(p: SellerProduct) {
    try {
      await send(`/seller/products/${p.id}/favorite`, {
        favorite: !p.favorite,
      });
      await mutate();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="YOUR SOURCING DESK"
        title={
          saved ? "Saved for your next purchase" : "Find your next best seller."
        }
        description={
          saved
            ? "Your shortlist of products and suppliers."
            : "Discover wholesale products. Check live stock. Contact suppliers directly."
        }
        actions={
          <Pill tone="success" dot>
            Direct sourcing · Free discovery
          </Pill>
        }
      />
      {!saved && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#e6e3fb] bg-[#f1effb] px-5 py-4">
          <Store className="size-5 text-primary" />
          <div>
            <p className="text-xs font-medium text-[#625a9c]">
              Source from verified wholesale businesses
            </p>
            <p className="mt-1 text-[11px] text-[#9790b5]">
              Stock and prices come from supplier catalogs. Discuss dispatch and
              payment terms directly.
            </p>
          </div>
          <span className="ml-auto text-[11px] text-[#7a719f]">
            {data?.supplierCount ?? "…"} verified suppliers
          </span>
        </div>
      )}
      <Panel className="mb-5">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="h-11 pl-10"
              aria-label="Search wholesale products"
              placeholder="Search products, suppliers or SKUs…"
            />
          </div>
          <select
            aria-label="Category"
            className="field !w-auto !text-xs"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categoryNames.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Button
            variant={filters ? "secondary" : "outline"}
            onClick={() => setFilters((v) => !v)}
          >
            <SlidersHorizontal />
            Filters
          </Button>
          <select
            aria-label="Sort products"
            className="field !w-auto !text-xs"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="new">New arrivals</option>
            <option value="trending">Trending</option>
            <option value="price">Price: low to high</option>
          </select>
        </div>
        {filters && (
          <div className="grid gap-3 border-t p-4 sm:grid-cols-4">
            <Field label="City">
              <Input
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. Surat"
              />
            </Field>
            <Field label="Market / area">
              <Input
                value={market}
                onChange={(e) => {
                  setMarket(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. Ring Road"
              />
            </Field>
            <Field label="Min unit price (₹)">
              <Input
                type="number"
                min={0}
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPage(1);
                }}
              />
            </Field>
            <Field label="Max unit price (₹)">
              <Input
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPage(1);
                }}
              />
            </Field>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-[11px] text-muted-foreground">
            {data
              ? `${data.total} products match your sourcing needs`
              : "Loading products…"}
          </p>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Checkbox
              checked={inStock}
              onCheckedChange={(v) => {
                setInStock(v === true);
                setPage(1);
              }}
            />
            In stock only
          </label>
        </div>
      </Panel>
      {error ? (
        <ErrorState
          error={error}
          retry={() => {
            void mutate();
          }}
        />
      ) : !data ? (
        <Loading />
      ) : data.products.length ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {data.products.map((p) => (
              <article key={p.id} className="panel overflow-hidden">
                <div className="relative aspect-[5/4] bg-[#f3f0eb]">
                  <Link
                    href={`/seller/products/${p.id}`}
                    className="absolute inset-0"
                  >
                    {p.images[0] ? (
                      <Image
                        src={p.images[0].url}
                        alt={p.name}
                        fill
                        sizes="(max-width:768px) 100vw, 300px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="size-12 text-stone-300" />
                      </div>
                    )}
                  </Link>
                  <div className="absolute left-3 top-3">
                    <Pill tone={p.stock > 0 ? "success" : "neutral"} dot>
                      {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                    </Pill>
                  </div>
                  <button
                    aria-label={`${p.favorite ? "Unsave" : "Save"} ${p.name}`}
                    onClick={() => {
                      void favorite(p);
                    }}
                    className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/95 shadow-sm"
                  >
                    <Heart
                      className={`size-4 ${p.favorite ? "fill-primary text-primary" : "text-stone-500"}`}
                    />
                  </button>
                </div>
                <div className="p-4">
                  <p className="text-[10px] text-muted-foreground">
                    {p.category} · {p.variants.length} variants
                  </p>
                  <Link
                    href={`/seller/products/${p.id}`}
                    className="mt-2 block truncate text-sm font-semibold hover:text-primary"
                  >
                    {p.name}
                  </Link>
                  <div className="mt-3 flex items-end justify-between">
                    <span
                      className={`numeric text-xl font-semibold tracking-tight ${p.pricePaise === null ? "text-[13px] text-muted-foreground" : ""}`}
                    >
                      {p.pricePaise !== null ? (
                        money(p.pricePaise, true)
                      ) : (
                        <span className="flex items-center gap-1">
                          <LockKeyhole className="size-3" />
                          Price on request
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      MOQ {p.moq}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-2 border-t pt-3">
                    <span className="flex size-7 items-center justify-center rounded-md bg-violet-50 text-primary">
                      <Store className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate text-[11px] font-medium">
                        {p.business.name}
                        <ShieldCheck className="size-3 text-emerald-600" />
                      </p>
                      <p className="mt-0.5 text-[9px] text-muted-foreground">
                        {p.business.marketArea}, {p.business.city}
                      </p>
                    </div>
                    <Link
                      href={`/seller/products/${p.id}`}
                      aria-label={`View ${p.name}`}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-5 flex justify-between gap-3 text-[11px] text-muted-foreground">
            <span>
              Page {page} of {Math.max(1, Math.ceil(data.total / 24))} · Stock
              refreshes while you browse
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page * 24 >= data.total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : (
        <Panel>
          <Empty
            title={
              saved ? "Build your sourcing shortlist" : "No products match yet"
            }
            description={
              saved
                ? "Tap the heart on a product to save it here."
                : "Try a different search, category or stock filter."
            }
            action={
              saved ? (
                <Button asChild variant="outline">
                  <Link href="/seller">Explore products</Link>
                </Button>
              ) : undefined
            }
          />
        </Panel>
      )}
    </>
  );
}
export function SellerProductDetail({ id }: { id: string }) {
  const {
    data: product,
    error,
    mutate,
  } = useSWR<SellerProduct>(`/seller/products/${id}`, {
    refreshInterval: 15000,
  });
  const [imageIndex, setImageIndex] = useState(0),
    [channel, setChannel] = useState<"CALL" | "WHATSAPP" | null>(null);
  async function favorite() {
    try {
      await send(`/seller/products/${id}/favorite`, {
        favorite: !product!.favorite,
      });
      await mutate();
    } catch (e) {
      toast.error(errorMessage(e));
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
  if (!product) return <Loading />;
  return (
    <>
      <Link
        href="/seller"
        className="mb-5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="size-3" />
        Back to discovery
      </Link>
      <PageHeader
        title={product.name}
        description={`${product.sku} · ${product.category}`}
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void favorite();
            }}
          >
            <Heart
              className={product.favorite ? "fill-primary text-primary" : ""}
            />
            {product.favorite ? "Saved" : "Save product"}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Panel className="overflow-hidden">
          <div className="relative aspect-square bg-[#f3f0eb]">
            {product.images[imageIndex] ? (
              <Image
                src={product.images[imageIndex].url}
                alt={product.name}
                fill
                sizes="600px"
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package className="size-16 text-muted-foreground" />
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-3 p-4">
              {product.images.map((image, index) => (
                <button
                  key={image.id}
                  aria-label={`View product image ${index + 1}`}
                  onClick={() => setImageIndex(index)}
                  className={`rounded-lg ${index === imageIndex ? "ring-2 ring-primary ring-offset-2" : ""}`}
                >
                  <Thumb src={image.url} name={product.name} size={58} />
                </button>
              ))}
            </div>
          )}
        </Panel>
        <div className="space-y-5">
          <Panel>
            <div className="space-y-5 p-6">
              <div className="flex justify-between">
                <Pill tone="success" dot>
                  Live catalog stock
                </Pill>
                <span className="text-xs text-muted-foreground">
                  MOQ {product.moq} units
                </span>
              </div>
              <div>
                <p className="numeric text-4xl font-semibold tracking-tight">
                  {product.pricePaise !== null
                    ? money(product.pricePaise)
                    : "Price on request"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {product.pricePaise !== null
                    ? "Wholesale price per unit"
                    : product.visibility === "APPROVED_SELLERS"
                      ? "This supplier shares prices with approved sellers. Contact them to request access."
                      : "Contact the supplier for current pricing."}
                </p>
                {product.cartonPricePaise !== null && (
                  <p className="mt-3 text-xs">
                    Carton of {product.cartonUnits} units:{" "}
                    <strong>{money(product.cartonPricePaise)}</strong>
                  </p>
                )}
              </div>
              <div className="rounded-lg border">
                <DataTable
                  rows={product.variants}
                  pageSize={8}
                  rowKey={(v) => v.id}
                  columns={[
                    { key: "size", label: "Size", render: (v) => v.size },
                    { key: "color", label: "Colour", render: (v) => v.color },
                    {
                      key: "stock",
                      label: "Available",
                      className: "text-right",
                      render: (v) => (
                        <span
                          className={`numeric font-medium ${v.stock === 0 ? "text-muted-foreground" : "text-emerald-600"}`}
                        >
                          {v.stock} units
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
              <p className="text-xs leading-6 text-muted-foreground">
                {product.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.tags.map((t) => (
                  <Pill key={t}>{t}</Pill>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  disabled={product.business.contactPreference === "CALL"}
                  onClick={() => setChannel("WHATSAPP")}
                >
                  <MessageCircle />
                  Contact on WhatsApp
                </Button>
                <Button
                  disabled={product.business.contactPreference === "WHATSAPP"}
                  variant="outline"
                  onClick={() => setChannel("CALL")}
                >
                  <Phone />
                  Call supplier
                </Button>
              </div>
              <p className="text-[10px] leading-5 text-muted-foreground">
                Confirm availability, commercial terms and dispatch with the
                supplier. Contacting them records a sourcing inquiry.
              </p>
            </div>
          </Panel>
          <Panel
            title="About the supplier"
            action={
              <Pill tone="success">
                <ShieldCheck className="size-3" />
                Verified
              </Pill>
            }
          >
            <div className="space-y-3 border-t p-5">
              <div className="flex items-center gap-3">
                <Initials name={product.business.name} />
                <div>
                  <p className="text-sm font-semibold">
                    {product.business.name}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="size-3" />
                    {product.business.marketArea}, {product.business.city}
                  </p>
                </div>
              </div>
              <p className="text-xs leading-6 text-muted-foreground">
                {product.business.description}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {product.business.address}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {product.business.deliveryInfo}
              </p>
            </div>
          </Panel>
        </div>
      </div>
      {channel && (
        <ContactDialog
          key={channel}
          product={product}
          channel={channel}
          onClose={() => setChannel(null)}
        />
      )}
    </>
  );
}
function ContactDialog({
  product,
  channel,
  onClose,
}: {
  product: SellerProduct;
  channel: "CALL" | "WHATSAPP";
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(product.moq),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [prepared, setPrepared] = useState<{
      inquiryId: string;
      href: string;
    } | null>(null);
  const [requestKey] = useState(() => crypto.randomUUID());
  async function prepare(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setPrepared(
        await send("/seller/contact", {
          productId: product.id,
          channel,
          quantity,
          note,
          requestKey,
        }),
      );
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
          <DialogTitle>
            {prepared
              ? "Your inquiry is ready"
              : `Contact ${product.business.name}`}
          </DialogTitle>
          <DialogDescription>
            {product.name} · {product.sku}
          </DialogDescription>
        </DialogHeader>
        {prepared ? (
          <>
            <div className="rounded-lg bg-emerald-50 p-4 text-xs leading-6 text-emerald-800">
              <Check className="mb-2 size-5" />
              Inquiry saved for {quantity} units.{" "}
              {channel === "WHATSAPP"
                ? "Open WhatsApp to send the prepared message and product reference."
                : "Use the phone link below to call the supplier."}
            </div>
            <Button asChild>
              <a
                href={prepared.href}
                target={channel === "WHATSAPP" ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                {channel === "WHATSAPP" ? <MessageCircle /> : <Phone />}
                {channel === "WHATSAPP"
                  ? "Open WhatsApp"
                  : `Call +91 ${product.business.phone}`}
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/seller/inquiries">View my inquiries</Link>
            </Button>
          </>
        ) : (
          <form onSubmit={prepare} className="space-y-4">
            <Field label="Quantity you are sourcing" required>
              <Input
                type="number"
                required
                min={product.moq}
                max={100000}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                autoFocus
              />
            </Field>
            <Field label="Sourcing note">
              <Textarea
                maxLength={500}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Colours, quantities, dispatch timing or pricing request…"
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
                {channel === "WHATSAPP"
                  ? "Prepare WhatsApp inquiry"
                  : "Prepare supplier call"}
                <ArrowRight />
              </BusyButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function Suppliers() {
  const { data, error, mutate } = useSWR<Supplier[]>("/seller/suppliers");
  const [query, setQuery] = useState(""),
    [savedOnly, setSavedOnly] = useState(false);
  async function saveSupplier(b: Supplier) {
    try {
      await send(`/seller/suppliers/${b.id}/favorite`, {
        favorite: !b.favorite,
      });
      await mutate();
      toast.success(
        b.favorite
          ? "Supplier removed from saved list"
          : "Supplier saved. Choose new-arrival alerts in Notifications.",
      );
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <>
      <PageHeader
        title="Wholesale suppliers"
        description="Find verified businesses and explore their available catalogs."
      />
      <div className="mb-4">
        <Button
          size="sm"
          variant={savedOnly ? "secondary" : "outline"}
          onClick={() => setSavedOnly((v) => !v)}
        >
          <Heart />
          {savedOnly ? "Saved suppliers" : "Show saved suppliers"}
        </Button>
      </div>
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Name, category or market"
          aria-label="Search suppliers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
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
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {data
            .filter((b) => !savedOnly || b.favorite)
            .filter((b) =>
              `${b.name} ${b.categories.join(" ")} ${b.marketArea} ${b.city}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((b) => (
              <Panel key={b.id}>
                <div className="space-y-4 p-5">
                  <div className="flex items-center gap-3">
                    <Initials name={b.name} />
                    <div>
                      <h2 className="text-sm font-semibold">{b.name}</h2>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {b.marketArea}, {b.city}
                      </p>
                    </div>
                    <Button
                      className="ml-auto"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`${b.favorite ? "Unsave" : "Save"} supplier ${b.name}`}
                      onClick={() => {
                        void saveSupplier(b);
                      }}
                    >
                      <Heart
                        className={
                          b.favorite ? "fill-primary text-primary" : ""
                        }
                      />
                    </Button>
                    <ShieldCheck className="size-4 text-emerald-600" />
                  </div>
                  <p className="text-xs leading-6 text-muted-foreground">
                    {b.description ||
                      "Explore this supplier's catalog for sourcing details."}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {b.categories.map((c) => (
                      <Pill key={c}>{c}</Pill>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t pt-4">
                    <span className="text-[11px] text-muted-foreground">
                      {b._count?.products || 0} published products
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/seller?q=${encodeURIComponent(b.name)}`}>
                        Explore catalog
                        <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                </div>
              </Panel>
            ))}
        </div>
      )}
    </>
  );
}
export function SellerInquiries() {
  const { data, error, mutate } = useSWR<Inquiry[]>("/seller/inquiries", {
    refreshInterval: 15000,
  });
  return (
    <>
      <PageHeader
        title="My sourcing inquiries"
        description="Your product references, contacts and supplier updates."
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
        <Panel>
          <DataTable
            rows={data}
            rowKey={(i) => i.id}
            columns={[
              {
                key: "product",
                label: "Product",
                render: (i) => (
                  <Link
                    href={`/seller/products/${i.product.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {i.product.name}
                    <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                      {i.product.sku}
                    </span>
                  </Link>
                ),
              },
              {
                key: "supplier",
                label: "Supplier",
                render: (i) => (
                  <>
                    <p>{i.business?.name}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {i.business?.marketArea}
                    </p>
                  </>
                ),
              },
              {
                key: "quantity",
                label: "Quantity",
                render: (i) => `${i.quantity} units`,
              },
              {
                key: "contact",
                label: "Channel",
                render: (i) => (
                  <span className="text-muted-foreground">
                    {i.channel.toLowerCase()}
                  </span>
                ),
              },
              {
                key: "status",
                label: "Stage",
                render: (i) => <Status value={i.status} />,
              },
              {
                key: "note",
                label: "Your note",
                render: (i) => (
                  <p className="max-w-52 text-[11px] text-muted-foreground">
                    {i.note || "—"}
                  </p>
                ),
              },
              {
                key: "date",
                label: "Created",
                render: (i) => date(i.createdAt),
              },
            ]}
            emptyTitle="Start a sourcing conversation"
            emptyDescription="Contact a supplier from any product page. Your inquiry will be recorded here."
          />
        </Panel>
      )}
    </>
  );
}
