export type SessionUser = {
  id: string;
  role: "WHOLESALER_OWNER" | "WHOLESALER_STAFF" | "PLATFORM_ADMIN";
};

export async function requireOwnerSession(): Promise<SessionUser> {
  // Replace this with the selected auth provider before production.
  return {
    id: "demo-owner",
    role: "WHOLESALER_OWNER"
  };
}
