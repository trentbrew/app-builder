#!/usr/bin/env node
/**
 * Downloads tweakcn registry theme JSON files into src/lib/theme/presets/tweakcn/
 * and writes tweakcn-manifest.json with id + display labels.
 *
 * Source of truth: tweakcn utils/theme-presets.ts (local clone or tweakcn.com CDN).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TWEAKCN_ROOT =
	process.env.TWEAKCN_ROOT ??
	path.resolve(process.env.HOME ?? '', 'turtle/projects/oss/tweakcn');
const PRESETS_DIR = path.join(ROOT, 'src/lib/theme/presets/tweakcn');
const MANIFEST_PATH = path.join(ROOT, 'src/lib/theme/presets/tweakcn-manifest.json');
const THEME_PRESETS_TS = path.join(TWEAKCN_ROOT, 'utils/theme-presets.ts');
const CDN_BASE = 'https://tweakcn.com/r/themes';

async function readPresetCatalog() {
	const source = await fs.readFile(THEME_PRESETS_TS, 'utf8');
	const re = /(?:^|\n)\s+"?([a-z0-9-]+)"?:\s*\{\s*\n\s+label:\s*"([^"]+)"/g;
	const presets = [];
	let match;
	while ((match = re.exec(source)) !== null) {
		presets.push({ id: match[1], name: match[2] });
	}
	if (presets.length === 0) {
		throw new Error(`No presets found in ${THEME_PRESETS_TS}`);
	}
	return presets;
}

async function downloadPreset(id) {
	const response = await fetch(`${CDN_BASE}/${id}.json`);
	if (!response.ok) {
		throw new Error(`Failed to download "${id}" (${response.status})`);
	}
	return response.json();
}

async function main() {
	const presets = await readPresetCatalog();
	await fs.mkdir(PRESETS_DIR, { recursive: true });

	const existing = await fs.readdir(PRESETS_DIR);
	const keep = new Set(presets.map((p) => `${p.id}.json`));
	for (const file of existing) {
		if (file.endsWith('.json') && !keep.has(file)) {
			await fs.unlink(path.join(PRESETS_DIR, file));
		}
	}

	for (const preset of presets) {
		const data = await downloadPreset(preset.id);
		const outPath = path.join(PRESETS_DIR, `${preset.id}.json`);
		await fs.writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`);
		process.stdout.write(`✓ ${preset.id}\n`);
	}

	const manifest = presets.map((preset) => ({
		id: preset.id,
		name: preset.name,
		description: 'From tweakcn'
	}));

	await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
	console.log(`\nSynced ${presets.length} presets → ${path.relative(ROOT, PRESETS_DIR)}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
