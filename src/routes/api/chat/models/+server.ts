import { getOllamaBaseUrl } from '$lib/ai/ollama.js';

export async function GET() {
	try {
		const response = await fetch(`${getOllamaBaseUrl()}/api/tags`);
		if (!response.ok) {
			return Response.json({ models: [], error: 'Ollama unavailable' }, { status: 502 });
		}

		const data = (await response.json()) as {
			models?: Array<{ name?: string; model?: string }>;
		};

		const models = (data.models ?? [])
			.map((entry) => entry.name ?? entry.model)
			.filter((name): name is string => Boolean(name))
			.sort((a, b) => a.localeCompare(b));

		return Response.json({ models });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to list Ollama models';
		return Response.json({ models: [], error: message }, { status: 502 });
	}
}
