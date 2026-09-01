import type { TreeNode } from '$lib/fileTree';

export function isDotfile(name: string): boolean {
	return name.startsWith('.');
}

export function normalizeTreePath(path: string): string {
	return path.startsWith('/') ? path : `/${path}`;
}

/** True when `path` is a pinned shortcut or nested under one in the main explorer tree. */
export function isPinnedTreeDuplicate(
	path: string,
	pinnedPaths: Iterable<string>,
	section: 'main' | 'pinned' | 'hidden' = 'main'
): boolean {
	if (section !== 'main') return false;

	const normalized = normalizeTreePath(path);
	for (const pinned of pinnedPaths) {
		const root = normalizeTreePath(pinned);
		if (normalized === root || normalized.startsWith(`${root}/`)) return true;
	}
	return false;
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

/** Explorer main-tree projection: hide filtered paths only; pinned shortcuts stay in-tree. */
export function projectExplorerMainTree(
	nodes: TreeNode[],
	hiddenPaths: Iterable<string>
): TreeNode[] {
	const hidden = new Set([...hiddenPaths].map(normalizeTreePath));
	return removePathsFromTree(nodes, hidden);
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

function nodeMatchesQuery(node: TreeNode, query: string): boolean {
	const haystack = `${node.name} ${node.path}`.toLowerCase();
	return haystack.includes(query);
}

/** Keep nodes whose name/path matches the query, plus ancestor folders of matches. */
export function filterTreeByQuery(nodes: TreeNode[], query: string): TreeNode[] {
	const trimmed = query.trim().toLowerCase();
	if (!trimmed) return nodes;

	function filterNode(node: TreeNode): TreeNode | null {
		if (node.kind === 'file') {
			return nodeMatchesQuery(node, trimmed) ? node : null;
		}

		const children = (node.children ?? [])
			.map(filterNode)
			.filter((child): child is TreeNode => child !== null);

		if (nodeMatchesQuery(node, trimmed) || children.length > 0) {
			return { ...node, children };
		}

		return null;
	}

	return nodes
		.map(filterNode)
		.filter((node): node is TreeNode => node !== null);
}
