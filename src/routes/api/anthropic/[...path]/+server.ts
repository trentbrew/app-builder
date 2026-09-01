import { env } from '$env/dynamic/private'
import { anthropicAuthHeaders, resolveAnthropicCredential } from '$lib/server/piHost/anthropicAuth'
import { proxyUpstream } from '$lib/server/piHost/proxy'
import type { RequestHandler } from './$types'

const TARGET = 'https://api.anthropic.com'

/** Anthropic proxy. Auth falls back to the local Claude Code login when no key is set. */
const handler: RequestHandler = ({ request, params }) => {
  const credential = resolveAnthropicCredential(env.ANTHROPIC_API_KEY)
  return proxyUpstream({
    target: TARGET,
    path: params.path,
    request,
    authHeaders: credential ? anthropicAuthHeaders(credential) : {},
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
