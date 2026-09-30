// 公開（main に push）する直前に実行する: バージョン番号を1つ上げ、日付（日本時間）を書き込む
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/version.js', import.meta.url);
const n = Number(readFileSync(file, 'utf8').match(/v(\d+)/)?.[1] ?? 0) + 1;
const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).replaceAll('-', '.');
writeFileSync(file, `// 画面の右下に出すバージョン。scripts/bump-version.mjs が公開のたびに書き換える\nexport const VERSION = 'v${n} (${date})';\n`);
console.log(`v${n} (${date})`);
