import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dist = join(root, 'node_modules/horizon-layout/dist');

function patchFile(relativePath, marker, transform) {
	const target = join(dist, relativePath);
	if (!existsSync(target)) {
		console.warn(`[patch-horizon-layout] ${relativePath} not found, skipping`);
		return false;
	}

	let source = readFileSync(target, 'utf8');
	if (source.includes(marker)) return false;

	const next = transform(source);
	if (next === source) {
		console.warn(`[patch-horizon-layout] Unexpected ${relativePath} shape, skipping`);
		return false;
	}

	writeFileSync(target, next);
	return true;
}

const tabBarPatched = patchFile(
	'TabGroup.svelte',
	'{baseClass}__tab-bar-drag',
	(source) => {
		const needle = `\t\t\t\t{/if}
\t\t\t</div>

\t\t\t<div class="{baseClass}__controls">`;

		const insert = `\t\t\t\t{/if}
\t\t\t\t{#if !disableDrag}
\t\t\t\t\t<div
\t\t\t\t\t\tclass="{baseClass}__tab-bar-drag"
\t\t\t\t\t\tdraggable="true"
\t\t\t\t\t\taria-hidden="true"
\t\t\t\t\t\tondragstart={(event) =>
\t\t\t\t\t\t\tstartTabDrag(event, config.tabs[config.activeTabIndex]!)}
\t\t\t\t\t></div>
\t\t\t\t{/if}
\t\t\t</div>

\t\t\t<div class="{baseClass}__controls">`;

		if (!source.includes(needle)) return source;
		return source.replace(needle, insert);
	}
);

const splitPatched = patchFile(
	'Split.svelte',
	'function equalizeAdjacentPanes',
	(source) => {
		const fnNeedle = `\tfunction handleKeyDown(event: KeyboardEvent, index: number) {`;
		const fnInsert = `\tfunction equalizeAdjacentPanes(index: number) {
\t\tif (disableResizeSplits) return;
\t\tconst { min, max } = posConstraints[index]!;
\t\tconst midpoint =
\t\t\t((config.splitPoints[index - 1] ?? 0) + (config.splitPoints[index + 1] ?? 1)) / 2;
\t\tconst clamped = Number(Math.min(Math.max(midpoint, min), max).toFixed(4));
\t\tif (clamped !== config.splitPoints[index]) config.splitPoints[index] = clamped;
\t}

\tfunction handleKeyDown(event: KeyboardEvent, index: number) {`;

		if (!source.includes(fnNeedle)) return source;
		source = source.replace(fnNeedle, fnInsert);

		const handleNeedle = `\t\t\t\t\tonpointerdown={(event) => startResize(event, i)}
\t\t\t\t\tonfocus={() => {`;
		const handleInsert = `\t\t\t\t\tonpointerdown={(event) => startResize(event, i)}
\t\t\t\t\tondblclick={() => equalizeAdjacentPanes(i)}
\t\t\t\t\tonfocus={() => {`;

		if (!source.includes(handleNeedle)) return source;
		return source.replace(handleNeedle, handleInsert);
	}
);

if (tabBarPatched) console.log('[patch-horizon-layout] Applied tab-bar drag patch');
if (splitPatched) console.log('[patch-horizon-layout] Applied resizer double-click patch');
