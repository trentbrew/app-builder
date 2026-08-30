# Think mode — evaluation

**Experiment:** [experiment.md](./experiment.md) · **Corpus:** v1 frozen 2026-08-29 (8 tasks)
**Runs:** 48 trials (3 per variant × task), 0 errored · **Build:** `4e332b1-dirty`
**Model:** `gemma4` via local Ollama · **Date:** 2026-08-29

---

## Verdict

**Hypothesis partially supported — and its central prediction refuted.**

`think: false` is **2.4× faster and 2.4× cheaper with no detectable correctness cost**, including on the two tasks predicted to suffer.

| claim | verdict |
|---|---|
| reduces TTFT and output tokens | **supported** — 2.4× on both |
| no correctness loss on easy recall | **supported** |
| measurable correctness drop on hard tasks (07, 08) | **refuted** — both arms 12/12 |

---

## Results (distributions)

| variant | think | n | pass | ttft p50 | ttft p95 | dur p50 | dur mean | out tok p50 | out tok total |
|---|---|---|---|---|---|---|---|---|---|
| `baseline` | true | 24 | 20/24 (83%) | 516 ms | 921 ms | 14,041 ms | 20,872 ms | 375 | 13,153 |
| `v-nothink` | false | 24 | 22/24 (92%) | 401 ms | 458 ms | **5,874 ms** | 9,634 ms | **155** | **6,141** |

No isolation warnings: `config.thinking` was constant within each arm, and all 48 trials share one `buildId`.

### The correctness difference is not real

`v-nothink` scored *higher*, but with pooled p = 0.875 and n = 24 per arm:

```
SE(difference) = 9.5 pp     observed difference = 8.3 pp     z = 0.87
```

Under one standard error. **Report this as "no detectable difference", not as a win for `v-nothink`.** The pre-registered rule was ≤1 trial ⇒ underpowered; at 2 trials this clears the letter of that rule but plainly fails its intent, and the intent governs.

What *is* well outside noise is the cost.

### Derived: what thinking cost

`reasoningTokens` is `null` on all 48 runs (provider gap — see experiment.md, Instrument note 1). Recovering it by subtraction, valid here only because the arms differ in exactly one field:

```
median reasoning cost ≈ 375 − 155 = 220 output tokens  (59% of baseline's output)
corpus total          ≈ 13,153 − 6,141 = 7,012 tokens spent on reasoning
```

**Thinking consumed 53% of all tokens baseline produced, and bought nothing measurable on this corpus.**

The tails are worse than the medians suggest: baseline's slowest trial took **58.5 s** and its largest response was **1,548** tokens, against 32.8 s and 972 for `v-nothink`. TTFT p95 tells the same story — 921 ms vs 458 ms.

---

## Tradeoff read

On short Svelte knowledge questions, `think: true` is paying roughly **2.4× latency and 2.4× tokens for no accuracy**. On a local model that is wall-clock the user waits; on a hosted model it would be a direct bill.

The result is *not* "thinking is useless." It is: **this workload does not exercise what thinking is for.** Every corpus task is single-step recall or a short translation. Reasoning earns its cost on multi-step decomposition, and this corpus contains none — because the agent has no tools yet, so multi-step work does not exist to test.

---

## Failure taxonomy

6 failures across 48 trials.

| cluster | share | trials |
|---|---|---|
| **Svelte 4/5 version contamination** | 5/6 (83%) | baseline `task-03` ×2, baseline `task-05`, `v-nothink` `task-03`, `v-nothink` `task-06` |
| Grading strictness (arguable) | 1/6 (17%) | baseline `task-02` |

### Version contamination dominates — and thinking does not fix it

The model reverts to Svelte 4 idioms. The clearest instance, `baseline task-05` — a *thinking* run that still got it wrong:

> "The rune is **`$`** (specifically, using the `$:` label for reactive statements)."
> ```svelte
> let count = $state(0);
> $: { console.log(...) }
> ```

