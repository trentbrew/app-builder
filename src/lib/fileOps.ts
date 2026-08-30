import { dirname, joinPath } from '$lib/fileTreeOps';
import { isBinaryPreviewPath } from '$lib/fileTypes';
import { sandboxStore } from '$lib/sandboxStore';
import { toast } from '$lib/notify';
import type { SandboxFs } from '$lib/sandbox/types';

export function basename(path: string): string {
	const normalized = path.startsWith('/') ? path : `/${path}`;
	const parts = normalized.split('/').filter(Boolean);
	return parts.at(-1) ?? path;
}

export async function readFileContent(fs: SandboxFs, path: string): Promise<string> {
	return fs.readFile(path, 'utf-8');
}

export async function openFileFromFs(
	fs: SandboxFs,
	path: string,
	onSelectFile?: (path: string, content: string) => void
) {
	if (!onSelectFile) return;
	try {
		if (isBinaryPreviewPath(path)) {
			onSelectFile(path, '');
			return;
		}
		const content = await readFileContent(fs, path);
		onSelectFile(path, content);
	} catch (error) {
		console.error('Error reading file:', error);
		toast.error(`Could not open ${basename(path)}`);
	}
}

export async function createFileInDirectory(
	fs: SandboxFs,
	dir: string,
	defaultName = 'untitled.md'
): Promise<string | null> {
	const name = window.prompt('New file name', defaultName);
	if (!name?.trim()) return null;

	const path = joinPath(dir, name.trim());
	try {
		await fs.writeFile(path, '');
		sandboxStore.notifyFilesystemChange();
		toast.success(`Created ${name.trim()}`);
		return path;
	} catch {
		toast.error(`Could not create ${name.trim()}`);
		return null;
	}
}

export async function createFolderInDirectory(fs: SandboxFs, dir: string): Promise<string | null> {
	const name = window.prompt('New folder name', 'untitled');
	if (!name?.trim()) return null;

	const path = joinPath(dir, name.trim());
	try {
		await fs.mkdir(path, { recursive: true });
		sandboxStore.notifyFilesystemChange();
		toast.success(`Created folder ${name.trim()}`);
		return path;
	} catch {
		toast.error(`Could not create folder ${name.trim()}`);
		return null;
	}
}

export async function renamePath(
	fs: SandboxFs,
	path: string,
	nodeKind: 'file' | 'directory'
): Promise<string | null> {
	const currentName = basename(path);
	const nextName = window.prompt(`Rename ${nodeKind}`, currentName);
	if (!nextName?.trim() || nextName.trim() === currentName) return null;

	const nextPath = joinPath(dirname(path), nextName.trim());
	const containerFs = sandboxStore.getContainer()?.fs;
	if (!containerFs?.rename) {
		toast.error('Rename is not supported in this sandbox backend');
		return null;
	}

	try {
		await containerFs.rename(path, nextPath);
		sandboxStore.notifyFilesystemChange();
		toast.success(`Renamed to ${nextName.trim()}`);
		return nextPath;
	} catch {
		toast.error(`Could not rename ${currentName}`);
		return null;
	}
}

export async function deletePath(
	fs: SandboxFs,
	path: string,
	nodeKind: 'file' | 'directory'
): Promise<boolean> {
	const name = basename(path);
	const confirmed = window.confirm(`Delete ${nodeKind} "${name}"?`);
	if (!confirmed) return false;

	const containerFs = sandboxStore.getContainer()?.fs;
	if (!containerFs?.rm) {
		toast.error('Delete is not supported in this sandbox backend');
		return false;
	}

	try {
		await containerFs.rm(path, { recursive: nodeKind === 'directory', force: true });
		sandboxStore.notifyFilesystemChange();
		toast.success(`Deleted ${name}`);
		return true;
	} catch {
		toast.error(`Could not delete ${name}`);
		return false;
	}
}

export async function movePath(fs: SandboxFs, path: string, targetDir: string): Promise<string | null> {
	const containerFs = sandboxStore.getContainer()?.fs;
	if (!containerFs?.rename) {
		toast.error('Move is not supported in this sandbox backend');
		return null;
	}

	const name = basename(path);
	const nextPath = joinPath(targetDir, name);
	if (normalizeTreePath(path) === normalizeTreePath(nextPath)) return path;

	try {
		await containerFs.rename(path, nextPath);
		sandboxStore.notifyFilesystemChange();
		return nextPath;
	} catch {
		toast.error(`Could not move ${name}`);
		return null;
	}
}

function normalizeTreePath(path: string) {
	return path.startsWith('/') ? path : `/${path}`;
}

export async function writeExternalFile(
	fs: SandboxFs,
	dir: string,
	file: File
): Promise<string | null> {
	const path = joinPath(dir, file.name);
	try {
		if (isBinaryPreviewPath(file.name) && fs.writeBinary) {
			await fs.writeBinary(path, new Uint8Array(await file.arrayBuffer()));
		} else {
			const content = await file.text();
			await fs.writeFile(path, content);
		}
		sandboxStore.notifyFilesystemChange();
		return path;
	} catch {
		toast.error(`Could not import ${file.name}`);
		return null;
	}
}

export async function copyPathToClipboard(path: string) {
	try {
		await navigator.clipboard.writeText(path);
		toast.success('Copied path');
	} catch {
		toast.error('Could not copy path');
	}
}
