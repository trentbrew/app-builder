#!/usr/bin/env node
/**
 * Enhanced PoC: Render multiple frames to create a video sequence
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
		executablePath:
			process.platform === 'darwin'
				? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
				: undefined
	});

	try {
		const page = await browser.newPage();
		page.setViewport({ width: 800, height: 450 });

		// Create frames directory
		const framesDir = path.join(root, 'frames');
		if (!fs.existsSync(framesDir)) {
			fs.mkdirSync(framesDir);
		}

		console.log('Rendering video frames...');
		const frameCount = 30; // 1 second at 30fps
		const frameFiles = [];

		for (let i = 0; i < frameCount; i++) {
			const time = i / frameCount; // 0 to 1

			await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

			// Set the time for this frame
			await page.evaluate((frameTime) => {
				window.__frame_time = frameTime;
			}, time);

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
				const framePath = path.join(framesDir, `frame_${i.toString().padStart(3, '0')}.png`);
				fs.writeFileSync(framePath, Buffer.from(base64, 'base64'));
				frameFiles.push(framePath);
				console.log(`Frame ${i + 1}/${frameCount} saved`);
			} else {
				console.error(`Frame ${i + 1} failed. Ready:`, data.ready, 'Error:', data.error);
			}
		}

		console.log(`\n✅ Successfully rendered ${frameFiles.length} frames to ${framesDir}/`);
		console.log(
			'📁 Frame files:',
			frameFiles.slice(0, 5).join(', '),
			frameFiles.length > 5 ? '...' : ''
		);

		// Create a simple HTML viewer for the frames
		const viewerHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Motion Canvas Frames</title>
  <style>
    body { margin: 0; padding: 20px; background: #111; color: #fff; font-family: system-ui; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 30px; }
    .frames { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
    .frame { border: 1px solid #333; border-radius: 8px; overflow: hidden; }
    .frame img { width: 100%; height: auto; display: block; }
    .frame .label { padding: 8px; background: #222; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Motion Canvas Rendered Frames</h1>
    <div class="frames">
      ${frameFiles
				.map(
					(file, i) => `
        <div class="frame">
          <img src="${path.basename(file)}" alt="Frame ${i}">
          <div class="label">Frame ${i}</div>
        </div>
      `
				)
				.join('')}
    </div>
  </div>
</body>
</html>`;

		const viewerPath = path.join(framesDir, 'viewer.html');
		fs.writeFileSync(viewerPath, viewerHtml);
		console.log(`\n🌐 Frame viewer created: ${viewerPath}`);
		console.log(`   Open in browser to view all frames`);
	} finally {
		await browser.close();
		server.close();
	}
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
