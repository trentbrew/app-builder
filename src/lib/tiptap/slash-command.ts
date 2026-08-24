import { Extension, type Editor } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

interface SlashItem {
	title: string;
	description: string;
	icon: string;
	command: (props: { editor: Editor; range: { from: number; to: number } }) => void;
}

const items: SlashItem[] = [
	{
		title: 'Heading 1',
		description: 'Large section heading',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12h8M4 18V6M12 18V6M17 12l3-2v8"/></svg>`,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
		}
	},
	{
		title: 'Heading 2',
		description: 'Medium section heading',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12h8M4 18V6M12 18V6M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>`,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
		}
	},
	{
		title: 'Heading 3',
		description: 'Small section heading',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12h8M4 18V6M12 18V6M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2M17.5 17.5c1.7 1 3.5 0 3.5-1.5a2 2 0 0 0-2-2"/></svg>`,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
		}
	},
	{
		title: 'Bullet List',
		description: 'Unordered list',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>`,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleBulletList().run();
		}
	},
	{
		title: 'Ordered List',
		description: 'Numbered list',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/></svg>`,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleOrderedList().run();
		}
	},
	{
		title: 'Task List',
		description: 'Checklist with toggleable items',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4"/><line x1="13" y1="6" x2="21" y2="6"/><line x1="13" y1="12" x2="21" y2="12"/><line x1="13" y1="18" x2="21" y2="18"/></svg>`,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).toggleTaskList().run();
		}
	},
	{
		title: 'Code Block',
		description: 'Fenced code block',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setCodeBlock().run();
		}
	},
	{
		title: 'Mermaid diagram',
		description: 'Flowchart or sequence diagram',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h8m-8 6h16"/><circle cx="17" cy="12" r="3"/></svg>`,
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.insertContent({
					type: 'mermaid',
					attrs: { source: 'graph TD\n  A[Start] --> B[End]' }
				})
				.run();
		}
	},
	{
		title: 'Blockquote',
		description: 'Quote block',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/></svg>`,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setBlockquote().run();
		}
	},
	{
		title: 'Horizontal Rule',
		description: 'Divider line',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="12" x2="22" y2="12"/></svg>`,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).setHorizontalRule().run();
		}
	},
	{
		title: 'Note',
		description: 'Info callout',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4493f8" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.insertContent({ type: 'callout', attrs: { type: 'NOTE' }, content: [{ type: 'paragraph' }] })
				.run();
		}
	},
	{
		title: 'Tip',
		description: 'Helpful tip callout',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3fb950" stroke-width="2" stroke-linecap="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>`,
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.insertContent({ type: 'callout', attrs: { type: 'TIP' }, content: [{ type: 'paragraph' }] })
				.run();
		}
	},
	{
		title: 'Warning',
		description: 'Warning callout',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d29922" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.insertContent({ type: 'callout', attrs: { type: 'WARNING' }, content: [{ type: 'paragraph' }] })
				.run();
		}
	},
	{
		title: 'Caution',
		description: 'Danger/caution callout',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f85149" stroke-width="2" stroke-linecap="round"><path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
		command: ({ editor, range }) => {
			editor
				.chain()
				.focus()
				.deleteRange(range)
				.insertContent({ type: 'callout', attrs: { type: 'CAUTION' }, content: [{ type: 'paragraph' }] })
				.run();
		}
	}
];

function filter(query: string): SlashItem[] {
	const q = query.toLowerCase();
	if (!q) return items;
	return items.filter(
		(item) =>
			item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
	);
}

function position(el: HTMLDivElement, rect: DOMRect) {
	const gap = 4;
	const height = el.offsetHeight || 360;
	const below = window.innerHeight - rect.bottom - gap;
	const above = rect.top - gap;
	el.style.position = 'fixed';
	el.style.left = `${Math.min(rect.left, window.innerWidth - 330)}px`;
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
	let current: SlashItem[] = [];
	let command: SuggestionProps<SlashItem> | null = null;

	function render() {
		if (!el) return;
		el.innerHTML = '';
		if (current.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'slash-empty';
			empty.textContent = 'No results';
			el.appendChild(empty);
			return;
		}
		current.forEach((item, idx) => {
			const row = document.createElement('button');
			row.type = 'button';
			row.className = `slash-item${idx === selected ? ' is-selected' : ''}`;
			row.innerHTML = `<span class="slash-icon">${item.icon}</span><span class="slash-text"><span class="slash-title">${item.title}</span><span class="slash-desc">${item.description}</span></span>`;
			row.addEventListener('mouseenter', () => {
				selected = idx;
				render();
			});
			row.addEventListener('mousedown', (e) => e.preventDefault());
			row.addEventListener('click', () => {
				if (command) item.command(command as never);
			});
			el!.appendChild(row);
		});
		el.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest' });
	}

	return {
		onStart(props: SuggestionProps<SlashItem>) {
			command = props;
			el = document.createElement('div');
			el.className = 'slash-menu';
			el.addEventListener('mousedown', (e) => e.preventDefault());
			current = props.items;
			selected = 0;
			render();
			const rect = props.clientRect?.();
			if (rect) position(el, rect);
			document.body.appendChild(el);
		},
		onUpdate(props: SuggestionProps<SlashItem>) {
			command = props;
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
				if (current[selected] && command) current[selected].command(command as never);
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

export const SlashCommand = Extension.create({
	name: 'slashCommand',

	addProseMirrorPlugins() {
		return [
			Suggestion({
				editor: this.editor,
				pluginKey: new PluginKey('slashCommand'),
				char: '/',
				startOfLine: true,
				allow: ({ state, range }) => {
					const $from = state.doc.resolve(range.from);
					for (let d = $from.depth; d > 0; d--) {
						if ($from.node(d).type.spec.code) return false;
					}
					const marks = state.storedMarks ?? $from.marks();
					if (marks.some((m) => m.type.spec.code)) return false;
					return true;
				},
				items: ({ query }) => filter(query),
				command: ({ editor, range, props }) => {
					(props as SlashItem).command({ editor, range });
				},
				render: () => popup()
			})
		];
	}
});
