import { Settings } from "@/components/settings";
import { Gate } from "@/components/common";
export default function Page() {
  return (
    <Gate permission="SETTINGS:VIEW">
      <Settings />
    </Gate>
  );
}
