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
	import BaseNode from './BaseNode.svelte';

	// Props from parent using Svelte 5 runes
	const {
		data = {}
	}: {
		data?: {
			label?: string;
			setEditorView?: (view: EditorView) => void;
			onResize?: (width: number, height: number) => void;
		};
	} = $props();

	let editorContainer: HTMLDivElement;
	let editorView: EditorView;
	let isMinimized = $state(false);
	let isMaximized = $state(false);

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

<BaseNode
	title={data.label ?? 'Editor'}
	bind:isMinimized
	bind:isMaximized
	on:close={() => console.log('Editor close requested')}
	on:minimize={(e) => console.log('Editor minimize:', e.detail)}
	on:maximize={(e) => console.log('Editor maximize:', e.detail)}
	on:resize={(e) => {
		// Handle resize - refresh editor layout
		if (editorView) {
			setTimeout(() => {
				editorView.requestMeasure();
			}, 100);
		}
		// Notify parent about resize
		if (data.onResize) {
			data.onResize(e.detail.width, e.detail.height);
		}
	}}
>
	{#snippet children()}
		<div class="flex h-full flex-col">
			<div class="bg-muted border-border flex items-center justify-between border-b px-3 py-1">
				<span class="text-muted-foreground text-xs">HTML Editor</span>
				<button
					class="hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs transition-colors"
					title="Run code"
					onclick={codeCanvasActions.runCode}
				>
					▶️ Run
				</button>
			</div>
			<div bind:this={editorContainer} class="nodrag nowheel flex-1 overflow-hidden"></div>
		</div>
	{/snippet}
</BaseNode>

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
