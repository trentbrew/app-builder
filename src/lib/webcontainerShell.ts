import type { WebContainer } from '@webcontainer/api';

/**
 * Default jsh aliases for WebContainer terminals.
 * jsh syntax: `alias NAME cmd arg...` (not bash `name='cmd'`).
 * Loaded from ~/.jshrc when jsh starts — see StackBlitz WebContainer docs.
 */
export const DEFAULT_JSHRC = `# App Builder — WebContainer shell defaults
export PATH="$PWD/node_modules/.bin:$PATH"
alias l ls -al
alias ll ls -l
alias la ls -A
alias .. cd ..
`;

/**
 * jshrc paths relative to the project workdir.
 * Absolute paths like `/home/.jshrc` are resolved under the workdir (e.g.
 * `/home/project-expo/home/.jshrc`) and fail with ENOENT — use relatives only.
 */
const JSHRC_PATHS = ['.jshrc', '../.jshrc'] as const;

/** Write jsh aliases for new terminal sessions. */
export async function ensureWebContainerShellConfig(container: WebContainer): Promise<void> {
	for (const jshrcPath of JSHRC_PATHS) {
		try {
			await container.fs.writeFile(jshrcPath, DEFAULT_JSHRC);
		} catch (error) {
			console.warn(`Failed to write WebContainer .jshrc at ${jshrcPath}:`, error);
		}
	}
}
