export function clipboardHasImage(data: DataTransfer | null): boolean {
	if (!data) return false;
	return Array.from(data.items).some((item) => item.type.startsWith('image/'));
}
