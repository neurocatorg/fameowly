import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DATA_DIR } from "./paths";
import type { Collection } from "./contracts/document-store";
import { getDocumentStore } from "./storage/db";
import { externalizeAttachments } from "./file-storage";
import { deleteImageVariants } from "./image-variants";

// ─── Types ───────────────────────────────────────────────────────────

export interface ImageHistoryItem {
  id: string;
  prompt: string;
  imageUrl: string | null;
  error?: string;
  modelId: string;
  modelName: string;
  createdAt: string;
  referenceFiles?: Array<{ url: string; name: string; mimeType: string }>;
  aspectRatio?: string;
  resolution?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  }
}

type StoredImageItem = ImageHistoryItem & { userId: string };

function history(): Collection<StoredImageItem> {
  return getDocumentStore().collection<StoredImageItem>("image_history", {
    indexes: [{ fields: ["userId"] }],
  });
}

function toItem(doc: StoredImageItem): ImageHistoryItem {
  const item: Partial<StoredImageItem> = { ...doc };
  delete item.userId;
  return item as ImageHistoryItem;
}

// ─── CRUD Operations ─────────────────────────────────────────────────

/** Get all image generation history for a user (newest first) */
export async function getImageHistory(userId: string): Promise<ImageHistoryItem[]> {
  const items = await history().find({ userId }, { sort: { createdAt: -1 } });
  for (const item of items) {
    // Legacy items inlined reference images, bloating every history fetch to megabytes
    if (externalizeReferenceFiles([item], userId)) await history().upsert(item);
  }
  return items.map(toItem);
}

function externalizeReferenceFiles(items: ImageHistoryItem[], userId: string): boolean {
  return externalizeAttachments(items.map((item) => ({ attachments: item.referenceFiles })), userId);
}

/** Add a new item to the history */
export async function addImageHistoryItem(
  userId: string,
  item: ImageHistoryItem
): Promise<void> {
  externalizeReferenceFiles([item], userId);
  await history().upsert({ ...item, userId });
}

/** Delete an item from history and its image file */
export async function deleteImageHistoryItem(
  userId: string,
  itemId: string
): Promise<boolean> {
  const item = await history().get(itemId);
  if (item?.userId !== userId) return false;

  // Delete the image file if stored on disk
  if (item.imageUrl && item.imageUrl.startsWith("/api/files/")) {
    const relativePath = item.imageUrl.replace("/api/files/", "");
    const filePath = path.join(UPLOADS_DIR, relativePath);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      deleteImageVariants(filePath);
    } catch {
      /* ignore */
    }
  }

  return history().delete(itemId);
}

// ─── Image File Storage ──────────────────────────────────────────────

/** Save a base64-encoded image to disk and return the public URL */
export function saveGeneratedImage(
  base64Data: string,
  mimeType: string
): string {
  const genDir = path.join(UPLOADS_DIR, "generated");
  ensureDir(genDir);

  const ext = mimeType.includes("png")
    ? ".png"
    : mimeType.includes("webp")
      ? ".webp"
      : ".jpg";
  const fileName = `${crypto.randomUUID()}${ext}`;
  const filePath = path.join(genDir, fileName);

  const buffer = Buffer.from(base64Data, "base64");
  fs.writeFileSync(filePath, buffer);

  return `/api/files/generated/${fileName}`;
}
