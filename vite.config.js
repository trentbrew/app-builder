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
	plugins: [tailwindcss(), sveltekit(), coepCoopPlugin]
});
