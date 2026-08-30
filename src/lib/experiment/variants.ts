/**
 * Experiment arms.
 *
 * One registry mapping a variant id to the knobs it moves. Two rules keep this
 * an ablation rather than A/B vibes:
 *
 *   1. Every arm differs from `baseline` in exactly one field.
 *   2. Nothing outside this file decides what an arm does.
 *
 * The run record's `config` snapshot — not the variant label — is the ground
 * truth for analysis. A typo'd or retired label still produces an analysable
 * run, because what actually ran is written into the record.
 */

/** The knobs an arm may move. Add a field here, not a special case at the call site. */
export type VariantConfig = {
	/**
	 * Ollama's `think` setting. Pinned to `true` since the chat route was written
	 * and never measured — the reason this is the first experiment.
	 */
	thinking: boolean;
};

export const BASELINE = 'baseline';

const VARIANTS: Record<string, VariantConfig> = {
	[BASELINE]: { thinking: true },
	'v-nothink': { thinking: false },
};

/**
 * Resolve an arm's configuration, falling back to baseline for unknown labels.
 *
 * The fallback is deliberately silent-but-recorded: an unknown label still runs
 * and still writes a truthful `config` snapshot, so a mislabelled batch is
 * recoverable rather than lost. `isKnownVariant` lets a driver refuse up front.
 */
export function resolveVariantConfig(variant: string): VariantConfig {
	return VARIANTS[variant] ?? VARIANTS[BASELINE];
}

export function isKnownVariant(variant: string): boolean {
	return variant in VARIANTS;
}

export function knownVariants(): string[] {
	return Object.keys(VARIANTS);
}
