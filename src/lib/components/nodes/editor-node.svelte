<script lang="ts">
	import { onMount } from 'svelte';
	import {
		EditorView,
		lineNumbers,
		highlightActiveLineGutter,
		highlightSpecialChars,
		drawSelection,
		dropCursor,
		rectangularSelection,
		crosshairCursor,
		keymap,
		highlightActiveLine
	} from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
	import {
		foldGutter,
		indentOnInput,
		bracketMatching,
		syntaxHighlighting,
		defaultHighlightStyle
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
	import { codeCanvasState, codeCanvasActions } from '../../../routes/code-canvas/state.svelte';

	// Props from parent using Svelte 5 runes
	const {
		data = {}
	}: {
		data?: {
			label?: string;
			setEditorView?: (view: EditorView) => void;
		};
	} = $props();

	let editorContainer: HTMLDivElement;
	let editorView: EditorView;

	onMount(() => {
		// Initialize CodeMirror
		const state = EditorState.create({
			doc: codeCanvasState.editorContent || '',
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
				html(),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						const content = update.state.doc.toString();
						codeCanvasActions.updateEditorContent(content);
					}
				})
			]
		});

		editorView = new EditorView({
			state,
			parent: editorContainer
		});

		// Pass editor view to parent if callback provided
		if (data.setEditorView) {
			data.setEditorView(editorView);
		}

		return () => {
			editorView.destroy();
		};
	});

	// Update editor content when shared state changes (but avoid infinite loops)
	$effect(() => {
		if (editorView && codeCanvasState.editorContent !== editorView.state.doc.toString()) {
			const transaction = editorView.state.update({
				changes: {
					from: 0,
					to: editorView.state.doc.length,
					insert: codeCanvasState.editorContent
				}
			});
			editorView.dispatch(transaction);
		}
	});
</script>

<div class="border-border bg-card flex h-full w-full flex-col overflow-hidden rounded border">
	<div
		class="drag-handle border-border bg-muted text-muted-foreground flex items-center justify-between border-b px-2 py-1 text-xs font-semibold"
	>
		<span>{data.label ?? 'Editor'}</span>
		<div class="flex items-center gap-1">
			<button
				class="hover:bg-muted-foreground/20 rounded px-1 py-0.5 text-xs transition-colors"
				title="Run code"
				onclick={codeCanvasActions.runCode}
			>
				▶️ Run
			</button>
		</div>
	</div>
	<div bind:this={editorContainer} class="nodrag nowheel flex-1 overflow-hidden"></div>
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
