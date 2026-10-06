"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ShieldCheck,
  Smartphone,
  Store,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BusyButton, Field, FormError } from "@/components/common";
import { home, useSession } from "@/components/session";
import { errorMessage, send } from "@/lib/api";
import { buyerDestination } from "@/lib/auth-entry";
import type { Role, SessionUser } from "@wholesale/shared";
type Portal = "WHOLESALER" | "SELLER" | "TEAM";
type Challenge = {
  challengeId: string;
  expiresIn: number;
  developmentCode?: string;
};
const labels: Record<Role, string> = {
  WHOLESALER_OWNER: "Owner",
  WHOLESALER_STAFF: "Staff",
  SELLER: "Buyer",
  PLATFORM_ADMIN: "Admin",
  PLATFORM_OPERATIONS: "Operations",
};
export function Login({
  portal = "WHOLESALER",
  register = false,
}: {
  portal?: Portal;
  register?: boolean;
}) {
  const router = useRouter(),
    params = useSearchParams(),
    { user, refresh, loading } = useSession();
  const next = params.get("next"),
    buyer = portal === "SELLER",
    team = portal === "TEAM";
  const route = team
    ? "/login/team"
    : buyer
      ? "/login/buyer"
      : "/login/wholesaler";
  const other = `${register ? route : buyer ? "/register/buyer" : "/register/wholesaler"}${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  const { data: config } = useSWR<{
    development: boolean;
    accounts: { name: string; phone: string; role: Role }[];
  }>("/config");
  const [phone, setPhone] = useState(""),
    [challenge, setChallenge] = useState<Challenge | null>(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [resendAt, setResendAt] = useState(0),
    [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (user)
      router.replace(
        user.onboardingRequired
          ? `/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}`
          : buyerDestination(user, next) || home(user),
      );
  }, [user, router, next]);
  useEffect(() => {
    if (!resendAt) return;
    const tick = () =>
      setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);
  async function request(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      setChallenge(
        await send<Challenge>("/auth/request", {
          phone,
          accountType: buyer ? "SELLER" : "WHOLESALER_OWNER",
          portal,
          intent: register ? "REGISTER" : "LOGIN",
        }),
      );
      setCode("");
      setResendAt(Date.now() + 60000);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const signed = await send<SessionUser>("/auth/verify", {
        challengeId: challenge!.challengeId,
        code,
      });
      await refresh();
      router.replace(
        signed.onboardingRequired
          ? `/onboarding${next ? `?next=${encodeURIComponent(next)}` : ""}`
          : buyerDestination(signed, next) || home(signed),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const title = challenge
    ? "Check your phone."
    : register
      ? buyer
        ? "Your next supplier starts here."
        : "Let’s set up your business."
      : team
        ? "Your team workspace."
        : buyer
          ? "Welcome back, buyer."
          : "Welcome back, wholesaler.";
  return (
    <div className="entry-page min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-10">
        <Link href="/" aria-label="Wholseler home">
          <Brand />
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href="/marketplace">
            <ArrowLeft />
            Marketplace
          </Link>
        </Button>
      </header>
      <main className="mx-auto grid max-w-7xl gap-12 px-5 py-8 lg:min-h-[calc(100vh-160px)] lg:grid-cols-2 lg:items-center lg:px-10 lg:py-12">
        <section className="entry-story relative hidden overflow-hidden rounded-3xl p-10 lg:block">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-white/60">
            {buyer
              ? "A better way to source"
              : "Built for your wholesale business"}
          </p>
          <h1 className="mt-8 max-w-md text-5xl font-semibold leading-[1.12] tracking-[-2px]">
            {buyer ? (
              <>
                Find the right products.
                <br />
                <span className="text-white/50">
                  Know who you’re buying from.
                </span>
              </>
            ) : (
              <>
                Less counter chaos.
                <br />
                <span className="text-white/50">More business, together.</span>
              </>
            )}
          </h1>
          <p className="mt-7 max-w-sm text-sm leading-7 text-white/70">
            {buyer
              ? "Browse published catalogs, shortlist products and speak directly with wholesale suppliers."
              : "One place for your catalog, every stock movement, your team and the bills that keep your business moving."}
          </p>
          <div className="mt-12 space-y-4 border-t border-white/15 pt-7">
            {(buyer
              ? [
                  "Search by product, category and city",
                  "See MOQ and available variants",
                  "Contact suppliers on WhatsApp or call",
                ]
              : [
                  "Manage products, sizes and colours",
                  "Create bills with stock kept in sync",
                  "Give your staff the right access",
                ]
            ).map((text) => (
              <p
                key={text}
                className="flex items-center gap-3 text-sm text-white/80"
              >
                <Check className="size-4 shrink-0" />
                {text}
              </p>
            ))}
          </div>
          <div className="mt-12 flex items-center gap-3 text-xs text-white/60">
            <ShieldCheck className="size-5" />
            Mobile verification. Separate business workspaces.
          </div>
        </section>
        <section className="mx-auto w-full max-w-md pb-8">
          {!challenge && !team && (
            <div
              className="mb-9 grid grid-cols-2 gap-2 rounded-xl border bg-card p-1.5"
              aria-label="Choose your workspace"
            >
              {[
                [
                  "WHOLESALER",
                  "Wholesaler",
                  register ? "/register/wholesaler" : "/login/wholesaler",
                ],
                [
                  "SELLER",
                  "Buyer / retailer",
                  register ? "/register/buyer" : "/login/buyer",
                ],
              ].map(([value, label, href]) => (
                <Link
                  key={value}
                  href={`${href}${next ? `?next=${encodeURIComponent(next)}` : ""}`}
                  aria-current={value === portal ? "page" : undefined}
                  className={`rounded-lg px-3 py-3 text-center text-sm font-medium ${value === portal ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted"}`}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border bg-card text-primary">
            {challenge ? <Smartphone /> : <Store />}
          </div>
          <h2 className="text-3xl font-semibold leading-tight tracking-[-1px]">
            {title}
          </h2>
          <p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">
            {challenge
              ? `Enter the six-digit code sent to +91 ${phone}. The code expires in five minutes.`
              : register
                ? "First verify your mobile number. Then add your business details—no password to remember."
                : "Sign in with your registered mobile number. We’ll send you a one-time verification code."}
          </p>
          <form onSubmit={challenge ? verify : request} className="space-y-5">
            {!challenge ? (
              <Field label="Mobile number" required>
                <div className="flex h-12 overflow-hidden rounded-xl border bg-card focus-within:ring-2 focus-within:ring-ring/20">
                  <span className="flex items-center border-r px-4 text-sm text-muted-foreground">
                    +91
                  </span>
                  <input
                    aria-label="Mobile number"
                    autoComplete="tel-national"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    pattern="[6-9][0-9]{9}"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="Your 10-digit mobile number"
                    className="min-w-0 flex-1 bg-transparent px-4 text-base outline-none"
                  />
                </div>
              </Field>
            ) : (
              <>
                <Field label="Verification code" required>
                  <Input
                    aria-label="Verification code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="h-14 rounded-xl text-center font-mono text-2xl tracking-[.4em]"
                    autoFocus
                    required
                  />
                </Field>
                {challenge.developmentCode && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                    <p>
                      Local development OTP:{" "}
                      <strong>{challenge.developmentCode}</strong>
                    </p>
                    <p>SMS is disabled for local testing.</p>
                    <Button
                      type="button"
                      variant="link"
                      className="h-7 px-0 text-amber-900"
                      onClick={() => setCode(challenge.developmentCode!)}
                    >
                      Use this code
                    </Button>
                  </div>
                )}
              </>
            )}
            <FormError message={error} />
            <BusyButton
              busy={busy || loading}
              type="submit"
              className="h-12 w-full rounded-xl text-sm"
            >
              {challenge
                ? "Verify & continue"
                : register
                  ? "Verify my mobile"
                  : "Send verification code"}
              <ArrowRight />
            </BusyButton>
            {challenge && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-xs"
                  disabled={busy}
                  onClick={() => {
                    setChallenge(null);
                    setCode("");
                    setError("");
                  }}
                >
                  Change number
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-xs"
                  disabled={busy || seconds > 0}
                  onClick={() => void request()}
                >
                  {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
                </Button>
              </div>
            )}
          </form>
          {!team && (
            <p className="mt-7 text-center text-sm text-muted-foreground">
              {register ? "Already have an account?" : "New to Wholseler?"}{" "}
              <Link
                href={other}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {register
                  ? "Sign in"
                  : buyer
                    ? "Create buyer account"
                    : "Register your business"}
              </Link>
            </p>
          )}
          {!challenge && (
            <p className="mt-5 text-center text-xs text-muted-foreground">
              {team ? (
                "Ask your business owner or platform administrator for access."
              ) : (
                <>
                  Staff member?{" "}
                  <Link href="/login/team" className="text-primary">
                    Use team sign in
                  </Link>
                </>
              )}
            </p>
          )}
          {!register && !challenge && config?.development && (
            <details className="mt-8 rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Local demo accounts</summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {config.accounts
                  .filter(
                    (a, i, all) =>
                      all.findIndex((b) => b.role === a.role) === i,
                  )
                  .filter((a) =>
                    buyer
                      ? a.role === "SELLER"
                      : team
                        ? [
                            "WHOLESALER_STAFF",
                            "PLATFORM_ADMIN",
                            "PLATFORM_OPERATIONS",
                          ].includes(a.role)
                        : ["WHOLESALER_OWNER", "WHOLESALER_STAFF"].includes(
                            a.role,
                          ),
                  )
                  .map((account) => (
                    <Button
                      type="button"
                      key={account.phone}
                      size="sm"
                      variant="outline"
                      onClick={() => setPhone(account.phone)}
                    >
                      {labels[account.role]}
                    </Button>
                  ))}
              </div>
            </details>
          )}
        </section>
      </main>
    </div>
  );
}
