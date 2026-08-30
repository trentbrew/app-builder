import { decodeDds, parseHeaders } from 'dds-parser';

export type DdsDecodeResult = {
	width: number;
	height: number;
	format: string;
	canvas: HTMLCanvasElement;
};

export function decodeDdsBuffer(buffer: ArrayBuffer): DdsDecodeResult {
	const info = parseHeaders(buffer);
	const image = info.images[0];
	if (!image) {
		throw new Error('DDS file has no image data');
	}

	const slice = buffer.slice(image.offset, image.offset + image.length);
	const rgba = decodeDds(
		new Uint8Array(slice),
		info.format,
		image.shape.width,
		image.shape.height
	);

	const canvas = document.createElement('canvas');
	canvas.width = image.shape.width;
	canvas.height = image.shape.height;

	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not create canvas context');

	const pixels = new Uint8ClampedArray(rgba);
	const imageData = new ImageData(pixels, image.shape.width, image.shape.height);
	ctx.putImageData(imageData, 0, 0);

	return {
		width: image.shape.width,
		height: image.shape.height,
		format: info.format,
		canvas,
	};
}
