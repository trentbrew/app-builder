/** @module pathAllowlist — guest sandbox write allowlist for agent harness */

/**
 * Reduce a path to a sandbox-relative form with all `.` and `..` segments resolved.
 *
 * Resolution must happen BEFORE the allowlist match, not after. Stripping only
 * the leading slash left `components/../../../etc/passwd` matching the
 * `^components/` allow rule while actually pointing outside the sandbox. That
 * was latent while paths came from `editComponent.ts` (human-chosen, fixed);
 * it became reachable when the agent tool pipeline let a model supply the path.
 *
 * Returns `''` for anything that escapes the root, which `isGuestPathWritable`
 * rejects — escaping is not representable rather than merely disallowed.
 */
export function normalizeGuestPath(path: string): string {
	const segments = path.replace(/\\/g, '/').split('/');
	const resolved: string[] = [];

	for (const segment of segments) {
		if (!segment || segment === '.') continue;
		if (segment === '..') {
			if (resolved.length === 0) return '';
			resolved.pop();
			continue;
		}
		resolved.push(segment);
	}

	return resolved.join('/');
}

const DENY_PATTERNS = [
	/lib\/agent-sdk\//,
	/^package\.json$/,
	/^vite\.config/,
	/^svelte\.config/,
	/^index\.html$/,
	/^main\.js$/
];

const ALLOW_PATTERNS = [
	/^App\.svelte$/,
	/^agent\.manifest\.json$/,
	/^components\//,
	/^src\//,
	/^app\//,
	/^lib\//,
	/^styles\//,
	/^public\//,
	/^pages\//,
	/^routes\//
];

/** Whether agent/human may write this guest sandbox path. */
export function isGuestPathWritable(path: string): boolean {
	const p = normalizeGuestPath(path);
	if (!p) return false;
	if (DENY_PATTERNS.some((re) => re.test(p))) return false;
	return ALLOW_PATTERNS.some((re) => re.test(p));
}

/** Whether agent/guest may read this sandbox path. */
export function isGuestPathReadable(path: string): boolean {
	const p = normalizeGuestPath(path);
	if (!p) return false;
	if (p.startsWith('.git/') || p.startsWith('.sandboxes/')) return false;
	return true;
}
