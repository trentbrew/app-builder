import type { ExplorerPaneDropTarget } from '$lib/explorerDropTarget';

class ExplorerDragState {
	activePath = $state<string | null>(null);
	paneDropTarget = $state<ExplorerPaneDropTarget | null>(null);

	setActivePath(path: string | null) {
		this.activePath = path;
		if (!path) this.paneDropTarget = null;
	}

	setPaneDropTarget(target: ExplorerPaneDropTarget | null) {
		this.paneDropTarget = target;
	}
}

export const explorerDrag = new ExplorerDragState();
