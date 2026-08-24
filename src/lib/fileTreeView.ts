import type { TreeNode } from '$lib/fileTree';

export function isDotfile(name: string): boolean {
	return name.startsWith('.');
}

export function normalizeTreePath(path: string): string {
	return path.startsWith('/') ? path : `/${path}`;
}

export function findNode(nodes: TreeNode[], path: string): TreeNode | null {
	const target = normalizeTreePath(path);
	for (const node of nodes) {
		if (normalizeTreePath(node.path) === target) return node;
		if (node.children?.length) {
			const found = findNode(node.children, target);
			if (found) return found;
		}
	}
	return null;
}

export function collectNodesByPaths(nodes: TreeNode[], paths: Iterable<string>): TreeNode[] {
	const wanted = new Set([...paths].map(normalizeTreePath));
	const found: TreeNode[] = [];

	function walk(list: TreeNode[]) {
		for (const node of list) {
			if (wanted.has(normalizeTreePath(node.path))) found.push(node);
			if (node.children?.length) walk(node.children);
		}
	}

	walk(nodes);
	return [...found].sort((a, b) => a.path.localeCompare(b.path));
}

export function removePathsFromTree(nodes: TreeNode[], paths: Set<string>): TreeNode[] {
	const skip = new Set([...paths].map(normalizeTreePath));

	return nodes
		.filter((node) => !skip.has(normalizeTreePath(node.path)))
		.map((node) =>
			node.kind === 'folder' && node.children?.length
				? { ...node, children: removePathsFromTree(node.children, skip) }
				: node
		);
}

export function filterDotfiles(nodes: TreeNode[], showDotfiles: boolean): TreeNode[] {
	if (showDotfiles) return nodes;

	return nodes
		.filter((node) => !isDotfile(node.name))
		.map((node) =>
			node.kind === 'folder' && node.children?.length
				? { ...node, children: filterDotfiles(node.children, showDotfiles) }
				: node
		);
}

export function flattenVisibleTree(
	nodes: TreeNode[],
	isExpanded: (path: string) => boolean
): TreeNode[] {
	const flat: TreeNode[] = [];

	function walk(list: TreeNode[]) {
		for (const node of list) {
			flat.push(node);
			if (node.kind === 'folder' && isExpanded(node.path) && node.children?.length) {
				walk(node.children);
			}
		}
	}

	walk(nodes);
	return flat;
}

export function parentFolderPath(path: string): string | null {
	const normalized = normalizeTreePath(path);
	const parts = normalized.split('/').filter(Boolean);
	if (parts.length <= 1) return '/';
	parts.pop();
	return `/${parts.join('/')}`;
}
