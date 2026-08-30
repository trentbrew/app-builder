# Think mode — does Ollama's `think: true` earn its cost?

**Status:** complete — see [evaluation.md](./evaluation.md)
**Baseline:** `baseline` (current shipped behaviour, `think: true`)
**Corpus:** [`corpus/tasks.jsonl`](./corpus/tasks.jsonl) (v1, frozen 2026-08-29, 8 tasks)
**Companion to:** [app_builder_run_envelope.md](../../app_builder_run_envelope.md) · [app_builder_finding_semantics.md](../../app_builder_finding_semantics.md)

> Not filed under a `TRL-` wedge because none has been cut for it. If one is, move this
> directory to `docs/issues/TRL-N/` — the driver takes `--corpus`, so nothing breaks.

---

## Why this experiment first

Not because the answer matters most. Because **it is the only hypothesis the current system can answer.**

`streamText` is called with no `tools`, so `steps` is always 1 and `toolCalls` always 0. Three of the six process metrics the experiment role cares about are structurally pinned at zero until the tool pipeline lands. What remains — latency and tokens — is exactly what `think` moves.

The stronger reason: **the instrument is unvalidated.** The TTFT metric was wrong on its first real run and reported a plausible number for it (run-envelope §5). `reasoningTokens` has come back `null` on every run so far and nobody yet knows whether that is gemma4 not reporting the detail or a second wiring bug — and it is *the* dependent variable here. Better to discover that on a question nobody is staking a decision on.

This is shaking out the apparatus on an easy question before pointing it at a hard one.

---

## Hypothesis (falsifiable)

> Disabling `think` on `gemma4` reduces time-to-first-token and total output tokens on short Svelte knowledge tasks, **without** reducing correctness on tasks whose answers are single-fact recall — but *with* a measurable correctness drop on the two tasks that require distinguishing similar APIs (`task-07`, `task-08`).

Predicted tradeoff: **faster and cheaper, equal on easy, worse on hard.**

Stated this way it can fail in three distinct, informative ways:

| outcome | reading |
|---|---|
| no latency/token difference | `think: true` is not doing what the flag implies — check the wiring before the model |
| faster **and** equal on hard tasks | thinking is not earning its cost on this workload; flip the default |
| faster but worse on easy tasks too | the effect is broader than reasoning; the corpus is measuring something else |

---

## Variants

| id | change | held constant |
|---|---|---|
| `baseline` | `think: true` | model, system prompt, corpus, temperature, host |
| `v-nothink` | `think: false` | everything else |

One field, `VariantConfig.thinking`, defined once in [`src/lib/experiment/variants.ts`](../../../../src/lib/experiment/variants.ts). Nothing outside that file decides what an arm does, which is what makes this an ablation rather than two configurations that drifted apart.

The run record's `config.thinking` reports what **actually ran** — it is no longer a hardcoded `true`. The analyzer asserts that this value does not vary within an arm and prints `!! arm is not isolated` if it does.

---

## Task corpus

8 synthetic tasks, Svelte 5 runes, spanning easy recall to hard API distinction. Inclusion rules, grading limits, and freeze discipline are in [`corpus/README.md`](./corpus/README.md).

**Grading is regex, not an LLM judge** — deliberately. The `deep_research_assessment.md` work in this stack found judges unreliable in two concrete ways (a hallucinated defect, and honesty being penalised). Adding an unvalidated judge to an experiment whose purpose is validating instruments would defeat the point. Regex is a blunt floor, applied identically to both arms.

---

## Metrics

**Outcome**
- pass rate (all `checks` match, case-insensitive)
- per-task pass rate — separates discriminating tasks from noise

**Process**
- `ttftMs` — median and p95
- `durationMs` — median
- `outputTokens` — median
- `reasoningTokens` — median (**suspect; see §Why this experiment first**)

Medians and spread, never bare means: with a handful of trials against a local model, one cold-start outlier moves a mean enough to invent a result.

---

## Trials

3 per (variant × task) = **48 runs**. Enough to see a large effect and to expose instrument bugs; **not** enough to call a small correctness difference. If pass rates land within one trial of each other, the honest verdict is `inconclusive / underpowered`, not a winner.

---

## Benchmark validity

| axis | how it is satisfied |
|---|---|
| Validity | latency and tokens are measured at the source (`onEnd` usage), not inferred from wall clock |
| Representativeness | tasks match the shipped system prompt's domain; **weak** — synthetic, not drawn from real usage |
| Reproducibility | `buildId` stamped per run; corpus frozen; model pinned; analyzer flags runs spanning builds |
| Isolation | one field differs; driver is sequential so trials do not contend for the local model |
| Statistical honesty | medians + p95; n stated; underpowered results reported as such |
| Gaming-resistance | outcome **and** process metrics — an arm cannot win by answering faster and wronger |
| Baseline | `baseline` is the currently shipped behaviour, not a strawman |
| Stability | corpus versioned; edits require a version bump and a full re-run of both arms |

