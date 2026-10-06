import { Onboarding } from "@/components/onboarding";
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
