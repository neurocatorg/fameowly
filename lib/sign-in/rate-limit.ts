/**
 * Fixed-window counters and cooldowns for sign-in, shared by every server
 * process through the document store.
 */

import { getDocumentStore } from "../storage/db";
import { hashKey } from "./email";

interface LimitDoc {
  id: string;
  count: number;
  /** The document disappears at this moment */
  expiresAt: string;
}

function limits() {
  return getDocumentStore().collection<LimitDoc>("auth_limits", {
    indexes: [{ fields: ["expiresAt"], ttlSeconds: 0 }],
  });
}

function windowDoc(scope: string, key: string, windowSeconds: number) {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  return {
    id: `${scope}-${hashKey(key)}-${window}`,
    expiresAt: new Date((window + 1) * windowSeconds * 1000).toISOString(),
  };
}

/** Seconds left on an active cooldown, or 0 after starting a new one */
export async function claimCooldown(scope: string, key: string, seconds: number): Promise<number> {
  const id = `${scope}-${hashKey(key)}`;
  return getDocumentStore().transaction(async () => {
    const col = limits();
    const active = await col.get(id);
    if (active) return Math.max(1, Math.ceil((Date.parse(active.expiresAt) - Date.now()) / 1000));
    await col.upsert({ id, count: 1, expiresAt: new Date(Date.now() + seconds * 1000).toISOString() });
    return 0;
  });
}

export async function isLimited(
  scope: string,
  key: string,
  windowSeconds: number,
  max: number,
): Promise<boolean> {
  const doc = await limits().get(windowDoc(scope, key, windowSeconds).id);
  return (doc?.count ?? 0) >= max;
}

/** Counts one event; false when the window was already full */
export async function consumeLimit(
  scope: string,
  key: string,
  windowSeconds: number,
  max: number,
): Promise<boolean> {
  const { id, expiresAt } = windowDoc(scope, key, windowSeconds);
  return getDocumentStore().transaction(async () => {
    const col = limits();
    const doc = await col.get(id);
    if (!doc) {
      await col.upsert({ id, count: 1, expiresAt });
      return true;
    }
    if (doc.count >= max) return false;
    await col.update(id, { inc: { count: 1 } });
    return true;
  });
}
