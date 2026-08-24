export type TreeExpandMode = 'default' | 'expanded' | 'collapsed';

class FileTreeState {
	mode = $state<TreeExpandMode>('default');

	expandAll() {
		this.mode = 'expanded';
	}

	collapseAll() {
		this.mode = 'collapsed';
	}

	reset() {
		this.mode = 'default';
	}
}

export const fileTreeState = new FileTreeState();
