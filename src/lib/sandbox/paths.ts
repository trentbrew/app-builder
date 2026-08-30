/** WebContainer paths are relative to the workdir — no leading slash. */
export function normalizeSandboxPath(path: string): string {
	return path.replace(/^\/+/, '');
}
