import type { Metadata } from "next"

import { AssetDetail } from "@/components/assets/asset-detail"
import { initialAssets } from "@/lib/mock-data/assets"

type AssetPageProps = {
  params: Promise<{ id: string }>
}

export function generateStaticParams() {
  return initialAssets.map((asset) => ({ id: asset.id }))
}

export async function generateMetadata({
  params,
}: AssetPageProps): Promise<Metadata> {
  const { id } = await params
  const asset = initialAssets.find((item) => item.id === id)
  return { title: asset?.name ?? "Asset" }
}

export default async function AssetPage({ params }: AssetPageProps) {
  const { id } = await params
  return <AssetDetail assetId={id} />
}
