import { MarketplaceDetail } from "@/components/marketplace";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MarketplaceDetail id={id} />;
}
