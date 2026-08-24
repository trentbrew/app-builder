import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { svelte } from '@replit/codemirror-lang-svelte';
import type { Extension } from '@codemirror/state';

export function languageExtensionForPath(path: string): Extension {
	const ext = path.split('.').pop()?.toLowerCase() ?? '';

	switch (ext) {
		case 'svelte':
			return svelte();
		case 'js':
		case 'mjs':
		case 'cjs':
			return javascript();
		case 'jsx':
			return javascript({ jsx: true });
		case 'ts':
			return javascript({ typescript: true });
		case 'tsx':
			return javascript({ jsx: true, typescript: true });
		case 'json':
		case 'jsonc':
			return json();
		case 'css':
		case 'scss':
		case 'sass':
		case 'less':
			return css();
		case 'html':
		case 'htm':
			return html();
		case 'md':
		case 'markdown':
			return markdown();
		default:
			return [];
	}
}
