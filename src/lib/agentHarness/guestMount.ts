/** Guest SDK + manifest sources injected into WebContainer / Bun sandbox mount. */

export const AGENT_MANIFEST_JSON = JSON.stringify(
	{ version: 1, slots: ['main', 'sidebar', 'status'] },
	null,
	2
);

export const GUEST_SDK_TYPES = `export type HarnessCallMethod = 'read' | 'write';

export interface CallToolArgs {
  path: string;
  content?: string;
}
`;

export const GUEST_SDK_INDEX = `const pending = new Map();

function send(envelope) {
  window.parent.postMessage(envelope, '*');
}

window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.v !== 1 || data.dir !== 'host→guest') return;
  if (data.type === 'call-result' && data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.ok) resolve(data.result);
    else reject(new Error(data.error || 'call failed'));
  }
  if (data.type === 'context') {
    contextCache = data.payload || {};
    for (const fn of contextListeners) fn(contextCache);
  }
});

let contextCache = {};
const contextListeners = new Set();

function callId() {
  return 'call-' + Math.random().toString(36).slice(2, 10);
}

/** Emit a structured UI event to the host agent loop. */
export function emit(name, data) {
  send({ v: 1, dir: 'guest→host', type: 'emit', payload: { name, data } });
}

/** Proxy a host tool call (read-only in v1). */
export function callTool(method, args) {
  return new Promise((resolve, reject) => {
    const id = callId();
    pending.set(id, { resolve, reject });
    send({
      v: 1,
      dir: 'guest→host',
      type: 'call',
      id,
      method,
      args
    });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('call timeout'));
      }
    }, 15000);
  });
}

/** Subscribe to host context pushes. */
export function subscribe(fn) {
  contextListeners.add(fn);
  fn(contextCache);
  return () => contextListeners.delete(fn);
}

/** Latest host context snapshot. */
export function getContext() {
  return contextCache;
}
`;

export const COMPONENTS_GITKEEP = '';
