import { getOllamaBaseUrl } from '$lib/ai/ollama.js';

const FALLBACK_MODELS = ['gemma4:latest', 'qwen2.5-coder:latest', 'llama3.3:latest'];

export async function GET() {
	try {
		const response = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
			signal: AbortSignal.timeout(2000),
		});

		if (!response.ok) {
			return Response.json({ models: FALLBACK_MODELS, unavailable: true });
		}

		const data = (await response.json()) as {
			models?: Array<{ name?: string; model?: string }>;
		};

		const models = (data.models ?? [])
			.map((entry) => entry.name ?? entry.model)
			.filter((name): name is string => Boolean(name))
			.sort((a, b) => a.localeCompare(b));

		return Response.json({ models: models.length > 0 ? models : FALLBACK_MODELS });
	} catch {
		return Response.json({ models: FALLBACK_MODELS, unavailable: true });
	}
}
