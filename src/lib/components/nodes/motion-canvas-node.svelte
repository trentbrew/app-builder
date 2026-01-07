<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import BaseNode from './BaseNode.svelte';
	import { Handle, Position } from '@xyflow/svelte';
	import { codeCanvasState, codeCanvasActions } from '../../../routes/code-canvas/state.svelte';

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
		};
	} = $props();

	let isMinimized = $state(false);
	let isMaximized = $state(false);
	let isActiveContent = $state(data.isActiveContent || false);
	let canvasElement: HTMLCanvasElement | null = $state(null);
	let rendering = $state(false);
	let lastRenderTime = $state<Date | null>(null);
	let renderStatus = $state('Ready');
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

	// Watch for changes in sceneCode from parent
	$effect(() => {
		if (data.sceneCode && data.sceneCode !== sceneCode) {
			sceneCode = data.sceneCode;
		}
	});

	// Format time since last render
	function getTimeSinceRender() {
		if (!lastRenderTime) return '';
		const now = new Date();
		const diff = now.getTime() - lastRenderTime.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);

		if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s ago`;
		}
		return `${seconds}s ago`;
	}

	// Get status color based on render status
	function getStatusColor() {
		if (renderStatus === 'Rendering...') return 'text-yellow-400';
		if (renderStatus === 'Error') return 'text-red-400';
		if (renderStatus === 'Ready') return 'text-green-400';
		return 'text-gray-400';
	}

	// Render a single frame
	async function renderFrame() {
		if (rendering) return;

		rendering = true;
		renderStatus = 'Rendering...';
		codeCanvasActions.addLog('Starting Motion Canvas render...');

		try {
			// Create a simple animated scene on the canvas
			if (canvasElement) {
				const ctx = canvasElement.getContext('2d');
				if (ctx) {
					// Clear canvas
					ctx.fillStyle = '#0f172a';
					ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

					// Create gradient background
					const gradient = ctx.createLinearGradient(
						0,
						0,
						canvasElement.width,
						canvasElement.height
					);
					gradient.addColorStop(0, '#1e293b');
					gradient.addColorStop(1, '#0f172a');
					ctx.fillStyle = gradient;
					ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

					// Draw animated circle
					const time = Date.now() * 0.001;
					const centerX = canvasElement.width / 2 + Math.sin(time) * 50;
					const centerY = canvasElement.height / 2 + Math.cos(time * 0.7) * 30;

					ctx.beginPath();
					ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
					ctx.fillStyle = '#3b82f6';
					ctx.fill();

					// Add glow effect
					ctx.shadowColor = '#3b82f6';
					ctx.shadowBlur = 20;
					ctx.beginPath();
					ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
					ctx.fillStyle = '#60a5fa';
					ctx.fill();
					ctx.shadowBlur = 0;

					// Add text
					ctx.font = 'bold 24px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto';
					ctx.fillStyle = '#f8fafc';
					ctx.textAlign = 'center';
					ctx.fillText('Motion Canvas Node', canvasElement.width / 2, 60);

					ctx.font = '14px ui-sans-serif, system-ui';
					ctx.fillStyle = '#94a3b8';
					ctx.fillText('Click "Render Frame" to generate animation', canvasElement.width / 2, 85);

					// Add some particles
					for (let i = 0; i < 15; i++) {
						const x = (i * 30) % canvasElement.width;
						const y = Math.sin(time + i * 0.5) * 15 + canvasElement.height - 40;
						ctx.beginPath();
						ctx.arc(x, y, 2, 0, Math.PI * 2);
						ctx.fillStyle = `rgba(59, 130, 246, ${0.3 + Math.sin(time + i) * 0.2})`;
						ctx.fill();
					}
				}
			}

			lastRenderTime = new Date();
			renderStatus = 'Ready';
			codeCanvasActions.addLog('Motion Canvas frame rendered successfully');
		} catch (error) {
			renderStatus = 'Error';
			codeCanvasActions.addLog(`Motion Canvas render error: ${error}`);
			console.error('Motion Canvas render error:', error);
		} finally {
			rendering = false;
		}
	}

	// Render video sequence (multiple frames)
	async function renderVideo() {
		if (rendering) return;

		rendering = true;
		renderStatus = 'Rendering...';
		codeCanvasActions.addLog('Starting Motion Canvas video render...');

		try {
			const frameCount = 30; // 1 second at 30fps

			for (let i = 0; i < frameCount; i++) {
				const time = i / frameCount; // 0 to 1

				if (canvasElement) {
					const ctx = canvasElement.getContext('2d');
					if (ctx) {
						// Clear canvas
						ctx.fillStyle = '#0f172a';
						ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

						// Create gradient background
						const gradient = ctx.createLinearGradient(
							0,
							0,
							canvasElement.width,
							canvasElement.height
						);
						gradient.addColorStop(0, '#1e293b');
						gradient.addColorStop(1, '#0f172a');
						ctx.fillStyle = gradient;
						ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

						// Draw animated circle based on frame time
						const animTime = time * 10; // Scale for animation
						const centerX = canvasElement.width / 2 + Math.sin(animTime) * 50;
						const centerY = canvasElement.height / 2 + Math.cos(animTime * 0.7) * 30;

						ctx.beginPath();
						ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
						ctx.fillStyle = '#3b82f6';
						ctx.fill();

						// Add glow effect
						ctx.shadowColor = '#3b82f6';
						ctx.shadowBlur = 20;
						ctx.beginPath();
						ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
						ctx.fillStyle = '#60a5fa';
						ctx.fill();
						ctx.shadowBlur = 0;

						// Add text
						ctx.font = 'bold 24px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto';
						ctx.fillStyle = '#f8fafc';
						ctx.textAlign = 'center';
						ctx.fillText('Motion Canvas Video', canvasElement.width / 2, 60);

						ctx.font = '14px ui-sans-serif, system-ui';
						ctx.fillStyle = '#94a3b8';
						ctx.fillText(`Frame ${i + 1}/${frameCount}`, canvasElement.width / 2, 85);

						// Add some particles
						for (let j = 0; j < 15; j++) {
							const x = (j * 30) % canvasElement.width;
							const y = Math.sin(animTime + j * 0.5) * 15 + canvasElement.height - 40;
							ctx.beginPath();
							ctx.arc(x, y, 2, 0, Math.PI * 2);
							ctx.fillStyle = `rgba(59, 130, 246, ${0.3 + Math.sin(animTime + j) * 0.2})`;
							ctx.fill();
						}
					}
				}

				// Small delay to show animation
				await new Promise((resolve) => setTimeout(resolve, 50));
			}

			lastRenderTime = new Date();
			renderStatus = 'Ready';
			codeCanvasActions.addLog(`Motion Canvas video rendered successfully (${frameCount} frames)`);
		} catch (error) {
			renderStatus = 'Error';
			codeCanvasActions.addLog(`Motion Canvas video render error: ${error}`);
			console.error('Motion Canvas video render error:', error);
		} finally {
			rendering = false;
		}
	}

	// Get status info for the title bar
	function getStatusInfo() {
		const statuses = [];

		if (renderStatus) {
			statuses.push({
				type:
					renderStatus === 'Ready'
						? 'success'
						: renderStatus === 'Rendering...'
							? 'warning'
							: 'error',
				text: renderStatus
			});
		}

		if (lastRenderTime) {
			statuses.push({
				type: 'info',
				text: getTimeSinceRender()
			});
		}

		return statuses;
	}

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

	// Auto-render on mount
	onMount(() => {
		// Initial render
		setTimeout(() => {
			renderFrame();
		}, 500);
	});
</script>

<BaseNode
	title="Motion Canvas"
	{isMinimized}
	{isMaximized}
	onMaximize={handleMaximize}
	statusInfo={getStatusInfo()}
	showStatusBar={true}
	on:resize={handleResize}
>
	<!-- Input Handle for Scene Code -->
	<Handle
		type="target"
		position={Position.Left}
		id="scene-code-input"
		style="background: #3b82f6; width: 12px; height: 12px; border: 2px solid #1e40af;"
		title="Scene Code Input"
	/>
	<div class="motion-canvas-container">
		<!-- Canvas for rendering -->
		<div class="canvas-container">
			<canvas bind:this={canvasElement} width={400} height={300} class="motion-canvas"></canvas>
		</div>

		<!-- Controls -->
		<div class="controls">
			<button class="btn btn-primary" onclick={renderFrame} disabled={rendering}>
				{#if rendering && renderStatus === 'Rendering...'}
					<svg class="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
						<circle
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
							fill="none"
							opacity="0.25"
						/>
						<path
							d="M12 2a10 10 0 0 1 10 10"
							stroke="currentColor"
							stroke-width="4"
							fill="none"
							stroke-linecap="round"
						/>
					</svg>
				{/if}
				Render Frame
			</button>

			<button class="btn btn-secondary" onclick={renderVideo} disabled={rendering}>
				{#if rendering && renderStatus === 'Rendering...'}
					<svg class="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
						<circle
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
							fill="none"
							opacity="0.25"
						/>
						<path
							d="M12 2a10 10 0 0 1 10 10"
							stroke="currentColor"
							stroke-width="4"
							fill="none"
							stroke-linecap="round"
						/>
					</svg>
				{/if}
				Render Video
			</button>
		</div>

		<!-- Status -->
		<div class="status">
			<span class="status-label">Status:</span>
			<span class="status-value" class:getStatusColor()>{renderStatus}</span>
			{#if lastRenderTime}
				<span class="status-time">({getTimeSinceRender()})</span>
			{/if}
		</div>
	</div>
</BaseNode>

<style>
	.motion-canvas-container {
		display: flex;
		flex-direction: column;
		gap: 12px;
		height: 100%;
		padding: 8px;
	}

	.canvas-container {
		display: flex;
		justify-content: center;
		align-items: center;
		background: #111;
		border-radius: 6px;
		padding: 8px;
		min-height: 200px;
	}

	.motion-canvas {
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		max-width: 100%;
		max-height: 100%;
	}

	.controls {
		display: flex;
		gap: 8px;
		justify-content: center;
	}

	.btn {
		display: flex;
		align-items: center;
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 14px;
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

	.btn-primary {
		background: #3b82f6;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #2563eb;
	}

	.btn-secondary {
		background: #6b7280;
		color: white;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #4b5563;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		padding: 8px;
		background: var(--color-muted);
		border-radius: 4px;
	}

	.status-label {
		font-weight: 600;
		color: var(--color-muted-foreground);
	}

	.status-value {
		font-weight: 500;
	}

	.status-time {
		color: var(--color-muted-foreground);
		font-size: 11px;
	}

	:global(.text-green-400) {
		color: #10b981;
	}

	:global(.text-yellow-400) {
		color: #f59e0b;
	}

	:global(.text-red-400) {
		color: #ef4444;
	}

	:global(.text-gray-400) {
		color: #9ca3af;
	}

	.animate-spin {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
