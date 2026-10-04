export const modules = [
  "Dashboard",
  "Products",
  "Inventory",
  "Billing",
  "Sellers",
  "Reports",
  "Staff",
  "Settings"
] as const;

export const actions = ["View", "Create", "Edit", "Delete"] as const;

export type ModuleName = (typeof modules)[number];
export type PermissionActionName = (typeof actions)[number];

export type StaffPermissionMap = Record<ModuleName, PermissionActionName[]>;

export const cashierPermissions: StaffPermissionMap = {
  Dashboard: ["View"],
  Products: ["View"],
  Inventory: ["View", "Edit"],
  Billing: ["View", "Create", "Edit"],
  Sellers: ["View"],
  Reports: ["View"],
  Staff: [],
  Settings: []
};

export const catalogPermissions: StaffPermissionMap = {
  Dashboard: ["View"],
  Products: ["View", "Create", "Edit"],
  Inventory: ["View", "Create", "Edit"],
  Billing: [],
  Sellers: [],
  Reports: ["View"],
  Staff: [],
  Settings: []
};
