// lib/image-variant-url.ts — client-safe URLs of downscaled image copies

export const IMAGE_VARIANTS = ["thumb", "view"] as const;
export type ImageVariant = (typeof IMAGE_VARIANTS)[number];

const VARIANT_SOURCE = /\.(png|jpe?g|webp)$/i;

export function isImageVariant(value: string | null): value is ImageVariant {
  return IMAGE_VARIANTS.includes(value as ImageVariant);
}

/** True for stored raster images that can be served as a WebP variant. */
export function hasImageVariants(pathOrUrl: string): boolean {
  return VARIANT_SOURCE.test(pathOrUrl);
}

/** URL of a downscaled WebP for stored images; data: and external URLs pass through. */
export function imageVariantUrl(url: string, variant: ImageVariant): string {
  if (!url.startsWith("/api/files/") || !hasImageVariants(url)) return url;
  return `${url}?v=${variant}`;
}
