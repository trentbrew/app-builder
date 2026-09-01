import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

export const lowlight = createLowlight(common);

lowlight.registerAlias({
	js: 'javascript',
	ts: 'typescript',
	sh: 'bash',
	zsh: 'bash',
	yml: 'yaml',
	md: 'markdown',
	svelte: 'xml',
	html: 'xml',
	htm: 'xml',
});

export const MarkdownCodeBlock = CodeBlockLowlight.extend({
	parseMarkdown(token, helpers) {
		if ((token.lang ?? '').toLowerCase() === 'mermaid') {
			return [];
		}
		return this.parent?.(token, helpers) ?? [];
	},
}).configure({
	lowlight,
	defaultLanguage: 'plaintext',
});
