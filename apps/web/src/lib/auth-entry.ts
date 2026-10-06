import type { SessionUser } from "@wholesale/shared";
export function buyerDestination(user: SessionUser, next: string | null) {
  if (
    user.role !== "SELLER" ||
    !next ||
    !/^\/seller(?:\/|\?|$)/.test(next) ||
    next.includes("\\") ||
    /%2f|%5c/i.test(next)
  )
    return null;
  const url = new URL(next, "https://wholseler.local");
  if (!/^\/seller(?:\/|$)/.test(url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
