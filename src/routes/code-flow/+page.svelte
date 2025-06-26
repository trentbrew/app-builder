<script>
	import { SvelteFlow, Background, Controls, MiniMap } from '@xyflow/svelte';
	import CodeBlock from '$lib/components/ui/code-block/index.svelte';
	import EditableNode from '$lib/components/nodes/EditableNode.svelte';
	import '@xyflow/svelte/dist/style.css';

	const nodeTypes = {
		editable: EditableNode
	};

	let nodes = $state([
		{
			id: 'start-fn',
			type: 'editable',
			data: { label: 'function bubbleSort(arr)' },
			position: { x: 400, y: -100 }
		},
		{
			id: 'cond-i',
			type: 'editable',
			data: { label: 'let i = 0; i < arr.length - 1; i++' },
			position: { x: 400, y: 0 }
		},
		{
			id: 'cond-j',
			type: 'editable',
			data: { label: 'let j = 0; j < arr.length - i - 1; j++' },
			position: { x: 400, y: 100 }
		},
		{
			id: 'if-cmp',
			type: 'editable',
			data: { label: 'if (arr[j] > arr[j+1])' },
			position: { x: 400, y: 200 }
		},
		{
			id: 'swap',
			type: 'editable',
			data: { label: 'let temp = arr[j]; arr[j] = arr[j+1]; arr[j+1] = temp;' },
			position: { x: 400, y: 300 }
		},
		{ id: 'return', type: 'editable', data: { label: 'return arr' }, position: { x: 400, y: 400 } }
	]);

	let edges = $state([
		{ id: 'e-fn-for-i', source: 'start-fn', target: 'cond-i' },
		{ id: 'e-for-i-for-j', source: 'cond-i', target: 'cond-j', label: 'true' },
		{ id: 'e-for-j-if', source: 'cond-j', target: 'if-cmp', label: 'true' },
		{ id: 'e-if-swap', source: 'if-cmp', target: 'swap', label: 'true' },
		{ id: 'e-swap-back-j', source: 'swap', target: 'cond-j', type: 'smoothstep' },
		{
			id: 'e-if-false-back-j',
			source: 'if-cmp',
			target: 'cond-j',
			type: 'smoothstep',
			label: 'false'
		},
		{
			id: 'e-for-j-false-back-i',
			source: 'cond-j',
			target: 'cond-i',
			type: 'smoothstep',
			label: 'false'
		},
		{ id: 'e-for-i-false-return', source: 'cond-i', target: 'return', label: 'false' }
	]);

	let generatedCode = $state('');

	function generateCodeFromFlow(nodes, edges) {
		let code = '';
		const nodeMap = new Map(nodes.map((n) => [n.id, n]));
		const edgeMap = new Map();
		for (const edge of edges) {
			if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, []);
			edgeMap.get(edge.source).push(edge);
		}

		function getNode(id) {
			return nodeMap.get(id);
		}

		function getOutgoingEdges(nodeId) {
			return edgeMap.get(nodeId) || [];
		}

		let openBraces = 0;

		function indent() {
			return '  '.repeat(openBraces);
		}

		const startNode = nodes.find((n) => n.id === 'start-fn');
		if (!startNode) return 'Error: Start node not found';

		code += `${startNode.data.label} {\\n`;
		openBraces++;

		const forINode = getNode(getOutgoingEdges('start-fn')[0].target);
		code += `${indent()}for (${forINode.data.label}) {\\n`;
		openBraces++;

		const forJNode = getNode(getOutgoingEdges('cond-i').find((e) => e.label === 'true').target);
		code += `${indent()}for (${forJNode.data.label}) {\\n`;
		openBraces++;

		const ifNode = getNode(getOutgoingEdges('cond-j').find((e) => e.label === 'true').target);
		code += `${indent()}${ifNode.data.label} {\\n`;
		openBraces++;

		const swapNode = getNode(getOutgoingEdges('if-cmp').find((e) => e.label === 'true').target);
		code += `${indent()}${swapNode.data.label}\\n`;

		// Close if
		openBraces--;
		code += `${indent()}}\\n`;

		// Close for j
		openBraces--;
		code += `${indent()}}\\n`;

		// Close for i
		openBraces--;
		code += `${indent()}}\\n`;

		const returnNode = getNode(getOutgoingEdges('cond-i').find((e) => e.label === 'false').target);
		code += `${indent()}${returnNode.data.label};\\n`;

		// Close function
		openBraces--;
		code += `}\\n`;

		return code;
	}

	$effect(() => {
		generatedCode = generateCodeFromFlow(nodes, edges);
	});
</script>

<div class="grid h-screen grid-cols-2 gap-4 p-4">
	<div class="rounded-lg border">
		<SvelteFlow bind:nodes bind:edges {nodeTypes} fitView>
			<Background />
			<Controls />
			<MiniMap />
		</SvelteFlow>
	</div>
	<div class="overflow-x-auto rounded-lg rounded-lg border bg-gray-900 p-4 text-white">
		<CodeBlock code={generatedCode} />
	</div>
</div>

<style>
	:global(.svelte-flow__edge-text) {
		fill: white;
	}
</style>
