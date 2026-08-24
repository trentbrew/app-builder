import { languageLabelForPath } from '$lib/languageLabel';

export type StatusBarItem = {
	id: string;
	label: string;
	title?: string;
};

export const statusBar = $state({
	left: [{ id: 'app', label: 'App Builder' }] as StatusBarItem[],
	right: [{ id: 'encoding', label: 'UTF-8' }] as StatusBarItem[]
});

export function setStatusBarLeft(items: StatusBarItem[]) {
	statusBar.left = items;
}

export function setStatusBarRight(items: StatusBarItem[]) {
	statusBar.right = items;
}

export function setEditorStatus(options: {
	activeFile?: string;
	phase?: string;
	booting?: boolean;
	error?: string;
}) {
	const { activeFile, phase, booting, error } = options;

	const left: StatusBarItem[] = [{ id: 'workspace', label: 'svelte-repl' }];

	if (error) {
		left.push({ id: 'error', label: 'Build Error', title: error });
	} else if (booting) {
		left.push({ id: 'boot', label: phase ? `Booting: ${phase}` : 'Booting…' });
	} else {
		left.push({ id: 'ready', label: phase && phase !== 'idle' ? phase : 'Ready' });
	}

	statusBar.left = left;

	if (!activeFile) return;

	const language = languageLabelForPath(activeFile);
	const fileName = activeFile.split('/').filter(Boolean).at(-1) ?? activeFile;

	statusBar.right = [
		{ id: 'file', label: fileName, title: activeFile },
		{ id: 'language', label: language },
		{ id: 'encoding', label: 'UTF-8' },
		{ id: 'eol', label: 'LF' }
	];
}
