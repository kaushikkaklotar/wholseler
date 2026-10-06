"use client";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Check, Upload } from "lucide-react";
import { sellerSchema } from "@wholesale/shared";
import { api, errorMessage, send } from "@/lib/api";
import { useSession } from "./session";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import {
  BusyButton,
  ErrorState,
  Field,
  FormError,
  Loading,
  PageHeader,
  Panel,
  Status,
} from "./common";
type BuyerProfile = {
  businessName: string;
  city: string;
  gstNumber: string;
  panNumber: string;
  marketplaceChannels: string[];
  verificationStatus: string;
  verificationNote: string;
  user: { name: string; phone: string };
  uploads: { id: string; fileName: string }[];
};
export function BuyerProfile() {
  const { data, error, mutate } = useSWR<BuyerProfile>("/seller/profile");
  return (
    <>
      <PageHeader
        title="Buyer profile"
        description="Your sourcing business, selling channels and optional verification documents."
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
        <BuyerProfileForm
          key={JSON.stringify(data)}
          data={data}
          onSaved={() => {
            void mutate();
          }}
        />
      )}
    </>
  );
}
function BuyerProfileForm({
  data,
  onSaved,
}: {
  data: BuyerProfile;
  onSaved: () => void;
}) {
  const { refresh } = useSession();
  const [draft, setDraft] = useState({
      name: data.user.name,
      businessName: data.businessName,
      city: data.city,
      gstNumber: data.gstNumber,
      panNumber: data.panNumber,
      marketplaceChannels: data.marketplaceChannels,
    }),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send("/seller/profile", sellerSchema.parse(draft), "PATCH");
      await refresh();
      toast.success("Buyer profile saved for review");
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api("/uploads?kind=KYC", { method: "POST", body: form });
      toast.success("Private document uploaded");
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1.5fr_1fr]">
      <Panel
        title="Business details"
        action={<Status value={data.verificationStatus} />}
      >
        <form onSubmit={save} className="space-y-5 border-t p-5">
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            {[
              ["name", "Your name"],
              ["businessName", "Business name"],
              ["city", "City"],
              ["gstNumber", "GSTIN (optional)"],
              ["panNumber", "PAN (optional)"],
            ].map(([key, label]) => (
              <Field
                key={key}
                label={label}
                required={["name", "businessName", "city"].includes(key)}
              >
                <Input
                  required={["name", "businessName", "city"].includes(key)}
                  value={draft[key as "name"]}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      [key]: key.endsWith("Number")
                        ? e.target.value.toUpperCase()
                        : e.target.value,
                    }))
                  }
                  maxLength={
                    key === "panNumber" ? 10 : key === "gstNumber" ? 15 : 100
                  }
                />
              </Field>
            ))}
            <Field label="Verified login mobile">
              <Input value={`+91 ${data.user.phone}`} disabled />
            </Field>
          </fieldset>
          <Field label="Where do you sell?">
            <div className="flex flex-wrap gap-3">
              {[
                "Amazon",
                "Meesho",
                "Flipkart",
                "Ajio",
                "Shopify",
                "Instagram",
                "Offline",
                "Other",
              ].map((c) => (
                <label key={c} className="flex items-center gap-2 text-xs">
                  <Checkbox
                    disabled={busy}
                    checked={draft.marketplaceChannels.includes(c)}
                    onCheckedChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        marketplaceChannels:
                          v === true
                            ? [...d.marketplaceChannels, c]
                            : d.marketplaceChannels.filter((s) => s !== c),
                      }))
                    }
                  />
                  {c}
                </label>
              ))}
            </div>
          </Field>
          <FormError message={error} />
          <BusyButton busy={busy} type="submit">
            <Check />
            Save profile
          </BusyButton>
        </form>
      </Panel>
      <Panel title="Optional business verification">
        <div className="space-y-4 border-t p-5">
          <p className="text-xs leading-5 text-muted-foreground">
            Upload GST / PAN / business proof for platform review. Documents
            remain private to your account and verification team.
          </p>
          {data.uploads.map((f) => (
            <a
              key={f.id}
              className="block text-xs text-primary"
              href={`/api/v1/media/${f.id}`}
              download
            >
              {f.fileName}
            </a>
          ))}
          <Button variant="outline" asChild disabled={uploading}>
            <label>
              <Upload />
              {uploading ? "Uploading…" : "Upload document"}
              <input
                className="sr-only"
                type="file"
                disabled={uploading}
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          {data.verificationNote && (
            <p className="text-xs leading-5">{data.verificationNote}</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
