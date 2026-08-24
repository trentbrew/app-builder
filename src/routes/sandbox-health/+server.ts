import { json } from '@sveltejs/kit';

const SANDBOX_SERVER_URL = process.env.SANDBOX_SERVER_URL ?? 'http://127.0.0.1:9899';

/** Probes the Bun sandbox server without surfacing proxy 5xx in the browser console. */
export async function GET() {
	try {
		const res = await fetch(`${SANDBOX_SERVER_URL}/api/sandbox/health`, {
			signal: AbortSignal.timeout(600)
		});
		if (res.ok) {
			const details = await res.json().catch(() => ({}));
			return json({ ok: true, backend: 'bun', ...details });
		}
	} catch {
		// Bun sandbox server unavailable — fall back to WebContainer in the client.
	}

	return json({ ok: false, backend: 'webcontainer' });
}
