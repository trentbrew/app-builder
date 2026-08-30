import { Extension, type Editor } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

export interface AgentSlashItem {
	title: string;
	description: string;
	icon: string;
	command: (props: { editor: Editor; range: { from: number; to: number } }) => void;
}

/** Placeholder agent slash commands — configurable via toolbar context menu (backlog). */
export const DEFAULT_AGENT_SLASH_ITEMS: AgentSlashItem[] = [
	{
		title: 'Add context',
		description: 'Attach open files to this message',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).insertContent('Add context from workspace ').run();
		},
	},
	{
		title: 'Run command',
		description: 'Execute a shell command in the terminal',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).insertContent('/terminal ').run();
		},
	},
	{
		title: 'Review diff',
		description: 'Summarize recent file changes',
		icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/></svg>`,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).insertContent('Review the current diff ').run();
		},
	},
];

function filter(items: AgentSlashItem[], query: string) {
	const q = query.toLowerCase();
	if (!q) return items;
	return items.filter(
		(item) => item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
	);
}

function popup() {
	let el: HTMLDivElement | null = null;
	let selected = 0;
	let current: AgentSlashItem[] = [];
	let command: SuggestionProps<AgentSlashItem> | null = null;

	function render() {
		if (!el) return;
		el.innerHTML = '';
		if (current.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'slash-empty';
			empty.textContent = 'No commands';
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
			row.addEventListener('mousedown', (event) => event.preventDefault());
			row.addEventListener('click', () => {
				if (command) item.command(command as never);
			});
			el.appendChild(row);
		});
	}

	return {
		onStart(props: SuggestionProps<AgentSlashItem>) {
			command = props;
			current = props.items;
			selected = 0;
			el = document.createElement('div');
			el.className = 'slash-menu';
			document.body.appendChild(el);
			render();
			const rect = props.clientRect?.();
			if (rect) {
				el.style.position = 'fixed';
				el.style.left = `${rect.left}px`;
				el.style.top = `${rect.bottom + 4}px`;
			}
		},
		onUpdate(props: SuggestionProps<AgentSlashItem>) {
			command = props;
			current = props.items;
			selected = 0;
			render();
			const rect = props.clientRect?.();
			if (rect && el) {
				el.style.left = `${rect.left}px`;
				el.style.top = `${rect.bottom + 4}px`;
			}
		},
		onKeyDown(props: SuggestionKeyDownProps) {
			if (props.event.key === 'ArrowDown') {
				selected = (selected + 1) % Math.max(current.length, 1);
				render();
				return true;
			}
			if (props.event.key === 'ArrowUp') {
				selected = (selected - 1 + current.length) % Math.max(current.length, 1);
				render();
				return true;
			}
			if (props.event.key === 'Enter') {
				if (current[selected] && command) current[selected].command(command as never);
				return true;
			}
			if (props.event.key === 'Escape') return true;
			return false;
		},
		onExit() {
			el?.remove();
			el = null;
		},
	};
}

export function createAgentSlashCommand(items: AgentSlashItem[] = DEFAULT_AGENT_SLASH_ITEMS) {
	return Extension.create({
		name: 'agentSlashCommand',

		addProseMirrorPlugins() {
			return [
				Suggestion({
					editor: this.editor,
					pluginKey: new PluginKey('agentSlashCommand'),
					char: '/',
					startOfLine: false,
					allow: ({ state, range }) => {
						const $from = state.doc.resolve(range.from);
						for (let d = $from.depth; d > 0; d--) {
							if ($from.node(d).type.spec.code) return false;
						}
						return true;
					},
					items: ({ query }) => filter(items, query),
					command: ({ editor, range, props }) => {
						(props as AgentSlashItem).command({ editor, range });
					},
					render: () => popup(),
				}),
			];
		},
	});
}
