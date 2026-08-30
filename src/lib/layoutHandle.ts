import type { LayoutHandle } from '$lib/layoutKeyboard';

export type { LayoutHandle } from '$lib/layoutKeyboard';

const handles = new Map<string, LayoutHandle>();

export function setLayoutHandle(dockId: string, handle: LayoutHandle | null) {
	if (handle) handles.set(dockId, handle);
	else handles.delete(dockId);
}

export function resolveActiveLayoutHandle(): LayoutHandle | null {
	if (typeof document === 'undefined') return handles.get('root') ?? null;

	const dock = document.activeElement?.closest('[data-dock-id]');
	const dockId = dock instanceof HTMLElement ? (dock.dataset.dockId ?? 'root') : 'root';
	return handles.get(dockId) ?? handles.get('root') ?? null;
}
