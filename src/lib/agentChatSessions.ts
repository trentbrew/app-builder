import { browser } from '$app/environment';
import { Chat } from '@ai-sdk/svelte';
import {
	DefaultChatTransport,
	lastAssistantMessageIsCompleteWithToolCalls,
	type UIMessage,
} from 'ai';
import {
	backfillMessageTimestamps,
	createMessageMetadata,
	getMessageText,
	type ChatMessageMetadata,
} from '$lib/ai/messages.js';
import { toast } from '$lib/notify';
import { loadPersistedChat } from '$lib/chat/persistence.js';
import { chatSettings } from '$lib/chat/settings.svelte.js';
import { BASELINE_VARIANT, resolveVariant } from '$lib/runEnvelope';
import { runTool } from '$lib/agent/tools/pipeline';
import { appendSessionEvent } from '$lib/agent/session/log';
import { resetApprovalTurn } from '$lib/agent/approval/approvalStore.svelte';
import { inferenceSnapshot } from '$lib/agent/inference/settings.svelte';

const sessions = new Map<string, Chat>();
let primarySessionId: string | null = null;

/**
 * Experiment arm for this page load, from `?variant=` (default `baseline`).
 *
 * Resolved once so every run in a session carries the same label, and sent to
 * `/api/chat` because the run log is written server-side — that is where token
 * usage and finish reason live.
 */
const RUN_VARIANT = browser ? resolveVariant(window.location.search) : BASELINE_VARIANT;

export function registerPrimaryAgentSession(sessionId: string) {
	if (!primarySessionId) primarySessionId = sessionId;
}

function stampAssistantMessage(chat: Chat, message: UIMessage) {
	const metadata = message.metadata as ChatMessageMetadata | undefined;
	if (typeof metadata?.createdAt === 'number') return;

	const index = chat.messages.findIndex((entry) => entry.id === message.id);
	if (index < 0) return;

	const existing = chat.messages[index];
	chat.messages[index] = {
		...existing,
		metadata: createMessageMetadata((existing.metadata ?? {}) as ChatMessageMetadata),
	};
}

function withMessageTimestamp<T extends { metadata?: unknown }>(message: T): T {
	const metadata = (message.metadata ?? {}) as ChatMessageMetadata;
	return {
		...message,
		metadata: createMessageMetadata(metadata),
	};
}

/**
 * Ceiling on tool calls per turn.
 *
 * Client-side tools drive the loop by resubmitting, so a model that keeps
 * calling a tool would resubmit forever — each round costing a real model call.
 * The budget makes that terminate. It is per turn, reset when the user speaks.
 */
const MAX_TOOL_CALLS_PER_TURN = 12;

type TurnState = { turnId: string; toolCalls: number };

/** Per-session turn bookkeeping. A turn spans every request until the model stops. */
const turns = new Map<string, TurnState>();

function currentTurn(sessionId: string): TurnState {
	let turn = turns.get(sessionId);
	if (!turn) {
		turn = { turnId: crypto.randomUUID(), toolCalls: 0 };
		turns.set(sessionId, turn);
	}
	return turn;
}

/** Begin a new turn. Called when the user sends, not when the model replies. */
function beginTurn(sessionId: string) {
	turns.set(sessionId, { turnId: crypto.randomUUID(), toolCalls: 0 });
	// A new turn drops any standing "allow all this turn" grant.
	resetApprovalTurn();
}

