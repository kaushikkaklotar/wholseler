import { Buyers } from "@/components/buyers";
import { Gate } from "@/components/common";
export default function Page() {
  return (
    <Gate permission="SELLERS:VIEW">
      <Buyers />
    </Gate>
  );
}
