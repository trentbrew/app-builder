export function dirname(path: string): string {
	const normalized = path.startsWith('/') ? path : `/${path}`
	const parts = normalized.split('/').filter(Boolean)
	if (parts.length <= 1) return '/'
	parts.pop()
	return `/${parts.join('/')}`
}

export function joinPath(dir: string, name: string): string {
	const base = dir === '/' ? '' : dir.replace(/\/$/, '')
	const segment = name.replace(/^\//, '')
	return `${base}/${segment}`.replace(/\/+/g, '/')
}
