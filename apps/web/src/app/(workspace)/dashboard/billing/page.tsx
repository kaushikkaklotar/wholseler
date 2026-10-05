import { Billing } from "@/components/billing";
import { Gate } from "@/components/common";
export default function Page() {
  return (
    <Gate permission="BILLING:VIEW">
      <Billing />
    </Gate>
  );
}
