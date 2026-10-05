import { Discover } from "@/components/seller";
import { Gate } from "@/components/common";
export default function Page() {
  return (
    <Gate roles={["SELLER"]}>
      <Discover />
    </Gate>
  );
}
