import { dev } from '$app/environment'
import { error } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { credentialForPiAuth, resolveAnthropicCredential } from '$lib/server/piHost/anthropicAuth'
import type { RequestHandler } from './$types'

/**
 * Hand the local sandbox the developer's own Anthropic credential so the agent inside
 * the WebContainer can write its auth.json without the user pasting a key.
 *
 * DEV ONLY, and deliberately so. The response body contains live OAuth access and
 * refresh tokens, and this route carries no authentication of its own — it is safe
 * solely because it is unreachable outside a local dev server. The `dev` guard is the
 * security boundary, not a convenience: without it, a deployed build would expose
 * whatever credential the host happens to resolve to any unauthenticated caller.
 *
 * Ported from pi-sprite's Vite `anthropicBridgePlugin`, which was structurally
 * dev-only because it lived in `configureServer`. A SvelteKit route is not, so the
 * constraint has to be stated explicitly here.
 */
export const GET: RequestHandler = () => {
  if (!dev) error(404, 'Not found')

  const credential = resolveAnthropicCredential(env.ANTHROPIC_API_KEY)
  return Response.json({
    available: Boolean(credential),
    source: credential?.source ?? null,
    auth: credential ? credentialForPiAuth(credential) : null,
  })
}
