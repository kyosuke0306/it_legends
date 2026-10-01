// 図鑑の一覧に出す絵（models/<id>.webp）を、3D モデルから作る。
// ゲーム側で毎回 3D モデルを読み込まずにすむので図鑑がすぐ開く。モデルを作り直したら実行する
//
// 使い方: node scripts/make-thumbs.mjs [id ...]（省略すると models/manifest.json の全員）
// three.js は CDN から読むので、つながらない環境では npm i three@0.170.0 しておくとそれを使う
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_THREE = path.join(ROOT, 'node_modules/three');
const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const ids = process.argv.slice(2);
if (!ids.length) ids.push(...JSON.parse(await fs.readFile(path.join(ROOT, 'models/manifest.json'), 'utf8')));

const server = http.createServer(async (req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
if (existsSync(LOCAL_THREE)) {
  await page.route('https://cdn.jsdelivr.net/npm/three@*/**', (r) =>
    r.fulfill({ path: path.join(LOCAL_THREE, r.request().url().split(/three@[^/]+\//)[1]), contentType: 'text/javascript' }),
  );
}
await page.goto(`http://localhost:${server.address().port}/`);
for (const id of ids) {
  const dataUrl = await page.evaluate(async (id) => {
    const { createCharacter } = await import('./src/character.js');
    const { renderThumbnail } = await import('./src/stage.js');
    const { byId } = await import('./src/data.js');
    const url = renderThumbnail(await createCharacter(byId[id]));
    // PNG を WebP に変えて小さくする
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/webp', 0.85);
  }, id);
  const out = path.join(ROOT, 'models', `${id}.webp`);
  await fs.writeFile(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`  ${path.relative(ROOT, out)}`);
}
await browser.close();
server.close();
