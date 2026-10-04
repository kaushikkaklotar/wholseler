export type SubscriptionPlan = {
  name: string;
  staffLimit: number;
  productLimit: number;
  invoiceLimit: number;
  monthlyPrice: number;
};

export const currentPlan: SubscriptionPlan = {
  name: "Growth",
  staffLimit: 10,
  productLimit: 2500,
  invoiceLimit: 3000,
  monthlyPrice: 2499
};

export function getStaffLimitState(activeStaff: number, plan: SubscriptionPlan) {
  const percentage = Math.min(100, Math.round((activeStaff / plan.staffLimit) * 100));
  const remaining = Math.max(0, plan.staffLimit - activeStaff);

  return {
    percentage,
    remaining,
    isAtLimit: activeStaff >= plan.staffLimit
  };
}
