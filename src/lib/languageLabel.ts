export function languageLabelForPath(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase() ?? '';

	switch (ext) {
		case 'svelte':
			return 'Svelte';
		case 'js':
			return 'JavaScript';
		case 'mjs':
			return 'JavaScript';
		case 'cjs':
			return 'JavaScript';
		case 'jsx':
			return 'JavaScript JSX';
		case 'ts':
			return 'TypeScript';
		case 'tsx':
			return 'TypeScript JSX';
		case 'json':
		case 'jsonc':
			return 'JSON';
		case 'css':
			return 'CSS';
		case 'scss':
			return 'SCSS';
		case 'sass':
			return 'Sass';
		case 'less':
			return 'Less';
		case 'html':
		case 'htm':
			return 'HTML';
		case 'md':
		case 'markdown':
			return 'Markdown';
		default:
			return 'Plain Text';
	}
}
