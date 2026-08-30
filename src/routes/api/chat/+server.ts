import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { env } from '$env/dynamic/private';
import {
	CHAT_SYSTEM_PROMPT,
	DEFAULT_OLLAMA_MODEL,
} from '$lib/ai/config';
import { createOllamaChatModel } from '$lib/ai/ollama.js';
import { recordRun } from '$lib/server/runLog';
import {
	hashText,
	sanitizeVariant,
	type RunOutcome,
	type RunRecord,
} from '$lib/runEnvelope';
import { resolveVariantConfig } from '$lib/experiment/variants';

const PROVIDER = 'ollama';

/**
 * Characters in the last user message.
 *
 * A rough size signal for the prompt that opened this run — enough to spot
 * "the v-plan arm was fed longer prompts", which is the failure mode that
 * quietly invalidates a comparison.
 */
function lastUserPromptChars(messages: UIMessage[]): number {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role !== 'user') continue;
		const parts = Array.isArray(message.parts) ? message.parts : [];
		return parts.reduce(
			(total, part) =>
				total + (part?.type === 'text' && typeof part.text === 'string' ? part.text.length : 0),
			0,
		);
	}
	return 0;
}

export async function POST({ request }: { request: Request }) {
	let body: {
		messages?: UIMessage[];
		model?: string;
		sessionId?: string;
		variant?: string;
		taskId?: string;
	};

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

	// Run envelope: opened before the model call so every exit path can close it.
	// `config` is assembled field by field — never spread from `body` — so a field
	// added to the request contract cannot silently land in the run log.
	const runId = crypto.randomUUID();
	const startedAt = Date.now();
	const variant = sanitizeVariant(body.variant);
	const variantConfig = resolveVariantConfig(variant);
	const config: RunRecord['config'] = {
		model: modelId,
		provider: PROVIDER,
		// Reports what this run actually used, not what the default happens to be.
		// A hardcoded value here would make every arm look identical in the log.
		thinking: variantConfig.thinking,
		systemPromptChars: CHAT_SYSTEM_PROMPT.length,
		systemPromptHash: hashText(CHAT_SYSTEM_PROMPT),
		messageCount: messages.length,
	};
	const openRun = {
		runId,
		sessionId: typeof body.sessionId === 'string' ? body.sessionId : '',
		variant,
		...(typeof body.taskId === 'string' && body.taskId ? { taskId: body.taskId } : {}),
		buildId: __APP_BUILDER_BUILD_ID__,
		startedAt,
		promptChars: lastUserPromptChars(messages),
		config,
	};

	let firstChunkAt: number | null = null;
	let closed = false;

	function closeRun(
		outcome: RunOutcome,
		details: {
			steps?: number;
			toolCalls?: number;
			finishReason?: string | null;
			inputTokens?: number | null;
			outputTokens?: number | null;
			reasoningTokens?: number | null;
			totalTokens?: number | null;
			error?: string;
		} = {},
	) {
		if (closed) return;
		closed = true;

		recordRun({
			...openRun,
			endedAt: Date.now(),
			outcome,
			finishReason: details.finishReason ?? null,
			metrics: {
				durationMs: Date.now() - startedAt,
				ttftMs: firstChunkAt === null ? null : firstChunkAt - startedAt,
				steps: details.steps ?? 0,
				toolCalls: details.toolCalls ?? 0,
				inputTokens: details.inputTokens ?? null,
				outputTokens: details.outputTokens ?? null,
				reasoningTokens: details.reasoningTokens ?? null,
				totalTokens: details.totalTokens ?? null,
				// Ollama runs locally. A synthetic 0 would be averaged as a measurement.
				costUsd: null,
			},
			...(details.error ? { error: details.error } : {}),
		});
	}

	try {
		const result = streamText({
			model: createOllamaChatModel(modelId, { thinking: variantConfig.thinking }),
			system: CHAT_SYSTEM_PROMPT,
			messages: await convertToModelMessages(messages),
			onChunk: ({ chunk }) => {
				// Only generated content counts. `onChunk` also fires for `start` and
				// `start-step` control parts, which arrive as soon as the stream opens —
				// timing those reports a 5ms TTFT on a 16s turn.
				if (chunk.type !== 'text-delta' && chunk.type !== 'reasoning-delta') return;
				// Reasoning counts as generation: with `think: true` the first token the
				// model emits is often reasoning, and that is when waiting actually ends.
				if (firstChunkAt === null) firstChunkAt = Date.now();
			},
			onEnd: (event) => {
				const usage = event.usage;
				closeRun(event.text.trim() ? 'success' : 'empty', {
					steps: event.steps.length,
					toolCalls: event.toolCalls.length,
					finishReason: event.finishReason ?? null,
					inputTokens: usage.inputTokens ?? null,
					outputTokens: usage.outputTokens ?? null,
					reasoningTokens: usage.outputTokenDetails?.reasoningTokens ?? null,
					totalTokens: usage.totalTokens ?? null,
				});
			},
			onAbort: ({ steps }) => {
				// Client disconnected mid-stream. Recorded rather than dropped: a lost
				// run is data about reliability, and omitting it biases every rate.
				closeRun('aborted', { steps: steps.length });
			},
			onError: ({ error }) => {
				closeRun('error', {
					error: error instanceof Error ? error.message : String(error),
				});
			},
		});

		// The run id travels back as a header so an experiment driver can join its
		// own grading to this exact run. Without it the join would be by
		// (task, variant, trial), which breaks the moment a trial is retried.
		return result.toUIMessageStreamResponse({
			sendReasoning: true,
			headers: { 'X-Run-Id': runId },
		});
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: 'Failed to reach Ollama. Is it running with the gemma4 model pulled?';

		closeRun('error', { error: message });

		return new Response(JSON.stringify({ error: message }), {
			status: 502,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}
