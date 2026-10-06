import { BuyerProfile } from "@/components/buyer-profile";
import { Gate } from "@/components/common";
export default function Page(){return <Gate roles={["SELLER"]}><BuyerProfile/></Gate>;}
