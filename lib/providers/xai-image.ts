// lib/providers/xai-image.ts — Grok Imagine generation and editing via the xAI Images API

import sharp from "sharp";
import { generateImage } from "ai";
import { createXai } from "@ai-sdk/xai";
import { proxyFetch } from "../proxy-fetch";
import { resolveFileUrl } from "../file-storage";
import type { ResolvedCredentials } from "../types";

/** `/v1/images/edits` takes up to five source images */
const MAX_REFERENCES = 5;
const ACCEPTED_MIME = new Set(["image/jpeg", "image/png"]);

export interface XaiImageRequest {
  credentials: ResolvedCredentials;
  modelId: string;
  prompt: string;
  referenceUrls: string[];
  aspectRatio?: string;
  /** "1K" | "2K" | "4K"; xAI renders at most 2k, larger sizes are upscaled by the caller */
  resolution?: string;
}

export interface XaiImageResult {
  base64: string;
  mimeType: string;
  revisedPrompt?: string;
}

/** A failure whose message is fit to show to the user */
export class XaiImageInputError extends Error {}

async function toDataUri(url: string): Promise<string> {
  const ref = resolveFileUrl(url);
  if (!ref || !ref.mimeType.startsWith("image/")) {
    throw new XaiImageInputError("Grok Imagine принимает в качестве образцов только изображения");
  }
  if (ACCEPTED_MIME.has(ref.mimeType)) return `data:${ref.mimeType};base64,${ref.data}`;
  const png = await sharp(Buffer.from(ref.data, "base64")).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

export async function generateXaiImage(request: XaiImageRequest): Promise<XaiImageResult> {
  if (!request.credentials.apiKey) throw new Error("xAI API key not configured");
  if (request.referenceUrls.length > MAX_REFERENCES) {
    throw new XaiImageInputError(`Grok Imagine принимает не больше ${MAX_REFERENCES} образцов`);
  }
  const images = await Promise.all(request.referenceUrls.map(toDataUri));
  const xai = createXai({
    apiKey: request.credentials.apiKey,
    baseURL: request.credentials.baseURL,
    fetch: proxyFetch,
  });
  const { image, providerMetadata } = await generateImage({
    model: xai.image(request.modelId),
    prompt: images.length > 0 ? { text: request.prompt, images } : request.prompt,
    ...(request.aspectRatio ? { aspectRatio: request.aspectRatio as `${number}:${number}` } : {}),
    providerOptions: { xai: { resolution: !request.resolution || request.resolution === "1K" ? "1k" : "2k" } },
  });
  const revised = (providerMetadata?.xai as { images?: Array<{ revisedPrompt?: string }> } | undefined)
    ?.images?.[0]?.revisedPrompt;
  return { base64: image.base64, mimeType: image.mediaType, revisedPrompt: revised };
}
