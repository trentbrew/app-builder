import { browser } from '$app/environment'
import { cloneConfig, type LayoutConfig } from 'horizon-layout'
import { EMPTY_PANE_VIEW_ID, GROUP_VIEW_PREFIX } from '$lib/editorLayout'
import { dockContainersStorageKey, getActiveEditorScopeId } from '$lib/projects/projectScope'

const LEGACY_STORAGE_KEY = 'app-builder:dock-containers:v1'

function storageKey(): string {
  const projectId = getActiveEditorScopeId()
  return projectId ? dockContainersStorageKey(projectId) : LEGACY_STORAGE_KEY
}

export function groupViewId(id: string): string {
  return `${GROUP_VIEW_PREFIX}${id}`
}

export function groupIdFromViewId(viewId: string): string | null {
  return viewId.startsWith(GROUP_VIEW_PREFIX) ? viewId.slice(GROUP_VIEW_PREFIX.length) : null
}

export function isGroupViewId(id: string): boolean {
  return id.startsWith(GROUP_VIEW_PREFIX)
}

export type ContainerTabState = {
  id: string
  label: string
  config: LayoutConfig
  openFiles: string[]
  openTerminals: string[]
}

function loadContainers(): Record<string, ContainerTabState> {
  if (!browser) return {}
  try {
    const raw = localStorage.getItem(storageKey())
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ContainerTabState>) : {}
  } catch {
    return {}
  }
}

function persist() {
  if (!browser) return
  try {
    localStorage.setItem(storageKey(), JSON.stringify({ ...containers }))
  } catch {
    // ignore quota / private-mode failures
  }
}

export const containers = $state<Record<string, ContainerTabState>>(loadContainers())

/** Reload dock container state when switching projects. */
export function reloadContainersForProject() {
  const next = loadContainers()
  for (const key of Object.keys(containers)) delete containers[key]
  Object.assign(containers, next)
}

export function getContainer(id: string): ContainerTabState | undefined {
  return containers[id]
}

/** Create a container tab state. Starts with a single Blank pane. */
export function createContainer(): ContainerTabState {
	const id = newGroupId()
	return ensureContainer(id)
}

/** Ensure container state exists for a layout-referenced group id. */
export function ensureContainer(id: string): ContainerTabState {
	const existing = containers[id]
	if (existing) return existing

	const state: ContainerTabState = {
		id,
		label: `Group ${Object.keys(containers).length + 1}`,
		config: { root: { tabs: [EMPTY_PANE_VIEW_ID], activeTabIndex: 0 } },
		openFiles: [],
		openTerminals: []
	}
	containers[id] = state
	persist()
	return state
}

export function renameContainer(id: string, config: LayoutConfig) {
  const existing = containers[id]
  if (!existing) return
  containers[id] = { ...existing, config }
  persist()
}

export function setContainerFiles(id: string, files: string[]) {
  const existing = containers[id]
  if (!existing) return
  containers[id] = { ...existing, openFiles: files }
  persist()
}

export function setContainerTerminals(id: string, terminals: string[]) {
  const existing = containers[id]
  if (!existing) return
  containers[id] = { ...existing, openTerminals: terminals }
  persist()
}

/** Remove a container's state entirely (caller is responsible for orphaned sessions). */
export function destroyContainer(id: string) {
  delete containers[id]
  persist()
}

/** Clone-safe snapshot used when rendering. */
export function containerConfig(id: string): LayoutConfig | undefined {
  return containers[id]?.config ? cloneConfig(containers[id].config) : undefined
}

let counter = 0

export function newGroupId(): string {
  counter += 1
  return `g${Date.now().toString(36)}${counter.toString(36)}`
}

