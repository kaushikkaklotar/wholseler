import { Catalog } from "@/components/catalog";
import { Gate } from "@/components/common";
export default function Page() {
  return (
    <Gate permission="PRODUCTS:VIEW">
      <Catalog />
    </Gate>
  );
}
