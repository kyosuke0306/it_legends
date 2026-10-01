// 軽量化済みの GLB をさらに軽くする（ゲームの画面は小さいので、細かさを落としても見た目はほぼ同じ）
// - 模様の画像を 1024px に縮める
// - ゲームで使っていない凹凸・つやの画像を消す（character.js でつや消しにしているため）
// - 形の三角形を半分ほどに間引く
//
// 使い方: node pipeline/slim.mjs models/jobs.glb [ほかの GLB ...]（上書き）
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, resample, prune, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const RATIO = Number(process.env.SLIM_RATIO ?? 0.5);
const TEX = Number(process.env.SLIM_TEX ?? 1024);

export async function slimGlb(file) {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const before = (await fs.stat(file)).size;
  const doc = await io.read(file);
  for (const m of doc.getRoot().listMaterials()) {
    m.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null);
  }
  await doc.transform(
    prune(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: 0.001 }),
    resample(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX] }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  await io.write(file, doc);
  const after = (await fs.stat(file)).size;
  console.log(`  さらに軽量化 ${path.basename(file)}: ${kb(before)} → ${kb(after)}`);
}

const kb = (n) => `${Math.round(n / 1024)}KB`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const f of process.argv.slice(2)) await slimGlb(path.resolve(f));
}