It mixes Svelte 5 (`$state`) with Svelte 4 (`$:`) in one snippet. The answer should be `$effect`. **Extra reasoning did not correct the version confusion** — it produced a more elaborate wrong answer.

Same pattern in `v-nothink task-06`: `$: doubled = $derived(count * 2)` — runes syntax inside a Svelte 4 reactive label.

### `task-03` is the corpus's real difficulty outlier

Labelled *easy*, it produced **3 of 6 failures** (baseline 1/3, `v-nothink` 2/3):

> "`export let` is replaced by simply declaring the prop variable at the top level" — wrong
> "`let`" — wrong
> "...akin to Vue's `props`..." — wrong, with Vue contamination

`$props` recall is empirically the hardest item, while both "hard" tasks scored 12/12. **The difficulty labels are wrong** and should be re-derived from observed pass rates in v2.

### The one grading artifact

`baseline task-02` answered `` `derived` `` — the concept without the `$`. The regex demanded `\$derived`.

Defensible as-is: `$derived` is the Svelte 5 rune, while bare `derived` is a *Svelte 4 store helper* — a different thing. The grader was **not** changed mid-run, and it applies identically to both arms, so it lowers absolute pass rates without biasing the comparison. Fix in v2 by tightening the *prompt* ("include the leading `$`"), not by loosening the regex — loosening would stop the task discriminating.

---

## Threats to validity

| threat | severity | note |
|---|---|---|
| **Representativeness** | **high** | 8 synthetic knowledge questions, no tool use, no multi-step work. This is the axis flagged weak at design time and it is the one that limits the conclusion. |
| Corpus size | medium | 8 tasks × 3 trials cannot resolve differences under ~10 pp |
| Arm ordering | low | `baseline` always ran first; any residual warming favours `v-nothink`. The observed direction favours `v-nothink`, so this cannot be ruled out as a contributor — another reason not to claim a correctness win |
| Grader bluntness | low | applies equally to both arms |
| Single model | medium | `gemma4` only; other models may allocate reasoning differently |

**The conclusion is scoped to this corpus.** It says nothing about thinking during tool-using agent work, which is the workload app-builder actually cares about.

---

## Conclusion

On corpus v1, `think: true` costs **2.4× wall-clock and 2.4× tokens** and delivers **no measurable correctness benefit** (z = 0.87). Its dominant failure mode — Svelte 4/5 version contamination, 5 of 6 failures — is **not corrected by reasoning**.

**Recommendation:** do *not* flip the default yet. The corpus that would justify flipping it — multi-step, tool-using tasks — cannot be built until the tool pipeline lands. Flipping on this evidence would be generalising from single-step recall to agent work, which is exactly the representativeness error the validity table flagged.

What this *does* justify: treating `think: true` as an **unvalidated cost** rather than a safe default, and re-running this comparison as the first experiment after tools land.

---

## Next hypothesis

Single-variable delta from the strongest observation, not from the arm that won:

> **Version contamination is a prompt problem, not a reasoning problem.** Adding the target Svelte version to `CHAT_SYSTEM_PROMPT` ("Svelte 5 runes only; `$:` and `export let` are Svelte 4 and must not be used") eliminates the majority of the version-contamination cluster, at no latency cost — and does so for *both* arms.

Falsifiable, one field (`systemPromptHash` already discriminates it), and it attacks the cluster that caused 83% of observed failures rather than the variable that happened to be under test.

---

## Regression additions

Promote to L3 — these are real defects with minimal repros:

| task | reason |
|---|---|
| `task-03` | `$props` recall fails 50% of the time; hardest item despite the "easy" label |
| `task-05` | thinking produced Svelte 4 `$:` mixed with Svelte 5 `$state` in one snippet |
| `task-06` | `$: doubled = $derived(...)` — runes syntax inside a Svelte 4 reactive label |

## Corpus v2 changes (do not apply mid-comparison)

1. Re-derive `difficulty` from observed pass rates — `task-03` is not easy.
2. Tighten `task-02`'s prompt to require the leading `$`; leave the regex alone.
3. Add tasks that require more than one step, **once tools exist** — the gap this experiment exposed.
