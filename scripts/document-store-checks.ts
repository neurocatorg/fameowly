/**
 * Backend-neutral checks of the DocumentStore contract: concurrency,
 * transactions, ids, indexes, the query language and TTL visibility.
 * Runners: scripts/check-document-store.ts (files) and any plugin backend.
 */

import assert from "node:assert/strict";
import type { CollectionOptions, DocumentStore } from "../lib/contracts/document-store";
import { DuplicateKeyError } from "../lib/storage/errors";

export interface Counter {
  id: string;
  value: number;
}

export interface Session {
  id: string;
  email?: string | null;
  userId: string;
  createdAt: string;
  score?: number;
}

export const SESSION_OPTIONS: CollectionOptions<Session> = {
  indexes: [{ fields: ["userId"] }, { fields: ["email"], unique: true }, { fields: ["createdAt"], ttlSeconds: 60 }],
};

export async function check(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`ok  ${name}`);
}

export async function runDocumentStoreChecks(store: DocumentStore): Promise<void> {
  const counters = store.collection<Counter>("counters");
  const sessions = store.collection<Session>("sessions", SESSION_OPTIONS);

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

  await check("parallel update-or-insert transactions lose nothing", async () => {
    await Promise.all(
      Array.from({ length: 50 }, () =>
        store.transaction(async (tx) => {
          const c = tx.collection<Counter>("counters");
          if (!(await c.update("fresh", { inc: { value: 1 } }))) await c.insert({ id: "fresh", value: 1 });
        }),
      ),
    );
    assert.equal((await counters.get("fresh"))?.value, 50);
  });

  await check("single writes wait for a transaction holding the document", async () => {
    let release!: () => void;
    let written!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const firstWrite = new Promise<void>((r) => (written = r));
    const tx = store.transaction(async (t) => {
      await t.collection<Counter>("counters").update("hits", { set: { value: 1000 } });
      written();
      await gate;
      await t.collection<Counter>("counters").update("hits", { inc: { value: 1 } });
    });
    await firstWrite;
    const outside = counters.update("hits", { inc: { value: 10 } });
    await new Promise((r) => setTimeout(r, 20));
    release();
    await Promise.all([tx, outside]);
    assert.equal((await counters.get("hits"))?.value, 1011);
  });

  await check("nested transactions join the outer one", async () => {
    await assert.rejects(
      store.transaction(async () => {
        await store.transaction(async (inner) => {
          await inner.collection<Counter>("counters").insert({ id: "nested", value: 1 });
        });
        throw new Error("outer");
      }),
      /outer/,
    );
    assert.equal(await counters.get("nested"), null);
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
    await sessions.insert({ id: "n1", email: null, userId: "u5", createdAt: now });
    await sessions.insert({ id: "n2", email: null, userId: "u5", createdAt: now });
    await assert.rejects(sessions.insert({ id: "s1", userId: "u9", createdAt: now }), DuplicateKeyError);
    await assert.rejects(sessions.insert({ id: "s4", email: "a@x", userId: "u3", createdAt: now }), DuplicateKeyError);
    await assert.rejects(sessions.update("s2", { set: { email: "a@x" } }), DuplicateKeyError);
    await assert.rejects(sessions.insert({ id: "../evil", userId: "u1", createdAt: now }), /Invalid id/);
    await assert.rejects(sessions.upsert({ id: "a..b", userId: "u1", createdAt: now }), /Invalid id/);
    assert.equal(await sessions.get("../evil"), null);
    assert.equal(await sessions.update("../evil", { set: { score: 1 } }), null);
    assert.equal(await sessions.delete("../evil"), false);
    assert.equal(await sessions.deleteMany({ userId: "u5" }), 2);
  });

  await check("filters, sort, skip, limit", async () => {
    assert.deepEqual((await sessions.find({ userId: "u1" }, { sort: { score: -1 } })).map((s) => s.id), ["s2", "s1"]);
    assert.deepEqual((await sessions.find({ userId: { $in: ["u2"] } })).map((s) => s.id), ["s3"]);
    assert.deepEqual((await sessions.find({ score: { $gte: 6 } })).map((s) => s.id), ["s2"]);
    assert.deepEqual((await sessions.find({ score: { $gte: 6, $lt: undefined } })).map((s) => s.id), ["s2"]);
    assert.deepEqual((await sessions.find({ email: { $exists: false } })).map((s) => s.id), ["s2", "s3"]);
    assert.deepEqual((await sessions.find({ email: null })).map((s) => s.id), ["s2", "s3"]);
    assert.deepEqual((await sessions.find({ id: { $gt: "s1" } })).map((s) => s.id), ["s2", "s3"]);
    assert.deepEqual((await sessions.find({}, { sort: { id: 1 }, skip: 1, limit: 1 })).map((s) => s.id), ["s2"]);
    assert.deepEqual((await sessions.find({}, { sort: { score: 1 } })).map((s) => s.id), ["s3", "s1", "s2"]);
    assert.equal(await sessions.count({ userId: "u1" }), 2);
    assert.equal((await sessions.findOne({ userId: "u1" }, { sort: { score: 1 } }))?.id, "s1");
    await assert.rejects(sessions.find({ score: { $ne: 1 } as never }), /Unsupported filter operator/);
  });

  await check("update set/unset/inc and deleteMany", async () => {
    const updated = await sessions.update("s1", { set: { userId: "u2" }, unset: ["email"], inc: { score: 2 } });
    assert.deepEqual({ userId: updated?.userId, email: updated?.email, score: updated?.score }, { userId: "u2", email: undefined, score: 7 });
    assert.equal((await sessions.update("s3", { inc: { score: 4 } }))?.score, 4);
    assert.equal(await sessions.update("missing", { inc: { score: 1 } }), null);
    assert.equal((await sessions.update("s2", {}))?.id, "s2");
    assert.equal(await sessions.deleteMany({ userId: "u2" }), 2);
    assert.equal(await sessions.count(), 1);
  });

  await check("expired documents are never returned", async () => {
    const old = new Date(Date.now() - 120_000).toISOString();
    await sessions.upsert({ id: "old", userId: "u1", createdAt: old });
    assert.equal(await sessions.get("old"), null);
    assert.equal(await sessions.count({ userId: "u1" }), 1);
    assert.deepEqual((await sessions.find()).map((s) => s.id), ["s2"]);
    assert.equal(await sessions.update("old", { set: { score: 1 } }), null);
    await sessions.insert({ id: "old", userId: "u1", createdAt: new Date().toISOString() });
    assert.equal((await sessions.get("old"))?.userId, "u1");
  });
}
