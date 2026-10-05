import { Inventory } from "@/components/inventory";
import { Gate } from "@/components/common";
export default function Page() {
  return (
    <Gate permission="INVENTORY:VIEW">
      <Inventory />
    </Gate>
  );
}
