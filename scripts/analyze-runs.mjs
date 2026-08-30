#!/usr/bin/env node
/**
 * Join the server's run manifest to the driver's grading and report per-arm distributions.
 *
 * Reports medians and spread, never bare means: with a handful of trials against
 * a local model, one cold-start outlier moves a mean enough to invent a result.
 *
 * Usage:
 *   node scripts/analyze-runs.mjs [--manifest runs/manifest.jsonl] [--outcomes runs/outcomes.jsonl]
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function parseArgs(argv) {
	const args = { manifest: 'runs/manifest.jsonl', outcomes: 'runs/outcomes.jsonl' };
	for (let i = 2; i < argv.length; i += 2) {
		const key = argv[i]?.replace(/^--/, '');
		if (key && key in args && argv[i + 1]) args[key] = argv[i + 1];
	}
	return args;
}

async function readJsonl(path) {
	try {
		const body = await readFile(resolve(path), 'utf8');
		return body
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean)
			.flatMap((l) => {
				try {
					return [JSON.parse(l)];
				} catch {
					return []; // torn tail line; see runEnvelope.parseManifestJsonl
				}
			});
	} catch {
		return [];
	}
}

const median = (xs) => {
	if (!xs.length) return null;
	const s = [...xs].sort((a, b) => a - b);
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

const quantile = (xs, q) => {
	if (!xs.length) return null;
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

const nums = (rows, pick) => rows.map(pick).filter((v) => typeof v === 'number' && Number.isFinite(v));
const fmt = (v, unit = '') => (v === null || v === undefined ? '—' : `${v}${unit}`);

async function main() {
	const args = parseArgs(process.argv);
	const manifest = await readJsonl(args.manifest);
	const outcomes = await readJsonl(args.outcomes);

	if (!manifest.length) {
		console.error(`No runs in ${args.manifest}. Run the driver first.`);
		process.exit(1);
	}

	const gradeByRunId = new Map(outcomes.filter((o) => o.runId).map((o) => [o.runId, o]));

	// Only runs that carry a taskId are trials; interactive turns share the manifest.
	const trials = manifest.filter((r) => r.taskId);
	const orphans = trials.filter((r) => !gradeByRunId.has(r.runId)).length;

	const byVariant = new Map();
	for (const run of trials) {
		if (!byVariant.has(run.variant)) byVariant.set(run.variant, []);
		byVariant.get(run.variant).push({ run, grade: gradeByRunId.get(run.runId) ?? null });
	}

	console.log(`\nruns in manifest: ${manifest.length}   trials (with taskId): ${trials.length}`);
	console.log(`graded: ${trials.length - orphans}   ungraded: ${orphans}\n`);

	// A config that varies inside one arm means the label is lying — check before reporting.
	for (const [variant, rows] of byVariant) {
		const thinking = new Set(rows.map((r) => r.run.config?.thinking));
		const builds = new Set(rows.map((r) => r.run.buildId));
		if (thinking.size > 1) {
			console.log(`!! ${variant}: mixed thinking=${[...thinking].join(',')} — arm is not isolated`);
		}
		if (builds.size > 1) {
			console.log(`!! ${variant}: spans builds ${[...builds].join(', ')} — not one instrument`);
		}
	}

	const header = [
		'variant',
		'think',
		'n',
		'pass',
		'ttft p50',
		'ttft p95',
		'dur p50',
		'out tok p50',
		'reason tok p50',
	];
	const rowsOut = [];

	for (const [variant, rows] of [...byVariant].sort()) {
		const graded = rows.filter((r) => r.grade && r.grade.ok);
		const passes = graded.filter((r) => r.grade.passed).length;
		const ttft = nums(rows, (r) => r.run.metrics?.ttftMs);
		const dur = nums(rows, (r) => r.run.metrics?.durationMs);
		const outTok = nums(rows, (r) => r.run.metrics?.outputTokens);
		const reasonTok = nums(rows, (r) => r.run.metrics?.reasoningTokens);

		rowsOut.push([
			variant,
			String(rows[0]?.run.config?.thinking ?? '—'),
			String(rows.length),
			graded.length ? `${passes}/${graded.length} (${Math.round((100 * passes) / graded.length)}%)` : '—',
			fmt(median(ttft), 'ms'),
			fmt(quantile(ttft, 0.95), 'ms'),
			fmt(median(dur), 'ms'),
			fmt(median(outTok)),
			reasonTok.length ? fmt(median(reasonTok)) : 'null',
		]);
	}

	const widths = header.map((h, i) =>
		Math.max(h.length, ...rowsOut.map((r) => r[i].length)),
	);
	const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
	console.log(line(header));
	console.log(widths.map((w) => '-'.repeat(w)).join('  '));
	for (const r of rowsOut) console.log(line(r));

	// Per-task pass rates expose tasks that discriminate from tasks that are noise.
	console.log('\nper-task pass rate');
	const taskIds = [...new Set(trials.map((r) => r.taskId))].sort();
	const variants = [...byVariant.keys()].sort();
	console.log(line(['task', ...variants.map((v) => v.padEnd(10))].slice(0, 1 + variants.length)));
	for (const taskId of taskIds) {
		const cells = [taskId.padEnd(8)];
		for (const variant of variants) {
			const rows = (byVariant.get(variant) ?? []).filter(
				(r) => r.run.taskId === taskId && r.grade?.ok,
			);
			const passes = rows.filter((r) => r.grade.passed).length;
			cells.push(rows.length ? `${passes}/${rows.length}`.padEnd(10) : '—'.padEnd(10));
		}
		console.log(cells.join('  '));
	}

	if (reasoningAllNull(trials)) {
		console.log(
			'\nNOTE: reasoningTokens is null on every trial. Either the provider does not report\n' +
				'the detail for this model, or the field is mis-wired. Do not report a reasoning-cost\n' +
				'result until this is resolved — see app_builder_run_envelope.md §5.',
		);
	}
}

function reasoningAllNull(trials) {
	return trials.length > 0 && trials.every((r) => r.metrics?.reasoningTokens == null);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
