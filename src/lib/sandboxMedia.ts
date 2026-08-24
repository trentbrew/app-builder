import { mimeTypeForPath } from '$lib/fileTypes';
import { sandboxStore } from '$lib/sandboxStore';

const FS_READY_TIMEOUT_MS = 15_000;

/** Resolve to a sandbox filesystem once it is ready, waiting for the store to
 * settle rather than failing on the first call during boot. */
async function waitForReadyFs(timeoutMs = FS_READY_TIMEOUT_MS) {
	const existing = sandboxStore.getFs();
	if (existing?.readBinary) return existing;

	return new Promise<ReturnType<typeof sandboxStore.getFs>>((resolve) => {
		let done = false;
		let timer: ReturnType<typeof setTimeout>;

		const finish = () => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			unsubscribe();
			resolve(sandboxStore.getFs());
		};

		const unsubscribe = sandboxStore.subscribe((state) => {
			if (state.fsReady && sandboxStore.getFs()?.readBinary) finish();
		});

		timer = setTimeout(finish, timeoutMs);
	});
}

export async function createSandboxObjectUrl(path: string): Promise<{
	url: string;
	size: number;
	revoke: () => void;
}> {
	const fs = await waitForReadyFs();
	if (!fs?.readBinary) {
		throw new Error('Binary file reads are not available');
	}

	const bytes = await fs.readBinary(path);
	const blob = new Blob([bytes as BlobPart], { type: mimeTypeForPath(path) });
	const url = URL.createObjectURL(blob);
	return {
		url,
		size: bytes.byteLength,
		revoke: () => URL.revokeObjectURL(url),
	};
}
