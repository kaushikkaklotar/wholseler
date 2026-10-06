import { Suspense } from "react";
import { MarketplaceBrowse } from "@/components/marketplace";
export default function Page() {
  return (
    <Suspense>
      <MarketplaceBrowse />
    </Suspense>
  );
}
