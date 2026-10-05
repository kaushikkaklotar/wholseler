import { NewBill } from "@/components/billing";
import { Gate } from "@/components/common";
export default function Page() {
  return (
    <Gate permission="BILLING:CREATE">
      <NewBill />
    </Gate>
  );
}
