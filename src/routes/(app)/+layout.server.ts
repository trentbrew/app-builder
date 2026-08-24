import type { LayoutServerLoad } from './$types';

const SANDBOX_SERVER_URL = process.env.SANDBOX_SERVER_URL ?? 'http://127.0.0.1:9899';

export const load: LayoutServerLoad = async () => {
	const forced = process.env.PUBLIC_SANDBOX_BACKEND;
	if (forced === 'bun' || forced === 'webcontainer') {
		return { sandboxBackend: forced };
	}

	try {
		const res = await fetch(`${SANDBOX_SERVER_URL}/api/sandbox/health`, {
			signal: AbortSignal.timeout(600)
		});
		if (res.ok) {
			return { sandboxBackend: 'bun' as const };
		}
	} catch {
		// Bun sandbox server unavailable — client uses WebContainer.
	}

	return { sandboxBackend: 'webcontainer' as const };
};
