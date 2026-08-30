/** @module pathAllowlist — guest sandbox write allowlist for agent harness */
export function normalizeGuestPath(path: string): string {
	return path.replace(/^\/+/, '');
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
	/^components\//
];

/** Whether agent/human may write this guest sandbox path. */
export function isGuestPathWritable(path: string): boolean {
	const p = normalizeGuestPath(path);
	if (!p) return false;
	if (DENY_PATTERNS.some((re) => re.test(p))) return false;
	return ALLOW_PATTERNS.some((re) => re.test(p));
}
