# Corpus v1 — Svelte 5 runes knowledge

**Frozen:** 2026-08-29 · **Count:** 8 tasks · **Source:** synthetic

## Inclusion rules

A task belongs here if it is:

1. **Answerable without tools.** The agent has no tool pipeline yet (`streamText` is called with no `tools`), so anything requiring a file read or write is out of scope until phase 3.
2. **In-domain.** `CHAT_SYSTEM_PROMPT` casts the model as a Svelte/web coding assistant. Tasks that leave that domain measure the model, not this app.
3. **Mechanically gradeable.** See below.
4. **Short.** Output length is a dependent variable; long-form tasks would swamp the token comparison with formatting variance.

## Grading: regex, not a judge

Each task carries a `checks` array of regexes. A trial passes iff **every** regex matches the assistant's text, case-insensitively.

This is deliberate. The prior `deep_research_assessment.md` work in this stack found LLM judges unreliable in two concrete ways — a hallucinated defect on topic 08, and honesty being penalised on topic 05. Introducing a judge here would add an unvalidated instrument to an experiment whose entire purpose is to validate the instrument.

Regex grading has real limits, stated plainly so nobody over-reads the numbers:

- It measures **whether the right rune was named**, not whether the surrounding explanation is correct.
- It cannot catch a response that names `$state` inside an argument against using it.
- `task-04`'s `on:?click` accepts both Svelte 5 (`onclick`) and Svelte 4 (`on:click`) syntax, so it does not test that distinction.

It is a floor, not a ceiling: a failing trial is definitely wrong; a passing trial is *probably* right. For comparing two arms on the same fixed tasks, a consistent floor is sufficient — both arms are measured by the identical, equally-blunt ruler.

## Difficulty spread

| difficulty | tasks | intent |
|---|---|---|
| easy | 01–03 | single-fact recall; should be near-ceiling for both arms |
| medium | 04–06 | short generation and translation |
| hard | 07–08 | requires distinguishing two similar APIs, or explaining a failure mode |

Easy tasks are included **to detect a broken harness**, not because they discriminate. If an arm fails `task-01`, the problem is the apparatus, not the hypothesis.

## Freeze discipline

Do not edit `tasks.jsonl` while a comparison is in flight. If a task must change, bump to `corpus v2` and re-run **both** arms — a mid-comparison edit silently invalidates every number computed before it.
