import { Subscription } from "@/components/subscription";
import { Gate } from "@/components/common";
export default function Page() { return <Gate roles={["WHOLESALER_OWNER"]}><Subscription/></Gate>; }
