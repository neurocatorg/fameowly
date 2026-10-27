// lib/image-variants.ts — server-side rendering of downscaled image copies

import fs from "fs";
import sharp from "sharp";
import { IMAGE_VARIANTS, type ImageVariant } from "./image-variant-url";

const MAX_SIDE: Record<ImageVariant, number> = { thumb: 256, view: 2048 };
const QUALITY: Record<ImageVariant, number> = { thumb: 70, view: 85 };

// A decoded 4K PNG is ~40 MB; a cold history list would otherwise decode ~100 at once.
const MAX_CONCURRENT = 2;
let active = 0;
const waiting: Array<() => void> = [];
const inFlight = new Map<string, Promise<string>>();

async function withSlot<T>(job: () => Promise<T>): Promise<T> {
  if (active < MAX_CONCURRENT) active++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await job();
  } finally {
    // Hand the slot straight to the next waiter so no newcomer can overtake it
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

function variantPath(originalPath: string, variant: ImageVariant): string {
  return `${originalPath}.${variant}.webp`;
}

/** Path of the WebP variant, rendered once on first request and then reused from disk. */
export function ensureImageVariant(originalPath: string, variant: ImageVariant): Promise<string> {
  const target = variantPath(originalPath, variant);
  if (fs.existsSync(target)) return Promise.resolve(target);
  const pending = inFlight.get(target);
  if (pending) return pending;

  const job = withSlot(async () => {
    const tmp = `${target}.${process.pid}.tmp`;
    const side = MAX_SIDE[variant];
    try {
      await sharp(originalPath)
        .rotate()
        .resize(side, side, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: QUALITY[variant] })
        .toFile(tmp);
      await fs.promises.rename(tmp, target);
    } catch (err) {
      await fs.promises.rm(tmp, { force: true });
      throw err;
    }
    return target;
  }).finally(() => inFlight.delete(target));

  inFlight.set(target, job);
  return job;
}

export function deleteImageVariants(originalPath: string): void {
  for (const variant of IMAGE_VARIANTS) {
    fs.rmSync(variantPath(originalPath, variant), { force: true });
  }
}
