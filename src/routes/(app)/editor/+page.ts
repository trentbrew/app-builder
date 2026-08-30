import { redirect } from '@sveltejs/kit';
import { LAST_PROJECT_KEY } from '$lib/projects/projectScope';

export const ssr = false;

export function load() {
	if (typeof localStorage !== 'undefined') {
		const last = localStorage.getItem(LAST_PROJECT_KEY);
		if (last) throw redirect(302, `/editor/${last}`);
	}
	throw redirect(302, '/dashboard');
}
