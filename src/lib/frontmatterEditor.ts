function yamlVal(v: unknown): string {
	if (typeof v === 'boolean' || typeof v === 'number') return String(v);
	if (typeof v === 'string') {
		const needs = v === '' || v.trim() !== v || /[:#\[\]{},|>&*!'"\\%@`]/.test(v);
		return needs ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : v;
	}
	return String(v);
}

export function serializeFrontmatter(meta: Record<string, unknown>): string {
	const lines: string[] = ['---'];
	for (const [k, v] of Object.entries(meta)) {
		if (v === null || v === undefined) continue;
		if (Array.isArray(v)) {
			lines.push(`${k}:`);
			for (const item of v) lines.push(`  - ${yamlVal(item)}`);
		} else if (typeof v === 'object') {
			lines.push(`${k}:`);
			for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
				lines.push(`  ${yamlVal(k2)}: ${yamlVal(v2)}`);
			}
		} else {
			lines.push(`${k}: ${yamlVal(v)}`);
		}
	}
	lines.push('---', '');
	return lines.join('\n');
}

export function createEmptyFrontmatter(title = ''): Record<string, unknown> {
	return title ? { title } : { title: '' };
}
