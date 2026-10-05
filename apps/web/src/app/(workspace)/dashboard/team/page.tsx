import { Team } from "@/components/team";
import { Gate } from "@/components/common";
export default function Page() {
  return (
    <Gate permission="STAFF:VIEW">
      <Team />
    </Gate>
  );
}
