"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Sparkles,
  Smartphone,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BusyButton, Field, FormError, Pill } from "@/components/common";
import { home, useSession } from "@/components/session";
import { errorMessage, send } from "@/lib/api";
import type { Role, SessionUser } from "@wholesale/shared";
type Config = {
  development: boolean;
  accounts: { name: string; phone: string; role: Role }[];
};
const roleLabel: Record<Role, string> = {
  WHOLESALER_OWNER: "Owner",
  WHOLESALER_STAFF: "Staff",
  SELLER: "Seller",
  PLATFORM_ADMIN: "Admin",
  PLATFORM_OPERATIONS: "Operations",
};
export function Login() {
  const router = useRouter(),
    { user, refresh } = useSession();
  const { data: config } = useSWR<Config>("/config");
  const [phone, setPhone] = useState(""),
    [accountType, setAccountType] = useState("WHOLESALER_OWNER"),
    [challenge, setChallenge] = useState<{
      challengeId: string;
      developmentCode?: string;
    } | null>(null),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (user) router.replace(home(user));
  }, [user, router]);
  async function request(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setChallenge(await send("/auth/request", { phone, accountType }));
      setCode("");
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
      router.replace(home(signed));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <div className="mx-auto max-w-[1360px] px-6 py-7 sm:px-10">
        <header className="flex items-center justify-between">
          <Brand />
          <Pill tone="primary">Wholesale, in control</Pill>
        </header>
        <main className="grid min-h-[calc(100vh-160px)] items-center gap-12 py-10 lg:grid-cols-[1.15fr_1fr]">
          <div className="max-w-[620px]">
            <div className="mb-7 flex items-center gap-2 text-xs font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              BUILT FOR THE WHOLESALE COUNTER
            </div>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-[-1.8px] sm:text-[58px]">
              Your business.
              <br />
              One connected
              <br />
              <span className="text-primary">workspace.</span>
            </h1>
            <p className="mt-7 max-w-[430px] text-[15px] leading-7 text-muted-foreground">
              From your first catalog entry to the last bill of the day. Keep
              products, stock, buyers and your team moving together.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["Catalog & stock", "Every variant, accounted for."],
                ["Counter billing", "Bill fast. Stock stays in sync."],
                ["Seller sourcing", "Connect directly with buyers."],
              ].map(([title, text]) => (
                <div key={title}>
                  <Check className="mb-2 size-4 text-primary" />
                  <h2 className="text-xs font-semibold">{title}</h2>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    {text}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-12 flex items-center gap-3 border-t pt-6 text-xs text-muted-foreground">
              <ShieldCheck className="size-5 text-primary" />
              Separate workspaces. The right access for every role.
            </div>
          </div>
          <div className="mx-auto w-full max-w-[430px]">
            <div className="panel p-7 sm:p-9">
              <div className="mb-6 flex size-11 items-center justify-center rounded-xl bg-violet-50 text-primary">
                <Smartphone className="size-5" />
              </div>
              <h2 className="text-[23px] font-semibold tracking-tight">
                {challenge ? "Verify your mobile" : "Welcome to Wholseler"}
              </h2>
              <p className="mb-6 mt-2 text-xs leading-5 text-muted-foreground">
                {challenge
                  ? `Enter the 6 digit code for +91 ${phone}. It expires in five minutes.`
                  : "Sign in with your mobile number. New members can create a business or seller profile."}
              </p>
              <form
                onSubmit={challenge ? verify : request}
                className="space-y-5"
              >
                {!challenge ? (
                  <>
                    <div className="flex rounded-lg bg-muted p-1">
                      {[
                        ["WHOLESALER_OWNER", "Wholesaler"],
                        ["SELLER", "Seller"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setAccountType(value)}
                          className={`flex-1 rounded-md px-3 py-2 text-xs font-medium ${accountType === value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <Field label="Mobile number" required>
                      <div className="flex h-11 rounded-lg border bg-white focus-within:border-primary">
                        <span className="flex items-center border-r px-3 text-sm text-muted-foreground">
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
                          placeholder="Enter your 10 digit number"
                          className="w-full rounded-r-lg bg-transparent px-3 text-sm outline-none"
                        />
                      </div>
                    </Field>
                  </>
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
                        onChange={(e) =>
                          setCode(e.target.value.replace(/\D/g, ""))
                        }
                        className="h-12 text-center font-mono text-xl tracking-[.4em]"
                        autoFocus
                        required
                      />
                    </Field>
                    {challenge.developmentCode && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        <p className="font-medium">
                          Local review code: {challenge.developmentCode}
                        </p>
                        <p className="mt-1 leading-5">
                          SMS is disabled in this local workspace.
                        </p>
                        <Button
                          type="button"
                          variant="link"
                          className="h-6 px-0 text-amber-800"
                          onClick={() => setCode(challenge.developmentCode!)}
                        >
                          Use this code
                        </Button>
                      </div>
                    )}
                  </>
                )}
                <FormError message={error} />
                <BusyButton busy={busy} className="h-11 w-full">
                  {challenge ? "Verify & continue" : "Get verification code"}
                  <ArrowRight />
                </BusyButton>
                {challenge && (
                  <button
                    type="button"
                    onClick={() => {
                      setChallenge(null);
                      setCode("");
                      setError("");
                    }}
                    className="w-full text-xs text-muted-foreground hover:text-primary"
                  >
                    Change mobile number
                  </button>
                )}
              </form>
              <p className="mt-5 text-center text-[10px] leading-5 text-muted-foreground">
                Staff and platform members use their registered mobile number.
              </p>
            </div>
            {config?.development &&
              config.accounts.length > 0 &&
              !challenge && (
                <div className="mt-5 rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-4">
                  <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-violet-700">
                    <Sparkles className="size-3.5" />
                    Sample accounts for local review
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {config.accounts
                      .filter(
                        (account, index, all) =>
                          all.findIndex((a) => a.role === account.role) ===
                          index,
                      )
                      .sort(
                        (a, b) =>
                          [
                            "WHOLESALER_OWNER",
                            "WHOLESALER_STAFF",
                            "SELLER",
                            "PLATFORM_ADMIN",
                            "PLATFORM_OPERATIONS",
                          ].indexOf(a.role) -
                          [
                            "WHOLESALER_OWNER",
                            "WHOLESALER_STAFF",
                            "SELLER",
                            "PLATFORM_ADMIN",
                            "PLATFORM_OPERATIONS",
                          ].indexOf(b.role),
                      )
                      .map((account) => (
                        <Button
                          type="button"
                          key={account.phone}
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPhone(account.phone);
                            setAccountType(
                              account.role === "SELLER"
                                ? "SELLER"
                                : "WHOLESALER_OWNER",
                            );
                          }}
                        >
                          {roleLabel[account.role]}
                        </Button>
                      ))}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Choose an account, then request its local OTP.
                  </p>
                </div>
              )}
          </div>
        </main>
        <footer className="flex flex-wrap justify-between gap-2 border-t pt-5 text-[11px] text-muted-foreground">
          <span>Wholseler · Catalog. Stock. Billing. Connected.</span>
          <span>Built around the wholesale market.</span>
        </footer>
      </div>
    </div>
  );
}
