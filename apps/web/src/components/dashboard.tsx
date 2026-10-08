"use client";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  IndianRupee,
  Package,
  Plus,
  Wallet,
  Warehouse,
} from "lucide-react";
import { money } from "@wholesale/shared";
import {
  PageHeader,
  Metric,
  Panel,
  Pill,
  Status,
  DataTable,
  Empty,
  ErrorState,
  Initials,
  Loading,
  Thumb,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { SalesChart } from "@/components/sales-chart";
import { useSession } from "@/components/session";
import { date, time } from "@/lib/api";
import type { Dashboard as DashboardData, Invoice } from "@/lib/types";
export function Dashboard() {
  const { user, can } = useSession();
  const { data, error, mutate } = useSWR<DashboardData>("/dashboard");
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
  const difference =
    data.yesterdaySalesPaise > 0
      ? ((data.todaySalesPaise - data.yesterdaySalesPaise) * 100) /
        data.yesterdaySalesPaise
      : undefined;
  return (
    <>
      <PageHeader
        title={data.ownOnly ? "Counter overview" : "Business overview"}
        description={
          data.ownOnly
            ? "Your counter's activity, stock alerts and next actions."
            : "Sales, stock and outstanding payments for today."
        }
        actions={
          <>
            <div className="hidden items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs text-muted-foreground sm:flex">
              <CalendarDays className="size-3.5" />
              {date(new Date(), { year: "numeric" })}
            </div>
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
      {data.sampleWorkspace && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-secondary px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            <strong className="font-medium text-primary">
              Sample workspace
            </strong>
            <span className="mx-2 text-primary/30">·</span>Explore the workflow.
            Changes are saved in your local workspace.
          </span>
          <span className="flex items-center gap-1 text-primary">
            Catalog → Stock → Billing
            <ArrowRight className="size-3" />
          </span>
        </div>
      )}
      {!data.sampleWorkspace &&
        data.productCount === 0 &&
        user?.role === "WHOLESALER_OWNER" && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-primary/20 bg-secondary p-5">
            <div>
              <h2 className="text-base font-semibold">
                Your workspace is ready. Start with your catalog.
              </h2>
              <p className="mt-2 max-w-xl text-xs leading-6 text-muted-foreground">
                Add your first product, its sizes and colours, and opening
                stock. Then create a bill or invite your staff. Your public
                supplier profile appears after platform approval.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/products">
                Open product catalog
                <ArrowRight />
              </Link>
            </Button>
          </div>
        )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Today's sales"
          value={money(data.todaySalesPaise, true)}
          icon={<IndianRupee />}
          change={difference}
          detail={
            difference !== undefined
              ? "vs yesterday"
              : "Net invoice sales today"
          }
        />
        <Metric
          label="Bills issued today"
          value={String(data.todayInvoices).padStart(2, "0")}
          icon={<FileText />}
          detail={
            data.ownOnly ? "Issued by your counter" : "Across your business"
          }
        />
        <Metric
          label="Units in stock"
          value={data.stockUnits.toLocaleString("en-IN")}
          icon={<Warehouse />}
          detail={`${data.productCount} active catalog products`}
        />
        <Metric
          label="Outstanding payments"
          value={money(data.outstandingPaise, true)}
          icon={<Wallet />}
          detail="Recorded invoice balances"
        />
      </div>
      <div className="mb-6 grid gap-5 min-[1100px]:grid-cols-[1.7fr_1fr]">
        <Panel
          title="Sales overview"
          description="Net sales, after returns and cancellations"
          action={<Pill>Last 7 days</Pill>}
        >
          <div className="px-5 pb-2">
            <span className="numeric text-[26px] font-semibold tracking-tight">
              {money(
                data.daily.reduce((s, d) => s + d.salesPaise, 0),
                true,
              )}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              this week
            </span>
          </div>
          <SalesChart data={data.daily} />
          <div className="mt-3 flex items-center justify-between border-t px-5 py-3">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Net invoice sales
            </span>
            {can("REPORTS:VIEW") && (
              <Link
                href="/dashboard/reports"
                className="flex items-center gap-1 text-xs font-medium text-primary"
              >
                View reports
                <ArrowRight className="size-3" />
              </Link>
            )}
          </div>
        </Panel>
        <Panel
          title="Incoming inquiries"
          description="Buyers interested in your catalog"
          action={<Pill tone="primary">{data.inquiries.length} new</Pill>}
        >
          {data.inquiries.length ? (
            <div className="px-5">
              {data.inquiries.slice(0, 4).map((i) => (
                <div key={i.id} className="flex gap-3 border-t py-4">
                  <Initials name={i.seller.businessName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {i.seller.businessName}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {i.product.name} · {i.quantity} units
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {date(i.createdAt)} · {time(i.createdAt)}
                    </p>
                  </div>
                  <span className="mt-1 size-1.5 rounded-full bg-primary" />
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No new inquiries"
              description="New sourcing contacts appear here."
            />
          )}
          {can("SELLERS:VIEW") && (
            <div className="border-t px-5 py-3">
              <Link
                href="/dashboard/buyers"
                className="flex items-center justify-between text-xs font-medium text-primary"
              >
                Manage buyer inquiries
                <ArrowRight className="size-3" />
              </Link>
            </div>
          )}
        </Panel>
      </div>
      <div className="grid gap-5 min-[1100px]:grid-cols-[1.7fr_1fr]">
        <Panel
          title="Recent invoices"
          description="The latest activity at your counter"
          action={
            can("BILLING:VIEW") ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/billing">
                  View all
                  <ArrowRight />
                </Link>
              </Button>
            ) : undefined
          }
        >
          <DataTable<Invoice>
            rows={data.recentInvoices}
            pageSize={5}
            rowKey={(i) => i.id}
            columns={[
              {
                key: "number",
                label: "Invoice",
                render: (i) =>
                  can("BILLING:VIEW") ? (
                    <Link
                      className="font-medium hover:text-primary"
                      href={`/dashboard/billing/${i.id}`}
                    >
                      {i.number}
                      <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                        {date(i.createdAt)} · {time(i.createdAt)}
                      </span>
                    </Link>
                  ) : (
                    i.number
                  ),
              },
              {
                key: "buyer",
                label: "Buyer",
                render: (i) => (
                  <>
                    <span className="font-medium">{i.buyerName}</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {i.actor.name}
                    </span>
                  </>
                ),
              },
              {
                key: "amount",
                label: "Amount",
                className: "text-right",
                render: (i) => (
                  <span className="numeric font-medium">
                    {money(i.netPaise, true)}
                  </span>
                ),
              },
              {
                key: "status",
                label: "Payment",
                render: (i) => <Status value={i.paymentStatus} />,
              },
            ]}
            emptyTitle="Your first invoice starts here"
            emptyDescription="Create a bill and stock will update automatically."
          />
        </Panel>
        <Panel
          title="Stock needs attention"
          description="Variants at or below their alert level"
          action={<Pill tone="warning">{data.lowStockCount} alerts</Pill>}
        >
          {data.lowStock.length ? (
            <div className="px-5">
              {data.lowStock.slice(0, 4).map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 border-t py-3.5"
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
                    <p className="truncate text-xs font-medium">
                      {v.product.name}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {v.size} · {v.color}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`numeric text-[13px] font-semibold ${v.stock === 0 ? "text-rose-500" : "text-amber-600"}`}
                    >
                      {v.stock}
                    </p>
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      units left
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Stock looks healthy"
              description="No variants are below the alert level."
            />
          )}
          {can("INVENTORY:VIEW") && (
            <div className="border-t px-5 py-3">
              <Link
                href="/dashboard/inventory?low=true"
                className="flex items-center justify-between text-xs font-medium text-primary"
              >
                Review inventory
                <ArrowRight className="size-3" />
              </Link>
            </div>
          )}
        </Panel>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Package className="size-3.5" />
        Catalog, stock and billing stay connected.
        <span className="ml-auto">All times shown in India Standard Time.</span>
      </div>
    </>
  );
}
