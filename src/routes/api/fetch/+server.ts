import type { RequestHandler } from './$types'

/**
 * Outbound web fetch for the sandbox agent's WebFetch tool.
 *
 * The sandbox cannot reach the network directly, so this relays on its behalf. Because
 * the caller controls the URL, this is an SSRF surface: loopback, link-local, private
 * ranges, non-http(s) schemes, and embedded credentials are all rejected before we
 * fetch, and the response is size-capped.
 *
 * Ported from pi-sprite `src/server/webFetchProxy.ts`.
 */

const MAX_BYTES = 256 * 1024
const FETCH_TIMEOUT_MS = 30_000

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false
  const [a, b] = parts
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!normalized) return true
  if (normalized === 'localhost' || normalized === '::1') return true
  if (normalized.endsWith('.localhost') || normalized.endsWith('.local')) return true
  return isPrivateIpv4(normalized)
}

function validateTargetUrl(rawUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed')
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed')
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error('Fetching local or private network URLs is not allowed')
  }
  return parsed
}

export const POST: RequestHandler = async ({ request }) => {
  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const rawUrl = typeof body.url === 'string' ? body.url.trim() : ''
  if (!rawUrl) return Response.json({ error: 'Missing url' }, { status: 400 })

  let target: URL
  try {
    target = validateTargetUrl(rawUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid URL'
    return Response.json({ error: message }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain,application/json,*/*;q=0.8',
        'User-Agent': 'pi-sprite-web-fetch/1.0',
      },
    })

    const buffer = Buffer.from(await response.arrayBuffer())
    const truncated = buffer.length > MAX_BYTES
    const slice = truncated ? buffer.subarray(0, MAX_BYTES) : buffer
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
    const isText =
      contentType.startsWith('text/') ||
      contentType.includes('json') ||
      contentType.includes('xml') ||
      contentType.includes('javascript')

    return Response.json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType,
      body: isText ? slice.toString('utf8') : slice.toString('base64'),
      encoding: isText ? 'utf8' : 'base64',
      truncated,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? `Fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s`
        : error instanceof Error
          ? error.message
          : String(error)
    return Response.json({ error: message }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
