#!/usr/bin/env node
/**
 * Token parity: app_builder_multi_project_design.md YAML ↔ mock :root
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const designPath = join(dir, 'app_builder_multi_project_design.md');
const mockPath = join(dir, 'app_builder_multi_project_mockup.html');

const design = readFileSync(designPath, 'utf8');
const mock = readFileSync(mockPath, 'utf8');

const yamlBlock = design.match(/^---\n([\s\S]*?)\n---/m)?.[1] ?? '';
const yamlColors = Object.fromEntries(
	[...yamlBlock.matchAll(/^  ([\w-]+): "(.+)"\s*$/gm)].map((m) => [m[1], m[2]])
);

const mockRoot = mock.match(/:root\s*\{([^}]+)\}/s)?.[1] ?? '';
const mockVars = Object.fromEntries(
	[...mockRoot.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
);

const pairs = [
	['background', 'background'],
	['foreground', 'foreground'],
	['card', 'card'],
	['card-foreground', 'card-foreground'],
	['primary', 'primary'],
	['primary-foreground', 'primary-foreground'],
	['secondary', 'secondary'],
	['muted', 'muted'],
	['muted-foreground', 'muted-foreground'],
	['accent', 'accent'],
	['destructive', 'destructive'],
	['border', 'border'],
	['ring', 'ring'],
	['status-bar', 'status-bar'],
	['template-svelte', 'template-svelte'],
	['template-vue', 'template-vue'],
	['template-next', 'template-next']
];

let failed = 0;
for (const [yamlKey, cssKey] of pairs) {
	const y = yamlColors[yamlKey];
	const c = mockVars[cssKey];
	if (!y || !c) {
		console.error(`✗ missing pair ${yamlKey} ↔ --${cssKey}`);
		failed++;
		continue;
	}
	if (y !== c) {
		console.error(`✗ drift ${yamlKey}: yaml="${y}" mock="${c}"`);
		failed++;
	} else {
		console.log(`✓ ${yamlKey}`);
	}
}

const yamlRadius = yamlBlock.match(/^\s+lg:\s*(.+)$/m)?.[1]?.trim();
const mockRadius = mockVars.radius;
if (yamlRadius && mockRadius && yamlRadius !== mockRadius) {
	console.error(`✗ radius drift`);
	failed++;
} else if (yamlRadius && mockRadius) {
	console.log('✓ radius');
}

if (failed) {
	console.error(`\n${failed} token parity failure(s)`);
	process.exit(1);
}
console.log('\nAll token pairs verified.');
process.exit(0);
