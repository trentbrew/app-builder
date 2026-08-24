export type WikiMention = {
	kind: 'file';
	id: string;
	label: string;
};

function stripAlias(raw: string) {
	const pipe = raw.indexOf('|');
	const base = pipe === -1 ? raw : raw.slice(0, pipe);
	return base.trim();
}

function alias(raw: string, fallback: string) {
	const pipe = raw.indexOf('|');
	if (pipe === -1) return fallback;
	const next = raw.slice(pipe + 1).trim();
	return next || fallback;
}

/** Parse `[[path]]` or `[[path|alias]]` into mention attrs. */
export function parseWikiLink(raw: string): WikiMention | undefined {
	const inner = raw.trim();
	if (!inner || inner.startsWith('#')) return undefined;

	const target = stripAlias(inner);
	if (!target) return undefined;

	return {
		kind: 'file',
		id: target.replaceAll('\\', '/'),
		label: alias(raw, target.split('/').pop() || target)
	};
}
