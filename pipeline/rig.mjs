// 生成済みの3Dモデルに Tripo で骨組みと動きを付け、1つの GLB にまとめるスクリプト
//
// 使い方:
//   node pipeline/rig.mjs jobs greet_01 walk fold_arms agree
//   （動きの名前は Tripo の preset:biped:<名前>。一覧は https://developers.tripo3d.ai/en/docs/animations-retarget）
//
// - 先に generate.mjs でモデルを作っておく（pipeline/out/<id>_task.json を使う）
// - クレジット: 骨組み 25 + 動き 1種類ごとに 10
// - 動きはまとめて頼むと最後の1つしか入らないので、1つずつ頼む（最初の1つだけ体の形つき）
// - 途中のタスクは pipeline/out/<id>_rig*.json に残し、やり直すときは再利用する（クレジットを二重に使わない）
// - ちびキャラは頭が肩より広く、頭やメガネが肩・腕の骨に引っぱられて歪むので、首より上は頭の骨だけで動かす
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'pipeline/out');
const TRIPO = 'https://api.tripo3d.ai/v2/openapi';
const HEAD_ABOVE = 0.4; // 高さ(0〜1)がこれより上の頂点は頭の骨だけで動かす

await loadDotEnv();
const KEY = process.env.TRIPO_API_KEY;
const [id, ...anims] = process.argv.slice(2);
if (!KEY || !id || !anims.length) {
  console.error('使い方: node pipeline/rig.mjs <id> <動き1> [動き2 ...]（TRIPO_API_KEY が必要）');
  process.exit(1);
}

const model = JSON.parse(await fs.readFile(path.join(OUT, `${id}_task.json`), 'utf8'));
const rig = await cachedTask(`${id}_rig`, '骨組み', {
  type: 'animate_rig',
  original_model_task_id: model.task_id,
  out_format: 'glb',
  rig_type: 'biped',
  model_version: 'v1.0-20240301',
});

const files = [];
for (const [i, name] of anims.entries()) {
  const task = await cachedTask(`${id}_rig_${name}`, `動き ${name}`, {
    type: 'animate_retarget',
    original_model_task_id: rig.task_id,
    out_format: 'glb',
    bake_animation: true,
    animate_in_place: true, // 移動はゲーム側（show.js）で行う
    export_with_geometry: i === 0,
    animation: `preset:biped:${name}`,
  });
  const file = path.join(OUT, `${id}_rig_${name}.glb`);
  await download(task.output.model, file);
  files.push(file);
}

const io = new NodeIO();
const doc = await io.read(files[0]);
mergeAnimations(doc, await Promise.all(files.slice(1).map((f) => io.read(f))));
rebindHead(doc);
const glb = path.join(ROOT, 'models', `${id}.glb`);
await io.write(glb, doc);
console.log(`[${id}] 完了 → models/${id}.glb（動き: ${doc.getRoot().listAnimations().map((a) => a.getName()).join(', ')}）`);

// ---------- GLB の加工 ----------
// 体の形なしで受け取った動きを、骨の名前で対応させて1つのファイルに入れる
function mergeAnimations(doc, others) {
  const buffer = doc.getRoot().listBuffers()[0];
  const nodes = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
  const copy = (acc) => doc.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buffer);
  for (const src of others) {
    for (const a of src.getRoot().listAnimations()) {
      const anim = doc.createAnimation(a.getName());
      for (const ch of a.listChannels()) {
        const target = nodes.get(ch.getTargetNode().getName());
        if (!target) continue;
        const s = ch.getSampler();
        const sampler = doc
          .createAnimationSampler()
          .setInput(copy(s.getInput()))
          .setOutput(copy(s.getOutput()))
          .setInterpolation(s.getInterpolation());
        anim.addSampler(sampler);
        anim.addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(sampler));
      }
    }
  }
}

function rebindHead(doc) {
  const joints = doc.getRoot().listSkins()[0].listJoints();
  const head = joints.findIndex((j) => j.getName() === 'Head');
  if (head < 0) return console.warn('Head の骨が見つからないので頭の付け直しを省略');
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const J = prim.getAttribute('JOINTS_0');
      const W = prim.getAttribute('WEIGHTS_0');
      if (!J || !W) continue;
      const maxY = pos.getMax([])[1];
      const p = [];
      for (let i = 0; i < pos.getCount(); i++) {
        if (pos.getElement(i, p)[1] <= HEAD_ABOVE * maxY) continue;
        J.setElement(i, [head, 0, 0, 0]);
        W.setElement(i, [1, 0, 0, 0]);
      }
    }
  }
}

// ---------- Tripo ----------
async function cachedTask(name, label, body) {
  const cache = path.join(OUT, `${name}.json`);
  const saved = JSON.parse(await fs.readFile(cache, 'utf8').catch(() => 'null'));
  if (saved) {
    const task = await getTask(saved.task_id);
    if (task.status === 'success') {
      console.log(`[${id}] ${label}: 作成済みのタスクを再利用`);
      return task;
    }
  }
  console.log(`[${id}] ${label} を作成`);
  const res = await fetch(`${TRIPO}/task`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`Tripo task(${body.type}): ${json.message || res.status}`);
  await fs.writeFile(cache, JSON.stringify({ task_id: json.data.task_id }) + '\n');
  for (;;) {
    await new Promise((r) => setTimeout(r, 5000));
    const task = await getTask(json.data.task_id);
    if (task.status === 'success') return task;
    if (!['queued', 'running'].includes(task.status)) throw new Error(`Tripo task(${body.type}) が ${task.status} で終了`);
  }
}

async function getTask(taskId) {
  const res = await fetch(`${TRIPO}/task/${taskId}`, { headers: { Authorization: `Bearer ${KEY}` } });
  return (await res.json()).data;
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ダウンロードに失敗 (${res.status})`);
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
}

async function loadDotEnv() {
  const text = await fs.readFile(path.join(ROOT, '.env'), 'utf8').catch(() => '');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
