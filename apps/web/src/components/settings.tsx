"use client";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Check, FileCheck, Upload } from "lucide-react";
import { businessSchema, categories, money } from "@wholesale/shared";
import type { BusinessSettings } from "@/lib/types";
import { api, errorMessage, send } from "@/lib/api";
import { useSession } from "@/components/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BusyButton,
  ErrorState,
  Field,
  FormError,
  Loading,
  PageHeader,
  Panel,
  Pill,
  Status,
} from "@/components/common";
type BusinessDraft = {
  name: string;
  phone: string;
  address: string;
  city: string;
  marketArea: string;
  categories: string[];
  gstNumber: string;
  panNumber: string;
  contactPreference?: string;
  moq: number;
  deliveryInfo: string;
  description: string;
  invoicePrefix: string;
};
function CategoryChoices({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c) => (
        <label
          key={c}
          className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-[11px] ${value.includes(c) ? "border-violet-200 bg-violet-50 text-primary" : "bg-white text-muted-foreground"}`}
        >
          <Checkbox
            checked={value.includes(c)}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onChange(
                checked === true ? [...value, c] : value.filter((v) => v !== c),
              )
            }
          />
          {c}
        </label>
      ))}
    </div>
  );
}
function BusinessFields({
  draft,
  setDraft,
  disabled = false,
}: {
  draft: BusinessDraft;
  setDraft: React.Dispatch<React.SetStateAction<BusinessDraft>>;
  disabled?: boolean;
}) {
  const update = <K extends keyof BusinessDraft>(
    key: K,
    value: BusinessDraft[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Business name" required>
          <Input
            required
            minLength={2}
            disabled={disabled}
            value={draft.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Your business name"
          />
        </Field>
        <Field label="Contact mobile" required>
          <Input
            required
            maxLength={10}
            pattern="[6-9][0-9]{9}"
            disabled={disabled}
            value={draft.phone}
            onChange={(e) => update("phone", e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="City" required>
          <Input
            required
            minLength={2}
            disabled={disabled}
            value={draft.city}
            onChange={(e) => update("city", e.target.value)}
          />
        </Field>
        <Field label="Market / area" required>
          <Input
            required
            minLength={2}
            disabled={disabled}
            value={draft.marketArea}
            onChange={(e) => update("marketArea", e.target.value)}
          />
        </Field>
        <Field label="GSTIN (optional)" hint="Required for GST invoice mode">
          <Input
            maxLength={15}
            disabled={disabled}
            value={draft.gstNumber}
            onChange={(e) => update("gstNumber", e.target.value.toUpperCase())}
            placeholder="15 character GSTIN"
          />
        </Field>
        <Field label="PAN (optional)">
          <Input
            maxLength={10}
            disabled={disabled}
            value={draft.panNumber || ""}
            onChange={(e) => update("panNumber", e.target.value.toUpperCase())}
            placeholder="ABCDE1234F"
          />
        </Field>
        <Field label="Preferred buyer contact">
          <select
            className="field"
            disabled={disabled}
            value={draft.contactPreference || "BOTH"}
            onChange={(e) => update("contactPreference", e.target.value)}
          >
            <option value="BOTH">Call & WhatsApp</option>
            <option value="CALL">Call only</option>
            <option value="WHATSAPP">WhatsApp only</option>
          </select>
        </Field>
        <Field label="Minimum order quantity">
          <Input
            type="number"
            min={1}
            required
            disabled={disabled}
            value={draft.moq}
            onChange={(e) => update("moq", Number(e.target.value))}
          />
        </Field>
        <Field
          label="Invoice prefix"
          hint="Used for newly issued invoice numbers"
        >
          <Input
            maxLength={12}
            required
            disabled={disabled}
            value={draft.invoicePrefix}
            onChange={(e) =>
              update("invoicePrefix", e.target.value.toUpperCase())
            }
          />
        </Field>
        <Field label="Delivery / dispatch details">
          <Input
            disabled={disabled}
            value={draft.deliveryInfo}
            onChange={(e) => update("deliveryInfo", e.target.value)}
            placeholder="Dispatch time and delivery locations"
          />
        </Field>
      </div>
      <Field label="Business address" required>
        <Textarea
          required
          minLength={5}
          disabled={disabled}
          value={draft.address}
          onChange={(e) => update("address", e.target.value)}
          rows={2}
        />
      </Field>
      <Field label="About your business">
        <Textarea
          disabled={disabled}
          value={draft.description}
          onChange={(e) => update("description", e.target.value)}
          rows={3}
        />
      </Field>
      <div className="space-y-2">
        <p className="form-label">Product categories *</p>
        <CategoryChoices
          value={draft.categories}
          onChange={(v) => update("categories", v)}
          disabled={disabled}
        />
      </div>
    </>
  );
}
export function Settings() {
  const { can, refresh } = useSession();
  const { data, error, mutate } = useSWR<BusinessSettings>("/settings");
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
      <PageHeader
        title="Business settings"
        description="Your supplier profile, invoice details and current plan."
        actions={<Status value={data.verificationStatus} />}
      />
      <SettingsForm
        key={data.id + data.verificationStatus + data.gstNumber}
        data={data}
        editable={can("SETTINGS:EDIT")}
        onSaved={() => {
          void mutate();
          void refresh();
        }}
      />
    </>
  );
}
function SettingsForm({
  data,
  editable,
  onSaved,
}: {
  data: BusinessSettings;
  editable: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<BusinessDraft>({ ...data }),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send("/settings", businessSchema.parse(draft), "PATCH");
      toast.success("Profile saved and queued for verification");
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api("/uploads?kind=KYC", { method: "POST", body: form });
      toast.success("Verification document uploaded");
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.65fr_1fr]">
      <Panel
        title="Business profile"
        description="Profile changes are reviewed before public discovery"
      >
        <form onSubmit={save} className="space-y-5 border-t p-5">
          <BusinessFields
            draft={draft}
            setDraft={setDraft}
            disabled={!editable}
          />
          <FormError message={error} />
          {editable && (
            <BusyButton type="submit" busy={busy}>
              <Check />
              Save business profile
            </BusyButton>
          )}
        </form>
      </Panel>
      <div className="space-y-5">
        <Panel
          title="Your subscription"
          action={<Pill tone="primary">{data.plan.name}</Pill>}
        >
          <div className="space-y-4 border-t p-5">
            <p className="text-3xl font-semibold tracking-tight">
              {money(data.plan.monthlyPricePaise, true)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                / month
              </span>
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active staff</span>
                <span>
                  {data._count.staff} / {data.plan.staffLimit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active products</span>
                <span>
                  {data._count.products} /{" "}
                  {data.plan.productLimit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Billing & inventory
                </span>
                <span className="text-emerald-600">Included</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bulk import</span>
                <span>
                  {data.plan.bulkImport ? "Included" : "Growth / Pro"}
                </span>
              </div>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/support?category=SUBSCRIPTION">
                Contact team about plan
              </Link>
            </Button>
          </div>
        </Panel>
        <Panel
          title="Verification documents"
          description="Optional GST / PAN / business proof"
        >
          <div className="space-y-3 border-t p-5">
            {data.uploads.map((f) => (
              <a
                key={f.id}
                className="flex items-center gap-2 text-[11px] text-primary"
                href={`/api/v1/media/${f.id}`}
                download
              >
                <FileCheck className="size-3.5" />
                {f.fileName}
              </a>
            ))}
            {!data.uploads.length && (
              <p className="text-xs text-muted-foreground">
                No documents uploaded.
              </p>
            )}
            {editable && (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                <Upload className="size-4" />
                {uploading ? "Uploading…" : "Upload proof"}
                <input
                  disabled={uploading}
                  className="sr-only"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            <p className="text-[10px] leading-5 text-muted-foreground">
              Documents are private to your business and the platform
              verification team. Up to 8 MB per file.
            </p>
            {data.verificationNote && (
              <div className="rounded-lg bg-muted p-3 text-xs leading-5">
                {data.verificationNote}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
