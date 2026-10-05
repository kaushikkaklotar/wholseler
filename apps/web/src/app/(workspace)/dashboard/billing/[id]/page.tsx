import { InvoiceDetail } from "@/components/billing";
import { Gate } from "@/components/common";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Gate permission="BILLING:VIEW">
      <InvoiceDetail id={id} />
    </Gate>
  );
}
