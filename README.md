# IT Legends

ITの偉人をガチャで集めてコレクションするブラウザゲーム。
頭が大きく体が小さい3Dキャラがぴょこぴょこ動き、図鑑で「何をした人か」を読めます。

## 遊び方

```sh
npm start   # http://localhost:8080 を開く
```

ビルドは不要です（HTML + JavaScript + three.js を CDN から読み込み）。GitHub Pages でもそのまま公開できます。

- **ガチャ**: 1回 / 10連。排出率は SSR 5% / SR 30% / R 65%
- **図鑑**: 手に入れた偉人をタップすると、3Dキャラ（ドラッグで回せます）と「何をした人か」「おもな功績」を表示
- 集めた記録はブラウザ（localStorage）に保存

## 3Dモデルを本物の顔から作る（Gemini + Tripo）

最初はコードで組み立てた仮キャラを表示します。
`pipeline/generate.mjs` を実行すると、偉人ごとに次の流れで本物の顔をもとにした3Dモデルを作り、仮キャラと差し替えます。

1. 実在の写真 → **Gemini** で「顔が大きく体が小さい」ちびキャラ画像を生成
2. その画像 → **Tripo** で3Dモデル（GLB）を生成
3. `models/<id>.glb` に保存し、`models/manifest.json` に登録（ゲームが自動で読み込みます）

```sh
cp .env.example .env               # GEMINI_API_KEY と TRIPO_API_KEY を記入
node pipeline/generate.mjs --fetch-photo           # 全員分（写真は Wikipedia から取得）
node pipeline/generate.mjs turing --force          # 1人だけ作り直し
node pipeline/generate.mjs --fetch-photo --animate # Tripo のリギング＋待機モーション付き
```

- 写真は `pipeline/photos/<id>.jpg` に自分で置くこともできます（id は `src/data.js` を参照）
- `--fetch-photo` で取得した写真の出典は `pipeline/photos/SOURCES.md` に記録されます。公開する場合は各画像のライセンスを確認してください
- モーションが付いていないモデルは、ゲーム側で跳ねる・揺れる動きを付けます

## ファイル構成

| パス | 内容 |
| --- | --- |
| `index.html`, `style.css` | 画面 |
| `src/data.js` | 偉人データ（説明文・功績・レア度・仮キャラの見た目） |
| `src/character.js` | 仮キャラの組み立て、GLB の読み込み、動き |
| `src/stage.js` | 3D表示とガチャ演出 |
| `src/main.js` | ガチャ・図鑑・詳細画面 |
| `pipeline/generate.mjs` | Gemini + Tripo で3Dモデルを作るスクリプト |
