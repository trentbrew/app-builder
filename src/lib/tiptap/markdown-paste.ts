import { Extension, type Editor, type JSONContent } from '@tiptap/core';
import { Fragment, Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { clipboardHasImage } from '$lib/tiptap/clipboard';

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

function plainTextFromHtml(html: string): string {
	if (!html.trim()) return '';
	const doc = new DOMParser().parseFromString(html, 'text/html');
	return doc.body.textContent ?? '';
}

/**
 * Detect clipboard HTML that only wraps source text — pre/code blocks from plain
 * editors, or syntax-highlighted span trees from VS Code / Cursor.
 */
function htmlIsSourceWrapper(html: string, text: string): boolean {
	if (!html.trim() || !text.trim()) return false;

	const doc = new DOMParser().parseFromString(html, 'text/html');
	const body = doc.body;
	const htmlText = body.textContent?.trim() ?? '';
	if (htmlText !== text.trim()) return false;

	// Real rich content — let the HTML paste path handle it.
	if (body.querySelector('[data-pm-slice], table, img, a[href], h1, h2, h3, h4, h5, h6, p, li')) {
		return false;
	}

	if (body.querySelector('pre, code')) return true;

	// VS Code / Cursor syntax-highlighted markdown copies.
	return Boolean(body.querySelector('span[style], span[class], div[style], div[class]'));
}

function shouldPreferMarkdownPaste(text: string, html: string): boolean {
	const trimmed = text.trim();
	const htmlText = plainTextFromHtml(html).trim();
	const candidate = trimmed || htmlText;

	if (!candidate) return false;
	if (looksLikeMarkdown(candidate)) return true;
	if (htmlIsSourceWrapper(html, candidate)) return true;

	if (!html.trim()) return false;
	if (htmlText && htmlText === trimmed) return looksLikeMarkdown(trimmed);
	return false;
}

function parseMarkdownNodes(editor: Editor, text: string) {
	if (!editor.markdown) return null;

	const doc = editor.markdown.parse(text) as JSONContent;
	const jsonNodes = doc.content ?? [];
	if (!jsonNodes.length) return null;

	return jsonNodes.map((node) => editor.schema.nodeFromJSON(node));
}

function parseMarkdownSlice(editor: Editor, text: string): Slice | null {
	const nodes = parseMarkdownNodes(editor, text);
	if (!nodes?.length) return null;
	return new Slice(Fragment.fromArray(nodes), 0, 0);
}

function insertParsedMarkdown(editor: Editor, text: string, from: number, to: number): boolean {
	const nodes = parseMarkdownNodes(editor, text);
	if (!nodes?.length) return false;

	let insertFrom = from;
	let insertTo = to;

	if (insertFrom === insertTo) {
		const $pos = editor.state.doc.resolve(insertFrom);
		const parent = $pos.parent;
		const isEmptyTextBlock =
			parent.isTextblock && !parent.type.spec.code && parent.content.size === 0;
		if (isEmptyTextBlock) {
			insertFrom -= 1;
			insertTo += 1;
		}
	}

	const { tr } = editor.state;
	tr.replaceWith(insertFrom, insertTo, nodes);
	editor.view.dispatch(tr.scrollIntoView());
	return true;
}

function pasteMarkdown(editor: Editor, view: EditorView, event: ClipboardEvent): boolean {
	const clipboardData = event.clipboardData;
	if (!clipboardData) return false;
	if (clipboardHasImage(clipboardData)) return false;

	const text = clipboardData.getData('text/plain');
	const html = clipboardData.getData('text/html');
	const markdownText = text.trim() || plainTextFromHtml(html).trim();
	if (!markdownText) return false;
	if (!shouldPreferMarkdownPaste(text, html)) return false;
	if (!editor.markdown) return false;

	const { from, to } = editor.state.selection;
	if (!insertParsedMarkdown(editor, markdownText, from, to)) return false;

	event.preventDefault();
	return true;
}

export const MarkdownPaste = Extension.create({
	name: 'markdownPaste',
	priority: 1000,

	addProseMirrorPlugins() {
		const editor = this.editor;

		return [
			new Plugin({
				key: new PluginKey('markdownPaste'),
				props: {
					handleDOMEvents: {
						paste(view, event) {
							return pasteMarkdown(editor, view, event);
						}
					},
					clipboardTextParser(text) {
						if (!shouldPreferMarkdownPaste(text, '')) return null;
						return parseMarkdownSlice(editor, text);
					},
					handlePaste(_view, event) {
						// Fallback if a browser bypasses handleDOMEvents.
						return pasteMarkdown(editor, _view, event);
					}
				}
			})
		];
	}
});
