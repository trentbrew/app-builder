import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { env } from '$env/dynamic/private';
import {
	CHAT_SYSTEM_PROMPT,
	DEFAULT_OLLAMA_MODEL,
} from '$lib/ai/config';
import { ollama } from '$lib/ai/ollama.js';

export async function POST({ request }: { request: Request }) {
	let body: { messages?: UIMessage[]; model?: string };

	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid request body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const messages = body.messages;
	if (!Array.isArray(messages)) {
		return new Response(JSON.stringify({ error: 'messages must be an array' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const modelId =
		(typeof body.model === 'string' && body.model.trim()) ||
		env.OLLAMA_MODEL ||
		DEFAULT_OLLAMA_MODEL;

	try {
		const result = streamText({
			model: ollama(modelId),
			system: CHAT_SYSTEM_PROMPT,
			messages: await convertToModelMessages(messages),
		});

		return result.toUIMessageStreamResponse();
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: 'Failed to reach Ollama. Is it running with the gemma4 model pulled?';

		return new Response(JSON.stringify({ error: message }), {
			status: 502,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}
