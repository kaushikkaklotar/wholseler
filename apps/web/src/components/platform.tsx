"use client";
import { SearchSelect } from "@/components/ui/search-select";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  ClipboardList,
  FileCheck,
  MessageCircle,
  Package,
  Plus,
  ShieldCheck,
  Store,
} from "lucide-react";
import { money, toPaise } from "@wholesale/shared";
import type {
  Plan,
  PlatformBusiness,
  PlatformData,
  PlatformProduct,
  PlatformSeller,
} from "@/lib/types";
import { date, errorMessage, send } from "@/lib/api";
import { useSession } from "@/components/session";
import { Subscription } from "./subscription";
import { OperationsTasks } from "./operations-tasks";
import { CatalogReviewDialog } from "./catalog-review";
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
import { ProductEditor } from "@/components/catalog";
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
  Status,
  Thumb,
} from "@/components/common";
type Review = {
  kind: "businesses" | "sellers";
  id: string;
  name: string;
  status: string;
  note: string;
};
export function Platform({ section = "overview" }: { section?: string }) {
  const { user } = useSession(),
    ops = user?.role === "PLATFORM_OPERATIONS";
  const root = ops ? "/operations" : "/admin";
  const { data, error, mutate } = useSWR<PlatformData>("/platform");
  const [statusFilter, setStatusFilter] = useState(""),
    [review, setReview] = useState<Review | null>(null),
    [catalogReview, setCatalogReview] = useState<string | null>(null),
    [business, setBusiness] = useState<PlatformBusiness | null>(null),
    [plan, setPlan] = useState<Plan | null | undefined>(undefined),
    [catalogBusiness, setCatalogBusiness] = useState<PlatformBusiness | null>(
      null,
    );
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
  const titles: Record<string, [string, string]> = {
    overview: [
      ops ? "Keep the market moving." : "Platform overview",
      ops
        ? "Onboarding, catalog quality and support in one operations desk."
        : "Review businesses, maintain catalog quality and manage platform access.",
    ],
    businesses: [
      "Business approvals",
      "Verify supplier profiles and manage their subscription limits.",
    ],
    onboarding: [
      "Onboarding queue",
      "Add business notes and help suppliers build their first catalog.",
    ],
    sellers: ["Seller approvals", "Review sourcing profiles and trust status."],
    catalog: [
      ops ? "Catalog quality" : "Catalog review",
      ops
        ? "Identify entries that need photos, variants or platform moderation."
        : "Review product listings before they appear in seller discovery.",
    ],
    plans: [
      "Plans & limits",
      "All plans include billing and inventory. Configure catalog and staff capacity.",
    ],
  };
  const [title, description] = titles[section] || titles.overview;
  const businessesTable = (rows: PlatformBusiness[]) => (
    <DataTable
      rows={rows}
      rowKey={(b) => b.id}
      columns={[
        {
          key: "name",
          label: "Business",
          render: (b) => (
            <>
              <p className="font-medium">{b.name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {b.marketArea}, {b.city}
              </p>
            </>
          ),
        },
        {
          key: "owner",
          label: "Owner",
          render: (b) => (
            <>
              <p>{b.owner.name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {b.owner.phone}
              </p>
            </>
          ),
        },
        {
          key: "usage",
          label: "Catalog / team",
          render: (b) => (
            <span className="text-muted-foreground">
              {b._count.products} products · {b._count.staff} staff
            </span>
          ),
        },
        {
          key: "plan",
          label: "Plan",
          render: (b) => <Pill tone="primary">{b.plan.name}</Pill>,
        },
        {
          key: "status",
          label: "Verification",
          render: (b) => <Status value={b.verificationStatus} />,
        },
        {
          key: "open",
          label: "",
          className: "text-right",
          render: (b) => (
            <Button variant="outline" size="sm" onClick={() => setBusiness(b)}>
              {ops ? "Onboard" : "Review"}
              <ArrowRight className="size-3" />
            </Button>
          ),
        },
      ]}
      emptyTitle="No businesses in this queue"
      emptyDescription="New registrations enter the platform review queue."
    />
  );
  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          section === "plans" && !ops ? (
            <Button onClick={() => setPlan(null)}>
              <Plus />
              Create plan
            </Button>
          ) : (
            <Pill tone={ops ? "neutral" : "primary"}>
              {ops ? "Operations desk" : "Administrator"}
            </Pill>
          )
        }
      />
      {section === "overview" ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Wholesale businesses"
              value={data.businesses.length}
              icon={<Store />}
              detail={`${data.businesses.filter((b) => b.verificationStatus === "VERIFIED").length} verified suppliers`}
            />
            <Metric
              label="Pending onboarding"
              value={data.pendingBusinesses}
              icon={<ClipboardList />}
              detail="Business profiles awaiting review"
            />
            <Metric
              label="Catalog review queue"
              value={data.pendingProducts}
              icon={<Package />}
              detail="Product entries awaiting moderation"
            />
            <Metric
              label="Open support tickets"
              value={data.tickets}
              icon={<MessageCircle />}
              detail="Includes tickets being worked on"
            />
          </div>
          <Panel
            title="Business onboarding"
            description="Profiles waiting for platform verification"
            action={
              <Button asChild size="sm" variant="ghost">
                <Link href={`${root}/${ops ? "onboarding" : "businesses"}`}>
                  View queue
                  <ArrowRight />
                </Link>
              </Button>
            }
          >
            {businessesTable(
              data.businesses.filter((b) => b.verificationStatus === "PENDING"),
            )}
          </Panel>
          <div className="mt-6 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <Panel
              title="Recent audit activity"
              description="Changes are attributed to their actor"
            >
              <div className="divide-y px-5">
                {data.auditLogs.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex gap-3 py-3.5">
                    <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Check className="size-3.5 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">
                        {log.action.toLowerCase().replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {log.detail}
                      </p>
                      <p className="mt-1 text-[9px] text-muted-foreground">
                        {log.actor.name}
                        {log.business ? ` · ${log.business.name}` : ""}
                      </p>
                    </div>
                    <span className="text-[9px] text-muted-foreground">
                      {date(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel
              title="Catalog quality checklist"
              description="Prioritise entries that need attention"
            >
              <div className="space-y-4 border-t p-5">
                {[
                  ["Awaiting catalog moderation", data.pendingProducts],
                  [
                    "Missing product images",
                    data.products.filter((p) => !p.images.length).length,
                  ],
                  [
                    "Missing size / colour variants",
                    data.products.filter((p) => !p._count.variants).length,
                  ],
                  ["Pending seller verification", data.pendingSellers],
                ].map(([label, count]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="numeric font-semibold">{count}</span>
                  </div>
                ))}
                <Button asChild variant="outline" className="w-full">
                  <Link href={`${root}/catalog`}>
                    Open catalog queue
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link href="/support">Work support tickets</Link>
                </Button>
              </div>
            </Panel>
          </div>
        </>
      ) : section === "businesses" || section === "onboarding" ? (
        <Panel>
          <div className="flex items-center justify-between p-4">
            <Pill>{data.businesses.length} businesses</Pill>
            <SearchSelect
              className="field !w-auto !text-xs"
              aria-label="Business verification filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"].map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </SearchSelect>
          </div>
          {businessesTable(
            data.businesses.filter(
              (b) => !statusFilter || b.verificationStatus === statusFilter,
            ),
          )}
        </Panel>
      ) : section === "sellers" ? (
        <Panel title="Registered sellers">
          <DataTable<PlatformSeller>
            rows={data.sellers}
            rowKey={(s) => s.id}
            columns={[
              {
                key: "name",
                label: "Seller business",
                render: (s) => (
                  <>
                    <p className="font-medium">{s.businessName}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {s.user.name} · {s.city}
                    </p>
                  </>
                ),
              },
              { key: "phone", label: "Contact", render: (s) => s.user.phone },
              {
                key: "gst",
                label: "GSTIN",
                render: (s) => (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {s.gstNumber || "Not provided"}
                    <span className="mt-1 block">
                      PAN: {s.panNumber || "Not provided"}
                    </span>
                    {s.user.uploads?.map((f) => (
                      <a
                        key={f.id}
                        className="mt-1 block text-primary"
                        href={`/api/v1/media/${f.id}`}
                        download
                      >
                        {f.fileName}
                      </a>
                    ))}
                  </span>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (s) => <Status value={s.verificationStatus} />,
              },
              {
                key: "review",
                label: "",
                className: "text-right",
                render: (s) => (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setReview({
                        kind: "sellers",
                        id: s.id,
                        name: s.businessName,
                        status: s.verificationStatus,
                        note: s.verificationNote,
                      })
                    }
                  >
                    Review seller
                  </Button>
                ),
              },
            ]}
            emptyTitle="No sellers registered yet"
          />
        </Panel>
      ) : section === "catalog" ? (
        <Panel>
          <div className="flex items-center justify-between p-4">
            <Pill>{data.products.length} catalog entries</Pill>
            <SearchSelect
              className="field !w-auto !text-xs"
              aria-label="Catalog moderation filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {["PENDING", "APPROVED", "REJECTED"].map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </SearchSelect>
          </div>
          <DataTable<PlatformProduct>
            rows={data.products.filter(
              (p) => !statusFilter || p.moderation === statusFilter,
            )}
            rowKey={(p) => p.id}
            columns={[
              {
                key: "product",
                label: "Product",
                render: (p) => (
                  <div className="flex items-center gap-3">
                    <Thumb
                      src={
                        p.images[0]
                          ? `/api/v1/media/${p.images[0].id}`
                          : undefined
                      }
                      name={p.name}
                    />
                    <span>
                      <span className="block font-medium">{p.name}</span>
                      <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                        {p.sku}
                      </span>
                    </span>
                  </div>
                ),
              },
              {
                key: "supplier",
                label: "Supplier",
                render: (p) => (
                  <>
                    <p>{p.business.name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {p.category}
                    </p>
                  </>
                ),
              },
              {
                key: "quality",
                label: "Completeness",
                render: (p) => (
                  <>
                    <p className="text-xs">
                      {p.images.length} photos · {p._count.variants} variants
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {money(p.pricePaise, true)} / unit · MOQ {p.moq}
                    </p>
                  </>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (p) => <Status value={p.moderation} />,
              },
              { key: "changes", label: "Submission / changes", render: p => <div className="max-w-64 text-xs"><p>{p.revisions[0]?.summary || "Existing entry · no earlier snapshot"}</p>{p.revisions[0] && <p className="mt-1 text-muted-foreground">{p.revisions[0].actor?.name || "Former team member"} · {date(p.revisions[0].createdAt)}</p>}</div> },
              {
                key: "review",
                label: "",
                className: "text-right",
                render: (p) => (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCatalogReview(p.id)}
                    >
                      {ops ? "View changes" : "Review changes"}
                    </Button>
                  ),
              },
            ]}
            emptyTitle="Catalog queue is clear"
          />
        </Panel>
      ) : section === "plans" ? (
        <div className="grid gap-5 md:grid-cols-3">
          {data.plans.map((p) => (
            <Panel key={p.id}>
              <div className="space-y-5 p-6">
                <div className="flex justify-between">
                  <h2 className="text-lg font-semibold">{p.name}</h2>
                  <Status value={p.active ? "ACTIVE" : "DISABLED"} />
                </div>
                <p className="numeric text-3xl font-semibold tracking-tight">
                  {money(p.monthlyPricePaise, true)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    /mo
                  </span>
                </p>
                <ul className="space-y-3 text-xs text-muted-foreground">
                  {[
                    `${p.staffLimit} active staff accounts`,
                    `${p.productLimit.toLocaleString()} catalog products`,
                    "Billing & inventory included",
                    p.bulkImport
                      ? "CSV bulk import"
                      : "Individual product entry",
                    p.advancedReports
                      ? "Extended report periods"
                      : "Daily & monthly reports",
                  ].map((text) => (
                    <li key={text} className="flex gap-2">
                      <Check className="size-3.5 text-primary" />
                      {text}
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setPlan(p)}
                >
                  Edit plan limits
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      ) : null}
      {catalogReview && <CatalogReviewDialog key={catalogReview} id={catalogReview} readOnly={ops} onClose={() => setCatalogReview(null)} onSaved={() => { setCatalogReview(null); void mutate(); }} />}
      {review && (
        <ReviewDialog
          key={review.id}
          review={review}
          onClose={() => setReview(null)}
          onSaved={() => {
            setReview(null);
            void mutate();
          }}
        />
      )}
      {business && (
        <BusinessReview
          key={business.id}
          business={business}
          plans={data.plans}
          ops={ops}
          onClose={() => setBusiness(null)}
          onSaved={() => {
            void mutate();
          }}
          onReview={() => {
            setReview({
              kind: "businesses",
              id: business.id,
              name: business.name,
              status: business.verificationStatus,
              note: business.verificationNote,
            });
            setBusiness(null);
          }}
          onCatalog={() => {
            setCatalogBusiness(business);
            setBusiness(null);
          }}
        />
      )}
      {plan !== undefined && (
        <PlanEditor
          key={plan?.id || "new"}
          plan={plan}
          onClose={() => setPlan(undefined)}
          onSaved={() => {
            setPlan(undefined);
            void mutate();
          }}
        />
      )}
      {catalogBusiness && (
        <ProductEditor
          product={null}
          allowStock
          businessId={catalogBusiness.id}
          endpoint={`/platform/businesses/${catalogBusiness.id}/products`}
          onClose={() => setCatalogBusiness(null)}
          onSaved={() => {
            setCatalogBusiness(null);
            void mutate();
          }}
        />
      )}
    </>
  );
}
function ReviewDialog({
  review,
  onClose,
  onSaved,
}: {
  review: Review;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState(review.status),
    [note, setNote] = useState(review.note),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const statuses = ["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"];
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(
        `/platform/${review.kind}/${review.id}/review`,
        { status, note },
        "PATCH",
      );
      toast.success("Review saved and affected members notified");
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
          <DialogTitle>Review {review.name}</DialogTitle>
          <DialogDescription>
            Verification controls public trust status. Suspension revokes active account access.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <Field label="Review decision">
            <SearchSelect
              className="field"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.toLowerCase()}
                </option>
              ))}
            </SearchSelect>
          </Field>
          <Field
            label="Review note"
            required={["REJECTED", "SUSPENDED"].includes(status)}
          >
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required={["REJECTED", "SUSPENDED"].includes(status)}
              minLength={
                ["REJECTED", "SUSPENDED"].includes(status) ? 3 : undefined
              }
              placeholder="Reason or next steps for the member"
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
              Save review
            </BusyButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function BusinessReview({
  business,
  plans,
  ops,
  onClose,
  onSaved,
  onReview,
  onCatalog,
}: {
  business: PlatformBusiness;
  plans: Plan[];
  ops: boolean;
  onClose: () => void;
  onSaved: () => void;
  onReview: () => void;
  onCatalog: () => void;
}) {
  const [detailTab, setDetailTab] = useState("overview");
  const [note, setNote] = useState(business.onboardingNote),
    [planId, setPlanId] = useState(business.plan.id),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(
        `/platform/businesses/${business.id}/onboarding`,
        { note },
        "PATCH",
      );
      if (!ops && planId !== business.plan.id)
        await send(
          `/platform/businesses/${business.id}/plan`,
          { planId },
          "PATCH",
        );
      toast.success("Business operations record updated");
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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{business.name}</DialogTitle>
          <DialogDescription>
            {business.owner.name} · +91 {business.owner.phone}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 border-b pb-3">
          {["overview", "tasks", ...(!ops ? ["subscription"] : [])].map((t) => (
            <Button
              key={t}
              size="sm"
              variant={detailTab === t ? "secondary" : "ghost"}
              onClick={() => setDetailTab(t)}
            >
              {t === "overview"
                ? "Profile & review"
                : t === "tasks"
                  ? "Setup tasks"
                  : "Subscription"}
            </Button>
          ))}
        </div>
        {detailTab === "tasks" && (
          <OperationsTasks businessId={business.id} onSaved={onSaved} />
        )}
        {detailTab === "subscription" && !ops && (
          <Subscription businessId={business.id} embedded onSaved={onSaved} />
        )}
        {detailTab === "overview" && (
          <>
            <div className="space-y-3 rounded-lg bg-muted/50 p-4 text-xs">
              <div className="flex justify-between">
                <span>Verification</span>
                <Status value={business.verificationStatus} />
              </div>
              <p className="leading-5 text-muted-foreground">
                {business.address}, {business.city}
                <br />
                {business.marketArea} · {business.categories.join(", ")}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                GSTIN: {business.gstNumber || "Not provided"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Pill>{business._count.products} products</Pill>
                <Pill>{business._count.staff} staff</Pill>
                <Pill>{business._count.invoices} bills</Pill>
              </div>
              {business.uploads.map((u) => (
                <a
                  key={u.id}
                  className="flex items-center gap-1.5 text-primary"
                  href={`/api/v1/media/${u.id}`}
                  download
                >
                  <FileCheck className="size-3" />
                  {u.fileName}
                </a>
              ))}
              {business.verificationNote && (
                <p className="text-xs">
                  Review: {business.verificationNote}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCatalog}>
                <Plus />
                Add catalog entry
              </Button>
              {!ops && (
                <Button variant="outline" size="sm" onClick={onReview}>
                  <ShieldCheck />
                  Review verification
                </Button>
              )}
            </div>
            <form onSubmit={save} className="space-y-4">
              <Field label="Onboarding / data entry note">
                <Textarea
                  rows={3}
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Pending documents, catalog work and next steps"
                />
              </Field>
              {!ops && (
                <Field label="Assigned subscription plan">
                  <SearchSelect
                    className="field"
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                  >
                    {plans
                      .filter((p) => p.active || p.id === business.plan.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {money(p.monthlyPricePaise, true)}/mo ·{" "}
                          {p.staffLimit} staff
                        </option>
                      ))}
                  </SearchSelect>
                </Field>
              )}
              <FormError message={error} />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={busy}
                >
                  Close
                </Button>
                <BusyButton type="submit" busy={busy}>
                  Save operations record
                </BusyButton>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
function PlanEditor({
  plan,
  onClose,
  onSaved,
}: {
  plan: Plan | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(plan?.name || ""),
    [price, setPrice] = useState(String((plan?.monthlyPricePaise || 0) / 100)),
    [yearlyPrice, setYearlyPrice] = useState(
      String((plan?.yearlyPricePaise || 0) / 100),
    ),
    [staffLimit, setStaffLimit] = useState(plan?.staffLimit || 3),
    [productLimit, setProductLimit] = useState(plan?.productLimit || 500),
    [active, setActive] = useState(plan?.active ?? true),
    [bulkImport, setBulkImport] = useState(plan?.bulkImport ?? false),
    [advancedReports, setAdvancedReports] = useState(
      plan?.advancedReports ?? false,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(
        plan ? `/platform/plans/${plan.id}` : "/platform/plans",
        {
          name,
          monthlyPricePaise: toPaise(price),
          yearlyPricePaise: toPaise(yearlyPrice),
          staffLimit,
          productLimit,
          active,
          bulkImport,
          advancedReports,
        },
        plan ? "PATCH" : "POST",
      );
      toast.success("Subscription plan updated");
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
          <DialogTitle>
            {plan ? "Edit plan" : "Create a subscription plan"}
          </DialogTitle>
          <DialogDescription>
            Every plan retains billing and stock management.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <Field label="Plan name" required>
            <Input
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Monthly price (₹)" required>
            <Input
              required
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <Field
            label="Yearly price (₹)"
            hint="Set 0 to keep yearly collections unavailable"
          >
            <Input
              required
              inputMode="decimal"
              value={yearlyPrice}
              onChange={(e) => setYearlyPrice(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Active staff limit">
              <Input
                required
                type="number"
                min={1}
                value={staffLimit}
                onChange={(e) => setStaffLimit(Number(e.target.value))}
              />
            </Field>
            <Field label="Active product limit">
              <Input
                required
                type="number"
                min={1}
                value={productLimit}
                onChange={(e) => setProductLimit(Number(e.target.value))}
              />
            </Field>
          </div>
          {[
            ["Plan available", active, setActive],
            ["Excel / CSV & image import", bulkImport, setBulkImport],
            ["Extended report periods", advancedReports, setAdvancedReports],
          ].map(([label, checked, set]) => (
            <label
              key={String(label)}
              className="flex items-center gap-2 text-xs"
            >
              <Checkbox
                checked={checked as boolean}
                onCheckedChange={(v) =>
                  (set as (v: boolean) => void)(v === true)
                }
              />
              {label as string}
            </label>
          ))}
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
              Save plan
            </BusyButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
