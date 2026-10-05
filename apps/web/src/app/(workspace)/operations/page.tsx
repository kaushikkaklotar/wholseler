import { Platform } from "@/components/platform";
import { Gate } from "@/components/common";
export default function Page() {
  return (
    <Gate roles={["PLATFORM_OPERATIONS"]}>
      <Platform section="overview" />
    </Gate>
  );
}
