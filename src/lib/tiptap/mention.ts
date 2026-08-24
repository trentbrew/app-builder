import { Node, mergeAttributes } from '@tiptap/core';
import type { MarkdownParseHelpers, MarkdownToken } from '@tiptap/core';
import { parseWikiLink } from '$lib/wikiLink';

const FILE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

export interface MentionOptions {
	onNavigate?: (attrs: { type: string; id: string }) => void;
}

export const Mention = Node.create<MentionOptions>({
	name: 'mention',
	group: 'inline',
	inline: true,
	atom: true,
	selectable: true,

	addOptions() {
		return {
			onNavigate: undefined
		};
	},

	addAttributes() {
		return {
			type: {
				default: 'file',
				parseHTML: (el) => el.getAttribute('data-mention-type') || 'file',
				renderHTML: (attrs) => ({ 'data-mention-type': attrs.type })
			},
			id: {
				default: '',
				parseHTML: (el) => el.getAttribute('data-mention-id') || '',
				renderHTML: (attrs) => ({ 'data-mention-id': attrs.id })
			},
			label: {
				default: '',
				parseHTML: (el) => el.getAttribute('data-mention-label') || el.textContent || '',
				renderHTML: (attrs) => ({ 'data-mention-label': attrs.label })
			}
		};
	},

	markdownTokenName: 'mention' as never,

	markdownTokenizer: {
		name: 'mention',
		level: 'inline' as const,
		start(src: string) {
			return src.indexOf('[[');
		},
		tokenize(src: string) {
			const match = src.match(/^\[\[([^\]]+)\]\]/);
			if (!match) return undefined;
			const raw = match[0];
			const parsed = parseWikiLink(match[1]!);
			if (!parsed) return undefined;
			return {
				type: 'mention',
				raw,
				id: parsed.id,
				mentionType: parsed.kind,
				label: parsed.label
			};
		}
	} as never,

	parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
		const t = token as MarkdownToken & { id: string; mentionType: string; label?: string };
		const id = t.id || '';
		const type = t.mentionType || 'file';
		const label = t.label || id.split('/').pop() || id;
		return helpers.createNode('mention', { type, id, label });
	},

	renderMarkdown(node: { attrs?: { id?: string; label?: string } }) {
		const id = node.attrs?.id || '';
		const label = node.attrs?.label;
		if (label && label !== id && !label.includes('/')) {
			return `[[${id}|${label}]]`;
		}
		return `[[${id}]]`;
	},

	parseHTML() {
		return [{ tag: 'span[data-mention-id]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'span',
			mergeAttributes(HTMLAttributes, { class: 'mention-node', contenteditable: 'false' })
		];
	},

	addNodeView() {
		return ({ node }) => {
			const dom = document.createElement('span');
			dom.className = 'mention-node';
			dom.contentEditable = 'false';
			dom.setAttribute('data-mention-type', node.attrs.type);
			dom.setAttribute('data-mention-id', node.attrs.id);

			const icon = document.createElement('span');
			icon.className = 'mention-icon';
			icon.innerHTML = FILE_ICON;
			dom.appendChild(icon);

			const label = document.createElement('span');
			label.className = 'mention-label';
			label.textContent = node.attrs.label || node.attrs.id;
			dom.appendChild(label);

			const opts = this.options;
			dom.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				opts.onNavigate?.({ type: node.attrs.type, id: node.attrs.id });
			});

			return { dom };
		};
	}
});
