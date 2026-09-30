// 実在の写真 → Gemini でちびキャラ画像 → Tripo で3Dモデル(GLB) を作るスクリプト
//
// 使い方:
//   node pipeline/generate.mjs              # 全員分
//   node pipeline/generate.mjs turing jobs  # 指定した偉人だけ
//   オプション: --fetch-photo  写真が無ければ Wikipedia から取得
//               --animate      Tripo でリギング＋待機モーションを付ける
//               --force        生成済みでも作り直す
//               --image-only   Gemini の画像だけ作る（Tripo のクレジットを使わずに見た目を確認）
//
// 必要な環境変数（.env に書けば自動で読み込む）: GEMINI_API_KEY, TRIPO_API_KEY
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGENDS } from '../src/data.js';
import { optimizeGlb } from './optimize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHOTOS = path.join(ROOT, 'pipeline/photos');
const OUT = path.join(ROOT, 'pipeline/out');
const MODELS = path.join(ROOT, 'models');

await loadDotEnv();
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const TRIPO_KEY = process.env.TRIPO_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const TRIPO = 'https://api.tripo3d.ai/v2/openapi';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const ids = args.filter((a) => !a.startsWith('--'));
const targets = ids.length ? LEGENDS.filter((l) => ids.includes(l.id)) : LEGENDS;

if (!GEMINI_KEY || !TRIPO_KEY) {
  console.error('GEMINI_API_KEY と TRIPO_API_KEY を .env に設定してください（.env.example 参照）');
  process.exit(1);
}
await fs.mkdir(OUT, { recursive: true });

for (const legend of targets) {
  const glbPath = path.join(MODELS, `${legend.id}.glb`);
  if (!flags.has('--force') && (await exists(glbPath))) {
    console.log(`[${legend.id}] 生成済みなのでスキップ`);
    continue;
  }
  try {
    // Tripo のタスクが成功済みなら（ダウンロードだけ失敗した場合など）作り直さずに再利用する
    const taskPath = path.join(OUT, `${legend.id}_task.json`);
    let task = flags.has('--force') || flags.has('--image-only') ? null : await tripoReuse(taskPath);
    if (task) {
      console.log(`[${legend.id}] 生成済みの Tripo タスク ${task.task_id} を再利用`);
    } else {
      // --image-only で作って確認した画像があればそれを使う（--force か --image-only なら作り直す）
      const chibiPath = path.join(OUT, `${legend.id}_chibi.png`);
      if (!flags.has('--force') && !flags.has('--image-only') && (await exists(chibiPath))) {
        console.log(`[${legend.id}] 作成済みのちびキャラ画像を使用`);
      } else {
        console.log(`[${legend.id}] 写真を準備`);
        const photo = await findPhoto(legend);

        console.log(`[${legend.id}] Gemini でちびキャラ画像を生成`);
        await fs.writeFile(chibiPath, await geminiChibi(photo, legend));
      }
      if (flags.has('--image-only')) {
        console.log(`[${legend.id}] 画像だけ作成 → pipeline/out/${legend.id}_chibi.png`);
        continue;
      }

      console.log(`[${legend.id}] Tripo で3Dモデルを生成（数分かかります）`);
      const token = await tripoUpload(chibiPath);
      // 高品質テクスチャ（+10クレジット）で Gemini 画像の質感に近づけ、PBR(金属・反射)は付けずテカリを防ぐ
      task = await tripoRun({
        type: 'image_to_model',
        file: { type: 'png', file_token: token },
        texture_quality: 'detailed',
        pbr: false,
      });
      await fs.writeFile(taskPath, JSON.stringify({ task_id: task.task_id }) + '\n');
    }
    let url = task.output.pbr_model || task.output.model;

    if (flags.has('--animate')) {
      console.log(`[${legend.id}] リギングと待機モーションを付与`);
      const rig = await tripoRun({ type: 'animate_rig', original_model_task_id: task.task_id, out_format: 'glb' });
      task = await tripoRun({
        type: 'animate_retarget',
        original_model_task_id: rig.task_id,
        out_format: 'glb',
        animation: 'preset:idle',
      });
      url = task.output.model;
    }

    const glb = await fetch(url);
    if (!glb.ok) throw new Error(`GLB のダウンロードに失敗 (${glb.status})`);
    await fs.writeFile(glbPath, Buffer.from(await glb.arrayBuffer()));
    await optimizeGlb(glbPath);
    await addToManifest(legend.id);
    console.log(`[${legend.id}] 完了 → models/${legend.id}.glb`);
  } catch (e) {
    console.error(`[${legend.id}] 失敗: ${e.message}`);
  }
}

