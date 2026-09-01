import { execFileSync } from 'node:child_process'
import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

/**
 * Short git SHA of the tree that produced this bundle, suffixed `-dirty` when
 * the working tree has uncommitted changes.
 *
 * Stamped into every run record. "Which code produced this trajectory" is the
 * one field that cannot be recovered after the fact, and comparing two arms
 * built from different trees is the easiest way to get a wrong answer.
 */
function resolveBuildId() {
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const dirty = execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return dirty ? `${sha}-dirty` : sha
  } catch {
    // no git, shallow checkout, or build container without the repo
    return 'unknown'
  }
}

// Plugin to set Cross-Origin-Embedder-Policy & Cross-Origin-Opener-Policy headers on all dev-server responses
const coepCoopPlugin = {
  name: 'vite:coep-coop',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/webcontainer/connect')) {
        res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none')
        next()
        return
      }
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      next()
    })
  },
}

const sandboxServer = process.env.SANDBOX_SERVER_URL ?? 'http://localhost:9899'

/** Guest Vite often requests /main.js against the studio origin; send it to the preview proxy. */
const previewRootAssetsPlugin = {
  name: 'vite:preview-root-assets',
  enforce: 'pre',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const pathname = req.url?.split('?')[0]
      if (pathname !== '/main.js') {
        next()
        return
      }
      const referer = req.headers.referer ?? ''
      const match = referer.match(/\/preview\/([^/]+)/)
      if (!match) {
        next()
        return
      }
      res.writeHead(302, { Location: `/preview/${match[1]}/main.js` })
      res.end()
    })
  },
}

export default defineConfig({
  server: {
    port: 9898,
    strictPort: true,
    hmr: { overlay: false },
    proxy: {
      '/api/sandbox': { target: sandboxServer, ws: true },
      '/preview': sandboxServer,
    },
  },
  define: {
    __APP_BUILDER_BUILD_ID__: JSON.stringify(resolveBuildId()),
  },
  plugins: [previewRootAssetsPlugin, tailwindcss(), sveltekit(), coepCoopPlugin],
  optimizeDeps: {
    // Exclude @xterm/xterm from dependency optimization,
    // as it might interfere with the dynamic client-side import.
    exclude: ['@xterm/xterm'],
  },
  ssr: {
    // Explicitly tell Vite not to process @xterm/xterm and its CSS during SSR
    // as they are client-side only dependencies.
    external: ['@xterm/xterm'],
    // Keep noExternal empty or adjust if other server-side deps need processing
    noExternal: [],
  },
})
