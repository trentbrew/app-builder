import type { Component } from 'svelte';

export type AppHeaderBreadcrumb = {
	label: string;
	href?: string;
};

export type AppHeaderAction = {
	id: string;
	label: string;
	onclick: () => void;
	disabled?: boolean;
	variant?: 'default' | 'outline';
	icon?: Component;
};

export const appHeader = $state({
	breadcrumb: [] as AppHeaderBreadcrumb[],
	title: undefined as string | undefined,
	subtitle: undefined as string | undefined,
	actions: [] as AppHeaderAction[]
});

export function setAppHeader(options: {
	breadcrumb?: AppHeaderBreadcrumb[];
	title?: string;
	subtitle?: string;
	actions?: AppHeaderAction[];
}) {
	if (options.breadcrumb !== undefined) appHeader.breadcrumb = options.breadcrumb;
	if (options.title !== undefined) appHeader.title = options.title;
	if (options.subtitle !== undefined) appHeader.subtitle = options.subtitle;
	if (options.actions !== undefined) appHeader.actions = options.actions;
}

export function clearAppHeader() {
	appHeader.breadcrumb = [];
	appHeader.title = undefined;
	appHeader.subtitle = undefined;
	appHeader.actions = [];
}
