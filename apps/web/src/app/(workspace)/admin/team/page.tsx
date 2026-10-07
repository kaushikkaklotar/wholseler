import { PlatformTeam } from "@/components/platform-team";
import { Gate } from "@/components/common";
export default function Page() {
  return <Gate roles={["PLATFORM_ADMIN"]}><PlatformTeam /></Gate>;
}
