import { ForbiddenException } from "@nestjs/common";
// Shared by services and guards; no module dependency on authentication.
export function activeBusiness(business: { subscriptionEndsAt: Date }) {
  if (business.subscriptionEndsAt <= new Date())
    throw new ForbiddenException(
      "Your subscription has expired. Renew to add products, stock, staff or new bills. Existing records remain accessible.",
    );
}
export function businessSubscription(business: {
  subscriptionStartsAt: Date;
  subscriptionEndsAt: Date;
  subscriptionTrial: boolean;
}) {
  return {
    status:
      business.subscriptionEndsAt <= new Date()
        ? ("EXPIRED" as const)
        : business.subscriptionTrial
          ? ("TRIAL" as const)
          : ("ACTIVE" as const),
    startsAt: business.subscriptionStartsAt.toISOString(),
    endsAt: business.subscriptionEndsAt.toISOString(),
  };
}
