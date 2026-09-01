import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table/kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import DragHandle from '@tiptap/extension-drag-handle';
import FindAndReplace from '@tiptap/extension-find-and-replace';
import CharacterCount from '@tiptap/extension-character-count';
import { Callout } from '$lib/tiptap/callout';
import { MarkdownCodeBlock } from '$lib/tiptap/code-block-lowlight.js';
import { MarkdownLink } from '$lib/tiptap/markdown-link.js';
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
	onOpenUrl?: (url: string) => void;
	getCurrentFilePath?: () => string | undefined;
	mentionSearch?: (query: string) => MentionItem[] | Promise<MentionItem[]>;
};

const sharedExtensions = (options: MarkdownExtensionOptions) => [
	StarterKit.configure({
		codeBlock: false,
		link: false,
	}),
	Mermaid,
	MarkdownCodeBlock,
	MarkdownLink.configure({
		onNavigateFile: options.onNavigateFile,
		onOpenUrl: options.onOpenUrl,
		getCurrentFilePath: options.getCurrentFilePath,
	}),
	TableKit.configure({
		table: { renderWrapper: true },
	}),
	TaskList,
	TaskItem.configure({ nested: true }),
	Image.configure({
		inline: false,
		allowBase64: true,
		HTMLAttributes: { class: 'markdown-image' },
	}),
	Callout,
	Mention.configure({
		onNavigate: ({ id }) => options.onNavigateFile?.(id),
	}),
	Markdown.configure({
		markedOptions: { gfm: true },
	}),
];

export function createMarkdownExtensions(options: MarkdownExtensionOptions = {}): Extensions {
	const mode = options.mode ?? 'editor';

	if (mode === 'view') {
		return sharedExtensions(options);
	}

	return [
		// High-priority paste handlers register first so they run before HTML/code-block paste.
		ImagePaste,
		...sharedExtensions(options),
		MarkdownPaste,
		Placeholder.configure({
			placeholder: options.placeholder ?? 'Type something…',
			emptyEditorClass: 'is-editor-empty',
		}),
		CharacterCount,
		FindAndReplace.configure({
			searchDebounceMs: 150,
		}),
		DragHandle.configure({
			nested: true,
			render: () => {
				const element = document.createElement('div');
				element.classList.add('markdown-drag-handle');
				element.setAttribute('aria-hidden', 'true');
				return element;
			},
			computePositionConfig: {
				placement: 'left-start',
				strategy: 'absolute',
			},
		}),
		MentionSuggestion.configure({
			char: '@',
			search: options.mentionSearch ?? (() => []),
		}),
		SlashCommand,
	];
}