**Known weakness:** representativeness. These are synthetic knowledge questions, not captured user turns. A result here is about *this corpus*, and the conclusion must say so.

---

## Running it

```bash
# terminal 1 — Ollama must be reachable and gemma4 pulled
ollama serve

# terminal 2
pnpm dev

# terminal 3
node scripts/run-experiment.mjs \
  --corpus docs/artifacts/experiments/think-mode/corpus/tasks.jsonl \
  --variants baseline,v-nothink \
  --trials 3

node scripts/analyze-runs.mjs
```

Two files result, joined on `runId` (returned by the server as the `X-Run-Id` header):

| file | written by | contains |
|---|---|---|
| `runs/manifest.jsonl` | the server | timing, tokens, outcome, config snapshot |
| `runs/outcomes.jsonl` | the driver | pass/fail per check, response length |

Both are gitignored. Commit `evaluation.md`, never raw runs.

---

## Acceptance criteria

- test: `node scripts/run-experiment.mjs --trials 3` completes 48 runs with 0 errored trials
- test: `node scripts/analyze-runs.mjs` prints no `!!` isolation warnings
- test: every trial in `runs/manifest.jsonl` carries a `taskId` and a non-null `ttftMs`
- deliverable: `evaluation.md` with distributions, per-task breakdown, and a verdict of
  `supported | refuted | inconclusive(reason)` per [finding semantics](../../app_builder_finding_semantics.md)

---

## Instrument notes (found by the smoke run, before the real run)

A 2-task × 2-arm smoke pass was run first, specifically to shake out the apparatus. It found two defects. Both would have corrupted the real numbers.

### 1. `reasoningTokens` is never populated — use subtraction instead

Smoke evidence, `baseline` / `task-01` ("which rune declares reactive state?"):

| field | value |
|---|---|
| `outputTokens` | **141** |
| graded text length | **10 chars** |
| `reasoningTokens` | **null** |

141 output tokens produced ten characters of visible answer. The reasoning unambiguously happened — but `usage.outputTokenDetails.reasoningTokens` is not broken out by the Ollama provider, so the field is `null` on *every* run including thinking ones.

**This is a provider gap, not a wiring bug in the envelope** — the same code path correctly populates `inputTokens`, `outputTokens` and `totalTokens`.

Consequence for this experiment: the pre-registered rule ("if `reasoningTokens` is null across all runs, report no reasoning-cost result") is **satisfiable another way**. Reasoning cost is recoverable by subtraction on the same task:

```
reasoning cost ≈ outputTokens(think=true) − outputTokens(think=false)
```

That is a *derived* quantity and must be labelled as such in `evaluation.md` — it attributes the whole per-arm token delta to reasoning, which is only sound because the arms differ in exactly one field.

### 2. Cold start contaminated the first measurement

Same arm, same task, consecutive requests: `ttft = 11,307 ms` then `421 ms`. Ollama loads the model on first use, and the first arm in the first trial was paying for it — a **25×** distortion landing entirely on `baseline`, the arm that runs first.

Fixed: the driver now sends a discarded warm-up request before any trial, and refuses to run if it fails. The warm-up omits `taskId`, so the analyzer (which counts only manifest rows carrying one) never sees it.

**Residual caveat, not fixed:** within each trial the arms always run in the same order (`baseline` then `v-nothink`). Any remaining warming trend therefore favours `v-nothink`. With the warm-up in place this should be small, but it is a known asymmetry and `evaluation.md` must not claim a latency win smaller than it.

### 3. The driver recorded verdicts but not trajectories — run aborted and restarted

The first full run was **killed at trial 7 of 48** and its data discarded.

`baseline` failed `task-05` and `task-06`, and those failures were **unattributable**: the driver stored `passed: false` and a character count, but not what the model actually said. There was no way to tell a wrong answer from an over-strict regex — and the failure taxonomy is a required deliverable, not a nice-to-have.

The experiment role states the principle directly:

> *Trajectory data is the difference between evaluating an agent and merely grading it.*

Response text is **irrecoverable** once a run ends, which puts it in the same category as `buildId` and token usage: capture it now or lose it. The driver now stores the response (capped at 4,000 chars, with a `truncated` flag).

Aborting at 15% cost about three minutes. Completing all 48 runs would have produced a dataset that could answer "which arm won" but not "why did it lose" — the more valuable question, and the one that generates the next hypothesis.

> **Lesson.** A verdict without its evidence is not a result, it is a rumour. Check that your apparatus captures *why*, not just *what*, before spending the run budget.

---

## Pre-registered analysis

Written **before** seeing results, so the analysis cannot be fitted to them:

1. Compare median `ttftMs` and median `outputTokens` across arms.
2. Compare pass rate overall, then split easy (01–03) / medium (04–06) / hard (07–08).
3. If `reasoningTokens` is null across all runs, **report no reasoning-cost result** and open an instrument defect instead.
4. If overall pass rates differ by ≤ 1 trial, the verdict is `inconclusive(underpowered)` regardless of which direction it leans.
