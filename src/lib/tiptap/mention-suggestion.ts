import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

export interface MentionItem {
	type: 'file';
	id: string;
	label: string;
	detail?: string;
}

export interface MentionSuggestionOptions {
	char: string;
	search: (query: string) => Promise<MentionItem[]> | MentionItem[];
}

const FILE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

function position(el: HTMLDivElement, rect: DOMRect) {
	const gap = 4;
	const height = el.offsetHeight || 300;
	const below = window.innerHeight - rect.bottom - gap;
	const above = rect.top - gap;
	el.style.position = 'fixed';
	el.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
	if (below >= height || below >= above) {
		el.style.top = `${rect.bottom + gap}px`;
		el.style.bottom = '';
	} else {
		el.style.bottom = `${window.innerHeight - rect.top + gap}px`;
		el.style.top = '';
	}
}

function popup() {
	let el: HTMLDivElement | null = null;
	let selected = 0;
	let current: MentionItem[] = [];
	let cmd: SuggestionProps<MentionItem> | null = null;

	function render() {
		if (!el) return;
		el.innerHTML = '';
		if (current.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'mention-suggestion-empty';
			empty.textContent = 'No files found';
			el.appendChild(empty);
			return;
		}

		current.forEach((item, idx) => {
			const row = document.createElement('button');
			row.type = 'button';
			row.className = `mention-suggestion-item${idx === selected ? ' is-selected' : ''}`;

			const icon = document.createElement('span');
			icon.className = 'mention-suggestion-icon';
			icon.innerHTML = FILE_ICON;
			row.appendChild(icon);

			const text = document.createElement('span');
			text.className = 'mention-suggestion-text';

			const name = document.createElement('span');
			name.className = 'mention-suggestion-name';
			name.textContent = item.label;
			text.appendChild(name);

			if (item.detail) {
				const detail = document.createElement('span');
				detail.className = 'mention-suggestion-detail';
				detail.textContent = item.detail;
				text.appendChild(detail);
			}

			row.appendChild(text);
			row.addEventListener('mouseenter', () => {
				selected = idx;
				render();
			});
			row.addEventListener('mousedown', (e) => e.preventDefault());
			row.addEventListener('click', () => {
				cmd?.command({ id: item.id, type: item.type, label: item.label });
			});
			el!.appendChild(row);
		});

		el.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
	}

	return {
		onStart(props: SuggestionProps<MentionItem>) {
			cmd = props;
			el = document.createElement('div');
			el.className = 'mention-suggestion-menu';
			el.addEventListener('mousedown', (e) => e.preventDefault());
			current = props.items;
			selected = 0;
			render();
			const rect = props.clientRect?.();
			if (rect) position(el, rect);
			document.body.appendChild(el);
		},
		onUpdate(props: SuggestionProps<MentionItem>) {
			cmd = props;
			current = props.items;
			selected = Math.min(selected, Math.max(current.length - 1, 0));
			if (selected < 0) selected = 0;
			render();
			const rect = props.clientRect?.();
			if (rect && el) position(el, rect);
		},
		onKeyDown({ event }: SuggestionKeyDownProps) {
			if (event.key === 'ArrowDown') {
				selected = (selected + 1) % Math.max(current.length, 1);
				render();
				return true;
			}
			if (event.key === 'ArrowUp') {
				selected = (selected - 1 + current.length) % Math.max(current.length, 1);
				render();
				return true;
			}
			if (event.key === 'Enter') {
				if (current[selected]) {
					cmd?.command({
						id: current[selected].id,
						type: current[selected].type,
						label: current[selected].label
					});
				}
				return true;
			}
			if (event.key === 'Escape') return true;
			return false;
		},
		onExit() {
			el?.remove();
			el = null;
		}
	};
}

export const MentionSuggestion = Extension.create<MentionSuggestionOptions>({
	name: 'mentionSuggestion',

	addOptions() {
		return {
			char: '@',
			search: () => []
		};
	},

	addProseMirrorPlugins() {
		const search = this.options.search;
		return [
			Suggestion({
				editor: this.editor,
				pluginKey: new PluginKey('mentionSuggestion'),
				char: this.options.char,
				allow: ({ state, range }) => {
					const $from = state.doc.resolve(range.from);
					for (let d = $from.depth; d > 0; d--) {
						if ($from.node(d).type.spec.code) return false;
					}
					const marks = state.storedMarks ?? $from.marks();
					if (marks.some((m) => m.type.spec.code)) return false;
					return true;
				},
				items: async ({ query }) => {
					const results = await search(query);
					return results.slice(0, 20);
				},
				command: ({ editor, range, props }) => {
					const attrs = props as { id: string; type: 'file'; label: string };
					editor
						.chain()
						.focus()
						.deleteRange(range)
						.insertContent({
							type: 'mention',
							attrs: { type: attrs.type, id: attrs.id, label: attrs.label }
						})
						.run();
				},
				render: () => popup()
			})
		];
	}
});
