"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Bell,
  BookOpen,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  ContactRound,
  CreditCard,
  FileText,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  UsersRound,
  Warehouse,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@wholesale/shared";
import { Brand } from "@/components/brand";
import { Initials, Loading, ErrorState } from "@/components/common";
import { home, useSession } from "@/components/session";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { send } from "@/lib/api";
type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  group?: string;
};
const businessNav: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "DASHBOARD:VIEW",
  },
  {
    label: "Product catalog",
    href: "/dashboard/products",
    icon: Package,
    permission: "PRODUCTS:VIEW",
  },
  {
    label: "Inventory",
    href: "/dashboard/inventory",
    icon: Warehouse,
    permission: "INVENTORY:VIEW",
  },
  {
    label: "Billing",
    href: "/dashboard/billing",
    icon: FileText,
    permission: "BILLING:VIEW",
  },
  {
    label: "Buyers & inquiries",
    href: "/dashboard/buyers",
    icon: ContactRound,
    permission: "SELLERS:VIEW",
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: BookOpen,
    permission: "REPORTS:VIEW",
  },
  {
    label: "Team & access",
    href: "/dashboard/team",
    icon: UsersRound,
    permission: "STAFF:VIEW",
    group: "BUSINESS",
  },
  {
    label: "Business settings",
    href: "/dashboard/settings",
    icon: Settings2,
    permission: "SETTINGS:VIEW",
    group: "BUSINESS",
  },
];
const sellerNav: NavItem[] = [
  { label: "Discover products", href: "/seller", icon: Search },
  { label: "Saved products", href: "/seller/saved", icon: Heart },
  { label: "Suppliers", href: "/seller/suppliers", icon: Store },
  { label: "My inquiries", href: "/seller/inquiries", icon: MessageCircle },
];
const adminNav: NavItem[] = [
  { label: "Platform overview", href: "/admin", icon: LayoutDashboard },
  { label: "Business approvals", href: "/admin/businesses", icon: Store },
  { label: "Seller approvals", href: "/admin/sellers", icon: UsersRound },
  { label: "Catalog review", href: "/admin/catalog", icon: ShieldCheck },
  { label: "Plans & limits", href: "/admin/plans", icon: CreditCard },
];
const opsNav: NavItem[] = [
  { label: "Operations overview", href: "/operations", icon: LayoutDashboard },
  { label: "Onboarding queue", href: "/operations/onboarding", icon: Workflow },
  { label: "Catalog quality", href: "/operations/catalog", icon: CheckCheck },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, error, refresh, can } = useSession(),
    router = useRouter(),
    pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false),
    [commandOpen, setCommandOpen] = useState(false),
    [query, setQuery] = useState("");
  const { data: health } = useSWR<{ status: string }>("/health", {
    refreshInterval: 30000,
    shouldRetryOnError: false,
  });
  const { data: notifications } = useSWR<{ unread: number }>(
    user ? "/notifications" : null,
    { refreshInterval: 30000 },
  );
  useEffect(() => {
    const buyerPath = pathname.startsWith("/seller");
    if (!loading && error?.status === 401)
      router.replace(
        buyerPath
          ? `/login/buyer?next=${encodeURIComponent(pathname)}`
          : pathname.startsWith("/admin") || pathname.startsWith("/operations")
            ? "/login/team"
            : "/login/wholesaler",
      );
    else if (user?.onboardingRequired)
      router.replace(
        buyerPath
          ? `/onboarding?next=${encodeURIComponent(pathname)}`
          : "/onboarding",
      );
  }, [loading, error, user, router, pathname]);
  useEffect(() => {
    function keydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  if (loading)
    return (
      <div className="mx-auto max-w-6xl p-10">
        <Loading />
      </div>
    );
  if (error && error.status !== 401)
    return (
      <div className="p-10">
        <ErrorState
          error={error}
          retry={() => {
            void refresh();
          }}
        />
      </div>
    );
  if (!user || user.onboardingRequired) return null;
  const seller = user.role === "SELLER",
    admin = user.role === "PLATFORM_ADMIN",
    ops = user.role === "PLATFORM_OPERATIONS";
  const nav = (
    seller ? sellerNav : admin ? adminNav : ops ? opsNav : businessNav
  ).filter((n) => !n.permission || can(n.permission));
  const context = seller
    ? "Seller workspace"
    : admin
      ? "Platform administration"
      : ops
        ? "Platform operations"
        : "Wholesale workspace";
  const title =
    [
      ...nav,
      { label: "Support", href: "/support" },
      { label: "Notifications", href: "/notifications" },
    ]
      .filter((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
      .sort((a, b) => b.href.length - a.href.length)[0]?.label || "Workspace";
  const active = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" &&
      href !== "/seller" &&
      href !== "/admin" &&
      href !== "/operations" &&
      pathname.startsWith(href + "/"));
  async function logout() {
    const entry =
      user?.role === "SELLER"
        ? "/login/buyer"
        : user?.role === "WHOLESALER_OWNER"
          ? "/login/wholesaler"
          : "/login/team";
    await send("/auth/logout", {});
    try {
      await refresh();
    } catch {}
    router.replace(entry);
  }
  function go(href: string) {
    setMobileOpen(false);
    setCommandOpen(false);
    router.push(href);
  }
  const sidebar = (
    <div className="flex h-full flex-col bg-[#171b29] px-4 pb-5 pt-7 text-[#afb3c3]">
      <div className="px-2">
        <Link href={home(user)} onClick={() => setMobileOpen(false)}>
          <Brand dark />
        </Link>
      </div>
      <div className="mb-7 mt-7 flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[.035] px-3 py-3">
        <span className="flex size-8 items-center justify-center rounded-md bg-white/7">
          <Store className="size-4 text-[#c4c6d5]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-[#f1f2f8]">
            {user.businessName || user.name}
          </p>
          <p className="mt-0.5 text-[10px] text-[#71788f]">
            {seller
              ? "Sourcing account"
              : admin
                ? "Administrator"
                : ops
                  ? "Operations team"
                  : user.role === "WHOLESALER_STAFF"
                    ? "Staff account"
                    : `${user.plan?.name} workspace`}
          </p>
        </div>
        <ChevronDown className="size-3 text-[#6e758d]" />
      </div>
      <p className="mb-3 px-3 text-[9px] font-medium tracking-[.16em] text-[#626b83]">
        {seller ? "SOURCING" : admin || ops ? "PLATFORM" : "WORKSPACE"}
      </p>
      <nav className="space-y-1">
        {nav.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={item.href}>
              {item.group && nav[index - 1]?.group !== item.group && (
                <p className="mb-3 mt-7 px-3 text-[9px] font-medium tracking-[.16em] text-[#626b83]">
                  {item.group}
                </p>
              )}
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] transition-colors",
                  active(item.href)
                    ? "bg-[#635bdf] font-medium text-white shadow-sm"
                    : "hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="size-[17px]" />
                {item.label}
                {active(item.href) && (
                  <span className="ml-auto size-1 rounded-full bg-white/70" />
                )}
              </Link>
            </div>
          );
        })}
        <Link
          href="/support"
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px]",
            pathname === "/support"
              ? "bg-[#635bdf] text-white"
              : "hover:bg-white/5 hover:text-white",
          )}
        >
          <CircleHelp className="size-[17px]" />
          Help & support
        </Link>
      </nav>
      <div className="mt-auto pt-7">
        {user.plan && user.role === "WHOLESALER_OWNER" && (
          <div className="mb-5 rounded-lg border border-white/8 bg-white/[.025] px-3 py-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-[#d9dbeb]">
                {user.plan.name} plan
              </span>
              <span className="rounded bg-[#393457] px-1.5 py-0.5 text-[9px] text-[#beb8fc]">
                ACTIVE
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-5 text-[#777f97]">
              {user.plan.staffLimit} team members ·{" "}
              {user.plan.productLimit.toLocaleString("en-IN")} products
            </p>
            <Link
              href="/support?category=SUBSCRIPTION"
              className="mt-2 flex items-center justify-between text-[10px] text-[#bdb5fa]"
            >
              Manage subscription
              <ChevronRight className="size-3" />
            </Link>
          </div>
        )}
        <div className="flex items-center gap-2 px-2 text-[10px] text-[#727c95]">
          <span
            className={cn(
              "size-1.5 rounded-full",
              health?.status === "ok" ? "bg-emerald-400" : "bg-amber-400",
            )}
          />
          {health?.status === "ok"
            ? "System online"
            : "Connecting to workspace"}
        </div>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen">
      <aside className="app-sidebar fixed inset-y-0 left-0 z-30 hidden w-[228px] lg:block">
        {sidebar}
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[260px] border-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Workspace navigation</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>
      <div className="app-main lg:ml-[228px]">
        <header className="app-topbar sticky top-0 z-20 flex h-[76px] items-center justify-between gap-4 border-b bg-white/95 px-5 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </Button>
            <div>
              <p className="text-[10px] text-muted-foreground">{context}</p>
              <p className="mt-1 text-[12px] font-medium">{title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <button
              onClick={() => setCommandOpen(true)}
              className="hidden h-9 w-[228px] items-center gap-2 rounded-lg border bg-[#fafbfc] px-3 text-xs text-[#9397a4] md:flex"
            >
              <Search className="size-3.5" />
              <span className="flex-1 text-left">Search your workspace</span>
              <kbd className="rounded border bg-white px-1 py-0.5 text-[9px]">
                ⌘ K
              </kbd>
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              asChild
              aria-label="Notifications"
            >
              <Link href="/notifications" className="relative">
                <Bell className="size-[17px]" />
                {!!notifications?.unread && (
                  <span className="absolute right-1.5 top-1 size-1.5 rounded-full bg-primary ring-2 ring-white" />
                )}
              </Link>
            </Button>
            <div className="h-7 w-px bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 text-left">
                  <Initials name={user.name} />
                  <span className="hidden sm:block">
                    <span className="block text-xs font-medium">
                      {user.name}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {seller
                        ? "Seller"
                        : admin
                          ? "Admin"
                          : ops
                            ? "Operations"
                            : user.role === "WHOLESALER_STAFF"
                              ? "Team member"
                              : "Business owner"}
                    </span>
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <span className="text-xs">{user.name}</span>
                  <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                    +91 {user.phone}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => go("/support")}>
                  <CircleHelp />
                  Help & support
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    void logout();
                  }}
                >
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="app-content mx-auto max-w-[1550px] p-5 sm:p-8">
          {children}
        </main>
      </div>
      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        <DialogContent className="max-w-lg gap-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Command className="size-4" />
              Go to your workspace
            </DialogTitle>
            <DialogDescription>
              Search screens or look up a product.
            </DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, billing, reports…"
            className="field mt-3"
            aria-label="Search workspace"
            onKeyDown={(e) => {
              if (e.key === "Enter" && query)
                go(
                  `${seller ? "/seller" : "/dashboard/products"}?q=${encodeURIComponent(query)}`,
                );
            }}
          />
          <div className="mt-2 space-y-1">
            {nav
              .filter((n) =>
                n.label.toLowerCase().includes(query.toLowerCase()),
              )
              .map((n) => (
                <button
                  key={n.href}
                  onClick={() => go(n.href)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-xs hover:bg-muted"
                >
                  <n.icon className="size-4 text-muted-foreground" />
                  {n.label}
                  <ChevronRight className="ml-auto size-3 text-muted-foreground" />
                </button>
              ))}
            {query && (seller || can("PRODUCTS:VIEW")) && (
              <button
                onClick={() =>
                  go(
                    `${seller ? "/seller" : "/dashboard/products"}?q=${encodeURIComponent(query)}`,
                  )
                }
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-xs text-primary hover:bg-muted"
              >
                <Search className="size-4" />
                Search catalog for “{query}”
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
