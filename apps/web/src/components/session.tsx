"use client";
import { createContext, useContext } from "react";
import useSWR, { SWRConfig } from "swr";
import type { Permission, SessionUser } from "@wholesale/shared";
import { api, ApiError } from "@/lib/api";
import { Toaster } from "sonner";
type SessionContextValue = {
  user?: SessionUser;
  loading: boolean;
  error?: ApiError;
  refresh: () => Promise<SessionUser | undefined>;
  can: (permission: Permission) => boolean;
};
const SessionContext = createContext<SessionContextValue>({
  loading: true,
  refresh: async () => undefined,
  can: () => false,
});
function SessionState({ children }: { children: React.ReactNode }) {
  const { data, error, isLoading, mutate } = useSWR<SessionUser, ApiError>(
    "/auth/me",
    api,
    { shouldRetryOnError: false, revalidateOnFocus: true },
  );
  const user = error?.status === 401 ? undefined : data;
  return (
    <SessionContext.Provider
      value={{
        user,
        loading: isLoading,
        error,
        refresh: () => mutate(),
        can: (p) => user?.permissions.includes(p) ?? false,
      }}
    >
      <SWRConfig key={user?.id ?? "public"} value={{ provider: () => new Map() }}>
        {children}
      </SWRConfig>
    </SessionContext.Provider>
  );
}
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{ fetcher: api, revalidateOnFocus: false, errorRetryCount: 1 }}
    >
      <SessionState>{children}</SessionState>
      <Toaster richColors position="bottom-right" closeButton />
    </SWRConfig>
  );
}
export const useSession = () => useContext(SessionContext);
export function home(user: SessionUser) {
  if (user.onboardingRequired) return "/onboarding";
  if (user.role === "PLATFORM_ADMIN") return "/admin";
  if (user.role === "PLATFORM_OPERATIONS") return "/operations";
  if (user.role === "SELLER") return "/seller";
  if (user.role === "WHOLESALER_STAFF") {
    if (user.permissions.includes("BILLING:CREATE"))
      return "/dashboard/billing";
    if (user.permissions.includes("DASHBOARD:VIEW")) return "/dashboard";
    const workspaceModule = user.permissions
      .find((p) => p.endsWith(":VIEW"))
      ?.split(":")[0];
    return workspaceModule
      ? `/dashboard/${({ PRODUCTS: "products", INVENTORY: "inventory", SELLERS: "buyers", REPORTS: "reports", STAFF: "team", SETTINGS: "settings", BILLING: "billing" } as Record<string, string>)[workspaceModule] || ""}`
      : "/account";
  }
  return "/dashboard";
}
