import type { WebContainer } from '@webcontainer/api';

export interface SandboxDirent {
	name: string;
	isDirectory(): boolean;
}

/** Minimal filesystem surface shared by WebContainer and the Bun sandbox API. */
export interface SandboxFs {
	readFile(path: string, encoding: 'utf-8'): Promise<string>;
	writeFile(path: string, content: string): Promise<void>;
	mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
	readdir(path: string, options: { withFileTypes: true }): Promise<SandboxDirent[]>;
}

export interface SandboxPreviewState {
	loading: boolean;
	booting: boolean;
	error: string;
	previewUrl: string;
	previewPort: number | null;
	phase: string;
	logs: string[];
	treeGeneration: number;
	restoredFromSnapshot: boolean;
	backend: 'bun' | 'webcontainer';
	fsReady: boolean;
	container?: WebContainer;
}

export interface SandboxStore {
	subscribe: (run: (state: SandboxPreviewState) => void) => () => void;
	boot: () => Promise<void>;
	write: (path: string, content: string) => Promise<void>;
	getContainer: () => WebContainer | undefined;
	getFs: () => SandboxFs | undefined;
	getBackend: () => 'bun' | 'webcontainer' | 'unknown';
	appendLog: (line: string) => void;
	reboot: (options?: { clearSnapshot?: boolean }) => Promise<void>;
	clearSnapshot: () => Promise<void>;
	notifyFilesystemChange: () => void;
}

export function webContainerToFs(container: WebContainer): SandboxFs {
	return {
		readFile: (path, encoding) => container.fs.readFile(path, encoding),
		writeFile: (path, content) => container.fs.writeFile(path, content),
		mkdir: (path, options) => container.fs.mkdir(path, options),
		readdir: (path, options) => container.fs.readdir(path, options)
	};
}
