import sharp from "sharp"

export const employeePhotoMaxBytes = 2 * 1024 * 1024
export async function normalizeEmployeePhoto(file: File): Promise<Buffer> {
  if (!file.size || file.size > employeePhotoMaxBytes || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG or WebP image up to 2 MB.")
  const bytes = Buffer.from(await file.arrayBuffer())
  const image = sharp(bytes, { limitInputPixels: 25_000_000, failOn: "warning" })
  const metadata = await image.metadata()
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format) || (metadata.pages ?? 1) > 1) throw new Error("Choose a still JPG, PNG or WebP image.")
  // Re-encoding strips metadata and prevents storing the original untrusted file.
  return image.rotate().resize(512, 512, { fit: "cover" }).webp({ quality: 82 }).toBuffer()
}
