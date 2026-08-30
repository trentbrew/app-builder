import { browser } from '$app/environment'
import { getActiveEditorScopeId, tabNamesStorageKey } from '$lib/projects/projectScope'

const LEGACY_STORAGE_KEY = 'app-builder:tab-names:v1'

function storageKey(): string {
  const projectId = getActiveEditorScopeId()
  return projectId ? tabNamesStorageKey(projectId) : LEGACY_STORAGE_KEY
}

function loadNames(): Record<string, string> {
  if (!browser) return {}
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function persist() {
  if (!browser) return
  try {
    localStorage.setItem(storageKey(), JSON.stringify({ ...tabNames }))
  } catch {
    // ignore quota / private-mode failures
  }
}

export const tabNames = $state<Record<string, string>>(loadNames())

export function reloadTabNamesForProject() {
  const next = loadNames()
  for (const key of Object.keys(tabNames)) delete tabNames[key]
  Object.assign(tabNames, next)
}

/** Set (or clear) the display name for a tab identified by its view id. */
export function setTabName(viewId: string, name: string) {
  const trimmed = name.trim()
  if (trimmed) {
    tabNames[viewId] = trimmed
  } else {
    delete tabNames[viewId]
  }
  persist()
}

/** Resolve a tab's display title: a custom name if set, otherwise the derived fallback. */
export function getTabTitle(viewId: string, fallback: string): string {
  return tabNames[viewId]?.trim() || fallback
}

/** The active display name for a view id, if any (used to seed rename prompts). */
export function getTabName(viewId: string): string {
  return tabNames[viewId]?.trim() || ''
}
