/**
 * Self-check of the file document store: the shared contract checks
 * plus what only files can do (lazy purge on disk, hand edits).
 * Usage: npx tsx scripts/check-document-store.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileDocumentStore } from "../lib/storage/file-document-store";
import { check, runDocumentStoreChecks, SESSION_OPTIONS, type Session } from "./document-store-checks";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "docstore-check-"));
const store = new FileDocumentStore(root);

async function main(): Promise<void> {
  await runDocumentStoreChecks(store);
  const sessions = store.collection<Session>("sessions", SESSION_OPTIONS);

  await check("expired documents are purged from disk", async () => {
    await sessions.upsert({ id: "gone", userId: "u1", createdAt: new Date(Date.now() - 120_000).toISOString() });
    assert.equal(await sessions.get("gone"), null);
    assert.equal(fs.existsSync(path.join(root, "sessions", "gone.json")), false);
  });

  await check("hand edits are picked up by index lookups", async () => {
    const file = path.join(root, "sessions", "s2.json");
    const doc = JSON.parse(fs.readFileSync(file, "utf-8"));
    fs.writeFileSync(file, JSON.stringify({ ...doc, userId: "u7" }));
    fs.utimesSync(file, new Date(), new Date(Date.now() + 5_000));
    assert.deepEqual((await sessions.find({ userId: "u7" })).map((s) => s.id), ["s2"]);
  });
}

main()
  .then(() => console.log("all checks passed"))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => fs.rmSync(root, { recursive: true, force: true }));
