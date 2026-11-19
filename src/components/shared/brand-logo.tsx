import Image from "next/image"
import { cn } from "@/lib/utils"

/** Original supplied artwork. The compact viewport reveals its cloud mark. */
export function BrandLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  if (compact) return <span className={cn("block h-8 w-[42px] shrink-0 overflow-hidden",className)}><Image src="/branding/roaya-logo.png" alt="Roaya" width={1348} height={371} className="h-8 w-auto max-w-none" unoptimized /></span>
  return <Image src="/branding/roaya-logo.png" alt="Roaya" width={1348} height={371} className={cn("h-auto w-36 shrink-0 object-contain",className)} unoptimized />
}
