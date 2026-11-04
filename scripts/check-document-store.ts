/**
 * Self-check of the file document store: concurrency, transactions, indexes.
 * Usage: npx tsx scripts/check-document-store.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileDocumentStore } from "../lib/storage/file-document-store";
import { DuplicateKeyError } from "../lib/storage/errors";

interface Counter {
  id: string;
  value: number;
}

interface Session {
  id: string;
  email?: string;
  userId: string;
  createdAt: string;
  score?: number;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "docstore-check-"));
const store = new FileDocumentStore(root);

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`ok  ${name}`);
}

async function main(): Promise<void> {
  const counters = store.collection<Counter>("counters");
  const sessions = store.collection<Session>("sessions", {
    indexes: [{ fields: ["userId"] }, { fields: ["email"], unique: true }, { fields: ["createdAt"], ttlSeconds: 60 }],
  });

  await check("parallel inc loses nothing", async () => {
    await counters.insert({ id: "hits", value: 0 });
    await Promise.all(Array.from({ length: 200 }, () => counters.update("hits", { inc: { value: 1 } })));
    assert.equal((await counters.get("hits"))?.value, 200);
  });

  await check("parallel read-modify-write transactions lose nothing", async () => {
    await counters.insert({ id: "rmw", value: 0 });
    await Promise.all(
      Array.from({ length: 50 }, () =>
        store.transaction(async (tx) => {
          const c = tx.collection<Counter>("counters");
          const current = (await c.get("rmw"))!.value;
          await new Promise((r) => setTimeout(r, 1));
          await c.upsert({ id: "rmw", value: current + 1 });
        }),
      ),
    );
    assert.equal((await counters.get("rmw"))?.value, 50);
  });

  await check("single writes wait for a transaction holding the collection", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const tx = store.transaction(async (t) => {
      await t.collection<Counter>("counters").update("hits", { set: { value: 1000 } });
      await gate;
      await t.collection<Counter>("counters").update("hits", { inc: { value: 1 } });
    });
    await new Promise((r) => setTimeout(r, 5));
    const outside = counters.update("hits", { inc: { value: 10 } });
    release();
    await Promise.all([tx, outside]);
    assert.equal((await counters.get("hits"))?.value, 1011);
  });

  await check("a throwing transaction rolls back", async () => {
    await assert.rejects(
      store.transaction(async (tx) => {
        await tx.collection<Counter>("counters").update("hits", { set: { value: -1 } });
        await tx.collection<Counter>("counters").insert({ id: "temp", value: 1 });
        await tx.collection<Counter>("counters").delete("rmw");
        throw new Error("boom");
      }),
      /boom/,
    );
    assert.equal((await counters.get("hits"))?.value, 1011);
    assert.equal(await counters.get("temp"), null);
    assert.equal((await counters.get("rmw"))?.value, 50);
  });

  await check("ids and unique indexes are enforced", async () => {
    const now = new Date().toISOString();
    await sessions.insert({ id: "s1", email: "a@x", userId: "u1", createdAt: now, score: 5 });
    await sessions.insert({ id: "s2", userId: "u1", createdAt: now, score: 9 });
    await sessions.insert({ id: "s3", userId: "u2", createdAt: now });
    await assert.rejects(sessions.insert({ id: "s1", userId: "u9", createdAt: now }), DuplicateKeyError);
    await assert.rejects(sessions.insert({ id: "s4", email: "a@x", userId: "u3", createdAt: now }), DuplicateKeyError);
    await assert.rejects(sessions.update("s2", { set: { email: "a@x" } }), DuplicateKeyError);
    await assert.rejects(sessions.insert({ id: "../evil", userId: "u1", createdAt: now }), /Invalid id/);
    assert.equal(await sessions.get("../evil"), null);
  });

  await check("filters, sort, skip, limit", async () => {
    assert.deepEqual((await sessions.find({ userId: "u1" }, { sort: { score: -1 } })).map((s) => s.id), ["s2", "s1"]);
    assert.deepEqual((await sessions.find({ userId: { $in: ["u2"] } })).map((s) => s.id), ["s3"]);
    assert.deepEqual((await sessions.find({ score: { $gte: 6 } })).map((s) => s.id), ["s2"]);
    assert.deepEqual((await sessions.find({ email: { $exists: false } })).map((s) => s.id), ["s2", "s3"]);
    assert.deepEqual((await sessions.find({}, { sort: { id: 1 }, skip: 1, limit: 1 })).map((s) => s.id), ["s2"]);
    assert.equal(await sessions.count({ userId: "u1" }), 2);
    assert.equal((await sessions.findOne({ userId: "u1" }, { sort: { score: 1 } }))?.id, "s1");
  });

  await check("update set/unset/inc and deleteMany", async () => {
    const updated = await sessions.update("s1", { set: { userId: "u2" }, unset: ["email"], inc: { score: 2 } });
    assert.deepEqual({ userId: updated?.userId, email: updated?.email, score: updated?.score }, { userId: "u2", email: undefined, score: 7 });
    assert.equal(await sessions.update("missing", { inc: { score: 1 } }), null);
    assert.equal(await sessions.deleteMany({ userId: "u2" }), 2);
    assert.equal(await sessions.count(), 1);
  });

  await check("expired documents disappear and are purged", async () => {
    const old = new Date(Date.now() - 120_000).toISOString();
    await sessions.upsert({ id: "old", userId: "u1", createdAt: old });
    assert.equal(await sessions.get("old"), null);
    assert.equal(await sessions.count({ userId: "u1" }), 1);
    assert.equal(fs.existsSync(path.join(root, "sessions", "old.json")), false);
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
