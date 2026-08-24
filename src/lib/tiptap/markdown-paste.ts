import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const markdownPatterns = [
	/^#{1,6}\s+/m,
	/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/im,
	/^>\s+/m,
	/^[-*+]\s+/m,
	/^[-*+]\s+\[[ xX]\]\s+/m,
	/^\d+\.\s+/m,
	/^```/m,
	/\[\[[^\]]+\]\]/,
	/\[.+\]\(.+\)/,
	/\*\*.+\*\*/,
	/__.+__/,
	/~~.+~~/,
	/`[^`]+`/,
	/^\|.+\|/m,
	/^---+$/m,
	/^\*\*\*+$/m
];

function looksLikeMarkdown(text: string): boolean {
	if (!text || text.length < 2) return false;
	const trimmed = text.trim();
	if (trimmed.startsWith('---\n') && trimmed.includes('\n---')) return true;
	return markdownPatterns.some((pattern) => pattern.test(text));
}

function shouldPreferMarkdownPaste(text: string, html: string): boolean {
	if (!text.trim()) return false;
	if (looksLikeMarkdown(text)) return true;
	if (!html) return false;

	const doc = new DOMParser().parseFromString(html, 'text/html');
	const plainFromHtml = doc.body.textContent?.trim() ?? '';
	if (plainFromHtml === text.trim()) return looksLikeMarkdown(text);
	return false;
}

export const MarkdownPaste = Extension.create({
	name: 'markdownPaste',

	addProseMirrorPlugins() {
		const editor = this.editor;

		return [
			new Plugin({
				key: new PluginKey('markdownPaste'),
				props: {
					handlePaste(_view, event) {
						const clipboardData = event.clipboardData;
						if (!clipboardData) return false;

						if (clipboardHasImage(clipboardData)) return false;

						const text = clipboardData.getData('text/plain');
						const html = clipboardData.getData('text/html');
						if (!text) return false;

						if (!shouldPreferMarkdownPaste(text, html)) return false;

						event.preventDefault();

						const { from, to } = editor.state.selection;
						editor
							.chain()
							.focus()
							.insertContentAt({ from, to }, text, {
								contentType: 'markdown',
								parseOptions: { preserveWhitespace: 'full' }
							})
							.run();

						return true;
					}
				}
			})
		];
	}
});
