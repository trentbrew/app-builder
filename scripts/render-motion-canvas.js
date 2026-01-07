#!/usr/bin/env node
/**
 * Minimal PoC: launch Chromium with Puppeteer, load local HTML PoC and save canvas PNG
 */
import fs from 'fs';
import path from 'path';
import http from 'http';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
	const root = path.resolve(__dirname);
	const htmlPath = path.join(root, 'motion-canvas-poc.html');
	const html = fs.readFileSync(htmlPath, 'utf8');

	// Simple static server so Puppeteer can load the module via proper origin
	const server = http.createServer((req, res) => {
		if (req.url === '/' || req.url === '/index.html') {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(html);
			return;
		}
		res.writeHead(404);
		res.end('not found');
	});

	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const port = server.address().port;
	const url = `http://127.0.0.1:${port}/`;

	const browser = await puppeteer.launch({
		headless: 'new',
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
		// Try to use system Chrome if available
		executablePath:
			process.platform === 'darwin'
				? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
				: undefined
	});
	const page = await browser.newPage();
	page.setViewport({ width: 800, height: 450 });

	try {
		await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

		// Wait for the page script to set window.__mc_ready
		await page.waitForFunction('window.__mc_ready === true', { timeout: 10000 }).catch(() => {});

		const data = await page.evaluate(() => {
			return {
				ready: !!window.__mc_ready,
				error: window.__mc_error || null,
				image: window.__mc_image || null
			};
		});

		if (data.image) {
			const base64 = data.image.replace(/^data:image\/png;base64,/, '');
			const outPath = path.join(root, 'output.png');
			fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
			console.log('Saved', outPath);
		} else {
			console.error('No image produced. Ready:', data.ready, 'Error:', data.error);
		}
	} finally {
		await browser.close();
		server.close();
	}
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
