"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  LayoutGrid,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  ReceiptText,
  Search,
  ShieldCheck,
  Store,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { categories, money } from "@wholesale/shared";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, ErrorState, Loading, Pagination } from "@/components/common";
import { home, useSession } from "@/components/session";
import { SupplierDirectory } from "@/components/supplier-directory";

export type MarketProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  moq: number;
  pricePaise: number | null;
  stock: number;
  tags: string[];
  images: { url: string }[];
  variants: { size: string; color: string; stock: number }[];
  business: {
    name: string;
    city: string;
    marketArea: string;
    description: string;
    deliveryInfo: string;
  };
};
type Results = { products: MarketProduct[]; total: number; page: number };
type Plan = {
  id: string;
  name: string;
  monthlyPricePaise: number;
  productLimit: number;
  staffLimit: number;
  bulkImport: boolean;
  advancedReports: boolean;
};
export function PublicHeader() {
  const [open, setOpen] = useState(false),
    { user } = useSession();
  return (
    <header className="market-header sticky top-0 z-30 border-b bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-8 px-5 lg:px-10">
        <Link href="/" aria-label="Wholseler home">
          <Brand />
        </Link>
        <nav
          aria-label="Main navigation"
          className="ml-6 hidden items-center gap-7 text-sm text-muted-foreground lg:flex"
        >
          <Link href="/marketplace" className="hover:text-primary">
            Marketplace
          </Link>
          <Link href="/#supplier-directory" className="hover:text-primary">Suppliers</Link>
          <Link href="/#wholesalers" className="hover:text-primary">
            For wholesalers
          </Link>
          <Link href="/#how-it-works" className="hover:text-primary">
            How it works
          </Link>
          <Link href="/#plans" className="hover:text-primary">
            Plans
          </Link>
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {user ? (
            <Button asChild>
              <Link href={home(user)}>
                My workspace
                <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login/wholesaler">Sign in</Link>
              </Button>
              <Button asChild>
                <Link href="/register/wholesaler">
                  List your business
                  <ArrowRight />
                </Link>
              </Button>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto lg:hidden"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="public-mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav
          id="public-mobile-nav"
          aria-label="Mobile navigation"
          className="grid gap-1 border-t px-5 py-4 lg:hidden"
        >
          {[
            ["Marketplace", "/marketplace"],
            ["Suppliers", "/#supplier-directory"],
            ["For wholesalers", "/#wholesalers"],
            ["How it works", "/#how-it-works"],
            ["Plans", "/#plans"],
            ["Wholesaler sign in", "/login/wholesaler"],
            ["Buyer sign in", "/login/buyer"],
            ["Register your business", "/register/wholesaler"],
          ].map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="rounded-lg px-3 py-3 text-sm hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
export function PublicFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:grid-cols-[1.5fr_1fr_1fr] lg:px-10">
        <div>
          <Brand />
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
            The wholesale market, connected.
            <br />
            Better sourcing. A smoother business day.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider">
            For your business
          </p>
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
            <Link href="/marketplace">Browse the marketplace</Link>
            <Link href="/#supplier-directory">Surat supplier directory</Link>
            <Link href="/register/buyer">Create a buyer account</Link>
            <Link href="/register/wholesaler">Register as a wholesaler</Link>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider">
            Your workspace
          </p>
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
            <Link href="/login/wholesaler">Wholesaler sign in</Link>
            <Link href="/login/buyer">Buyer sign in</Link>
            <Link href="/login/team">Staff & platform sign in</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-2 border-t px-5 py-5 text-xs text-muted-foreground lg:px-10">
        <span>© {new Date().getFullYear()} Wholseler</span>
        <span>Products and commercial terms are provided by suppliers.</span>
      </div>
    </footer>
  );
}
function ProductCard({ product }: { product: MarketProduct }) {
  return (
    <article className="group overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg">
      <Link href={`/marketplace/${product.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {product.images[0] ? (
            <Image
              src={product.images[0].url}
              alt={product.name}
              fill
              sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 300px"
              unoptimized
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="size-14 text-muted-foreground/30" />
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-card/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide">
            {product.category}
          </span>
        </div>
        <div className="p-5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            {product.business.city} · {product.business.marketArea}
          </p>
          <h3 className="mt-3 line-clamp-2 min-h-12 text-base font-semibold leading-6 tracking-tight">
            {product.name}
          </h3>
          <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0 text-primary" />
            {product.business.name}
          </p>
          <div className="mt-5 flex items-end justify-between border-t pt-4">
            <p className="text-lg font-semibold tracking-tight">
              {product.pricePaise === null ? (
                <span className="text-sm">Price on request</span>
              ) : (
                money(product.pricePaise, true)
              )}
              {product.pricePaise !== null && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / unit
                </span>
              )}
            </p>
            <span className="text-xs text-muted-foreground">
              MOQ {product.moq}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
function ProductResults({
  data,
  error,
  retry,
}: {
  data?: Results;
  error?: Error;
  retry: () => void;
}) {
  if (error) return <ErrorState error={error} retry={retry} />;
  if (!data) return <Loading />;
  if (!data.products.length)
    return (
      <Empty
        title="No products found"
        description="Try another category or search. Published products from verified suppliers will appear here."
      />
    );
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {data.products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
export function MarketplaceHome() {
  const [query, setQuery] = useState("");
  const { data, error, mutate } = useSWR<Results>("/marketplace/products");
  const {
    data: plans,
    error: plansError,
    mutate: retryPlans,
  } = useSWR<Plan[]>("/marketplace/plans");
  return (
    <div className="market-page">
      <PublicHeader />
      <main>
        <section className="market-hero border-b">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:px-10 lg:py-20">
            <div>
              <p className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-primary">
                <span className="size-2 rounded-full bg-primary" />
                For the people who keep markets moving
              </p>
              <h1 className="max-w-xl text-5xl font-semibold leading-[1.07] tracking-[-2.5px] sm:text-6xl lg:text-7xl">
                Your next
                <br />
                best seller.
                <br />
                <span className="text-primary">Starts here.</span>
              </h1>
              <p className="mt-7 max-w-md text-base leading-7 text-muted-foreground">
                Explore wholesale collections, find the right supplier and
                source directly. Less searching around. More moving forward.
              </p>
              <form
                action="/marketplace"
                className="mt-8 flex max-w-lg items-center gap-2 rounded-2xl border bg-card p-2 shadow-sm"
              >
                <Search className="ml-3 size-5 shrink-0 text-muted-foreground" />
                <Input
                  name="q"
                  aria-label="Search the marketplace"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Try kurtis, sarees or a supplier…"
                  className="h-11 min-w-0 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                />
                <Button type="submit" className="h-11 rounded-xl">
                  Explore
                  <ArrowRight className="hidden sm:block" />
                </Button>
              </form>
              <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <Link
                  href="/marketplace?category=Kurtis"
                  className="hover:text-primary"
                >
                  Kurtis ↗
                </Link>
                <Link
                  href="/marketplace?category=Sarees"
                  className="hover:text-primary"
                >
                  Sarees ↗
                </Link>
                <Link
                  href="/marketplace?category=Menswear"
                  className="hover:text-primary"
                >
                  Menswear ↗
                </Link>
              </div>
            </div>
            <div className="hero-market-card relative overflow-hidden rounded-3xl border bg-card p-5 shadow-xl sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    Your sourcing desk
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-tight">
                    A market full of possibilities.
                  </p>
                </div>
                <Boxes className="size-8 text-primary" />
              </div>
              <div className="mt-7 grid grid-cols-2 gap-3">
                {[
                  ["Kurtis", "Everyday to occasion", "01"],
                  ["Sarees", "Fresh collections", "02"],
                  ["Menswear", "Ready for your shelves", "03"],
                  ["Home textiles", "The finishing touches", "04"],
                ].map(([name, description, index]) => (
                  <Link
                    key={name}
                    href={`/marketplace?category=${encodeURIComponent(name)}`}
                    className="hero-category rounded-2xl border p-5 transition-colors hover:border-primary"
                  >
                    <p className="font-mono text-xs text-primary/60">
                      /{index}
                    </p>
                    <div className="my-6 flex justify-center">
                      <CategoryIcon
                        category={name}
                        className="size-14 text-primary"
                      />
                    </div>
                    <p className="font-semibold">
                      {name}
                      <ArrowRight className="float-right mt-1 size-4" />
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {description}
                    </p>
                  </Link>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" />
                Published catalogs from verified businesses
              </div>
            </div>
          </div>
        </section>
        <div className="border-b bg-card">
          <div className="mx-auto grid max-w-7xl gap-4 px-5 py-6 sm:grid-cols-3 lg:px-10">
            {[
              [
                ShieldCheck,
                "Know your supplier",
                "Platform-reviewed business profiles",
              ],
              [Package, "Know your product", "MOQ, variants and catalog stock"],
              [
                MessageCircle,
                "Make the connection",
                "Speak directly on WhatsApp or call",
              ],
            ].map(([Icon, title, text]) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <div key={String(title)} className="flex items-center gap-4">
                  <I className="size-6 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">{String(title)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {String(text)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-5 py-12 lg:px-10"><SupplierDirectory /></div>
        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-10">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Explore the catalog
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Fresh finds for your business.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Available products from published wholesale catalogs.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/marketplace">
                View marketplace
                <ArrowRight />
              </Link>
            </Button>
          </div>
          <ProductResults
            data={
              data
                ? { ...data, products: data.products.slice(0, 4) }
                : undefined
            }
            error={error}
            retry={() => void mutate()}
          />
        </section>
        <section id="wholesalers" className="scroll-mt-24 border-y bg-card">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-2 lg:px-10 lg:py-20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                For wholesalers
              </p>
              <h2 className="mt-5 max-w-md text-4xl font-semibold leading-tight tracking-[-1.5px]">
                The busy counter.
                <br />
                The growing catalog.
                <br />
                <span className="text-muted-foreground">
                  One clear workspace.
                </span>
              </h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">
                Keep your daily work connected—from adding new stock to issuing
                a bill. Publish your catalog for buyers when your business and
                products are approved.
              </p>
              <Button asChild className="mt-7 h-12 rounded-xl">
                <Link href="/register/wholesaler">
                  Register your wholesale business
                  <ArrowRight />
                </Link>
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Already registered?{" "}
                <Link href="/login/wholesaler" className="text-primary">
                  Sign in to your workspace
                </Link>
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                [
                  LayoutGrid,
                  "Your entire catalog",
                  "Images, sizes, colours, MOQ and price visibility.",
                ],
                [
                  Warehouse,
                  "Stock you can follow",
                  "Purchases, sales, returns and adjustments in one ledger.",
                ],
                [
                  ReceiptText,
                  "Billing at your pace",
                  "GST or non-GST invoices, payments and outstanding dues.",
                ],
                [
                  Users,
                  "A team in sync",
                  "Give each staff member the modules they need.",
                ],
              ].map(([Icon, title, text]) => {
                const I = Icon as typeof LayoutGrid;
                return (
                  <div
                    key={String(title)}
                    className="rounded-2xl border bg-background p-6"
                  >
                    <I className="size-6 text-primary" />
                    <h3 className="mt-5 text-base font-semibold">
                      {String(title)}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {String(text)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        <section
          id="how-it-works"
          className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 lg:px-10"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            From browsing to business
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            A shorter route to the right supplier.
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              [
                "01",
                "Find your collection",
                "Search by product, category or city. Open a product to check the details.",
              ],
              [
                "02",
                "Create your buyer profile",
                "Verify your mobile and add your store details. Keep a shortlist and your inquiry history.",
              ],
              [
                "03",
                "Talk directly",
                "Send a WhatsApp inquiry or call the supplier. Agree on payment and dispatch together.",
              ],
            ].map(([n, title, text]) => (
              <div key={n} className="border-t pt-5">
                <p className="font-mono text-sm text-primary">/{n}</p>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section id="plans" className="scroll-mt-24 border-y bg-card">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-10">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                Wholesaler plans
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Room for the way you work.
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Buyer discovery is free. Business plans include catalog,
                inventory and billing.
              </p>
            </div>
            {plansError ? (
              <ErrorState error={plansError} retry={() => void retryPlans()} />
            ) : !plans ? (
              <Loading />
            ) : !plans.length ? (
              <Empty
                title="Plans are being updated"
                description="Please check back before registering your business."
              />
            ) : (
              <div className="grid gap-5 md:grid-cols-3">
                {plans.map((plan, index) => (
                  <article
                    key={plan.id}
                    className={`relative rounded-2xl border p-7 ${index === 1 ? "border-primary bg-secondary/40" : "bg-background"}`}
                  >
                    <p className="text-base font-semibold">{plan.name}</p>
                    <p className="mt-6 text-3xl font-semibold tracking-tight">
                      {money(plan.monthlyPricePaise, true)}
                      <span className="text-xs font-normal text-muted-foreground">
                        {" "}
                        / month
                      </span>
                    </p>
                    <div className="mt-6 space-y-3 text-sm">
                      {[
                        `${plan.productLimit.toLocaleString()} active products`,
                        `${plan.staffLimit} staff members`,
                        "Inventory & counter billing",
                        ...(plan.bulkImport
                          ? ["Excel / CSV & image imports"]
                          : []),
                        ...(plan.advancedReports ? ["Advanced reports"] : []),
                      ].map((text) => (
                        <p key={text} className="flex items-center gap-2">
                          <Check className="size-4 text-primary" />
                          {text}
                        </p>
                      ))}
                    </div>
                    <Button
                      asChild
                      variant={index === 1 ? "default" : "outline"}
                      className="mt-8 w-full"
                    >
                      <Link href="/register/wholesaler">
                        Create your business
                        <ArrowRight />
                      </Link>
                    </Button>
                  </article>
                ))}
              </div>
            )}
            <p className="mt-5 text-xs text-muted-foreground">
              New businesses receive a 30-day trial on the lowest-priced active
              plan. Contact the platform team for monthly or yearly renewal;
              received payments and receipts appear in your workspace.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-10">
          <div className="grid gap-10 md:grid-cols-[1fr_1.5fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                A few things to know
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Before you get started.
              </h2>
            </div>
            <div className="divide-y">
              {[
                [
                  "Do I need to sign in to browse?",
                  "You can browse published products without signing in. Create a buyer profile to save products and record supplier inquiries.",
                ],
                [
                  "Who handles payments and delivery?",
                  "You agree on pricing, payments and dispatch directly with the supplier. Wholseler records inquiries; it does not process marketplace orders or payments.",
                ],
                [
                  "How does a wholesaler get listed?",
                  "Register with your mobile, complete your business profile and add your products. The platform team reviews business profiles and product listings before they appear publicly.",
                ],
                [
                  "Can my staff sign in separately?",
                  "Yes. The owner adds staff using their mobile numbers and assigns permissions. Staff then use team sign in.",
                ],
              ].map(([question, answer]) => (
                <details key={question} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-sm font-semibold">
                    {question}
                    <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
function CategoryIcon({
  category,
  className,
}: {
  category: string;
  className: string;
}) {
  // Editorial category symbols are illustrations, not invented product photos.
  if (category === "Home textiles")
    return <Warehouse className={className} strokeWidth={1} />;
  if (category === "Menswear")
    return <Store className={className} strokeWidth={1} />;
  return <Boxes className={className} strokeWidth={1} />;
}
export function MarketplaceBrowse() {
  const params = useSearchParams(),
    [query, setQuery] = useState(params.get("q") || ""),
    [search, setSearch] = useState(params.get("q") || ""),
    [category, setCategory] = useState(params.get("category") || ""),
    [city, setCity] = useState(""),
    [page, setPage] = useState(1);
  const { data, error, mutate } = useSWR<Results>(
    `/marketplace/products?${new URLSearchParams({ q: search, category, city, page: String(page) })}`,
  );
  return (
    <div className="market-page">
      <PublicHeader />
      <main className="mx-auto min-h-[65vh] max-w-7xl px-5 py-12 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          The wholesale marketplace
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Find what your business needs.
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Browse collections from verified suppliers. Sign in as a buyer to
          contact them.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query);
            setPage(1);
          }}
          className="mt-8 flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4"
        >
          <div className="min-w-48 flex-1">
            <label
              htmlFor="market-search"
              className="mb-2 block text-xs font-medium"
            >
              Product or supplier
            </label>
            <Input
              id="market-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products or suppliers"
              className="h-11"
            />
          </div>
          <div className="min-w-40">
            <label
              htmlFor="market-category"
              className="mb-2 block text-xs font-medium"
            >
              Category
            </label>
            <select
              id="market-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="field h-11"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="min-w-32">
            <label
              htmlFor="market-city"
              className="mb-2 block text-xs font-medium"
            >
              City
            </label>
            <Input
              id="market-city"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setPage(1);
              }}
              placeholder="Any city"
              className="h-11"
            />
          </div>
          <Button type="submit" className="h-11">
            <Search />
            Search
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => {
              setQuery("");
              setSearch("");
              setCategory("");
              setCity("");
              setPage(1);
            }}
          >
            Reset
          </Button>
        </form>
        <div className="my-10"><SupplierDirectory query={search} category={category} city={city} /></div>
        <p className="mb-5 mt-6 text-xs text-muted-foreground">
          {data ? `${data.total} published products` : "Loading catalog…"}
        </p>
        <ProductResults data={data} error={error} retry={() => void mutate()} />
        {data && data.total > 12 && (
          <div className="mt-6 rounded-xl border bg-card">
            <Pagination
              total={data.total}
              page={data.page}
              pageSize={12}
              onPage={setPage}
            />
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
export function MarketplaceDetail({ id }: { id: string }) {
  const {
      data: product,
      error,
      mutate,
    } = useSWR<MarketProduct>(`/marketplace/products/${id}`),
    { user } = useSession();
  const destination = `/seller/products/${id}`;
  const contact =
    user?.role === "SELLER"
      ? user.onboardingRequired
        ? `/onboarding?next=${encodeURIComponent(destination)}`
        : destination
      : user
        ? home(user)
        : `/login/buyer?next=${encodeURIComponent(destination)}`;
  return (
    <div className="market-page">
      <PublicHeader />
      <main className="mx-auto min-h-[65vh] max-w-7xl px-5 py-10 lg:px-10">
        <Link
          href="/marketplace"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to marketplace
        </Link>
        {error ? (
          <ErrorState error={error} retry={() => void mutate()} />
        ) : !product ? (
          <Loading />
        ) : (
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div className="relative aspect-square overflow-hidden rounded-3xl border bg-muted">
              {product.images[0] ? (
                <Image
                  src={product.images[0].url}
                  alt={product.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Package className="size-24 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                {product.category}
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">
                {product.name}
              </h1>
              <p className="mt-5 flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4 text-primary" />
                {product.business.name}
                <span className="text-xs text-muted-foreground">
                  Verified business
                </span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {product.business.marketArea}, {product.business.city}
              </p>
              <div className="my-7 border-y py-6">
                <p className="text-3xl font-semibold">
                  {product.pricePaise === null
                    ? "Price on request"
                    : money(product.pricePaise)}
                  {product.pricePaise !== null && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      per unit
                    </span>
                  )}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  Minimum order: {product.moq} units ·{" "}
                  {product.stock > 0
                    ? `${product.stock} units in catalog stock`
                    : "Out of stock"}
                </p>
              </div>
              <p className="text-sm leading-7 text-muted-foreground">
                {product.description ||
                  "Contact the supplier for product and dispatch details."}
              </p>
              <h2 className="mb-3 mt-6 text-sm font-semibold">
                Available variants
              </h2>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <span
                    key={`${v.size}-${v.color}`}
                    className="rounded-lg border bg-card px-3 py-2 text-xs"
                  >
                    {v.size} / {v.color} · {v.stock}
                  </span>
                ))}
              </div>
              <Button asChild className="mt-8 h-12 w-full rounded-xl">
                <Link href={contact}>
                  <MessageCircle />
                  {user && user.role !== "SELLER"
                    ? "Open your workspace"
                    : "Contact supplier"}
                  <ArrowRight />
                </Link>
              </Button>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                {!user
                  ? "Sign in or create a buyer account to send an inquiry. "
                  : ""}
                Confirm prices, stock, payment and dispatch directly with the
                supplier.
              </p>
              {product.business.deliveryInfo && (
                <div className="mt-7 border-t pt-5">
                  <h2 className="text-sm font-semibold">Dispatch details</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {product.business.deliveryInfo}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
