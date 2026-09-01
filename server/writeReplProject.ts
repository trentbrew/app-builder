import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { replProjectFiles, type WriteReplProjectOptions } from '$lib/replProject';

/** Write the Svelte REPL scaffold to a directory on disk. */
export async function writeReplProject(dir: string, options: WriteReplProjectOptions) {
	await mkdir(dir, { recursive: true });
	const files = replProjectFiles(options);

	await Promise.all(
		Object.entries(files).map(async ([name, contents]) => {
			const abs = join(dir, name);
			await mkdir(dirname(abs), { recursive: true });
			await writeFile(abs, contents, 'utf-8');
		})
	);
}
