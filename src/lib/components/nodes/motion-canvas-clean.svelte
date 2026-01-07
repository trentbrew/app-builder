<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Handle, Position } from '@xyflow/svelte';
	import BaseNode from './BaseNode.svelte';

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
	let isLiveUpdating = $state(false);
	let isPlaying = $state(false);
	let animationId: number | null = null;
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
			// Show live update indicator
			isLiveUpdating = true;
			// Auto-render when scene code changes (much faster)
			setTimeout(() => {
				renderFrame();
				// Hide live update indicator after render
				setTimeout(() => {
					isLiveUpdating = false;
				}, 200);
			}, 50);
		}
	});

	// Format time since last render
	function getTimeSinceRender() {
		if (!lastRenderTime) return '';
		const now = new Date();
		const diffMs = now.getTime() - lastRenderTime.getTime();
		const diffSecs = Math.floor(diffMs / 1000);
		if (diffSecs < 60) return `${diffSecs}s ago`;
		const diffMins = Math.floor(diffSecs / 60);
		return `${diffMins}m ago`;
	}

	// Get status color based on render status
	function getStatusColor() {
		switch (renderStatus) {
			case 'Ready':
				return 'text-green-400';
			case 'Rendering...':
				return 'text-yellow-400';
			case 'Error':
				return 'text-red-400';
			default:
				return 'text-gray-400';
		}
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

	// Render a single frame
	async function renderFrame() {
		if (rendering) return;

		rendering = true;
		renderStatus = 'Rendering...';

		try {
			// Simulate rendering process (much faster for real-time updates)
			await new Promise((resolve) => setTimeout(resolve, 16)); // ~60fps

			// Draw a dynamic scene based on the current code
			if (canvasElement) {
				const ctx = canvasElement.getContext('2d');
				if (ctx) {
					// Clear canvas
					ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

					// Draw background
					ctx.fillStyle = '#1a1a1a';
					ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

					// Get current time for animations
					const time = Date.now() * 0.001;
					const centerX = canvasElement.width / 2;
					const centerY = canvasElement.height / 2;

					// Analyze the scene code to show different visuals
					const hasCircle = sceneCode.includes('Circle');
					const hasText = sceneCode.includes('Txt');
					const hasAnimation = sceneCode.includes('position.x') || sceneCode.includes('position.y');

					// Draw animated circle if Circle is in the code
					if (hasCircle) {
						const radius = 60 + Math.sin(time) * 10;
						ctx.beginPath();
						ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);

						// Parse color from the scene code (look for Circle's fill property)
						const circleColorMatch = sceneCode.match(/Circle[^}]*fill\s*=\s*['"`]([^'"`]+)['"`]/s);
						const circleColor = circleColorMatch ? circleColorMatch[1] : '#3b82f6';
						ctx.fillStyle = circleColor;
						ctx.fill();
					}

					// Draw text if Txt is in the code
					if (hasText) {
						// Parse text color from the scene code (look for Txt's fill property)
						const textColorMatch = sceneCode.match(/Txt[^}]*fill\s*=\s*['"`]([^'"`]+)['"`]/s);
						const textColor = textColorMatch ? textColorMatch[1] : '#ffffff';

						ctx.fillStyle = textColor;
						ctx.font = '24px Arial';
						ctx.textAlign = 'center';
						ctx.fillText('Hello Motion Canvas!', centerX, centerY + 100);
					}

					// Show animation indicator
					if (hasAnimation) {
						ctx.fillStyle = '#10b981';
						ctx.font = '16px Arial';
						ctx.textAlign = 'center';
						ctx.fillText('✨ Animated Scene', centerX, centerY + 150);
					}

					// Always show render status
					ctx.fillStyle = '#6b7280';
					ctx.font = '14px Arial';
					ctx.textAlign = 'center';
					ctx.fillText('Motion Canvas Preview', centerX, 30);
					ctx.fillText(
						`Code Length: ${sceneCode.length} chars`,
						centerX,
						canvasElement.height - 20
					);
				}
			}

			renderStatus = 'Ready';
			lastRenderTime = new Date();
		} catch (error) {
			renderStatus = 'Error';
			console.error('Render error:', error);
		} finally {
			rendering = false;
		}
	}

	// Render video (placeholder)
	async function renderVideo() {
		if (rendering) return;

		rendering = true;
		renderStatus = 'Rendering Video...';

		try {
			// Simulate video rendering
			await new Promise((resolve) => setTimeout(resolve, 3000));

			renderStatus = 'Video Ready';
			lastRenderTime = new Date();
		} catch (error) {
			renderStatus = 'Error';
			console.error('Video render error:', error);
		} finally {
			rendering = false;
		}
	}

	// Get status info for the title bar
	function getStatusInfo() {
		const statuses = [];

		if (isLiveUpdating) {
			statuses.push({
				type: 'warning',
				text: 'Live Update'
			});
		}

		if (renderStatus) {
			statuses.push({
				type: renderStatus === 'Ready' ? 'success' : renderStatus === 'Error' ? 'error' : 'warning',
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

	// Play/pause animation
	function togglePlayPause() {
		if (isPlaying) {
			// Pause animation
			if (animationId) {
				cancelAnimationFrame(animationId);
				animationId = null;
			}
			isPlaying = false;
		} else {
			// Start animation
			isPlaying = true;
			animate();
		}
	}

	// Animation loop
	function animate() {
		if (!isPlaying || !canvasElement || rendering) return;

		// Re-render the frame with updated time
		renderFrame();

		// Schedule next frame
		animationId = requestAnimationFrame(animate);
	}

	// Cleanup animation on destroy
	onDestroy(() => {
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
	});

	// Auto-render on mount
	onMount(() => {
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
		<div class="canvas-container" onwheel={(e) => e.stopPropagation()}>
			<canvas bind:this={canvasElement} width={400} height={300} class="motion-canvas"></canvas>
		</div>

		<!-- Controls -->
		<div class="controls">
			<button class="btn btn-play" onclick={togglePlayPause} disabled={rendering}>
				{#if isPlaying}
					<svg
						class="mr-2 h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<rect x="6" y="4" width="4" height="16" />
						<rect x="14" y="4" width="4" height="16" />
					</svg>
					Pause
				{:else}
					<svg
						class="mr-2 h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<polygon points="5,3 19,12 5,21" />
					</svg>
					Play
				{/if}
			</button>

			<button class="btn btn-primary" onclick={renderFrame} disabled={rendering}>
				{#if rendering && renderStatus === 'Rendering...'}
					<svg
						class="mr-2 h-4 w-4 animate-spin"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="12" cy="12" r="10" />
						<path d="M12 6v6l4 2" />
					</svg>
				{/if}
				Render Frame
			</button>

			<button class="btn btn-secondary" onclick={renderVideo} disabled={rendering}>
				{#if rendering && renderStatus === 'Rendering Video...'}
					<svg
						class="mr-2 h-4 w-4 animate-spin"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="12" cy="12" r="10" />
						<path d="M12 6v6l4 2" />
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
		padding: 12px;
	}

	.canvas-container {
		flex: 1;
		min-height: 200px;
		background: #000;
		border-radius: 8px;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		z-index: 1;
	}

	.motion-canvas {
		max-width: 100%;
		max-height: 100%;
		background: #000;
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

	.btn-play {
		background: #10b981;
		color: white;
	}

	.btn-play:hover:not(:disabled) {
		background: #059669;
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
