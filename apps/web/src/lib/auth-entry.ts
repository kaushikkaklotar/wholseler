import type { SessionUser } from "@wholesale/shared";
export function buyerDestination(user: SessionUser, next: string | null) {
  if (
    user.role !== "SELLER" ||
    !next ||
    !/^\/seller(?:\/|\?|$)/.test(next) ||
    next.includes("\\")
  )
    return null;
  return next;
}
