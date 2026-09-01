export type ExplorerPaneDropSide = 'left' | 'right' | 'up' | 'down' | 'center';

export type ExplorerPaneDropTarget = {
	anchorViewId: string;
	side: ExplorerPaneDropSide;
};

const EDGE_RATIO = 0.22;

function sideFromPoint(rect: DOMRect, clientX: number, clientY: number): ExplorerPaneDropSide {
	const relX = (clientX - rect.left) / rect.width;
	const relY = (clientY - rect.top) / rect.height;

	if (relX < EDGE_RATIO) return 'left';
	if (relX > 1 - EDGE_RATIO) return 'right';
	if (relY < EDGE_RATIO) return 'up';
	if (relY > 1 - EDGE_RATIO) return 'down';
	return 'center';
}

function activeViewId(tabGroup: Element): string | null {
	const active = tabGroup.querySelector('.horizon-layout-tabgroup__tab--active[data-view-id]');
	return active?.getAttribute('data-view-id') ?? null;
}

/** Resolve which pane edge (or center) the pointer is over inside a dock root. */
export function resolveExplorerDropTarget(
	clientX: number,
	clientY: number,
	dockRoot: Element | null | undefined,
): ExplorerPaneDropTarget | null {
	if (!dockRoot) return null;

	const groups = dockRoot.querySelectorAll('.horizon-layout-tabgroup');
	let match: { el: Element; area: number } | null = null;

	for (const el of groups) {
		const rect = el.getBoundingClientRect();
		if (
			clientX < rect.left ||
			clientX > rect.right ||
			clientY < rect.top ||
			clientY > rect.bottom
		) {
			continue;
		}

		const area = rect.width * rect.height;
		if (!match || area < match.area) match = { el, area };
	}

	const tabGroup = match?.el ?? groups[0];
	if (!tabGroup) return null;

	const rect = tabGroup.getBoundingClientRect();
	const anchorViewId = activeViewId(tabGroup);
	if (!anchorViewId) return null;

	return {
		anchorViewId,
		side: sideFromPoint(rect, clientX, clientY),
	};
}
