<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { EditorState } from '@codemirror/state';
	import {
		EditorView,
		keymap,
		highlightSpecialChars,
		drawSelection,
		highlightActiveLine,
		dropCursor,
		lineNumbers,
		highlightActiveLineGutter
	} from '@codemirror/view';
	import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
	import {
		syntaxHighlighting,
		defaultHighlightStyle,
		bracketMatching,
		foldGutter,
		indentOnInput
	} from '@codemirror/language';
	import {
		autocompletion,
		closeBrackets,
		closeBracketsKeymap,
		completionKeymap
	} from '@codemirror/autocomplete';
	import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
	import { html } from '@codemirror/lang-html';
	import { oneDark } from '@codemirror/theme-one-dark';
	import FileExplorer from '$lib/FileExplorer.svelte';

	// Props from parent
	export let data: {
		label?: string;
		onFileSelect?: (path: string, content: string) => void;
		onRun?: () => void;
		initialCode?: string;
		setEditorView?: (view: EditorView) => void;
	} = {};

	let editorContainer: HTMLDivElement;
	let localEditorView: EditorView | null = null;

	onMount(async () => {
		if (!browser) return;

		// Wait for DOM to be fully ready
		await new Promise((resolve) => setTimeout(resolve, 100));

		if (!editorContainer) {
			console.error('Editor container not found');
			return;
		}

		console.log('Editor container DOM element:', editorContainer);
		const state = EditorState.create({
			doc: data.initialCode || '',
			extensions: [
				oneDark,
				autocompletion(),
				lineNumbers(),
				highlightActiveLineGutter(),
				highlightSpecialChars(),
				history(),
				foldGutter(),
				drawSelection(),
				dropCursor(),
				EditorState.allowMultipleSelections.of(true),
				indentOnInput(),
				syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
				bracketMatching(),
				closeBrackets(),
				highlightActiveLine(),
				highlightSelectionMatches(),
				keymap.of([
					...closeBracketsKeymap,
					...completionKeymap,
					...defaultKeymap,
					...searchKeymap,
					...historyKeymap,
					indentWithTab
				]),
				html()
			]
		});

		localEditorView = new EditorView({ state, parent: editorContainer });

		// Update parent's editorView reference
		if (data.setEditorView !== undefined) {
			data.setEditorView(localEditorView);
		}
	});

	onDestroy(() => {
		if (localEditorView) {
			localEditorView.destroy();
		}
	});
</script>

<div class="border-border bg-card flex h-full w-full flex-col overflow-hidden rounded border">
	<div
		class="drag-handle border-border bg-muted text-muted-foreground border-b px-2 py-1 text-xs font-semibold"
	>
		{data.label ?? 'Editor'}
	</div>

	<div class="flex h-full overflow-hidden">
		<!-- File Explorer -->
		<div class="border-border bg-muted/50 w-48 flex-shrink-0 overflow-y-auto border-r">
			<FileExplorer onSelectFile={data.onFileSelect} />
		</div>

		<!-- Editor Main Area -->
		<div class="flex flex-1 flex-col overflow-hidden">
			<!-- Editor Controls -->
			<div class="border-border bg-muted/30 flex justify-end border-b p-2">
				<button
					class="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-3 py-1 text-xs transition-colors"
					on:click={data.onRun}
				>
					Run
				</button>
			</div>

			<!-- Editor Container -->
			<div bind:this={editorContainer} class="nodrag nowheel flex-1 overflow-hidden"></div>
		</div>
	</div>
</div>

<style>
	/* CodeMirror styling overrides */
	:global(.cm-editor) {
		height: 100%;
		font-size: 12px;
	}

	:global(.cm-focused) {
		outline: none;
	}

	:global(.cm-scroller) {
		font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
	}
</style>
