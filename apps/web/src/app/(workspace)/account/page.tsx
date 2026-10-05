"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/common";
import { useSession } from "@/components/session";
export default function Page() {
  const { user, can } = useSession();
  return (
    <>
      <PageHeader
        title="Your account"
        description="Account access is managed by your business owner or platform team."
      />
      <Panel>
        <div className="space-y-4 p-6">
          <p className="text-lg font-semibold">{user?.name}</p>
          <p className="text-sm text-muted-foreground">+91 {user?.phone}</p>
          <p className="text-xs text-muted-foreground">
            {user?.businessName ||
              user?.role.toLowerCase().replaceAll("_", " ")}
          </p>
          {user?.role === "WHOLESALER_STAFF" && !user.permissions.length && (
            <p className="text-xs text-amber-700">
              No module access has been assigned. Ask your owner to update your
              permissions.
            </p>
          )}
          {can("SETTINGS:VIEW") && (
            <Button asChild variant="outline">
              <Link href="/dashboard/settings">Business profile</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link href="/support">Contact support</Link>
          </Button>
        </div>
      </Panel>
    </>
  );
}
