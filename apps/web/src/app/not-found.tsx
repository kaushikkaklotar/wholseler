import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-xs text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">
        This workspace page was not found.
      </h1>
      <Button asChild variant="outline">
        <Link href="/">Open BulkSaathi</Link>
      </Button>
    </main>
  );
}
