import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { replProjectFiles, type WriteReplProjectOptions } from '$lib/replProject';

/** Write the Svelte REPL scaffold to a directory on disk. */
export async function writeReplProject(dir: string, options: WriteReplProjectOptions) {
	await mkdir(dir, { recursive: true });
	const files = replProjectFiles(options);

	await Promise.all(
		Object.entries(files).map(([name, contents]) => writeFile(join(dir, name), contents, 'utf-8'))
	);
}
