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
		lineNumbers,
		highlightActiveLineGutter
	} from '@codemirror/view';
	import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
	import {
		syntaxHighlighting,
		defaultHighlightStyle,
		bracketMatching,
		indentOnInput
	} from '@codemirror/language';
	import {
		autocompletion,
		closeBrackets,
		closeBracketsKeymap,
		completionKeymap
	} from '@codemirror/autocomplete';
	import { html } from '@codemirror/lang-html';
	import { oneDark } from '@codemirror/theme-one-dark';

	export let data: { label?: string } = {};

	let editorContainer: HTMLDivElement;
	let editorView: EditorView | null = null;

	let code =
		`<` +
		`script>
	let count = 0;
	const handleClick = () => count += 1;
</` +
		`script>

<h1>Svelte REPL</h1>
<button on:click={handleClick}>
	Clicked {count} times
</button>

<style>
	h1 {
		color: #7e22ce;
		font-family: sans-serif;
	}
	button {
		background: #7e22ce;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 4px;
		cursor: pointer;
	}
	button:hover {
		background: #6b21a8;
	}
</style>`;

	onMount(() => {
		if (!browser || !editorContainer) return;

		const state = EditorState.create({
			doc: code,
			extensions: [
				oneDark,
				autocompletion(),
				lineNumbers(),
				highlightActiveLineGutter(),
				highlightSpecialChars(),
				history(),
				drawSelection(),
				indentOnInput(),
				syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
				bracketMatching(),
				closeBrackets(),
				highlightActiveLine(),
				keymap.of([
					...closeBracketsKeymap,
					...completionKeymap,
					...defaultKeymap,
					...historyKeymap,
					indentWithTab
				]),
				html(),
				// Update listener to sync code changes
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						code = update.state.doc.toString();
					}
				})
			]
		});

		editorView = new EditorView({
			state,
			parent: editorContainer
		});
	});

	onDestroy(() => {
		if (editorView) {
			editorView.destroy();
		}
	});
</script>

<div class="border-border bg-card flex h-full w-full flex-col overflow-hidden rounded border">
	<div
		class="drag-handle border-border bg-muted text-muted-foreground border-b px-2 py-1 text-xs font-semibold"
	>
		{data.label ?? 'Editor'}
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
