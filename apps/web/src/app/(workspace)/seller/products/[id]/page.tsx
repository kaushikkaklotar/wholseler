import { SellerProductDetail } from "@/components/seller";
import { Gate } from "@/components/common";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Gate roles={["SELLER"]}>
      <SellerProductDetail id={id} />
    </Gate>
  );
}
