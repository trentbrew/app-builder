import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Callout } from '$lib/tiptap/callout';
import { Mermaid } from '$lib/tiptap/mermaid';
import { ImagePaste } from '$lib/tiptap/image-paste';
import { MarkdownPaste } from '$lib/tiptap/markdown-paste';
import { SlashCommand } from '$lib/tiptap/slash-command';
import { Mention } from '$lib/tiptap/mention';
import { MentionSuggestion } from '$lib/tiptap/mention-suggestion';
import type { MentionItem } from '$lib/tiptap/mention-suggestion';

export type MarkdownExtensionOptions = {
	mode?: 'editor' | 'view';
	placeholder?: string;
	onNavigateFile?: (path: string) => void;
	mentionSearch?: (query: string) => MentionItem[] | Promise<MentionItem[]>;
};

const sharedExtensions = (options: MarkdownExtensionOptions) => [
	StarterKit,
	TaskList,
	TaskItem.configure({ nested: true }),
	Image.configure({
		inline: false,
		allowBase64: true,
		HTMLAttributes: { class: 'markdown-image' },
	}),
	Callout,
	Mermaid,
	Mention.configure({
		onNavigate: ({ id }) => options.onNavigateFile?.(id),
	}),
	Markdown,
];

export function createMarkdownExtensions(options: MarkdownExtensionOptions = {}): Extensions {
	const mode = options.mode ?? 'editor';

	if (mode === 'view') {
		return sharedExtensions(options);
	}

	return [
		...sharedExtensions(options),
		Placeholder.configure({
			placeholder: options.placeholder ?? 'Type something…',
			emptyEditorClass: 'is-editor-empty',
		}),
		MentionSuggestion.configure({
			char: '@',
			search: options.mentionSearch ?? (() => []),
		}),
		SlashCommand,
		ImagePaste,
		MarkdownPaste,
	];
}
