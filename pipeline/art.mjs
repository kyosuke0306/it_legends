// スタート画面の絵を Gemini で作る（タイトル・アプリのアイコン）。職種はアイコン（src/icons.js）なので作らない。1枚 約6円
// 使い方: NODE_USE_ENV_PROXY=1 node pipeline/art.mjs [title|icon]（省略すると全部。できている絵は作り直さない。--force で作り直す）
// 元の画像は pipeline/out/art/ に、軽くした画像は assets/ に保存する
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'pipeline/out/art');
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const KEY = process.env.GEMINI_API_KEY;

const ART = {
  title: {
    ratio: '9:16',
    prompt:
      'Cinematic key visual for a mobile game about building a legendary IT company. ' +
      'At night, a small cozy garage office with a glowing laptop on a desk; behind it a swirling glowing time portal of purple, pink and gold light, ' +
      'from which several mysterious silhouettes of legendary pioneers are stepping out, backlit, faces not visible. ' +
      'Floating subtle circuit lines and stars. Deep indigo color palette with purple and gold accents, dramatic, epic, polished 3D render. ' +
      'Leave the upper third calm and dark for a title. No text, no letters, no logos.',
  },
  icon: {
    ratio: '1:1',
    prompt:
      'App icon for a game called IT Legends: a bold glowing golden crown made of clean circuit lines, centered, on a deep indigo to purple gradient, ' +
      'minimal, modern, flat with soft glow, fills the square, no text, no letters, no border.',
  },
};

async function gemini(prompt, ratio) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: ratio } },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini: ${json.error?.message || res.status}`);
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error('Gemini が画像を返しませんでした');
  return Buffer.from(part.inlineData.data, 'base64');
}

// ゲームで使う軽い画像にする
async function publish(id, src) {
  const dir = path.join(ROOT, 'assets');
  if (id === 'title') {
    await sharp(src).resize(720).webp({ quality: 78 }).toFile(path.join(dir, 'title.webp'));
  } else if (id === 'icon') {
    await sharp(src).resize(512).png({ palette: true }).toFile(path.join(dir, 'icon-512.png'));
    await sharp(src).resize(180).png({ palette: true }).toFile(path.join(dir, 'apple-touch-icon.png'));
    await sharp(src).resize(64).png().toFile(path.join(dir, 'favicon.png'));
  }
}

const force = process.argv.includes('--force');
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
await fs.mkdir(OUT, { recursive: true });
for (const id of ids.length ? ids : Object.keys(ART)) {
  const src = path.join(OUT, `${id}.png`);
  const exists = await fs.stat(src).then(() => true, () => false);
  if (!exists || force) {
    process.stdout.write(`${id} を生成中… `);
    await fs.writeFile(src, await gemini(ART[id].prompt, ART[id].ratio));
    console.log('完了');
  }
  await publish(id, src);
}
