<script lang="ts">
	import { Compartment, EditorState } from '@codemirror/state';
	import {
		EditorView,
		keymap,
		highlightSpecialChars,
		drawSelection,
		highlightActiveLine,
		dropCursor,
		lineNumbers,
		highlightActiveLineGutter,
		placeholder
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
	import { oneDark } from '@codemirror/theme-one-dark';
	import { showMinimap } from '@replit/codemirror-minimap';
	import { languageExtensionForPath } from '$lib/codemirrorLanguage';
	import { isMarkdownPath } from '$lib/fileTypes';
	import { browser } from '$app/environment';
	import { onMount, untrack } from 'svelte';

	let {
		path,
		content,
		onChange,
		onFocus
	}: {
		path: string;
		content: string;
		onChange: (content: string) => void;
		onFocus: () => void;
	} = $props();

	let container = $state<HTMLDivElement | undefined>();
	const languageCompartment = new Compartment();

	const minimapCreate = () => ({
		dom: document.createElement('div')
	});

	onMount(() => {
		if (!browser || !container) return;

		const state = EditorState.create({
			doc: untrack(() => content),
			extensions: [
				oneDark,
				languageCompartment.of(languageExtensionForPath(path)),
				EditorView.theme({
					'&': {
						backgroundColor: 'var(--color-background)',
						fontFamily: 'var(--font-mono)'
					},
					'.cm-scroller': {
						backgroundColor: 'var(--color-background)',
						fontFamily: 'var(--font-mono)'
					},
					'.cm-content': {
						backgroundColor: 'var(--color-background)',
						fontFamily: 'var(--font-mono)',
						fontSize: '13px'
					},
					'.cm-gutters': {
						backgroundColor: 'var(--color-background)',
						color: 'var(--color-muted-foreground)',
						borderRight: '1px solid var(--color-border)',
						fontFamily: 'var(--font-mono)',
						fontSize: '13px'
					},
					'.cm-activeLine': { backgroundColor: 'var(--color-muted)' },
					'.cm-activeLineGutter': { backgroundColor: 'var(--color-muted)' }
				}),
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
				showMinimap.compute(['doc'], () => ({
					create: minimapCreate,
					displayText: 'blocks',
					showOverlay: 'always'
				})),
				keymap.of([
					...closeBracketsKeymap,
					...completionKeymap,
					...defaultKeymap,
					...searchKeymap,
					...historyKeymap,
					indentWithTab
				]),
				...(isMarkdownPath(path) ? [EditorView.lineWrapping, placeholder('Type something…')] : []),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						onChange(update.state.doc.toString());
					}
				})
			]
		});

		const view = new EditorView({ state, parent: container });

		return () => view.destroy();
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="code-editor h-full min-h-0 overflow-hidden" bind:this={container} onfocusin={() => onFocus()}></div>

<style>
  .code-editor :global(.cm-editor) {
    height: 100%;
    background-color: var(--color-background) !important;
  }

  .code-editor :global(.cm-scroller) {
    overflow: auto;
    background-color: var(--color-background) !important;
  }

  .code-editor :global(.cm-content),
  .code-editor :global(.cm-gutters) {
    background-color: var(--color-background) !important;
  }

  .code-editor :global(.cm-gutters) {
    border-right: 1px solid var(--color-border);
    color: var(--color-muted-foreground);
  }

  .code-editor :global(.cm-activeLine),
  .code-editor :global(.cm-activeLineGutter) {
    background-color: var(--color-muted) !important;
  }

  .code-editor :global(.cm-minimap) {
    border-left: 1px solid var(--color-border);
    background: color-mix(in oklch, var(--color-background) 88%, var(--color-muted));
  }
</style>
