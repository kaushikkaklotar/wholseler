"use client";
import { SearchSelect } from "@/components/ui/search-select";
import { useState } from "react";
import useSWR from "swr";
import {
  Download,
  FileText,
  IndianRupee,
  MessageCircle,
  RotateCcw,
} from "lucide-react";
import { money } from "@wholesale/shared";
import type { Report } from "@/lib/types";
import {
  DataTable,
  ErrorState,
  Loading,
  Metric,
  PageHeader,
  Panel,
  Pill,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { SalesChart } from "@/components/sales-chart";
import { useSession } from "@/components/session";
export function Reports() {
  const { user } = useSession();
  const [period, setPeriod] = useState("30");
  const [month, setMonth] = useState(() =>
    new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" })
      .slice(0, 7),
  );
  const query =
    period === "month"
      ? `month=${encodeURIComponent(month)}`
      : `days=${period}`;
  const { data, error, mutate } = useSWR<Report>(`/reports?${query}`);
  return (
    <>
      <PageHeader
        title="Business reports"
        description="Sales, stock and team activity from your recorded transactions."
        actions={
          <>
            <SearchSelect
              className="field !w-auto !text-xs"
              aria-label="Report period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value="month">Calendar month</option>
              {user?.plan?.advancedReports && (
                <>
                  <option value={90}>Last 90 days</option>
                  <option value={365}>Last 365 days</option>
                </>
              )}
            </SearchSelect>
            {period === "month" && (
              <input
                aria-label="Report month"
                type="month"
                value={month}
                onChange={(e) => {
                  if (e.target.value) setMonth(e.target.value);
                }}
                className="field !w-auto !text-xs"
              />
            )}
            <Button variant="outline" asChild>
              <a href={`/api/v1/reports/export?${query}`} download>
                <Download />
                Export report
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
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Net invoice sales"
              value={money(data.salesPaise, true)}
              icon={<IndianRupee />}
              detail="After returns and cancellations"
            />
            <Metric
              label="Invoices issued"
              value={data.invoiceCount}
              icon={<FileText />}
              detail={`${data.from} to ${data.to}`}
            />
            <Metric
              label="Return value"
              value={money(data.returnsPaise, true)}
              icon={<RotateCcw />}
              detail="Recorded against these invoices"
            />
            <Metric
              label="Sourcing inquiries"
              value={data.inquiryCount}
              icon={<MessageCircle />}
              detail="Calls and WhatsApp contacts"
            />
          </div>
          <Panel
            title="Sales trend"
            description={`${data.from} to ${data.to}`}
            action={<Pill tone="primary">Net sales</Pill>}
          >
            <div className="pb-4">
              <SalesChart data={data.daily} height={275} />
            </div>
          </Panel>
          <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_1fr]">
            <Panel
              title="Top products"
              description="Ranked by net invoice value"
            >
              <DataTable
                rows={data.topProducts}
                rowKey={(p) => p.sku}
                pageSize={5}
                columns={[
                  {
                    key: "product",
                    label: "Product",
                    render: (p) => (
                      <>
                        <p className="font-medium">{p.name}</p>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          {p.sku}
                        </p>
                      </>
                    ),
                  },
                  {
                    key: "units",
                    label: "Net units",
                    className: "text-right",
                    render: (p) => p.units,
                  },
                  {
                    key: "sales",
                    label: "Sales",
                    className: "text-right",
                    render: (p) => (
                      <span className="numeric font-medium">
                        {money(p.salesPaise, true)}
                      </span>
                    ),
                  },
                ]}
                emptyTitle="No sales in this period"
                emptyDescription="Issue a bill to start your sales report."
              />
            </Panel>
            <Panel
              title="Staff billing"
              description="Invoices grouped by the person who issued them"
            >
              <DataTable
                rows={data.staff}
                rowKey={(s) => s.name}
                pageSize={5}
                columns={[
                  {
                    key: "name",
                    label: "Team member",
                    render: (s) => (
                      <span className="font-medium">{s.name}</span>
                    ),
                  },
                  {
                    key: "bills",
                    label: "Bills",
                    className: "text-right",
                    render: (s) => s.invoices,
                  },
                  {
                    key: "sales",
                    label: "Sales",
                    className: "text-right",
                    render: (s) => (
                      <span className="numeric font-medium">
                        {money(s.salesPaise, true)}
                      </span>
                    ),
                  },
                ]}
                emptyTitle="No staff billing yet"
              />
            </Panel>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Panel
              title="Inventory position"
              description="Current stock, independent of the report period"
            >
              <div className="grid grid-cols-3 gap-3 border-t p-5">
                {[
                  ["Available units", data.stockUnits.toLocaleString()],
                  ["At unit prices", money(data.stockValuePaise, true)],
                  ["Low stock alerts", data.lowStockCount],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="numeric mt-2 text-lg font-semibold">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel
              title="Stock movements"
              description="Ledger entries during the selected period"
            >
              <div className="flex flex-wrap gap-2 border-t p-5">
                {data.movementTypes.length ? (
                  data.movementTypes.map((m) => (
                    <Pill
                      key={m.type}
                      tone={m.quantity > 0 ? "success" : "neutral"}
                    >
                      {m.type.toLowerCase()}: {m.quantity > 0 ? "+" : ""}
                      {m.quantity} units
                    </Pill>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No movements in this period.
                  </p>
                )}
              </div>
            </Panel>
          </div>
          <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
            Sales are attributed to invoice issue dates using current
            return/cancellation state. This operational report is not a filed
            GST return or an accounting integration.
          </p>
        </>
      )}
    </>
  );
}
