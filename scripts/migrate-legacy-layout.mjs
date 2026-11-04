/**
 * One-shot move of the legacy data layout into document collections:
 *
 *   users.json                     → db/users/<id>.json
 *   chats/<userId>/<chatId>.json   → db/chats/<chatId>.json        (+ userId)
 *   images/<userId>/history.json   → db/image_history/<id>.json    (+ userId)
 *   models.json, providers.json,
 *   rotation-state.json            → db/settings/{models,providers,rotation-state}.json
 *
 * Idempotent: existing documents are never overwritten, legacy files are never
 * deleted. Inline `data:` attachments are moved to uploads/<userId>/ on the way.
 *
 * Usage: DATA_DIR=./data node scripts/migrate-legacy-layout.mjs [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DRY_RUN = process.argv.includes("--dry-run");
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const DB_DIR = path.join(DATA_DIR, "db");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

// Same rules as lib/storage/file-io.ts
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const isSafeId = (id) => typeof id === "string" && SAFE_ID.test(id) && !id.includes("..");

// Same map and naming as lib/file-storage.ts, so files land where the app would put them
const EXT_BY_MIME = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "application/json": ".json",
  "text/csv": ".csv",
};

const stats = {};
function count(collection, key) {
  stats[collection] ??= { migrated: 0, existing: 0, collisions: 0, invalid: 0, externalized: 0 };
  stats[collection][key] += 1;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return undefined;
    console.error(`  ! cannot read ${path.relative(DATA_DIR, file)}: ${err.message}`);
    return undefined;
  }
}

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o755 });
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, content, { mode: 0o644 });
  fs.renameSync(tmp, file);
}

function externalize(collection, attachments, userId) {
  for (const att of attachments ?? []) {
    const match = typeof att?.url === "string" && att.url.match(/^data:(.*?);base64,([\s\S]*)$/);
    if (!match) continue;
    const [, mimeType, b64] = match;
    const buffer = Buffer.from(b64, "base64");
    const name = `${crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 32)}${EXT_BY_MIME[mimeType] ?? ".bin"}`;
    const file = path.join(UPLOADS_DIR, userId, name);
    if (!DRY_RUN && !fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o755 });
      fs.writeFileSync(file, buffer);
    }
    att.url = `/api/files/${userId}/${name}`;
    count(collection, "externalized");
  }
}

/** Writes the document unless it exists; a different owner of the same id is a collision */
function put(collection, doc, source) {
  if (!isSafeId(doc?.id)) {
    console.error(`  ! ${collection}: unsafe or missing id ${JSON.stringify(doc?.id)} in ${source}`);
    return count(collection, "invalid");
  }
  const file = path.join(DB_DIR, collection, `${doc.id}.json`);
  const existing = readJson(file);
  if (existing !== undefined) {
    if (doc.userId !== undefined && existing.userId !== doc.userId) {
      console.error(`  ! ${collection}/${doc.id}: already owned by user ${existing.userId}, skipped ${source}`);
      return count(collection, "collisions");
    }
    return count(collection, "existing");
  }
  if (!DRY_RUN) writeAtomic(file, JSON.stringify(doc, null, 2));
  count(collection, "migrated");
}

function subdirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

function migrateUsers() {
  const users = readJson(path.join(DATA_DIR, "users.json"));
  for (const user of Array.isArray(users) ? users : []) put("users", user, "users.json");
}

function migrateChats() {
  const root = path.join(DATA_DIR, "chats");
  for (const userId of subdirs(root)) {
    const files = fs.readdirSync(path.join(root, userId)).filter((f) => f.endsWith(".json"));
    for (const name of files) {
      const source = `chats/${userId}/${name}`;
      const chat = readJson(path.join(root, userId, name));
      if (!chat || !Array.isArray(chat.messages)) {
        console.error(`  ! chats: not a chat file ${source}`);
        count("chats", "invalid");
        continue;
      }
      chat.lastMessageAt ??= chat.updatedAt;
      for (const message of chat.messages) externalize("chats", message.attachments, userId);
      put("chats", { ...chat, userId }, source);
    }
  }
}

function migrateImageHistory() {
  const root = path.join(DATA_DIR, "images");
  for (const userId of subdirs(root)) {
    const history = readJson(path.join(root, userId, "history.json"));
    for (const item of Array.isArray(history) ? history : []) {
      externalize("image_history", item.referenceFiles, userId);
      put("image_history", { ...item, userId }, `images/${userId}/history.json`);
    }
  }
}

function migrateSettings() {
  const models = readJson(path.join(DATA_DIR, "models.json"));
  if (models) put("settings", { id: "models", chatModels: models.chatModels ?? [], imageModels: models.imageModels ?? [] }, "models.json");

  const providers = readJson(path.join(DATA_DIR, "providers.json"));
  if (Array.isArray(providers)) put("settings", { id: "providers", providers }, "providers.json");

  const rotation = readJson(path.join(DATA_DIR, "rotation-state.json"));
  if (rotation) put("settings", { id: "rotation-state", counters: rotation.counters ?? {}, currentIndex: rotation.currentIndex ?? {} }, "rotation-state.json");
}

console.log(`[migrate] ${DRY_RUN ? "DRY RUN, nothing is written" : "writing"}: ${DATA_DIR} → ${DB_DIR}`);
migrateUsers();
migrateChats();
migrateImageHistory();
migrateSettings();
console.table(stats);

const problems = Object.values(stats).reduce((sum, s) => sum + s.collisions + s.invalid, 0);
if (problems > 0) {
  console.error(`[migrate] ${problems} document(s) need attention, see the messages above.`);
  process.exitCode = 1;
}
