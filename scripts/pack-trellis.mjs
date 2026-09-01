#!/usr/bin/env node
/**
 * Regenerate static/trellis/bootstrap.json — the Trellis CLI payload mounted
 * into every WebContainer session.
 *
 * Mirrors apps/wc-sandbox/scripts/build.sh in the trellis-node repo: it shells
 * out to `trellis sandbox pack`, which serializes the built dist/, bin/, and
 * vendored node_modules into a single JSON blob of file contents.
 *
 * The output is committed so production builds (Vercel) do not need a
 * trellis-node checkout. Re-run after bumping the bundled Trellis version.
 *
 *   node scripts/pack-trellis.mjs
 *   TRELLIS_ROOT=/path/to/trellis-node node scripts/pack-trellis.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const candidateRoots = [
	process.env.TRELLIS_ROOT,
	path.join(appRoot, '../../../TRELLIS/trellis-node'),
	path.join(process.env.HOME ?? '', 'TURTLE/Projects/TRELLIS/trellis-node')
].filter(Boolean);

const trellisRoot = candidateRoots.find((candidate) =>
	existsSync(path.join(candidate, 'bin/trellis.mjs'))
);

if (!trellisRoot) {
	const looked = candidateRoots.map((c) => `  - ${c}`).join('\n');
	console.error(
		[
			'pack-trellis: could not locate a trellis-node checkout.',
			'Set TRELLIS_ROOT to the repo root, e.g.',
			'  TRELLIS_ROOT=~/TURTLE/Projects/TRELLIS/trellis-node node scripts/pack-trellis.mjs',
			`Looked in:\n${looked}`
		].join('\n')
	);
	process.exit(1);
}

const outDir = path.join(appRoot, 'static/trellis');
const outFile = path.join(outDir, 'bootstrap.json');
mkdirSync(outDir, { recursive: true });

console.log(`pack-trellis: packing from ${trellisRoot}`);

const result = spawnSync(
	process.execPath,
	[path.join(trellisRoot, 'bin/trellis.mjs'), 'sandbox', 'pack', '-P', trellisRoot, '-o', outFile],
	{ stdio: 'inherit' }
);

if (result.status !== 0) {
	console.error(`pack-trellis: \`trellis sandbox pack\` failed (exit ${result.status ?? 'signal'})`);
	process.exit(result.status ?? 1);
}

const megabytes = (statSync(outFile).size / 1024 / 1024).toFixed(2);
console.log(`pack-trellis: wrote ${path.relative(appRoot, outFile)} (${megabytes} MB)`);