// ---------- 写真 ----------
async function findPhoto(legend) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    const p = path.join(PHOTOS, `${legend.id}.${ext}`);
    if (await exists(p)) return p;
  }
  if (!flags.has('--fetch-photo')) {
    throw new Error(`pipeline/photos/${legend.id}.jpg を置くか --fetch-photo を付けてください`);
  }
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${legend.wiki}`, {
    headers: { 'User-Agent': 'it_legends-pipeline/0.1' },
  });
  const info = await res.json();
  const src = info.originalimage?.source || info.thumbnail?.source;
  if (!src) throw new Error('Wikipedia に画像が見つかりません');
  const ext = path.extname(new URL(src).pathname).slice(1).toLowerCase() || 'jpg';
  const p = path.join(PHOTOS, `${legend.id}.${ext}`);
  await fs.writeFile(p, Buffer.from(await (await fetch(src)).arrayBuffer()));
  // 画像のライセンス確認用に出典を残す
  await fs.appendFile(path.join(PHOTOS, 'SOURCES.md'), `- ${legend.id}: ${src} (https://en.wikipedia.org/wiki/${legend.wiki})\n`);
  return p;
}

// ---------- Gemini ----------
async function geminiChibi(photoPath, legend) {
  const mime = { '.png': 'image/png', '.webp': 'image/webp' }[path.extname(photoPath)] || 'image/jpeg';
  const data = (await fs.readFile(photoPath)).toString('base64');
  const prompt = [
    `Turn the person in this photo (${legend.nameEn}) into a cute chibi 3D figure.`,
    'Very large head (about half of the total height) and a small body.',
    'The face must clearly look like this specific person: keep the face shape, nose, mouth, eyebrows, hairstyle and hair color from the photo.',
    'Give the figure natural, realistic eyes like in the photo, with whites, colored irises and eyelids. Do not use black dot eyes, bead eyes or button eyes.',
    'Add glasses or facial hair only if they are clearly visible in the photo; otherwise the figure has none.',
    // 写真と違う服にしたいときは data.js の outfit に英語で書く
    legend.outfit ? `Dress the figure in ${legend.outfit}, not the clothes from the photo.` : '',
    'Full body, standing straight facing the camera in an A-pose, arms slightly away from the body, legs slightly apart.',
    'Soft vinyl toy style with simple clean shapes, even studio lighting, no shadows.',
    'Plain pure white background, nothing else in the image, no text.',
  ].filter(Boolean).join(' ');

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mime, data } }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini: ${json.error?.message || res.status}`);
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error('Gemini が画像を返しませんでした');
  return Buffer.from(part.inlineData.data, 'base64');
}

// ---------- Tripo ----------
async function tripoUpload(filePath) {
  const form = new FormData();
  form.append('file', new Blob([await fs.readFile(filePath)], { type: 'image/png' }), path.basename(filePath));
  const res = await fetch(`${TRIPO}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TRIPO_KEY}` },
    body: form,
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`Tripo upload: ${json.message || res.status}`);
  return json.data.image_token;
}

async function tripoReuse(taskPath) {
  const saved = JSON.parse(await fs.readFile(taskPath, 'utf8').catch(() => 'null'));
  if (!saved) return null;
  // ダウンロード URL は期限付きなので、タスクを取り直して新しい URL を得る
  const s = await (await fetch(`${TRIPO}/task/${saved.task_id}`, { headers: { Authorization: `Bearer ${TRIPO_KEY}` } })).json();
  return s.data?.status === 'success' ? s.data : null;
}

async function tripoRun(body) {
  const res = await fetch(`${TRIPO}/task`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TRIPO_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`Tripo task(${body.type}): ${json.message || res.status}`);
  const id = json.data.task_id;
  for (;;) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await (await fetch(`${TRIPO}/task/${id}`, { headers: { Authorization: `Bearer ${TRIPO_KEY}` } })).json();
    const st = s.data?.status;
    process.stdout.write(`  ${body.type}: ${st} ${s.data?.progress ?? ''}%\r`);
    if (st === 'success') {
      process.stdout.write('\n');
      return s.data;
    }
    if (['failed', 'cancelled', 'banned', 'expired', 'unknown'].includes(st)) {
      throw new Error(`Tripo task(${body.type}) が ${st} で終了`);
    }
  }
}

// ---------- 補助 ----------
async function addToManifest(id) {
  const p = path.join(MODELS, 'manifest.json');
  const list = JSON.parse(await fs.readFile(p, 'utf8').catch(() => '[]'));
  if (!list.includes(id)) list.push(id);
  await fs.writeFile(p, JSON.stringify(list, null, 2) + '\n');
}

async function exists(p) {
  return fs.access(p).then(() => true, () => false);
}

async function loadDotEnv() {
  const text = await fs.readFile(path.join(ROOT, '.env'), 'utf8').catch(() => '');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
