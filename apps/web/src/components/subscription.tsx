"use client";
import { SearchSelect } from "@/components/ui/search-select";
import Link from "next/link";
import { useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { CalendarClock, Check, CreditCard } from "lucide-react";
import { money, toPaise } from "@wholesale/shared";
import type { Plan } from "@/lib/types";
import { date, errorMessage, send } from "@/lib/api";
import { useSession } from "./session";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  BusyButton,
  DataTable,
  ErrorState,
  Field,
  FormError,
  Loading,
  PageHeader,
  Panel,
  Pill,
  Status,
} from "./common";
type Period = {
  id: string;
  planName: string;
  cycle: string;
  amountPaise: number;
  startsAt: string;
  endsAt: string;
  paymentMode: string;
  paymentReference: string;
  createdAt: string;
};
type SubscriptionData = {
  status: string;
  startsAt: string;
  endsAt: string;
  plan: Plan;
  plans: Plan[];
  periods: Period[];
};
export function Subscription({
  businessId,
  embedded = false,
  onSaved,
}: {
  businessId?: string;
  embedded?: boolean;
  onSaved?: () => void;
}) {
  const { refresh } = useSession();
  const key = businessId
    ? `/platform/businesses/${businessId}/subscription`
    : "/subscription";
  const { data, error, mutate } = useSWR<SubscriptionData>(key);
  const [yearly, setYearly] = useState(false);
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
    <>
      {!embedded && (
        <PageHeader
          title="Plan & subscription"
          description="Your plan, renewal date and recorded collections. Billing and stock are included in every plan."
        />
      )}
      <Panel title="Current access" action={<Status value={data.status} />}>
        <div className="grid gap-4 border-t p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="mt-2 text-xl font-semibold">{data.plan.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {data.status === "TRIAL" ? "Trial ends" : "Access until"}
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="size-4 text-primary" />
              {date(data.endsAt, { year: "numeric" })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Included capacity</p>
            <p className="mt-2 text-sm">
              {data.plan.staffLimit} staff ·{" "}
              {data.plan.productLimit.toLocaleString()} products
            </p>
          </div>
        </div>
        {data.status === "EXPIRED" && (
          <p className="border-t bg-muted p-4 text-xs leading-5">
            Renew to create new products, stock entries, staff or invoices.
            Existing bills, exports, returns and received-payment recording
            remain available.
          </p>
        )}
      </Panel>
      {businessId ? (
        <RenewalForm
          key={data.plan.id + data.endsAt}
          businessId={businessId}
          data={data}
          onSaved={() => {
            void mutate();
            onSaved?.();
          }}
        />
      ) : (
        <>
          <div className="my-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Choose your next plan</h2>
            <div className="flex gap-1 rounded-lg border p-1">
              <Button
                size="sm"
                variant={!yearly ? "secondary" : "ghost"}
                onClick={() => setYearly(false)}
              >
                Monthly
              </Button>
              <Button
                size="sm"
                variant={yearly ? "secondary" : "ghost"}
                onClick={() => setYearly(true)}
              >
                Yearly
              </Button>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {data.plans.map((plan) => (
              <Panel key={plan.id}>
                <div className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{plan.name}</h3>
                    {plan.id === data.plan.id && (
                      <Pill tone="primary">Current plan</Pill>
                    )}
                  </div>
                  <p className="numeric text-3xl font-semibold">
                    {yearly && !plan.yearlyPricePaise
                      ? "Ask team"
                      : money(
                          yearly
                            ? plan.yearlyPricePaise
                            : plan.monthlyPricePaise,
                          true,
                        )}
                    <span className="text-xs font-normal text-muted-foreground">
                      /{yearly ? "year" : "month"}
                    </span>
                  </p>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {[
                      "Catalog, inventory & counter billing",
                      `${plan.staffLimit} staff · ${plan.productLimit.toLocaleString()} products`,
                      plan.bulkImport
                        ? "Excel / CSV & image imports"
                        : "Manual catalog entry",
                      plan.advancedReports
                        ? "Extended report periods"
                        : "Daily & monthly reports",
                    ].map((label) => (
                      <li key={label} className="flex gap-2">
                        <Check className="size-3.5 shrink-0 text-primary" />
                        {label}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={plan.id === data.plan.id ? "outline" : "default"}
                    className="w-full"
                  >
                    <Link
                      href={`/support?category=SUBSCRIPTION&subject=${encodeURIComponent(`${plan.name} ${yearly ? "yearly" : "monthly"} renewal`)}`}
                    >
                      Contact team to{" "}
                      {plan.id === data.plan.id ? "renew" : "change plan"}
                    </Link>
                  </Button>
                </div>
              </Panel>
            ))}
          </div>
          <p className="my-4 text-xs leading-5 text-muted-foreground">
            Arrange payment directly with the platform team. Access updates
            after they record the collection. Seller discovery remains free.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void mutate();
              void refresh();
            }}
          >
            Refresh subscription
          </Button>
        </>
      )}
      <Panel
        className="mt-5"
        title="Collection history"
        description="Received payments and complimentary access periods recorded by the platform team."
      >
        <DataTable
          rows={data.periods}
          rowKey={(p) => p.id}
          pageSize={5}
          emptyTitle="No collections recorded"
          emptyDescription="Your trial has no payment receipt. Renewals will appear here."
          columns={[
            {
              key: "plan",
              label: "Plan",
              render: (p) => (
                <>
                  {p.planName}
                  <span className="block text-xs text-muted-foreground">
                    {p.cycle.toLowerCase()}
                  </span>
                </>
              ),
            },
            {
              key: "period",
              label: "Access period",
              render: (p) => (
                <>
                  {date(p.startsAt)} – {date(p.endsAt, { year: "numeric" })}
                </>
              ),
            },
            {
              key: "amount",
              label: "Received",
              render: (p) => money(p.amountPaise),
            },
            {
              key: "reference",
              label: "Reference",
              render: (p) => (
                <>
                  {p.paymentReference}
                  <span className="block text-xs text-muted-foreground">
                    {p.paymentMode}
                  </span>
                </>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}
function RenewalForm({
  businessId,
  data,
  onSaved,
}: {
  businessId: string;
  data: SubscriptionData;
  onSaved: () => void;
}) {
  const [planId, setPlanId] = useState(data.plan.id),
    [cycle, setCycle] = useState("MONTHLY"),
    [amount, setAmount] = useState(String(data.plan.monthlyPricePaise / 100)),
    [mode, setMode] = useState("UPI"),
    [reference, setReference] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const requestKey = useRef("");
  function price(id: string, nextCycle: string) {
    const plan = data.plans.find((p) => p.id === id);
    setAmount(
      String(
        (nextCycle === "YEARLY"
          ? plan?.yearlyPricePaise
          : plan?.monthlyPricePaise || 0)! / 100,
      ),
    );
    requestKey.current = "";
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!requestKey.current) requestKey.current = crypto.randomUUID();
      await send(`/platform/businesses/${businessId}/subscription`, {
        requestKey: requestKey.current,
        planId,
        cycle,
        amountPaise: toPaise(amount),
        paymentMode: mode,
        paymentReference: reference,
        note,
      });
      toast.success("Collection recorded and subscription renewed");
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      className="mt-5"
      title="Record collection & renew"
      description="Record only a payment already received. Renewal extends paid access; a trial converts immediately."
    >
      <form onSubmit={save} className="space-y-4 border-t p-5">
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan">
            <SearchSelect
              className="field"
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                price(e.target.value, cycle);
              }}
            >
              {data.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SearchSelect>
          </Field>
          <Field label="Period">
            <SearchSelect
              className="field"
              value={cycle}
              onChange={(e) => {
                setCycle(e.target.value);
                price(planId, e.target.value);
              }}
            >
              <option value="MONTHLY">One month</option>
              <option value="YEARLY">One year</option>
            </SearchSelect>
          </Field>
          <Field label="Received amount (₹)" required>
            <Input
              required
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                requestKey.current = "";
              }}
            />
          </Field>
          <Field label="Payment mode">
            <SearchSelect
              className="field"
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                requestKey.current = "";
                if (e.target.value === "COMPLIMENTARY") setAmount("0");
              }}
            >
              {["UPI", "BANK", "CASH", "COMPLIMENTARY"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </SearchSelect>
          </Field>
          <Field label="Receipt / transaction reference" required>
            <Input
              required
              minLength={3}
              maxLength={120}
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                requestKey.current = "";
              }}
            />
          </Field>
          <Field label="Collection note">
            <Textarea
              maxLength={500}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                requestKey.current = "";
              }}
              placeholder="Discount or complimentary reason, if any"
            />
          </Field>
        </fieldset>
        <FormError message={error} />
        <BusyButton busy={busy} type="submit">
          <CreditCard />
          Record & renew
        </BusyButton>
      </form>
    </Panel>
  );
}
