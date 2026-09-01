/**
 * Streaming upstream proxy for the sandbox LLM bridge.
 *
 * Replaces the Vite `server.proxy` entries from pi-sprite's vite.config.ts. Those were
 * dev-server middleware and did not exist in a production build; as SvelteKit endpoints
 * the same routes work in dev, preview, and deploy.
 *
 * Request and response bodies are passed through unbuffered so token streaming survives.
 */

/** Hop-by-hop and host-scoped headers that must not be forwarded upstream. */
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'content-length',
  'accept-encoding',
  'origin',
  'referer',
  'cookie',
])

/** Response headers that describe the upstream hop rather than the payload. */
const STRIPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'content-encoding',
  'content-length',
])

export type ProxyOptions = {
  /** Upstream origin, e.g. https://integrate.api.nvidia.com */
  target: string
  /** Path after the /api/<provider> prefix, from the [...path] param. */
  path: string
  request: Request
  /** Headers to add. A caller-supplied Authorization always wins over these. */
  authHeaders?: Record<string, string>
  /** Extra headers applied unconditionally (attribution, versioning). */
  extraHeaders?: Record<string, string>
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 120_000

export async function proxyUpstream({
  target,
  path,
  request,
  authHeaders = {},
  extraHeaders = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ProxyOptions): Promise<Response> {
  const incoming = new URL(request.url)
  const url = new URL(`/${path}`.replace(/\/+/g, '/'), target)
  url.search = incoming.search

  const headers = new Headers()
  for (const [key, value] of request.headers) {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value)
  }
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value)

  // The sandbox may carry its own key; only fill in host credentials when it does not.
  const callerAuthorized = headers.has('authorization') || headers.has('x-api-key')
  if (!callerAuthorized) {
    for (const [key, value] of Object.entries(authHeaders)) headers.set(key, value)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  // Abort upstream when the browser disconnects mid-stream.
  request.signal.addEventListener('abort', () => controller.abort(), { once: true })

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'

  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      // Required by undici whenever a stream is used as the body.
      duplex: hasBody ? 'half' : undefined,
      redirect: 'manual',
      signal: controller.signal,
    } as RequestInit)

    const outHeaders = new Headers()
    for (const [key, value] of response.headers) {
      if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) outHeaders.set(key, value)
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? `Upstream request timed out after ${timeoutMs / 1000}s`
        : error instanceof Error
          ? error.message
          : String(error)
    return Response.json({ error: message, target: url.origin }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
