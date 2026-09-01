export const EXPLORER_PATH_MIME = 'application/x-app-builder-path';

export function setExplorerDragData(dataTransfer: DataTransfer, path: string) {
	dataTransfer.setData(EXPLORER_PATH_MIME, path);
	dataTransfer.effectAllowed = 'move';
}

export function isExplorerPathDrag(dataTransfer: DataTransfer | null): boolean {
	return Boolean(dataTransfer?.types.includes(EXPLORER_PATH_MIME));
}

export function readExplorerDragPath(dataTransfer: DataTransfer | null): string | null {
	if (!dataTransfer) return null;
	const path = dataTransfer.getData(EXPLORER_PATH_MIME);
	return path || null;
}
