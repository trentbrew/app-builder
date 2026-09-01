import type { FileSystemTree, WebContainer } from '@webcontainer/api';

/**
 * Bundles the Trellis CLI into every WebContainer session.
 *
 * The payload is `static/trellis/bootstrap.json`, produced by
 * `scripts/pack-trellis.mjs` (which shells out to `trellis sandbox pack`).
 * It is the same artifact the standalone HTML sandbox in trellis-node uses —
 * Trellis runs *entirely inside the container*, never against the host.
 *
 * Everything lands under `node_modules/trellis/`, which matters for two
 * reasons:
 *   1. `SNAPSHOT_EXPORT_EXCLUDES` in webcontainerSnapshot.ts already skips
 *      `node_modules/**`, so the ~7 MB payload never bloats a Dexie snapshot.
 *   2. `bin/trellis.mjs` does `import '../dist/cli/index.js'`, so bin/ and
 *      dist/ must stay siblings; and Trellis's own deps resolve by walking up
 *      to `node_modules/trellis/node_modules/`.
 */

/** A packed file: UTF-8 text, or base64 for binaries (e.g. sql-wasm.wasm). */
type PackedFile = string | { binary: string };

export interface TrellisBootstrap {
	packageJson: Record<string, unknown>;
	binTrellis: string;
	/** Keyed by path relative to the Trellis package root, e.g. `cli/index.js`. */
	dist: Record<string, PackedFile>;
	/** Keyed by path already prefixed with `node_modules/`. */
	nodeModules?: Record<string, PackedFile>;
	clientHtml?: string;
	version: string;
}

export const TRELLIS_BOOTSTRAP_URL = '/trellis/bootstrap.json';

/** Where the Trellis package is mounted, relative to the project workdir. */
export const TRELLIS_PACKAGE_DIR = 'node_modules/trellis';

/**
 * npm bin entries are extensionless, and WebContainer's Node loads an
 * extensionless entry point as CommonJS — where a static `import` statement
 * silently no-ops (exit 0, no output). A *dynamic* import is valid in both
 * module systems, so it works regardless of how the file is classified.
 */
const TRELLIS_BIN_STUB = `#!/usr/bin/env node
import('../trellis/bin/trellis.mjs');
`;

/**
 * The payload is large and immutable for the life of the page, so fetch it at
 * most once and share the promise across concurrent boots.
 */
let bootstrapPromise: Promise<TrellisBootstrap> | null = null;

export function loadTrellisBootstrap(): Promise<TrellisBootstrap> {
	bootstrapPromise ??= fetch(TRELLIS_BOOTSTRAP_URL).then(async (response) => {
		if (!response.ok) {
			throw new Error(
				`Trellis bootstrap unavailable (HTTP ${response.status}). ` +
					'Run `node scripts/pack-trellis.mjs` to generate static/trellis/bootstrap.json.'
			);
		}
		return (await response.json()) as TrellisBootstrap;
	});
	return bootstrapPromise;
}

function decodePackedFile(value: PackedFile): string | Uint8Array {
	if (typeof value === 'string') return value;
	return Uint8Array.from(atob(value.binary), (char) => char.charCodeAt(0));
}

/** Expand a flat `path → contents` map into the nested tree mount() expects. */
function nestFiles(flat: Record<string, PackedFile>, tree: FileSystemTree = {}): FileSystemTree {
	for (const [relativePath, packed] of Object.entries(flat)) {
		const segments = relativePath.split('/');
		let node = tree;
		for (const segment of segments.slice(0, -1)) {
			const existing = node[segment];
			if (!existing || !('directory' in existing)) node[segment] = { directory: {} };
			node = (node[segment] as { directory: FileSystemTree }).directory;
		}
		node[segments[segments.length - 1]] = {
			file: { contents: decodePackedFile(packed) }
		};
	}
	return tree;
}

/**
 * Build the tree for `node_modules/trellis/` — the package manifest, the CLI
 * launcher, the compiled dist/, and Trellis's vendored dependencies.
 */
export function buildTrellisPackageTree(bootstrap: TrellisBootstrap): FileSystemTree {
	const distTree = nestFiles(bootstrap.dist);

	if (bootstrap.clientHtml) {
		const ui = distTree.ui;
		if (!ui || !('directory' in ui)) distTree.ui = { directory: {} };
		(distTree.ui as { directory: FileSystemTree }).directory['client.html'] = {
			file: { contents: bootstrap.clientHtml }
		};
	}

	const tree: FileSystemTree = {
		'package.json': { file: { contents: JSON.stringify(bootstrap.packageJson, null, 2) } },
		bin: {
			directory: {
				'trellis.mjs': { file: { contents: bootstrap.binTrellis } },
				trellis: { file: { contents: bootstrap.binTrellis } }
			}
		},
		dist: { directory: distTree }
	};

	// Keys already carry the `node_modules/` prefix, so this nests them at
	// node_modules/trellis/node_modules/<dep>/… where Node resolution finds them.
	if (bootstrap.nodeModules) nestFiles(bootstrap.nodeModules, tree);

	return tree;
}

/**
 * Mount Trellis into a booted container and put `trellis` on the shell PATH.
 *
 * Call this *after* `npm install` — npm may prune unknown entries from
 * node_modules, which would strip the package back out.
 */
export async function installTrellis(container: WebContainer): Promise<string> {
	const bootstrap = await loadTrellisBootstrap();

	// mount() with a mountPoint replaces only that directory, so confine it to
	// our own package rather than merging a tree at the project root.
	await container.fs.mkdir(TRELLIS_PACKAGE_DIR, { recursive: true });
	await container.mount(buildTrellisPackageTree(bootstrap), {
		mountPoint: TRELLIS_PACKAGE_DIR
	});

	// jsh cannot execute shell wrappers (no exec/dirname), so the bin entry is a
	// Node ESM stub rather than the usual npm shim.
	await container.fs.mkdir('node_modules/.bin', { recursive: true });
	await container.fs.writeFile('node_modules/.bin/trellis', TRELLIS_BIN_STUB);

	try {
		const chmod = await container.spawn('chmod', [
			'+x',
			'node_modules/.bin/trellis',
			`${TRELLIS_PACKAGE_DIR}/bin/trellis`,
			`${TRELLIS_PACKAGE_DIR}/bin/trellis.mjs`
		]);
		await chmod.exit;
	} catch {
		// Not fatal — `node node_modules/trellis/bin/trellis.mjs` still works.
	}

	return bootstrap.version;
}

/** Initialize a `.trellis/` repo in the project root if one is not there yet. */
export async function ensureTrellisRepo(container: WebContainer): Promise<boolean> {
	try {
		await container.fs.readdir('.trellis');
		return false;
	} catch {
		// No repo yet — fall through and create one.
	}

	const init = await container.spawn('node', [
		`${TRELLIS_PACKAGE_DIR}/bin/trellis.mjs`,
		'init',
		'--no-interactive',
		'--identity',
		'skip',
		'--framework',
		'node'
	]);
	return (await init.exit) === 0;
}
