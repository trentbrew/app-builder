<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import {
		keymap,
		highlightSpecialChars,
		drawSelection,
		highlightActiveLine,
		dropCursor,
		rectangularSelection,
		crosshairCursor,
		lineNumbers,
		highlightActiveLineGutter
	} from '@codemirror/view';
	import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
	import {
		syntaxHighlighting,
		defaultHighlightStyle,
		bracketMatching,
		foldGutter,
		indentOnInput,
		language
	} from '@codemirror/language';
	import {
		autocompletion,
		closeBrackets,
		closeBracketsKeymap,
		completionKeymap
	} from '@codemirror/autocomplete';
	import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { javascript } from '@codemirror/lang-javascript';
	import BaseNode from './BaseNode.svelte';
	import { Handle, Position } from '@xyflow/svelte';
	import { createEventDispatcher } from 'svelte';

	// Props from parent using Svelte 5 runes
	const {
		data = {}
	}: {
		data?: {
			label?: string;
			isActiveContent?: boolean;
			onResize?: (width: number, height: number) => void;
			onMaximize?: (isMaximized: boolean) => void;
			sceneCode?: string;
			onSceneCodeChange?: (code: string) => void;
		};
	} = $props();

	const dispatch = createEventDispatcher();

	let isMinimized = $state(false);
	let isMaximized = $state(false);
	let isActiveContent = $state(data.isActiveContent || false);
	let editorContainer: HTMLDivElement;
	let editorView: EditorView | null = null;
	let sceneCode = $state(
		data.sceneCode ||
			`// Motion Canvas Scene
import { makeScene2D } from '@motion-canvas/2d';
import { Circle, Txt } from '@motion-canvas/2d/lib/components';
import { all, createRef } from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();
  const text = createRef<Txt>();

  view.add(
    <>
      <Circle
        ref={circle}
        width={120}
        height={120}
        fill={'#3b82f6'}
        x={-200}
      />
      <Txt
        ref={text}
        text={'Hello Motion Canvas!'}
        fontSize={48}
        fill={'#ffffff'}
        x={200}
      />
    </>
  );

  yield* all(
    circle().position.x(200, 1),
    text().position.x(-200, 1),
  );
});`
	);

	// Initialize CodeMirror editor
	function initializeEditor() {
		if (editorContainer && !editorView) {
			// Create a minimal editor first
			const startState = EditorState.create({
				doc: sceneCode,
				extensions: [
					lineNumbers(),
					javascript(),
					syntaxHighlighting(defaultHighlightStyle),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							const newCode = update.state.doc.toString();
							sceneCode = newCode;
							// Dispatch the change to parent
							dispatch('sceneCodeChange', { code: newCode });
							// Also call the callback if provided
							if (data.onSceneCodeChange) {
								data.onSceneCodeChange(newCode);
							}
						}
					}),
					EditorView.theme({
						'&': {
							fontSize: '14px',
							fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
							backgroundColor: '#ffffff',
							color: '#333333'
						},
						'.cm-content': {
							padding: '12px',
							minHeight: '200px',
							backgroundColor: '#ffffff',
							color: '#333333'
						},
						'.cm-editor': {
							height: '100%',
							backgroundColor: '#ffffff'
						},
						'.cm-focused': {
							outline: 'none'
						},
						'.cm-line': {
							color: '#333333'
						},
						'.cm-lineNumbers': {
							color: '#666666',
							backgroundColor: '#f8f8f8'
						},
						'.cm-lineNumbers .cm-gutterElement': {
							color: '#666666'
						},
						'.cm-cursor': {
							borderLeft: '2px solid #333333'
						},
						'.cm-selectionBackground': {
							backgroundColor: '#b3d4fc'
						},
						'.cm-keyword': {
							color: '#0066cc',
							fontWeight: 'bold'
						},
						'.cm-string': {
							color: '#008800'
						},
						'.cm-comment': {
							color: '#666666',
							fontStyle: 'italic'
						},
						'.cm-variable': {
							color: '#333333'
						},
						'.cm-property': {
							color: '#cc6600'
						},
						'.cm-number': {
							color: '#cc0000'
						}
					})
				]
			});

			editorView = new EditorView({
				state: startState,
				parent: editorContainer
			});
		}
	}

	// Reactive statement to initialize editor when container is available
	$effect(() => {
		if (editorContainer && !editorView) {
			initializeEditor();
		}
	});

	onMount(() => {
		// Try to initialize immediately
		initializeEditor();
		// Also try with a delay as fallback
		setTimeout(initializeEditor, 100);
		setTimeout(initializeEditor, 500);
	});

	onDestroy(() => {
		if (editorView) {
			editorView.destroy();
		}
	});

	// Handle resize
	function handleResize(event: CustomEvent) {
		if (data.onResize) {
			data.onResize(event.detail.width, event.detail.height);
		}
	}

	// Handle maximize
	function handleMaximize(isMaximized: boolean) {
		if (data.onMaximize) {
			data.onMaximize(isMaximized);
		}
	}

	// Save scene to file
	function saveScene() {
		const blob = new Blob([sceneCode], { type: 'text/javascript' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'scene.js';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	// Load scene from file
	function loadScene() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.js,.ts,.jsx,.tsx';
		input.onchange = (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = (e) => {
					const content = e.target?.result as string;
					sceneCode = content;
					if (editorView) {
						editorView.dispatch({
							changes: {
								from: 0,
								to: editorView.state.doc.length,
								insert: content
							}
						});
					}
				};
				reader.readAsText(file);
			}
		};
		input.click();
	}

	// Get status info for the title bar
	function getStatusInfo() {
		const statuses = [];

		statuses.push({
			type: 'info',
			text: `${sceneCode.length} chars`
		});

		return statuses;
	}
</script>

<BaseNode
	title="Scene Editor"
	{isMinimized}
	{isMaximized}
	onMaximize={handleMaximize}
	statusInfo={getStatusInfo()}
	showStatusBar={true}
	on:resize={handleResize}
>
	<!-- Output Handle for Scene Code -->
	<Handle
		type="source"
		position={Position.Right}
		id="scene-code-output"
		style="background: #3b82f6; width: 12px; height: 12px; border: 2px solid #1e40af;"
		title="Scene Code Output"
	/>

	<div class="scene-editor-container">
		<!-- Toolbar -->
		<div class="toolbar">
			<button class="btn btn-secondary" onclick={saveScene}>
				<svg
					class="mr-2 h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
					<polyline points="17,21 17,13 7,13 7,21" />
					<polyline points="7,3 7,8 15,8" />
				</svg>
				Save Scene
			</button>

			<button class="btn btn-secondary" onclick={loadScene}>
				<svg
					class="mr-2 h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<polyline points="14,2 14,8 20,8" />
					<line x1="16" y1="13" x2="8" y2="13" />
					<line x1="16" y1="17" x2="8" y2="17" />
					<polyline points="10,9 9,9 8,9" />
				</svg>
				Load Scene
			</button>
		</div>

		<!-- Code Editor -->
		<div class="editor-container" onwheel={(e) => e.stopPropagation()}>
			<div bind:this={editorContainer} class="editor"></div>
		</div>

		<!-- Status -->
		<div class="status">
			<span class="status-label">Scene:</span>
			<span class="status-value">Ready</span>
			<span class="status-info">({sceneCode.length} characters)</span>
		</div>
	</div>
</BaseNode>

<style>
	.scene-editor-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
		height: 100%;
		padding: 8px;
	}

	.toolbar {
		display: flex;
		gap: 8px;
		justify-content: flex-start;
	}

	.btn {
		display: flex;
		align-items: center;
		padding: 6px 12px;
		border-radius: 4px;
		font-size: 12px;
		font-weight: 500;
		border: none;
		cursor: pointer;
		transition: all 0.2s ease;
		position: relative;
		z-index: 10;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #6b7280;
		color: white;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #4b5563;
	}

	.editor-container {
		flex: 1;
		min-height: 200px;
		background: var(--color-muted);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		overflow: hidden;
		position: relative;
		z-index: 1;
		user-select: text;
		pointer-events: auto;
	}

	.editor {
		height: 100%;
		width: 100%;
		min-height: 200px;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		padding: 6px 8px;
		background: var(--color-muted);
		border-radius: 4px;
	}

	.status-label {
		font-weight: 600;
		color: var(--color-muted-foreground);
	}

	.status-value {
		font-weight: 500;
		color: var(--color-foreground);
	}

	.status-info {
		color: var(--color-muted-foreground);
		font-size: 10px;
	}

	.w-4 {
		width: 1rem;
	}

	.h-4 {
		height: 1rem;
	}

	.mr-2 {
		margin-right: 0.5rem;
	}
</style>
