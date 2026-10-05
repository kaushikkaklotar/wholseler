import { Dashboard } from "@/components/dashboard";
import { Gate } from "@/components/common";
export default function Page() {
  return (
    <Gate permission="DASHBOARD:VIEW">
      <Dashboard />
    </Gate>
  );
}
