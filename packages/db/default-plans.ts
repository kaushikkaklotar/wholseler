// Commercial defaults shared by demo and production provisioning. Existing plans
// are preserved: prices and caps may already have been edited by an administrator.
export const defaultPlans = [
  {
    id: "plan-starter",
    name: "Starter",
    monthlyPricePaise: 99900,
    yearlyPricePaise: 999900,
    productLimit: 500,
    staffLimit: 3,
    bulkImport: false,
    advancedReports: false,
  },
  {
    id: "plan-growth",
    name: "Growth",
    monthlyPricePaise: 199900,
    yearlyPricePaise: 1999900,
    productLimit: 3000,
    staffLimit: 8,
    bulkImport: true,
    advancedReports: true,
  },
  {
    id: "plan-pro",
    name: "Pro",
    monthlyPricePaise: 349900,
    yearlyPricePaise: 3499900,
    productLimit: 10000,
    staffLimit: 20,
    bulkImport: true,
    advancedReports: true,
  },
];
