import {
	getIconForFile,
	getIconForFolder,
	getIconForOpenFolder
} from 'vscode-icons-js';

const ICON_BASE =
	'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons';

export function fileIconUrl(filename: string): string {
	return `${ICON_BASE}/${getIconForFile(filename)}`;
}

export function folderIconUrl(name: string, open = false): string {
	const icon = open ? getIconForOpenFolder(name) : getIconForFolder(name);
	return `${ICON_BASE}/${icon}`;
}

export function basename(path: string): string {
	return path.split('/').filter(Boolean).at(-1) ?? path;
}
