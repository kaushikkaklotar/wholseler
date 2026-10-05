import { Reports } from "@/components/reports";
import { Gate } from "@/components/common";
export default function Page() {
  return (
    <Gate permission="REPORTS:VIEW">
      <Reports />
    </Gate>
  );
}