function createChat(sessionId: string): Chat {
	const persisted = sessionId === primarySessionId ? loadPersistedChat() : null;

	const chat = new Chat({
		messages: backfillMessageTimestamps(persisted?.messages ?? []),
		transport: new DefaultChatTransport({
			api: '/api/chat',
			prepareSendMessagesRequest: ({ messages, id, ...rest }) => ({
				...rest,
				id,
				body: {
					messages,
					model: chatSettings.model,
					sessionId,
					variant: RUN_VARIANT,
					turnId: currentTurn(sessionId).turnId,
					inference: inferenceSnapshot(),
				},
			}),
		}),
		/**
		 * Resubmit once every tool call in the assistant's message has a result,
		 * which is what turns client-side tools into a real multi-step loop.
		 */
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		/**
		 * Execute a tool the server forwarded. Runs through the guarded pipeline,
		 * never straight to the filesystem.
		 */
		onToolCall: async ({ toolCall }) => {
			const turn = currentTurn(sessionId);
			turn.toolCalls += 1;
			const callId = toolCall.toolCallId;
			// The step is the assistant message that emitted this call — the message
			// currently at the tail when the tool fires. Best-effort: absent, the
			// event is still valid, just not step-attributed.
			const stepId = chat.messages.at(-1)?.id;

			// Durable plane: the call is a fact the moment the model asks for it,
			// logged before it runs so a crash mid-execution still leaves the request
			// on record. Fire-and-forget — a durable-log stall must not delay the
			// tool result the loop is waiting on; `seq` order follows issue order.
			void appendSessionEvent(sessionId, {
				kind: 'tool/call',
				turnId: turn.turnId,
				stepId,
				callId,
				name: toolCall.toolName,
				args: toolCall.input,
			});

			if (turn.toolCalls > MAX_TOOL_CALLS_PER_TURN) {
				// Reported as a tool result rather than thrown: the model has to see
				// the refusal to stop asking, and the turn still needs to close.
				const error = `Tool budget exhausted (${MAX_TOOL_CALLS_PER_TURN} calls this turn). Stop and summarise what you changed.`;
				void appendSessionEvent(sessionId, {
					kind: 'tool/result',
					turnId: turn.turnId,
					stepId,
					callId,
					ok: false,
					error,
				});
				chat.addToolResult({
					tool: toolCall.toolName as never,
					toolCallId: callId,
					output: { error } as never,
				});
				return;
			}

			const result = await runTool(toolCall.toolName, toolCall.input, { turnId: turn.turnId });

			void appendSessionEvent(sessionId, {
				kind: 'tool/result',
				turnId: turn.turnId,
				stepId,
				callId,
				ok: result.ok,
				denied: result.denied,
				...(result.error ? { error: result.error } : { result: result.output }),
			});
			if (result.observed) {
				void appendSessionEvent(sessionId, {
					kind: 'fs/observed',
					turnId: turn.turnId,
					callId,
					path: result.observed.path,
					op: result.observed.op,
					snapshotId: result.snapshotId,
				});
			}

			chat.addToolResult({
				tool: toolCall.toolName as never,
				toolCallId: callId,
				output: result.output as never,
			});
		},
		onError: (error) => {
			toast.error(error.message || 'Chat request failed');
		},
		onFinish: ({ message }) => {
			stampAssistantMessage(chat, message);

			// Durable plane: capture the assistant side of the turn. `onFinish` fires
			// once per completed step, so the final text step records real text while
			// intermediate tool-only steps produce none — skip those so the folded
			// transcript stays clean. Usage is not on the client message (it lives in
			// the server run envelope); text + stepId are what the transcript needs.
			if (message.role !== 'assistant') return;
			const text = getMessageText(message).trim();
			if (!text) return;
			void appendSessionEvent(sessionId, {
				kind: 'assistant/message',
				turnId: currentTurn(sessionId).turnId,
				stepId: message.id,
				text,
			});
		},
	});

	return chat;
}

export function getAgentChat(sessionId: string): Chat {
	let chat = sessions.get(sessionId);
	if (!chat) {
		chat = createChat(sessionId);
		sessions.set(sessionId, chat);
	}
	return chat;
}

export function disposeAgentChatSession(sessionId: string) {
	sessions.delete(sessionId);
	turns.delete(sessionId);
	if (primarySessionId === sessionId) primarySessionId = null;
}

type SendMessageInput = Parameters<Chat['sendMessage']>[0];
type SendMessageOptions = Parameters<Chat['sendMessage']>[1];

export async function sendAgentChatMessage(
	sessionId: string,
	message?: SendMessageInput,
	options?: SendMessageOptions,
) {
	const chat = getAgentChat(sessionId);
	// A user message opens a new turn: fresh turnId, fresh tool budget.
	beginTurn(sessionId);
	const turnId = currentTurn(sessionId).turnId;
	// Durable plane: mark the turn boundary and record the prompt that opened it,
	// so the transcript folds out of the log rather than living only in ai-sdk's
	// in-memory `Chat.messages`.
	void appendSessionEvent(sessionId, { kind: 'turn/start', turnId });
	const promptText =
		message && 'text' in message && typeof message.text === 'string' ? message.text : null;
	if (promptText) {
		void appendSessionEvent(sessionId, { kind: 'user/message', turnId, text: promptText });
	}

	if (!message) {
		await chat.sendMessage(message, options);
		return;
	}

	if ('text' in message || 'files' in message || 'metadata' in message) {
		await chat.sendMessage(withMessageTimestamp(message), options);
		return;
	}

	await chat.sendMessage(message, options);
}

export function isAgentChatBusy(sessionId: string) {
	const chat = sessions.get(sessionId);
	if (!chat) return false;
	return chat.status === 'submitted' || chat.status === 'streaming';
}

export function stopAgentChat(sessionId: string) {
	const chat = sessions.get(sessionId);
	if (!chat) return;
	void chat.stop();
}
