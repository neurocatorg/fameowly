/**
 * Provider store — CRUD for virtual providers and their key rotation state,
 * both kept as singleton documents of the `settings` collection.
 *
 * This is core infrastructure (data access), not a plugin feature.
 * The admin UI for managing providers lives in the plugins directory.
 */

import { getDocumentStore } from "./storage/db";
import type { VirtualProvider, RotationState } from "./types";

const PROVIDERS_ID = "providers";
const ROTATION_ID = "rotation-state";

type ProvidersDocument = { id: string; providers: VirtualProvider[] };
type RotationDocument = RotationState & { id: string };

function providersDoc() {
  return getDocumentStore().collection<ProvidersDocument>("settings");
}

function rotationDoc() {
  return getDocumentStore().collection<RotationDocument>("settings");
}

// ─── Providers CRUD ──────────────────────────────────────────────────

export async function getProviders(): Promise<VirtualProvider[]> {
  try {
    return (await providersDoc().get(PROVIDERS_ID))?.providers ?? [];
  } catch (err) {
    console.error("Failed to read virtual providers:", err);
    return [];
  }
}

async function saveProviders(providers: VirtualProvider[]): Promise<void> {
  await providersDoc().upsert({ id: PROVIDERS_ID, providers });
}

export async function getProviderById(id: string): Promise<VirtualProvider | undefined> {
  return (await getProviders()).find((p) => p.id === id);
}

export function upsertProvider(provider: VirtualProvider): Promise<void> {
  return getDocumentStore().transaction(async () => {
    const providers = await getProviders();
    const idx = providers.findIndex((p) => p.id === provider.id);
    if (idx >= 0) {
      providers[idx] = provider;
    } else {
      providers.push(provider);
    }
    await saveProviders(providers);
  });
}

export function deleteProvider(id: string): Promise<boolean> {
  return getDocumentStore().transaction(async () => {
    const providers = await getProviders();
    const filtered = providers.filter((p) => p.id !== id);
    if (filtered.length === providers.length) return false;
    await saveProviders(filtered);
    return true;
  });
}

// ─── Rotation state (in-memory + periodic flush) ─────────────────────

let _rotationState: Promise<RotationState> | null = null;
let _rotationDirty = false;
let _flushTimer: ReturnType<typeof setInterval> | null = null;

function rotationState(): Promise<RotationState> {
  _rotationState ??= rotationDoc()
    .get(ROTATION_ID)
    .then((doc) => ({ counters: doc?.counters ?? {}, currentIndex: doc?.currentIndex ?? {} }))
    .catch(() => ({ counters: {}, currentIndex: {} }));
  ensureFlushTimer();
  return _rotationState;
}

async function flushRotationState(): Promise<void> {
  if (!_rotationDirty || !_rotationState) return;
  try {
    _rotationDirty = false;
    await rotationDoc().upsert({ id: ROTATION_ID, ...(await _rotationState) });
  } catch (err) {
    _rotationDirty = true;
    console.error("Failed to flush rotation state:", err);
  }
}

function ensureFlushTimer(): void {
  if (_flushTimer) return;
  _flushTimer = setInterval(() => void flushRotationState(), 30_000);
  if (_flushTimer.unref) _flushTimer.unref();
}

/**
 * Get the next key for a virtual provider + role, applying rotation.
 */
export async function getRotatedKey(
  virtualProviderId: string,
  role: string,
  keys: string[],
  rotationThreshold: number,
): Promise<string> {
  if (keys.length === 0) {
    throw new Error(`No keys configured for provider ${virtualProviderId}, role ${role}`);
  }
  if (keys.length === 1 || rotationThreshold <= 0) {
    return keys[0];
  }

  const state = await rotationState();
  const stateKey = `${virtualProviderId}:${role}`;
  const currentIdx = state.currentIndex[stateKey] ?? 0;
  const counterKey = `${stateKey}:${currentIdx}`;
  const count = (state.counters[counterKey] ?? 0) + 1;

  if (count >= rotationThreshold) {
    const nextIdx = (currentIdx + 1) % keys.length;
    state.currentIndex[stateKey] = nextIdx;
    state.counters[counterKey] = 0;
    state.counters[`${stateKey}:${nextIdx}`] = 0;
    _rotationDirty = true;
    return keys[nextIdx];
  }

  state.counters[counterKey] = count;
  _rotationDirty = true;
  return keys[currentIdx];
}
