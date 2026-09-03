import { browser } from '$app/environment'

/**
 * Durability for project snapshots.
 *
 * Project files live in IndexedDB (see `webcontainerSnapshot.ts`), which sits in the
 * origin's *best-effort* storage bucket by default — the browser may evict it under
 * disk pressure, and Safari clears script-writable storage for origins the user has
 * not visited recently. `navigator.storage.persist()` promotes the whole bucket to
 * `persistent`, after which only the user can clear it.
 *
 * Note this covers IndexedDB, Cache Storage and OPFS alike — they share one bucket
 * and one eviction decision, so there is nothing to gain by moving snapshots to OPFS
 * for durability reasons.
 */

const ASKED_KEY = 'app-builder:storage-persist-asked:v1'

/** Warn once usage crosses this share of the quota. */
export const STORAGE_PRESSURE_RATIO = 0.8

export const storagePersistence = $state({
  /** `navigator.storage` is present (secure context). */
  supported: false,
  /** `true` granted, `false` denied, `null` not yet determined. */
  persisted: null as boolean | null,
  /** Bytes used by this origin, per the browser's own estimate. */
  usage: null as number | null,
  /** Bytes this origin may use before writes start failing. */
  quota: null as number | null,
})

function manager(): StorageManager | null {
  if (!browser) return null
  const storage = navigator.storage as StorageManager | undefined
  if (!storage || typeof storage.persisted !== 'function') return null
  return storage
}

function hasAsked(): boolean {
  if (!browser) return false
  try {
    return localStorage.getItem(ASKED_KEY) === '1'
  } catch {
    return false
  }
}

function markAsked() {
  if (!browser) return
  try {
    localStorage.setItem(ASKED_KEY, '1')
  } catch {
    // Storage unavailable (private mode, blocked cookies) — retrying next boot is harmless.
  }
}

/** Read the current grant without prompting. */
export async function refreshPersistedState(): Promise<boolean | null> {
  const storage = manager()
  storagePersistence.supported = storage !== null
  if (!storage) return null
  try {
    const persisted = await storage.persisted()
    storagePersistence.persisted = persisted
    return persisted
  } catch {
    return null
  }
}

/**
 * Ask the browser to make this origin's storage persistent.
 *
 * Grant is heuristic and varies by browser: Chrome tends to decide silently from
 * engagement signals, Firefox prompts. We therefore ask once and remember that we
 * asked, so a denial does not re-prompt on every project create — pass `force` from
 * an explicit user action (a settings button) to ask again.
 */
export async function ensurePersistentStorage(options: { force?: boolean } = {}): Promise<boolean> {
  const storage = manager()
  storagePersistence.supported = storage !== null
  if (!storage) return false

  const already = await refreshPersistedState()
  if (already) return true

  if (!options.force && hasAsked()) return false
  if (typeof storage.persist !== 'function') return false

  markAsked()
  try {
    const granted = await storage.persist()
    storagePersistence.persisted = granted
    return granted
  } catch {
    return false
  }
}

/** Refresh the usage/quota readout. Cheap enough to call after each snapshot save. */
export async function refreshStorageEstimate(): Promise<void> {
  const storage = manager()
  storagePersistence.supported = storage !== null
  if (!storage || typeof storage.estimate !== 'function') return
  try {
    const { usage, quota } = await storage.estimate()
    storagePersistence.usage = usage ?? null
    storagePersistence.quota = quota ?? null
  } catch {
    // Estimate is advisory; leaving the previous reading in place is fine.
  }
}

/** Share of quota consumed, or `null` when the browser gave us no usable numbers. */
export function storageUsageRatio(): number | null {
  const { usage, quota } = storagePersistence
  if (usage === null || quota === null || quota <= 0) return null
  return usage / quota
}

export function isStorageUnderPressure(): boolean {
  const ratio = storageUsageRatio()
  return ratio !== null && ratio >= STORAGE_PRESSURE_RATIO
}

/** Boot-time read so the status bar and settings have numbers before the first save. */
export async function initStoragePersistence(): Promise<void> {
  await refreshPersistedState()
  await refreshStorageEstimate()
}
