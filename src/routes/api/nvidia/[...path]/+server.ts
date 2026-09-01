import { env } from '$env/dynamic/private'
import { proxyUpstream } from '$lib/server/piHost/proxy'
import type { RequestHandler } from './$types'

const TARGET = 'https://integrate.api.nvidia.com'

/** Sandbox LLM traffic. The bridge also probes /v1/models here for host health. */
const handler: RequestHandler = ({ request, params }) =>
  proxyUpstream({
    target: TARGET,
    path: params.path,
    request,
    authHeaders: env.NVIDIA_API_KEY ? { authorization: `Bearer ${env.NVIDIA_API_KEY}` } : {},
  })

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
