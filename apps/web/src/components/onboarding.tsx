"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LogOut,
  ShieldCheck,
  Store,
} from "lucide-react";
import {
  businessSchema,
  categories,
  gstSchema,
  sellerSchema,
} from "@wholesale/shared";
import { home, useSession } from "@/components/session";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BusyButton,
  ErrorState,
  Field,
  FormError,
  Loading,
} from "@/components/common";
import { buyerDestination } from "@/lib/auth-entry";
import { errorMessage, send } from "@/lib/api";

type Draft = {
  ownerName: string;
  name: string;
  city: string;
  marketArea: string;
  address: string;
  categories: string[];
  gstNumber: string;
  moq: number;
  deliveryInfo: string;
  description: string;
  invoicePrefix: string;
};
const blank: Draft = {
  ownerName: "",
  name: "",
  city: "",
  marketArea: "",
  address: "",
  categories: [],
  gstNumber: "",
  moq: 1,
  deliveryInfo: "",
  description: "",
  invoicePrefix: "WH",
};
export function Onboarding() {
  const { user, loading, error, refresh } = useSession(),
    router = useRouter(),
    params = useSearchParams();
  const next = params.get("next"),
    buyer = user?.role === "SELLER";
  const [draft, setDraft] = useState<Draft>(blank),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    stepHeading.current?.focus({ preventScroll: true });
    stepHeading.current?.scrollIntoView({ block: "start" });
  }, [step]);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  useEffect(() => {
    if (!loading && error?.status === 401) router.replace("/login");
    if (user && !user.onboardingRequired)
      router.replace(buyerDestination(user, next) || home(user));
  }, [user, loading, error, router, next]);
  async function advance(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (step < 2) {
      if (step === 1) {
        const gst = gstSchema.safeParse(draft.gstNumber);
        if (!gst.success) {
          setMessage(
            "Enter a valid GSTIN, or leave it blank if you are not registered.",
          );
          return;
        }
      }
      if (step === 1 && !buyer && !draft.categories.length) {
        setMessage("Choose at least one product category.");
        return;
      }
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      const checked = buyer
        ? sellerSchema.safeParse({
            name: draft.ownerName,
            businessName: draft.name,
            city: draft.city,
            gstNumber: draft.gstNumber,
          })
        : businessSchema.safeParse({ ...draft, phone: user!.phone });
      if (!checked.success) {
        setMessage(
          checked.error.issues.map((issue) => issue.message).join(". "),
        );
        return;
      }
      const payload = buyer
        ? checked.data
        : { ...checked.data, ownerName: draft.ownerName };
      await send("/auth/onboard", payload);
      const signed = await refresh();
      if (signed)
        router.replace(buyerDestination(signed, next) || home(signed));
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    try {
      await send("/auth/logout", {});
      try {
        await refresh();
      } catch {}
      router.replace("/");
    } catch (e) {
      setMessage(errorMessage(e));
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="mx-auto max-w-4xl p-10">
        <Loading />
      </div>
    );
  if (error && error.status !== 401)
    return (
      <div className="mx-auto max-w-4xl p-10">
        <ErrorState error={error} retry={() => void refresh()} />
      </div>
    );
  if (!user || !user.onboardingRequired) return null;
  const steps = buyer
    ? ["Your store", "Business details", "Review & start"]
    : ["Your business", "Products & billing", "Review & start"];
  return (
    <div className="entry-page min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-10">
        <Link href="/" aria-label="Wholseler home">
          <Brand />
        </Link>
        <Button
          disabled={busy}
          variant="ghost"
          size="sm"
          onClick={() => void signOut()}
        >
          <LogOut />
          Sign out
        </Button>
      </header>
      <main className="mx-auto grid max-w-6xl items-start gap-12 px-5 py-8 lg:grid-cols-[.75fr_1.25fr] lg:py-12">
        <aside>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Your mobile is verified
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-[-1.5px]">
            {buyer
              ? "Make it your sourcing desk."
              : "Make it your business workspace."}
          </h1>
          <p className="mt-5 text-sm leading-7 text-muted-foreground">
            {buyer
              ? "A few details about your store help suppliers understand your business."
              : "Tell us about your business. Start with the essentials—you can complete your profile and upload documents from settings later."}
          </p>
          <ol className="mt-8 space-y-5">
            {steps.map((title, i) => (
              <li
                key={title}
                aria-current={step === i ? "step" : undefined}
                className="flex items-center gap-3"
              >
                <span
                  className={`flex size-9 items-center justify-center rounded-full border text-xs font-semibold ${step === i ? "border-primary bg-primary text-white" : step > i ? "border-primary bg-secondary text-primary" : "bg-card text-muted-foreground"}`}
                >
                  {step > i ? <Check className="size-4" /> : i + 1}
                </span>
                <span
                  className={`text-sm ${step === i ? "font-semibold" : "text-muted-foreground"}`}
                >
                  {title}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-9 rounded-xl border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-primary" />
              +91 {user.phone}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {buyer
                ? "Your verified sign-in mobile."
                : "Your sign-in and business contact mobile. You can change the business contact later."}
            </p>
          </div>
        </aside>
        <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-xs text-muted-foreground">Step {step + 1} of 3</p>
          <h2
            ref={stepHeading}
            tabIndex={-1}
            className="mb-2 mt-3 scroll-mt-6 text-2xl font-semibold tracking-tight outline-none"
          >
            {steps[step]}
          </h2>
          <p className="mb-7 text-sm text-muted-foreground">
            {step === 0
              ? "The basics, so we know who you are."
              : step === 1
                ? "Set the details your business needs."
                : "Everything looks good? Create your workspace."}
          </p>
          <form onSubmit={advance} className="space-y-5">
            {step === 0 && (
              <>
                <Field label="Your full name" required>
                  <Input
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                    value={draft.ownerName}
                    onChange={(e) => update("ownerName", e.target.value)}
                    placeholder="Owner / account holder name"
                  />
                </Field>
                <Field
                  label={
                    buyer ? "Store / business name" : "Wholesale business name"
                  }
                  required
                >
                  <Input
                    autoComplete="organization"
                    required
                    minLength={2}
                    maxLength={100}
                    value={draft.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder={
                      buyer ? "Your retail store name" : "Name buyers will see"
                    }
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="City" required>
                    <Input
                      autoComplete="address-level2"
                      required
                      minLength={2}
                      maxLength={80}
                      value={draft.city}
                      onChange={(e) => update("city", e.target.value)}
                      placeholder="e.g. Surat"
                    />
                  </Field>
                  {!buyer && (
                    <Field label="Market / area" required>
                      <Input
                        required
                        minLength={2}
                        maxLength={100}
                        value={draft.marketArea}
                        onChange={(e) => update("marketArea", e.target.value)}
                        placeholder="e.g. Ring Road"
                      />
                    </Field>
                  )}
                </div>
                {!buyer && (
                  <Field label="Business address" required>
                    <Textarea
                      autoComplete="street-address"
                      required
                      minLength={5}
                      maxLength={500}
                      value={draft.address}
                      onChange={(e) => update("address", e.target.value)}
                      placeholder="Shop number, building and street"
                      rows={3}
                    />
                  </Field>
                )}
              </>
            )}
            {step === 1 && (
              <>
                {!buyer && (
                  <fieldset>
                    <legend className="mb-3 text-sm font-medium">
                      What do you sell? <span className="text-primary">*</span>
                    </legend>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Choose at least one category.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {categories.map((category) => (
                        <label
                          key={category}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-xs ${draft.categories.includes(category) ? "border-primary bg-secondary text-primary" : "text-muted-foreground"}`}
                        >
                          <input
                            type="checkbox"
                            checked={draft.categories.includes(category)}
                            onChange={(e) =>
                              update(
                                "categories",
                                e.target.checked
                                  ? [...draft.categories, category]
                                  : draft.categories.filter(
                                      (c) => c !== category,
                                    ),
                              )
                            }
                            className="accent-[var(--primary)]"
                          />
                          {category}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                <Field
                  label="GSTIN (optional)"
                  hint="Leave blank if your business is not GST registered."
                >
                  <Input
                    maxLength={15}
                    value={draft.gstNumber}
                    onChange={(e) =>
                      update("gstNumber", e.target.value.toUpperCase())
                    }
                    placeholder="15-character GSTIN"
                  />
                </Field>
                {!buyer && (
                  <>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field
                        label="Minimum order quantity"
                        required
                        hint="Your default sourcing quantity."
                      >
                        <Input
                          type="number"
                          required
                          min={1}
                          max={100000}
                          value={draft.moq}
                          onChange={(e) =>
                            update("moq", Number(e.target.value))
                          }
                        />
                      </Field>
                      <Field
                        label="Invoice prefix"
                        required
                        hint="e.g. WH or your business initials."
                      >
                        <Input
                          required
                          pattern="[A-Z0-9-]{1,12}"
                          maxLength={12}
                          value={draft.invoicePrefix}
                          onChange={(e) =>
                            update(
                              "invoicePrefix",
                              e.target.value.toUpperCase(),
                            )
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Delivery / dispatch details (optional)">
                      <Input
                        maxLength={300}
                        value={draft.deliveryInfo}
                        onChange={(e) => update("deliveryInfo", e.target.value)}
                        placeholder="Dispatch timing and delivery locations"
                      />
                    </Field>
                  </>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <dl className="divide-y rounded-xl border px-4">
                  {[
                    ["Account holder", draft.ownerName],
                    ["Business", draft.name],
                    ["Mobile", `+91 ${user.phone}`],
                    [
                      "Location",
                      buyer ? draft.city : `${draft.marketArea}, ${draft.city}`,
                    ],
                    ...(!buyer
                      ? [
                          ["Address", draft.address],
                          ["Categories", draft.categories.join(", ")],
                          ["Invoice prefix", draft.invoicePrefix],
                          ["Minimum order", `${draft.moq} units`],
                        ]
                      : []),
                    ["GSTIN", draft.gstNumber || "Not provided"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[100px_1fr] gap-4 py-3 text-xs sm:grid-cols-[130px_1fr]"
                    >
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="break-words font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="rounded-xl bg-secondary p-4 text-xs leading-6 text-muted-foreground">
                  {buyer
                    ? "Your buyer workspace includes product discovery, saved products and inquiry history. Agree commercial terms directly with suppliers."
                    : "Your workspace starts on the lowest-priced active business plan. Your public business profile will be pending review; it will appear in the marketplace after approval. You can begin adding products and using your workspace."}
                </div>
              </>
            )}
            <FormError message={message} />
            <div className="flex items-center justify-between gap-3 border-t pt-5">
              {step > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setMessage("");
                    setStep(step - 1);
                  }}
                >
                  <ArrowLeft />
                  Back
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  * Required fields
                </span>
              )}
              <BusyButton type="submit" busy={busy} className="h-11">
                {step === 2 ? <Store /> : null}
                {step === 2 ? "Create my workspace" : "Continue"}
                <ArrowRight />
              </BusyButton>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
