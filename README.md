# IT Legends

IT業界の「ふつうの一人」として小さな部屋で会社を立ち上げ、仲間を雇い、時を超えて現れる **ITの偉人たち** とチームを組んで会社を大きくしていく、放っておいても進むゲーム。

**▶ 遊ぶ: https://kyosuke0306.github.io/it_legends/**

## 遊び方

```sh
npm start   # http://localhost:8080 を開く
```

ビルドは不要です（HTML + JavaScript + three.js を CDN から読み込み）。GitHub Pages でもそのまま公開できます。

- **はじめに**: 主人公の職種（SE・プログラマー・PM・GM・コンサルなど9種類）を選ぶ
- **仕事**: 届いた依頼に人を割り当てると、現実の時間で進む（ゲームを閉じていても進む）。1日に数回のぞく遊び方
- **仲間**: 一般の社員を雇う。職種ごとに得意がある。仕事をこなすとレベルが上がる
- **製品**: お金と時間をかけて自社製品を作る投資。流行しだいで大もうけも赤字も
- **偉人**: 条件を満たすと、まれに時を超えて現れる。誘って仲間になれば特別な力を発揮する（全11人）
- 記録はブラウザに自動保存。Google でログインするとクラウドにも保存（下の「Google ログインの準備」）
- 数字は `src/game/rules.js`、ゲームの中身は `src/game/state.js`

## Google ログイン（Firebase）

記録は Firestore の `users/<ユーザーID>` に保存し、ほかの端末の変更も自動で反映します（`src/cloud.js`）。設定は `src/firebase-config.js`。

### 準備の手順（済み）

1. https://console.firebase.google.com/ でプロジェクトを作る
2. 「Authentication」→ ログイン方法で **Google** を有効にし、「設定 → 承認済みドメイン」に `kyosuke0306.github.io` を追加
3. 「Firestore Database」を作り、「ルール」に `firestore.rules` の中身（`users/{uid}` は本人だけ読み書き可）を貼って公開
4. 「プロジェクトの設定」→「ウェブアプリを追加」で表示される値を `src/firebase-config.js` に貼る

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

- `--image-only` で Gemini の画像だけ作れます（Tripo のクレジットを使わずに見た目を確認し、よければ次の実行でその画像を3D化）
- 3Dモデルは高品質テクスチャ・つや消しで作ります（1体 40 クレジット）
- 保存時に `pipeline/optimize.mjs` で軽量化します（18MB → 1MB ほど）。`node pipeline/optimize.mjs models/<id>.glb` で個別にも実行できます
- 写真は `pipeline/photos/<id>.jpg` に自分で置くこともできます（id は `src/data.js` を参照）
- `--fetch-photo` で取得した写真の出典は `pipeline/photos/SOURCES.md` に記録されます。公開する場合は各画像のライセンスを確認してください
- モーションが付いていないモデルは、ゲーム側で跳ねる・揺れる動きを付けます

### 骨組みと動きを付ける（Tripo）

```sh
npm install                                               # GLB の加工に @gltf-transform/core を使う
node pipeline/rig.mjs jobs greet_01 walk fold_arms agree  # 骨組み＋動き4種類 → models/jobs.glb
```

- 動きの名前は Tripo の `preset:biped:<名前>`（90種類以上）。クレジットは骨組み 25 ＋ 動き1種類ごとに 10
- `src/data.js` の `show` に、歩き回ってしゃべるときのセリフ・動き・小物・ステージを書きます（`src/show.js`）

## ファイル構成

| パス | 内容 |
| --- | --- |
| `index.html`, `style.css` | 画面 |
| `src/data.js` | 偉人データ（説明文・功績・レア度・仮キャラの見た目） |
| `src/character.js` | 仮キャラの組み立て、GLB の読み込み、動き |
| `src/stage.js` | 3D表示とガチャ演出 |
| `src/main.js` | ガチャ・図鑑・詳細画面 |
| `src/show.js` | ステージを歩いてしゃべるショー（吹き出し・小物・背景） |
| `assets/` | 画像素材（Apple ロゴ: Wikimedia Commons, パブリックドメイン・商標） |
| `pipeline/generate.mjs` | Gemini + Tripo で3Dモデルを作るスクリプト |
| `pipeline/rig.mjs` | Tripo で骨組みと動きを付けるスクリプト |
