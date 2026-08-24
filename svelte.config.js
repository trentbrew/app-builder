import { mdsvex } from 'mdsvex'
import adapter from '@sveltejs/adapter-vercel'

const config = {
  kit: {
    adapter: adapter({ runtime: 'nodejs22.x' }),
    alias: {
      // shadcn-svelte aliases
      '$lib/components': './src/lib/components',
      '$lib/utils': './src/lib/utils',
    },
  },
  preprocess: [mdsvex()],
  extensions: ['.svelte', '.svx'],
}

export default config
