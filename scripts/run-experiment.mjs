#!/usr/bin/env node
/**
 * Experiment driver — runs a frozen corpus through /api/chat, once per arm per trial.
 *
 * Why HTTP and not Playwright: the agent loop is server-side. Driving a browser
 * would add rendering, hydration and WebContainer boot to every trial — three
 * sources of variance that are not under test, on the same machine that is
 * running the model. The URL `?variant=` param exists for interactive use; a
 * driver sends `variant` in the body directly and exercises the identical path.
 *
 * Two files come out of a session:
 *   runs/manifest.jsonl    written by the server (timing, tokens, outcome)
 *   runs/outcomes.jsonl    written here (grading), joined on runId
 *
 * Grading lives here, not in the envelope: correctness is corpus-specific, the
 * envelope is generic. Keeping them apart means a new corpus needs no server change.
 *
 * Usage:
 *   node scripts/run-experiment.mjs \
 *     --corpus docs/artifacts/experiments/think-mode/corpus/tasks.jsonl \
 *     --variants baseline,v-nothink \
 *     --trials 3
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** Cap on stored response text. Long enough to diagnose a failure, short enough to grep. */
const TEXT_CAP = 4000;

function parseArgs(argv) {
	const args = {
		corpus: 'docs/artifacts/experiments/think-mode/corpus/tasks.jsonl',
		variants: 'baseline,v-nothink',
		trials: 3,
		base: 'http://localhost:9898',
		out: 'runs/outcomes.jsonl',
		timeoutMs: 180_000,
	};
	for (let i = 2; i < argv.length; i += 2) {
		const key = argv[i]?.replace(/^--/, '');
		const value = argv[i + 1];
		if (key && value !== undefined && key in args) {
			args[key] = key === 'trials' || key === 'timeoutMs' ? Number(value) : value;
		}
	}
	return args;
}

async function loadCorpus(path) {
	const body = await readFile(resolve(path), 'utf8');
	return body
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}

/**
 * Pull assistant text out of the UI message stream.
 *
 * Only `text-delta` parts are concatenated. `reasoning-delta` is deliberately
 * excluded: grading the model's private reasoning would give the thinking arm
 * extra surface to match a regex on, which is exactly the bias this experiment
 * would be trying to measure.
 */
function extractText(sse) {
	let text = '';
	for (const line of sse.split('\n')) {
		if (!line.startsWith('data: ')) continue;
		const payload = line.slice(6).trim();
		if (!payload || payload === '[DONE]') continue;
		try {
			const event = JSON.parse(payload);
			if (event.type === 'text-delta' && typeof event.delta === 'string') text += event.delta;
		} catch {
			// partial or non-JSON frame — skip
		}
	}
	return text;
}

function grade(task, text) {
	const checks = Array.isArray(task.checks) ? task.checks : [];
	const results = checks.map((pattern) => ({
		pattern,
		matched: new RegExp(pattern, 'i').test(text),
	}));
	return { results, passed: results.length > 0 && results.every((r) => r.matched) };
}

async function runTrial({ base, task, variant, trial, timeoutMs }) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const startedAt = Date.now();

	try {
		const response = await fetch(`${base}/api/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				sessionId: `exp-${variant}-t${trial}`,
				variant,
				taskId: task.id,
				messages: [
					{ id: `${task.id}-${variant}-${trial}`, role: 'user', parts: [{ type: 'text', text: task.input }] },
				],
			}),
			signal: controller.signal,
		});

		if (!response.ok) {
			return { ok: false, error: `HTTP ${response.status}`, runId: response.headers.get('x-run-id') };
		}

		// The body must be drained fully: the server closes its run envelope from
		// the stream's onEnd, which only fires once the stream is consumed.
		const sse = await response.text();
		const text = extractText(sse);
		return {
			ok: true,
			runId: response.headers.get('x-run-id'),
			text,
			wallMs: Date.now() - startedAt,
		};
	} catch (error) {
		const aborted = error?.name === 'AbortError';
		return { ok: false, error: aborted ? `timeout after ${timeoutMs}ms` : String(error), runId: null };
	} finally {
		clearTimeout(timer);
	}
}

async function main() {
	const args = parseArgs(process.argv);
	const variants = args.variants.split(',').map((v) => v.trim()).filter(Boolean);
	const tasks = await loadCorpus(args.corpus);
	const outPath = resolve(args.out);
	await mkdir(dirname(outPath), { recursive: true });

	const total = variants.length * tasks.length * args.trials;
	console.log(
		`corpus ${tasks.length} tasks x ${variants.length} arms x ${args.trials} trials = ${total} runs`,
	);
	console.log(`arms: ${variants.join(', ')}\ntarget: ${args.base}\ngrading -> ${args.out}\n`);

	// Warm-up, discarded. Ollama loads the model on first use: a smoke run measured
	// ttft 11,307ms on the first request and 421ms on the next, same arm and task.
	// Without this the first arm in the first trial eats the load cost and looks
	// 25x slower than it is. Sent with `taskId` omitted so it is not a trial —
	// the analyzer only counts manifest rows that carry one.
	process.stdout.write('warming up model… ');
	const warm = await runTrial({
		base: args.base,
		task: { id: undefined, input: 'Reply with the single word: ready.' },
		variant: variants[0],
		trial: 0,
		timeoutMs: args.timeoutMs,
	});
	console.log(warm.ok ? `ok (${warm.wallMs}ms, discarded)\n` : `FAILED: ${warm.error}\n`);
	if (!warm.ok) {
		console.error('Refusing to run: the model is not reachable, so every trial would error.');
		process.exit(1);
	}

	let done = 0;
	let failures = 0;

	// Sequential on purpose. Concurrent requests contend for the same local
	// Ollama process, so latency would measure queueing rather than the arm.
	for (let trial = 1; trial <= args.trials; trial += 1) {
		for (const variant of variants) {
			for (const task of tasks) {
				const result = await runTrial({
					base: args.base,
					task,
					variant,
					trial,
					timeoutMs: args.timeoutMs,
				});
				done += 1;

				if (!result.ok) {
					failures += 1;
					console.log(`[${done}/${total}] ${variant} ${task.id} t${trial}  ERROR ${result.error}`);
					// Recorded, not skipped: a dropped trial biases every rate downstream.
					await appendFile(
						outPath,
						`${JSON.stringify({
							runId: result.runId,
							taskId: task.id,
							variant,
							trial,
							ok: false,
							error: result.error,
						})}\n`,
						'utf8',
					);
					continue;
				}

				const { passed, results } = grade(task, result.text);
				await appendFile(
					outPath,
					`${JSON.stringify({
						runId: result.runId,
						taskId: task.id,
						variant,
						trial,
						ok: true,
						passed,
						checks: results,
						chars: result.text.length,
						wallMs: result.wallMs,
						// The response itself, capped. Without it a FAIL is unattributable:
						// you cannot tell a wrong answer from a broken regex, and failure
						// clustering — the whole point of an evaluation — is impossible.
						// Irrecoverable once the run ends, so it is captured, not derived.
						text: result.text.slice(0, TEXT_CAP),
						truncated: result.text.length > TEXT_CAP,
					})}\n`,
					'utf8',
				);
				console.log(
					`[${done}/${total}] ${variant} ${task.id} t${trial}  ${passed ? 'PASS' : 'FAIL'}  ${result.wallMs}ms`,
				);
			}
		}
	}

	console.log(`\ndone. ${done - failures}/${done} completed, ${failures} errored.`);
	if (failures) console.log('Errored trials are recorded in the outcomes file, not dropped.');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
