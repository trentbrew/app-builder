#!/usr/bin/env node
/**
 * Token parity: app_builder_cli_copilot_design.md YAML ↔ mock :root
 *
 * v1 has no HTML mockup yet (per design §1 note: defer mock until spec
 * is accepted). Until the mock lands, this verifier checks only that
 * the YAML frontmatter is internally consistent — every component that
 * references a token must reference a defined color, and every color
 * that is referenced must be defined.
 *
 * When a mockup is added, extend the `pairs` table below and gate on
 * the same parity contract the harness artifact uses.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const designPath = join(dir, 'app_builder_cli_copilot_design.md')

const design = readFileSync(designPath, 'utf8')
const yamlBlock = design.match(/^---\n([\s\S]*?)\n---/m)?.[1] ?? ''

const definedColors = new Set([...yamlBlock.matchAll(/^  ([\w-]+): ['"](.+)['"]\s*$/gm)].map((m) => m[1]))

const referencedColors = new Set()
for (const m of yamlBlock.matchAll(/\{colors\.([\w-]+)\}/g)) {
  referencedColors.add(m[1])
}

let failed = 0

// Every referenced color must be defined.
for (const ref of referencedColors) {
  if (!definedColors.has(ref)) {
    console.error(`✗ undefined color referenced: {colors.${ref}}`)
    failed++
  } else {
    console.log(`✓ {colors.${ref}} → defined`)
  }
}

// Sanity: the copilot-specific tokens must exist.
const required = ['copilot-stream', 'copilot-pending', 'copilot-error']
for (const c of required) {
  if (!definedColors.has(c)) {
    console.error(`✗ required color missing from frontmatter: ${c}`)
    failed++
  } else {
    console.log(`✓ required color present: ${c}`)
  }
}

// Sanity: typography must declare body + mono (same as base).
if (!/body:\s*\n\s+fontFamily:/m.test(yamlBlock)) {
  console.error('✗ typography.body.fontFamily missing')
  failed++
} else {
  console.log('✓ typography.body declared')
}
if (!/mono:\s*\n\s+fontFamily:/m.test(yamlBlock)) {
  console.error('✗ typography.mono.fontFamily missing')
  failed++
} else {
  console.log('✓ typography.mono declared')
}

// Sanity: rounded.lg must exist.
if (!/rounded:\s*\n\s+lg:\s*\S/m.test(yamlBlock)) {
  console.error('✗ rounded.lg missing')
  failed++
} else {
  console.log('✓ rounded.lg declared')
}

if (failed) {
  console.error(`\n${failed} token parity failure(s)`)
  process.exit(1)
}
console.log('\nAll token pairs verified.')
process.exit(0)
