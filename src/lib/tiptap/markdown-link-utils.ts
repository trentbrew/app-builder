export type MarkdownLinkAction =
	| { type: 'file'; path: string; hash?: string }
	| { type: 'url'; url: string }
	| { type: 'external'; href: string }
	| { type: 'anchor'; id: string }
	| { type: 'noop' };

const PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

function splitHash(href: string): [string, string | undefined] {
	const hashIndex = href.indexOf('#');
	if (hashIndex === -1) return [href, undefined];
	return [href.slice(0, hashIndex), href.slice(hashIndex + 1) || undefined];
}

function resolveRelativePath(relativePath: string, currentFilePath?: string): string {
	const baseDir = currentFilePath?.includes('/')
		? currentFilePath.slice(0, currentFilePath.lastIndexOf('/'))
		: '';
	const stack = baseDir ? baseDir.split('/').filter(Boolean) : [];

	for (const part of relativePath.split('/')) {
		if (!part || part === '.') continue;
		if (part === '..') {
			stack.pop();
			continue;
		}
		stack.push(part);
	}

	return `/${stack.join('/')}`;
}

function normalizeFilePath(path: string, currentFilePath?: string): string {
	const trimmed = path.trim();
	if (!trimmed) return '/';

	if (trimmed.startsWith('/')) {
		return `/${trimmed.split('/').filter(Boolean).join('/')}`;
	}

	return resolveRelativePath(trimmed, currentFilePath);
}

/** Resolve markdown link targets for in-app navigation. */
export function resolveMarkdownLinkHref(
	href: string,
	currentFilePath?: string
): MarkdownLinkAction {
	const raw = href.trim();
	if (!raw) return { type: 'noop' };

	if (raw.startsWith('#')) {
		return { type: 'anchor', id: raw.slice(1) };
	}

	const [pathPart, hash] = splitHash(raw);

	if (pathPart.startsWith('file:')) {
		return {
			type: 'file',
			path: normalizeFilePath(decodeURIComponent(pathPart.slice(5)), currentFilePath),
			hash
		};
	}

	if (!PROTOCOL_PATTERN.test(pathPart)) {
		return {
			type: 'file',
			path: normalizeFilePath(pathPart, currentFilePath),
			hash
		};
	}

	if (pathPart.startsWith('mailto:') || pathPart.startsWith('tel:')) {
		return { type: 'external', href: raw };
	}

	return { type: 'url', url: raw };
}
