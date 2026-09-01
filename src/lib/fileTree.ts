import type { SandboxFs } from '$lib/sandbox/types';

export type TreeNode = {
	name: string;
	path: string;
	kind: 'file' | 'folder';
	children?: TreeNode[];
	/** Large/generated folders shown in the tree but not expanded eagerly. */
	truncated?: boolean;
};

/** Never shown in the explorer. */
const HIDDEN = new Set(['.git']);

/** Shown as folders, but children are not read (keeps node_modules usable without freezing the UI). */
const SKIP_RECURSE = new Set(['node_modules', 'dist', 'build', '.svelte-kit']);

export async function loadProjectTree(fs: SandboxFs, root = '/'): Promise<TreeNode[]> {
	return readDirectory(fs, root);
}

async function readDirectory(fs: SandboxFs, dirPath: string): Promise<TreeNode[]> {
	const entries = await fs.readdir(dirPath, { withFileTypes: true });
	const visible = entries
		.filter((entry) => !HIDDEN.has(entry.name))
		.sort((a, b) => {
			if (a.isDirectory() !== b.isDirectory()) {
				return a.isDirectory() ? -1 : 1;
			}
			return a.name.localeCompare(b.name);
		});

	const nodes: TreeNode[] = [];

	for (const entry of visible) {
		const path = dirPath === '/' ? `/${entry.name}` : `${dirPath}/${entry.name}`;

		if (entry.isDirectory()) {
			const truncated = SKIP_RECURSE.has(entry.name);
			let children: TreeNode[] = [];
			if (!truncated) {
				try {
					children = await readDirectory(fs, path);
				} catch {
					children = [];
				}
			}
			nodes.push({
				name: entry.name,
				path,
				kind: 'folder',
				truncated,
				children
			});
		} else {
			nodes.push({ name: entry.name, path, kind: 'file' });
		}
	}

	return nodes;
}
