import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { MIME_TYPES } from "@/lib/file-storage";
import { DATA_DIR } from "@/lib/paths";
import { hasImageVariants, isImageVariant } from "@/lib/image-variant-url";
import { ensureImageVariant } from "@/lib/image-variants";
import fs from "fs";
import path from "path";

const COOKIE_NAME = "session";

const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Auth check
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { path: segments } = await params;
  const relativePath = segments.join("/");

  // Ownership check for per-user files (new format: /api/files/{userId}/{filename})
  // Allow generated images for all authenticated users
  // Legacy flat files (single segment) are accessible to all authenticated users
  if (segments.length >= 2 && !relativePath.startsWith("generated/")) {
    const [fileUserId] = segments;
    if (fileUserId !== session.userId) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }
  }

  // Security: prevent directory traversal
  const resolved = path.resolve(UPLOADS_DIR, relativePath);
  if (!resolved.startsWith(UPLOADS_DIR)) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }

  let filePath = resolved;
  const variant = request.nextUrl.searchParams.get("v");
  if (isImageVariant(variant) && hasImageVariants(resolved)) {
    try {
      filePath = await ensureImageVariant(resolved, variant);
    } catch (err) {
      console.error("[files] variant failed, serving original:", relativePath, err);
    }
  }

  // Stored names are UUIDs or content hashes, so a URL never changes its bytes
  const stat = fs.statSync(filePath);
  const cacheHeaders = {
    ETag: `W/"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`,
    "Cache-Control": "private, max-age=31536000, immutable",
  };
  if (request.headers.get("if-none-match") === cacheHeaders.ETag) {
    return new NextResponse(null, { status: 304, headers: cacheHeaders });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      ...cacheHeaders,
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
    },
  });
}
