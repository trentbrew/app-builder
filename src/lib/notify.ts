import { toast as sonnerToast } from 'svelte-sonner'
import { recordNotification, type NotificationType } from '$lib/notifications.svelte'

function track(type: NotificationType, message: string) {
	recordNotification(type, message)
}

export const toast = {
	...sonnerToast,
	success(message: string, data?: Parameters<typeof sonnerToast.success>[1]) {
		track('success', message)
		return sonnerToast.success(message, data)
	},
	error(message: string, data?: Parameters<typeof sonnerToast.error>[1]) {
		track('error', message)
		return sonnerToast.error(message, data)
	},
	info(message: string, data?: Parameters<typeof sonnerToast.info>[1]) {
		track('info', message)
		return sonnerToast.info(message, data)
	},
	warning(message: string, data?: Parameters<typeof sonnerToast.warning>[1]) {
		track('warning', message)
		return sonnerToast.warning(message, data)
	},
	message(message: string, data?: Parameters<typeof sonnerToast.message>[1]) {
		track('default', message)
		return sonnerToast.message(message, data)
	},
}
