<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import type { NodeProps } from '@xyflow/svelte';

	export let data: NodeProps['data'];
</script>

<div class="editable-node">
	<Handle type="target" position={Position.Top} />
	<input bind:value={data.label} class="nodrag" />
	<Handle type="source" position={Position.Bottom} />
</div>

<style>
	.editable-node {
		background-color: #0f172a;
		color: white;
		border: 1px solid #1e293b;
		padding: 10px;
		border-radius: 4px;
		font-size: 12px;
		width: 180px;
		text-align: center;
	}

	input {
		background-color: transparent;
		color: white;
		border: none;
		width: 100%;
		text-align: center;
	}

	input:focus {
		outline: 1px solid #38bdf8;
		border-radius: 2px;
	}
</style>
