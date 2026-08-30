import {
	getIconForFile,
	getIconForFolder,
	getIconForOpenFolder
} from 'vscode-icons-js';

const ICON_BASE =
	'https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons';

const CUSTOM_FILE_ICONS: Record<string, string> = {
	mmd: 'file_type_mermaid.svg',
	mermaid: 'file_type_mermaid.svg',
	dds: 'file_type_image.svg',
};

export function fileIconUrl(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	const custom = CUSTOM_FILE_ICONS[ext];
	if (custom) return `${ICON_BASE}/${custom}`;
	return `${ICON_BASE}/${getIconForFile(filename)}`;
}

export function folderIconUrl(name: string, open = false): string {
	const icon = open ? getIconForOpenFolder(name) : getIconForFolder(name);
	return `${ICON_BASE}/${icon}`;
}

export function basename(path: string): string {
	return path.split('/').filter(Boolean).at(-1) ?? path;
}
