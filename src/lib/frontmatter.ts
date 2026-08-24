import YAML from 'yaml';

export type Frontmatter = {
	meta: Record<string, unknown>;
	body: string;
};

const fence = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;

const SUSPICIOUS_KEY_CHARS = /[*#>[\]()|`!]/;
const ORDERED_LIST_KEY = /^\d+\.\s/;

function isObsidianStyleMeta(meta: unknown): meta is Record<string, unknown> {
	if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;

	for (const key of Object.keys(meta)) {
		if (!key || key.includes('\n') || key.includes('\r')) return false;
		if (SUSPICIOUS_KEY_CHARS.test(key)) return false;
		if (ORDERED_LIST_KEY.test(key)) return false;
	}

	return true;
}

function isObsidianStyleYamlText(yamlText: string): boolean {
	for (const line of yamlText.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		return /^[\w-]+:/.test(trimmed);
	}
	return false;
}

export function parseFrontmatter(text: string): Frontmatter | undefined {
	const match = text.match(fence);
	if (!match) return undefined;
	try {
		const yamlText = match[1];
		if (!yamlText || !isObsidianStyleYamlText(yamlText)) return undefined;

		const raw = YAML.parse(yamlText, { logLevel: 'silent' });
		if (!isObsidianStyleMeta(raw)) return undefined;
		return {
			meta: raw as Record<string, unknown>,
			body: text.slice(match[0].length)
		};
	} catch {
		return undefined;
	}
}

export function splitFrontmatter(value: string): {
	meta: Record<string, unknown> | undefined;
	body: string;
} {
	const parsed = parseFrontmatter(value);
	if (!parsed) return { meta: undefined, body: value };
	return { meta: parsed.meta, body: parsed.body };
}
