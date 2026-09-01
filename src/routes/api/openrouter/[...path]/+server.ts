import { env } from '$env/dynamic/private'
import { proxyUpstream } from '$lib/server/piHost/proxy'
import type { RequestHandler } from './$types'

const TARGET = 'https://openrouter.ai'

/** OpenRouter fallback for the sandbox bridge. Attribution headers are required. */
const handler: RequestHandler = ({ request, params }) =>
  proxyUpstream({
    target: TARGET,
    path: params.path,
    request,
    authHeaders: env.OPENROUTER_API_KEY ? { authorization: `Bearer ${env.OPENROUTER_API_KEY}` } : {},
    extraHeaders: {
      'HTTP-Referer': 'https://github.com/trentbrew/pi-sprite',
      'X-Title': 'pi-sprite',
    },
  })

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
