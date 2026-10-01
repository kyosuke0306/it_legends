// スタート画面の絵を Gemini で作る（タイトル・職種9つ・アプリのアイコン）。職種の絵はいまは使っていない（?jobart=3d で表示。迷っているので残している）。1枚 約6円
// 使い方: NODE_USE_ENV_PROXY=1 node pipeline/art.mjs [title|icon|職種id ...]（省略すると全部。できている絵は作り直さない。--force で作り直す）
// 元の画像は pipeline/out/art/ に、軽くした画像は assets/ に保存する
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'pipeline/out/art');
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const KEY = process.env.GEMINI_API_KEY;

const STYLE =
  'Cute chibi 3D figure in a glossy soft vinyl toy style, very large head and small body, friendly confident smile, ' +
  'an anonymous original character (not a real person), full body, centered, standing on nothing, ' +
  'soft studio lighting, no text, no letters, no logos.';

const JOBS = {
  se: ['a young system engineer with short hair, holding a large rolled blueprint of a system diagram, pencil behind the ear', '#dbe7fb'],
  pg: ['a programmer with a hoodie and headphones around the neck, typing on a floating laptop, small glowing code brackets around', '#e3e3ee'],
  infra: ['an infrastructure engineer with rolled-up sleeves next to a small server rack with blinking lights and cables', '#d9f0e4'],
  designer: ['a woman UI designer with a beret, holding a stylus and a tablet that shows colorful app screens', '#fbe0e6'],
  data: ['a woman data scientist with glasses, surrounded by small floating bar charts and line graphs', '#e9e2fb'],
  pm: ['a woman project manager holding a clipboard with a simple timeline chart, a stopwatch on the belt', '#dde9f6'],
  gm: ['a general manager in a smart navy blazer, arms crossed, a small upward arrow chart floating behind', '#e6e6ea'],
  consul: ['an IT consultant in a dark suit, pointing at a small floating whiteboard with a simple flow diagram', '#dfe3ec'],
  sales: ['a cheerful IT salesperson in a suit holding a tablet and giving a thumbs up', '#fbeadb'],
};

const ART = {
  title: {
    ratio: '9:16',
    prompt:
      'A sleek dark indigo scene with a team of four IT specialists in silhouette with crisp rim light, each with a subtle glowing holographic element: code brackets, a server, a chart, a design grid. ' +
      'Behind them a large thin golden ring of light like a portal. Very clean, geometric, minimal, high-end. ' +
      'Vertical 9:16 mobile game title key visual. Sleek, smart, modern and minimal, premium tech brand aesthetic. Leave the top 35% as calm dark empty space for a title. No text, no letters, no logos, no watermark.',
  },
  icon: {
    ratio: '1:1',
    prompt:
      'App icon for a game called IT Legends: a bold glowing golden crown made of clean circuit lines, centered, on a deep indigo to purple gradient, ' +
      'minimal, modern, flat with soft glow, fills the square, no text, no letters, no border.',
  },
  ...Object.fromEntries(
    Object.entries(JOBS).map(([id, [who, bg]]) => [id, { ratio: '1:1', prompt: `${STYLE} The character is ${who}. Plain solid flat background color ${bg}, nothing else.` }]),
  ),
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
  } else {
    await fs.mkdir(path.join(dir, 'jobs'), { recursive: true });
    await sharp(src).resize(256).webp({ quality: 80 }).toFile(path.join(dir, 'jobs', `${id}.webp`));
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
