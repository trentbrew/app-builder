export type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'default'

export type NotificationRecord = {
	id: string
	type: NotificationType
	message: string
	createdAt: number
	read: boolean
}

const MAX_NOTIFICATIONS = 50

export const notifications = $state({
	items: [] as NotificationRecord[],
})

export function getUnreadNotificationCount() {
	return notifications.items.filter((item) => !item.read).length
}

export function recordNotification(type: NotificationType, message: string) {
	const next: NotificationRecord = {
		id: crypto.randomUUID(),
		type,
		message,
		createdAt: Date.now(),
		read: false,
	}

	notifications.items = [next, ...notifications.items].slice(0, MAX_NOTIFICATIONS)
}

export function markAllNotificationsRead() {
	if (!getUnreadNotificationCount()) return
	notifications.items = notifications.items.map((item) => ({ ...item, read: true }))
}

export function clearNotifications() {
	notifications.items = []
}

export function removeNotification(id: string) {
	notifications.items = notifications.items.filter((item) => item.id !== id)
}
