// 公開（main に push）する直前に実行する: バージョン番号を1つ上げ、日付（日本時間）を書き込む
// あわせて index.html の読み込み先に ?v=番号 を付け、ブラウザが古いファイルを使い続けないようにする
// （GitHub Pages は 10 分キャッシュされるので、新旧のファイルが混ざると正しく動かない）
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT, 'src/version.js');
const n = Number(readFileSync(file, 'utf8').match(/v(\d+)/)?.[1] ?? 0) + 1;
const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).replaceAll('-', '.');
writeFileSync(file, `// 画面の右下に出すバージョン。scripts/bump-version.mjs が公開のたびに書き換える\nexport const VERSION = 'v${n} (${date})';\n`);

// src の下のすべての .js を「?v=番号」付きの場所に読み替える import map を作る
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.js')) files.push(path.relative(ROOT, p).split(path.sep).join('/'));
  }
})(path.join(ROOT, 'src'));
const imports = {
  three: 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js',
  'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/',
};
for (const f of files) imports[`./${f}`] = `./${f}?v=${n}`;
const html = path.join(ROOT, 'index.html');
let s = readFileSync(html, 'utf8');
s = s.replace(/<script type="importmap">[\s\S]*?<\/script>/, `<script type="importmap">\n${JSON.stringify({ imports }, null, 2).replace(/^/gm, '      ')}\n    </script>`);
s = s.replace(/src="src\/main\.js(\?v=\d+)?"/, `src="src/main.js?v=${n}"`);
s = s.replace(/href="style\.css(\?v=\d+)?"/, `href="style.css?v=${n}"`);
writeFileSync(html, s);
console.log(`v${n} (${date})`);
