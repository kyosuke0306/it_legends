// GLB を軽くする（形を間引く・meshopt 圧縮・テクスチャを 2048px の WebP に）。18MB → 1MB 程度
// ゲーム側は character.js で MeshoptDecoder を設定して読み込む
//
// 使い方: node pipeline/optimize.mjs models/jobs.glb [ほかの GLB ...]（上書き）
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'node_modules/.bin/gltf-transform');

export async function optimizeGlb(file) {
  const tmp = `${file}.tmp.glb`;
  const before = (await fs.stat(file)).size;
  execFileSync(CLI, [
    'optimize', file, tmp,
    '--compress', 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', '2048',
    '--simplify-ratio', '0.2', // 三角形を 2 割に（38万 → 8万枚ほど）
    '--simplify-error', '0.001',
  ], { stdio: 'ignore' });
  await fs.rename(tmp, file);
  const after = (await fs.stat(file)).size;
  console.log(`  軽量化 ${path.basename(file)}: ${mb(before)} → ${mb(after)}`);
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)}MB`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const f of process.argv.slice(2)) await optimizeGlb(path.resolve(f));
}
