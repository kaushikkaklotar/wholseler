import { Platform } from "@/components/platform";
import { Gate } from "@/components/common";
export default function Page() {
  return (
    <Gate roles={["PLATFORM_ADMIN"]}>
      <Platform section="plans" />
    </Gate>
  );
}
