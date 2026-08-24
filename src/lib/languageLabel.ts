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
		case 'csv':
			return 'CSV';
		case 'tsv':
		case 'tab':
			return 'TSV';
		case 'pdf':
			return 'PDF';
		case 'mp4':
		case 'webm':
		case 'ogv':
		case 'mov':
		case 'm4v':
			return 'Video';
		case 'mp3':
		case 'wav':
		case 'flac':
		case 'aac':
		case 'm4a':
		case 'ogg':
		case 'oga':
		case 'opus':
			return 'Audio';
		case 'png':
		case 'jpg':
		case 'jpeg':
		case 'gif':
		case 'webp':
		case 'avif':
		case 'bmp':
		case 'ico':
			return 'Image';
		default:
			return 'Plain Text';
	}
}
