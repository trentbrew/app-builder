'use strict';

/**
 * WebContainer stack-trace shim for Expo CLI.
 *
 * Expo CLI (via caller-callsite → callsites) reads CallSite#getFileName().
 * WebContainer can yield undefined frames → callerCallsite().getFileName crashes.
 *
 * Patches:
 * 1. Error.prepareStackTrace — filter holes, substitute safe CallSite objects
 * 2. Module._load — wrap `callsites`, `caller-callsite`, and `caller-path`
 *
 * Loaded only from expo-dev.cjs (never NODE_OPTIONS / Metro workers).
 */
if (process.env.JEST_WORKER_ID) {
	// Metro transform workers must stay unpatched (structured clone / IPC).
} else {
	const fallbackFile = () => '/home/project-expo/node_modules/expo/bin/cli';

	function safeCallSite(site) {
		if (site && typeof site === 'object' && typeof site.getFileName === 'function') {
			const original = site.getFileName.bind(site);
			return {
				getFileName: () => {
					try {
						return original() || fallbackFile();
					} catch {
						return fallbackFile();
					}
				},
				getLineNumber: () => safeCall(site, 'getLineNumber', 1),
				getColumnNumber: () => safeCall(site, 'getColumnNumber', 1),
				getFunctionName: () => safeCall(site, 'getFunctionName', null),
				isNative: () => safeCall(site, 'isNative', false),
				isConstructor: () => safeCall(site, 'isConstructor', false),
				isEval: () => safeCall(site, 'isEval', false),
				isToplevel: () => safeCall(site, 'isToplevel', true),
				getEvalOrigin: () => safeCall(site, 'getEvalOrigin', undefined),
				getTypeName: () => safeCall(site, 'getTypeName', null),
				getMethodName: () => safeCall(site, 'getMethodName', null),
				getThis: () => safeCall(site, 'getThis', null),
				toString: () => (typeof site.toString === 'function' ? site.toString() : 'CallSite')
			};
		}

		return {
			getFileName: () => fallbackFile(),
			getLineNumber: () => 1,
			getColumnNumber: () => 1,
			getFunctionName: () => null,
			isNative: () => false,
			isConstructor: () => false,
			isEval: () => false,
			isToplevel: () => true,
			getEvalOrigin: () => undefined,
			getTypeName: () => null,
			getMethodName: () => null,
			getThis: () => null,
			toString: () => 'CallSite'
		};
	}

	function safeCall(site, method, fallback) {
		if (!site || typeof site[method] !== 'function') return fallback;
		try {
			return site[method]();
		} catch {
			return fallback;
		}
	}

	function sanitizeCallSites(sites) {
		if (!Array.isArray(sites)) return [safeCallSite(null), safeCallSite(null), safeCallSite(null)];
		const sanitized = sites.filter(Boolean).map(safeCallSite);
		while (sanitized.length < 3) {
			sanitized.push(safeCallSite(null));
		}
		return sanitized;
	}

	function wrapCallerCallsite(fn) {
		return function patchedCallerCallsite(options) {
			let site;
			try {
				site = fn(options);
			} catch {
				site = undefined;
			}
			return site ? safeCallSite(site) : safeCallSite(null);
		};
	}

	function wrapCallerPath(fn) {
		return function patchedCallerPath(options) {
			try {
				const path = fn(options);
				return path || fallbackFile();
			} catch {
				return fallbackFile();
			}
		};
	}

	const previousPrepare = Error.prepareStackTrace;
	Error.prepareStackTrace = function prepareStackTrace(error, stack) {
		const safeStack = stack.filter(Boolean).map(safeCallSite);
		if (previousPrepare) {
			const prepared = previousPrepare(error, safeStack);
			return sanitizeCallSites(Array.isArray(prepared) ? prepared : safeStack);
		}
		return safeStack;
	};

	const Module = require('module');
	const originalLoad = Module._load;

	function isModuleRequest(request, name) {
		const req = String(request);
		return req === name || new RegExp(`(?:^|[/\\\\])${name.replace('-', '\\-')}[/\\\\]`).test(req);
	}

	Module._load = function patchedLoad(request, parent, isMain) {
		const loaded = originalLoad.apply(this, arguments);

		if (isModuleRequest(request, 'callsites') && typeof loaded === 'function') {
			return function patchedCallsites() {
				return sanitizeCallSites(loaded());
			};
		}

		if (isModuleRequest(request, 'caller-callsite')) {
			const fn = typeof loaded === 'function' ? loaded : loaded?.default;
			if (typeof fn === 'function') {
				const wrapped = wrapCallerCallsite(fn);
				if (typeof loaded === 'function') return wrapped;
				if (loaded && typeof loaded === 'object') {
					loaded.default = wrapped;
					return loaded;
				}
			}
		}

		if (isModuleRequest(request, 'caller-path') && typeof loaded === 'function') {
			return wrapCallerPath(loaded);
		}

		return loaded;
	};
}
