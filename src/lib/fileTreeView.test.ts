import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { TreeNode } from './fileTree.ts';
import { isPinnedTreeDuplicate, projectExplorerMainTree, removePathsFromTree } from './fileTreeView.ts';

const sampleTree: TreeNode[] = [
	{
		name: 'src',
		path: '/src',
		kind: 'folder',
		children: [
			{ name: 'components', path: '/src/components', kind: 'folder', children: [] },
			{ name: 'pages', path: '/src/pages', kind: 'folder', children: [] },
			{ name: 'main.ts', path: '/src/main.ts', kind: 'file' }
		]
	},
	{ name: 'package.json', path: '/package.json', kind: 'file' }
];

test('projectExplorerMainTree keeps shortcut paths in the main tree', () => {
	const main = projectExplorerMainTree(sampleTree, []);
	const src = main.find((node) => node.path === '/src');
	assert.deepEqual(
		src?.children?.map((node) => node.path),
		['/src/components', '/src/pages', '/src/main.ts']
	);
});

test('projectExplorerMainTree removes only hidden paths from the main tree', () => {
	const main = projectExplorerMainTree(sampleTree, ['/src/components']);
	const src = main.find((node) => node.path === '/src');
	assert.deepEqual(src?.children?.map((node) => node.path), ['/src/pages', '/src/main.ts']);
});

test('isPinnedTreeDuplicate matches pinned paths and their descendants in main tree', () => {
	const pinned = new Set(['/src']);
	assert.equal(isPinnedTreeDuplicate('/src', pinned, 'main'), true);
	assert.equal(isPinnedTreeDuplicate('/src/main.ts', pinned, 'main'), true);
	assert.equal(isPinnedTreeDuplicate('/src/components', pinned, 'main'), true);
	assert.equal(isPinnedTreeDuplicate('/package.json', pinned, 'main'), false);
	assert.equal(isPinnedTreeDuplicate('/src/main.ts', pinned, 'pinned'), false);
});

test('projectExplorerMainTree does not treat shortcuts as removals when hidden set is empty', () => {
	const pinnedOnly = removePathsFromTree(sampleTree, new Set(['/src/components']));
	assert.equal(pinnedOnly.find((node) => node.path === '/src')?.children?.length, 2);

	const projected = projectExplorerMainTree(sampleTree, []);
	assert.equal(projected.find((node) => node.path === '/src')?.children?.length, 3);
});
