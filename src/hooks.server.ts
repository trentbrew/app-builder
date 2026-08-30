import type { Handle } from '@sveltejs/kit';

const CONNECT_PREFIX = '/webcontainer/connect';

export const handle: Handle = async ({ event, resolve }) => {
	const isConnectRoute = event.url.pathname.startsWith(CONNECT_PREFIX);
	const response = await resolve(event, {
		filterSerializedResponseHeaders: () => true
	});

	if (isConnectRoute) {
		// Connect pages must NOT be cross-origin isolated (WebContainer preview handshake).
		response.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
		response.headers.delete('Cross-Origin-Opener-Policy');
		return response;
	}

	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	return response;
};
