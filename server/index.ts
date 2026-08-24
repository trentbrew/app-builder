import {
	bootSession,
	createSession,
	destroySession,
	getSessionStatus,
	listSessions,
	proxyPreview,
	readSandboxDir,
	readSandboxFile,
	rebootSession,
	subscribeLogs,
	writeSandboxFile,
	mkdirSandbox
} from './sandboxManager';

const PORT = Number(process.env.SANDBOX_SERVER_PORT ?? 9899);

function json(data: unknown, status = 200) {
	return Response.json(data, { status });
}

function badRequest(message: string) {
	return json({ error: message }, 400);
}

async function readJson<T>(request: Request): Promise<T | null> {
	try {
		return (await request.json()) as T;
	} catch {
		return null;
	}
}

const server = Bun.serve({
	port: PORT,
	async fetch(request) {
		const url = new URL(request.url);
		const { pathname } = url;

		if (pathname === '/health') {
			return json({ ok: true, runtime: 'bun', version: Bun.version, sandboxes: listSessions().length });
		}

		if (pathname === '/api/sandbox/health') {
			return json({ ok: true, backend: 'bun', sandboxes: listSessions().length });
		}

		if (pathname === '/api/sandbox' && request.method === 'GET') {
			return json({ sandboxes: listSessions() });
		}

		if (pathname === '/api/sandbox' && request.method === 'POST') {
			const session = await createSession();
			return json(session, 201);
		}

		const sandboxMatch = pathname.match(/^\/api\/sandbox\/([^/]+)(?:\/(.*))?$/);
		if (sandboxMatch) {
			const id = sandboxMatch[1]!;
			const rest = sandboxMatch[2] ?? '';

			if (rest === '' && request.method === 'GET') {
				const status = getSessionStatus(id);
				return status ? json(status) : json({ error: 'Not found' }, 404);
			}

			if (rest === '' && request.method === 'DELETE') {
				await destroySession(id);
				return json({ ok: true });
			}

			if (rest === 'boot' && request.method === 'POST') {
				const body = await readJson<{ appContents?: string }>(request);
				if (!body?.appContents) return badRequest('appContents is required');
				try {
					const status = await bootSession(id, body.appContents);
					return json(status);
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Boot failed';
					return json({ error: message, ...(getSessionStatus(id) ?? {}) }, 500);
				}
			}

			if (rest === 'reboot' && request.method === 'POST') {
				const body = await readJson<{ appContents?: string }>(request);
				if (!body?.appContents) return badRequest('appContents is required');
				try {
					const status = await rebootSession(id, body.appContents);
					return json(status);
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Reboot failed';
					return json({ error: message, ...(getSessionStatus(id) ?? {}) }, 500);
				}
			}

			if (rest === 'files' && request.method === 'GET') {
				const filePath = url.searchParams.get('path') ?? '/';
				try {
					if (filePath.endsWith('/') || filePath === '/') {
						const entries = await readSandboxDir(id, filePath);
						return json({
							entries: entries.map((entry) => ({
								name: entry.name,
								isDirectory: entry.isDirectory()
							}))
						});
					}
					const content = await readSandboxFile(id, filePath);
					return json({ path: filePath, content });
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Read failed';
					return json({ error: message }, 404);
				}
			}

			if (rest === 'files' && request.method === 'PUT') {
				const body = await readJson<{ path?: string; content?: string }>(request);
				if (!body?.path || body.content === undefined) {
					return badRequest('path and content are required');
				}
				try {
					await writeSandboxFile(id, body.path, body.content);
					return json({ ok: true });
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Write failed';
					return json({ error: message }, 400);
				}
			}

			if (rest === 'files/mkdir' && request.method === 'POST') {
				const body = await readJson<{ path?: string; recursive?: boolean }>(request);
				if (!body?.path) return badRequest('path is required');
				try {
					await mkdirSandbox(id, body.path, body.recursive ?? true);
					return json({ ok: true });
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Mkdir failed';
					return json({ error: message }, 400);
				}
			}

			if (rest === 'logs' && request.method === 'GET') {
				const status = getSessionStatus(id);
				if (!status) return json({ error: 'Not found' }, 404);

				const stream = new ReadableStream<string>({
					start(controller) {
						for (const line of status.logs) {
							controller.enqueue(`data: ${JSON.stringify({ line })}\n\n`);
						}
						const unsubscribe = subscribeLogs(id, (line) => {
							controller.enqueue(`data: ${JSON.stringify({ line })}\n\n`);
						});
						request.signal.addEventListener('abort', () => {
							unsubscribe();
							controller.close();
						});
					}
				});

				return new Response(stream, {
					headers: {
						'Content-Type': 'text/event-stream',
						'Cache-Control': 'no-cache',
						Connection: 'keep-alive'
					}
				});
			}
		}

		const previewMatch = pathname.match(/^\/preview\/([^/]+)(\/.*)?$/);
		if (previewMatch) {
			const id = previewMatch[1]!;
			return proxyPreview(id, request);
		}

		return json({ error: 'Not found' }, 404);
	}
});

console.log(`[sandbox-server] listening on http://localhost:${server.port}`);
