import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Plugin to set Cross-Origin-Embedder-Policy & Cross-Origin-Opener-Policy headers on all dev-server responses
const coepCoopPlugin = {
	name: 'vite:coep-coop',
	configureServer(server) {
		server.middlewares.use((req, res, next) => {
			res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
			res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
			next();
		});
	}
};

export default defineConfig({
	server: { hmr: { overlay: false } },
	plugins: [tailwindcss(), sveltekit(), coepCoopPlugin],
	optimizeDeps: {
		// Exclude @xterm/xterm from dependency optimization,
		// as it might interfere with the dynamic client-side import.
		exclude: ['@xterm/xterm']
	},
	ssr: {
		// Explicitly tell Vite not to process @xterm/xterm and its CSS during SSR
		// as they are client-side only dependencies.
		external: ['@xterm/xterm'],
		// Keep noExternal empty or adjust if other server-side deps need processing
		noExternal: []
	}
});
