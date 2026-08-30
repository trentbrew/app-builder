import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';
import { Mention } from '$lib/tiptap/mention';
import { MentionSuggestion } from '$lib/tiptap/mention-suggestion';
import type { MentionItem } from '$lib/tiptap/mention-suggestion';
import { createAgentSlashCommand, type AgentSlashItem } from '$lib/tiptap/agent-slash-command';

export type AgentComposerExtensionOptions = {
	placeholder?: string;
	mentionSearch?: (query: string) => MentionItem[] | Promise<MentionItem[]>;
	slashItems?: AgentSlashItem[];
};

export function createAgentComposerExtensions(options: AgentComposerExtensionOptions = {}): Extensions {
	return [
		StarterKit.configure({
			heading: false,
			bulletList: false,
			orderedList: false,
			blockquote: false,
			codeBlock: false,
			horizontalRule: false,
			listItem: false,
			code: false,
			bold: false,
			italic: false,
			strike: false,
		}),
		Mention,
		Markdown.configure({
			markedOptions: { gfm: true },
		}),
		Placeholder.configure({
			placeholder: options.placeholder ?? 'Message agent…',
			emptyEditorClass: 'is-editor-empty',
		}),
		MentionSuggestion.configure({
			char: '@',
			search: options.mentionSearch ?? (() => []),
		}),
		createAgentSlashCommand(options.slashItems),
	];
}
