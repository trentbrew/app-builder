/**
 * Anthropic credential resolution for the WebContainer sandbox bridge.
 *
 * Ported from pi-sprite `examples/webcontainer-react/src/server/claudeCodeAuth.ts`.
 * Reads the local Claude Code login (Keychain, then on-disk credential files) so a
 * sandbox can talk to Anthropic without the user pasting a key.
 *
 * This is inherently a LOCAL-DEV capability: it shells out to the macOS Keychain and
 * reads the developer's home directory. On a deployed host none of those exist and
 * every reader returns null, so callers get `available: false` rather than an error.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const KEYCHAIN_SERVICE = 'Claude Code-credentials'
const PI_AUTH_PATH = join(homedir(), '.pi', 'agent', 'auth.json')
const CLAUDE_CREDENTIALS_PATH = join(homedir(), '.claude', '.credentials.json')

export type AnthropicOAuthCredential = {
  type: 'oauth'
  access: string
  refresh: string
  expires: number
  source: string
}

export type AnthropicApiKeyCredential = {
  type: 'api_key'
  key: string
  source: string
}

export type AnthropicCredential = AnthropicOAuthCredential | AnthropicApiKeyCredential

type CacheEntry = {
  credential: AnthropicCredential | null
  expiresAt: number
}

let cache: CacheEntry | null = null
const CACHE_TTL_MS = 30_000

function parseOAuthPayload(raw: string, source: string): AnthropicOAuthCredential | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  const data = (parsed as { claudeAiOauth?: unknown }).claudeAiOauth ?? parsed
  const creds = data as {
    accessToken?: unknown
    refreshToken?: unknown
    expiresAt?: unknown
  }

  if (
    typeof creds.accessToken !== 'string' ||
    typeof creds.refreshToken !== 'string' ||
    typeof creds.expiresAt !== 'number'
  ) {
    return null
  }

  return {
    type: 'oauth',
    access: creds.accessToken,
    refresh: creds.refreshToken,
    expires: creds.expiresAt,
    source,
  }
}

function readKeychainCredential(): AnthropicOAuthCredential | null {
  if (process.platform !== 'darwin') return null
  try {
    const raw = execSync(`security find-generic-password -s "${KEYCHAIN_SERVICE}" -w`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim()
    return parseOAuthPayload(raw, KEYCHAIN_SERVICE)
  } catch {
    return null
  }
}

function readClaudeCredentialsFile(): AnthropicOAuthCredential | null {
  if (!existsSync(CLAUDE_CREDENTIALS_PATH)) return null
  try {
    return parseOAuthPayload(readFileSync(CLAUDE_CREDENTIALS_PATH, 'utf8'), CLAUDE_CREDENTIALS_PATH)
  } catch {
    return null
  }
}

function readPiAuthJson(): AnthropicOAuthCredential | null {
  if (!existsSync(PI_AUTH_PATH)) return null
  try {
    const parsed = JSON.parse(readFileSync(PI_AUTH_PATH, 'utf8')) as Record<
      string,
      { type?: string; access?: string; refresh?: string; expires?: number }
    >
    const entry = parsed.anthropic ?? parsed['sprite-anthropic']
    if (
      entry?.type === 'oauth' &&
      typeof entry.access === 'string' &&
      typeof entry.refresh === 'string' &&
      typeof entry.expires === 'number'
    ) {
      return {
        type: 'oauth',
        access: entry.access,
        refresh: entry.refresh,
        expires: entry.expires,
        source: PI_AUTH_PATH,
      }
    }
  } catch {
    return null
  }
  return null
}

/** Resolve Anthropic auth for the sandbox bridge (env key → Keychain → files). */
export function resolveAnthropicCredential(envApiKey?: string): AnthropicCredential | null {
  if (cache && Date.now() < cache.expiresAt) {
    return cache.credential
  }

  const credential: AnthropicCredential | null = envApiKey?.trim()
    ? { type: 'api_key', key: envApiKey.trim(), source: 'ANTHROPIC_API_KEY' }
    : (readKeychainCredential() ?? readPiAuthJson() ?? readClaudeCredentialsFile())

  cache = { credential, expiresAt: Date.now() + CACHE_TTL_MS }
  return credential
}

export function anthropicAvailable(envApiKey?: string): boolean {
  return resolveAnthropicCredential(envApiKey) !== null
}

/** Shape the credential the way pi's agent expects to find it in auth.json. */
export function credentialForPiAuth(
  credential: AnthropicCredential,
  providerId = 'sprite-anthropic',
): Record<string, unknown> {
  if (credential.type === 'oauth') {
    return {
      [providerId]: {
        type: 'oauth',
        access: credential.access,
        refresh: credential.refresh,
        expires: credential.expires,
      },
    }
  }
  return {
    [providerId]: {
      type: 'api_key',
      key: credential.key,
    },
  }
}

/** Auth headers for a proxied Anthropic request. OAuth and API keys differ. */
export function anthropicAuthHeaders(credential: AnthropicCredential): Record<string, string> {
  if (credential.type === 'oauth') {
    return {
      authorization: `Bearer ${credential.access}`,
      'anthropic-version': '2023-06-01',
      'anthropic-beta':
        'claude-code-20250219,oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14,interleaved-thinking-2025-05-14',
    }
  }
  return {
    'x-api-key': credential.key,
    'anthropic-version': '2023-06-01',
  }
}
