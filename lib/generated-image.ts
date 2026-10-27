// lib/generated-image.ts — persist a model-generated image at the requested resolution

import sharp from "sharp";
import { resizeToTarget } from "./image-resize";
import { saveGeneratedImage } from "./image-store";

export interface StoredGeneratedImage {
  imageUrl: string;
  width: number;
  height: number;
  bytes: number;
  upscaled: boolean;
  resizeMs: number;
}

// Native output may differ slightly from the nominal size (e.g. 5504×3072 for 4K)
const NATIVE_TOLERANCE = 0.9;

/** Save the image, upscaling only when the model ignored `imageSize` (no native 2K/4K support). */
export async function storeGeneratedImage(
  base64: string,
  mimeType: string,
  targetLongestSide: number
): Promise<StoredGeneratedImage> {
  const started = Date.now();
  let buffer: Buffer = Buffer.from(base64, "base64");
  let mime = mimeType;
  let upscaled = false;
  let { width = 0, height = 0 } = await sharp(buffer).metadata().catch(() => ({ width: 0, height: 0 }));

  if (targetLongestSide > 0 && width > 0 && Math.max(width, height) < targetLongestSide * NATIVE_TOLERANCE) {
    try {
      buffer = await resizeToTarget(buffer, targetLongestSide);
      mime = "image/png";
      upscaled = true;
      ({ width = 0, height = 0 } = await sharp(buffer).metadata());
    } catch {
      // Keep the original on resize failure
    }
  }

  const resizeMs = Date.now() - started;
  const imageUrl = saveGeneratedImage(buffer.toString("base64"), mime);
  return { imageUrl, width, height, bytes: buffer.length, upscaled, resizeMs };
}
