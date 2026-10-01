# IT Legends — 作業メモ（Claude 向け）

IT会社を育てる放置ゲーム（2026-10-01 にガチャから作り変え）。公開先: https://kyosuke0306.github.io/it_legends/ （GitHub Pages, main ブランチ）

## ユーザーとの約束
- **変更したら確認して main に push し、公開まで行う**（作業ブランチにも push）。main に push する直前に `node scripts/bump-version.mjs` でバージョン（画面右下の `v番号 (日付)`、`src/version.js`）を1つ上げてコミットに含める。（このスクリプトは index.html の読み込み先にも ?v=番号 を付ける。src に .js を足したら必ず実行し直す）公開後はサイトに反映されたか確認する
- **指示された偉人以外は生成しない**（Tripo のクレジットは有料）。まず1人で見せてから広げる
- クレジットを使う前に、1体あたりの見込み（下表）を伝える。結果は画像・動画で見せる
- 日本語で、専門用語は避けて説明する
- **画面は文字を少なく、直感的に、スマートに。絵文字は使わない**（アイコンは `src/icons.js` の線のアイコン）。説明文は置かず、アイコンと数字で見せる

## 環境
- `GEMINI_API_KEY` / `TRIPO_API_KEY` は環境変数に設定済み
- Node の fetch はプロキシを通らないので `NODE_USE_ENV_PROXY=1 node ...` で実行する
- 必要なホスト: en.wikipedia.org, upload.wikimedia.org, generativelanguage.googleapis.com, api.tripo3d.ai, tripo-data.rg1.data.tripo3d.com（Tripo の GLB 配信）
- 残高確認: `curl -sS -H "Authorization: Bearer $TRIPO_API_KEY" https://api.tripo3d.ai/v2/openapi/user/balance`
- Playwright の npm 版はブラウザのバージョンが合わないので `executablePath: '/opt/pw-browsers/chromium'` を指定する
- 画面確認は Playwright（Chromium は `--use-gl=angle --use-angle=swiftshader`）。CDN の three.js は `npm i three@0.170.0` したものを route で差し替えると確実

## 3Dキャラを作る流れ（ジョブズで確立）
1. `node pipeline/generate.mjs <id> --fetch-photo --image-only` … Gemini のちびキャラ画像だけ作って見せる（安い）
2. OK なら `node pipeline/generate.mjs <id>` … 確認済みの画像を Tripo で3D化（高品質テクスチャ・PBRなし、40 クレジット）→ 自動で軽量化
   - 作り直すときは `models/<id>.glb` と `pipeline/out/<id>_task.json` を消す（画像も作り直すなら `--force`）
   - 軽量化は2段階（optimize.mjs → slim.mjs: 模様1024px・凹凸/つや画像なし・三角形を半分）。1体 0.3〜0.5MB
3. `npm install` 後 `node pipeline/rig.mjs <id> greet_01 walk fold_arms agree` … 骨組み(25)＋動き(10/種類)→1つの GLB にまとめ、首より上を頭の骨だけで動かし（メガネの歪み防止）、軽量化
   - 動きはまとめて頼むと最後の1つしか入らない（料金は全部かかる）ので、スクリプトは1つずつ頼む
   - 動きの一覧: https://developers.tripo3d.ai/en/docs/animations-retarget （preset:biped:<名前>）
4. `src/data.js` の `show` にセリフ・動き・小物・ステージを書く（`src/show.js`）。小物や背景は show.js の `PROPS` に three.js で作る
5. `node scripts/make-thumbs.mjs <id>` … 図鑑の一覧用の絵 `models/<id>.webp` を作る（図鑑で3Dを読まないため。モデルを作り直したら必ず実行）
6. ゲームで動画・スクショを撮って見せる → main に push

## 読み込みを軽くする工夫（2026-10-01）
- 起動後ひまなときに manifest の全モデルを先読み（`preloadCharacters`）。一度読んだモデルは覚えておき複製して使う
- ガチャはカプセルを揺らしながら読み込み、読み終わるまで揺れ続ける（`Stage.reveal` に Promise を渡す）
- **キャラはこれ以上増やさない**（ユーザー指示 2026-10-01）
- 通信を重くしない（ユーザー指示）。偉人の GLB は仲間にした偉人だけ先読み、Firebase はログインする人だけ読み込む、画面に出ていない 3D は描かない

## ゲームの形（2026-10-01 にユーザーと決定）
- ガチャは廃止。キャラ1人1人の価値を重く、入手の喜びを大きく
- 一般人（自分）1人から始める。主人公の職種を最初に1つ選ぶ（SE・プログラマー・インフラ・デザイナー・データ分析・PM・GM・コンサル・営業）。業界は IT だけ
- 放置・投資ゲーム。仕事を振って現実の時間で進む（1日2〜3回のぞく想定）。忙しいリアルタイム操作はしない
- IT の知識は、遊ぶうちに自然に身につく程度（ユーザー指示）。**知識を文章で見せる・まとめる機能は作らない**（一度作った知識ノートは削除済み）。職種・仕事の名前・偉人の出会いの条件や力を実際の IT・歴史に沿わせることで伝える
- 偉人は「時を超えて現れる」。条件を満たすとまれに出会い（平均4〜5日に1回）、誘うと確率で仲間に。断られると3日会えない。偉人は席を使わない
- 自社製品は投資。赤字はありだが会社はつぶれない
- 画面は事務所の3D（社員と偉人が歩き回る、仕事中は机へ）。`src/office.js`
- 記録: localStorage ＋ Google ログイン（`src/cloud.js`。kyosuke0306/money_manage の sync.js と同じ方式: Firebase 12.18.0 を gstatic CDN から、Firestore `users/{uid}` に `{ data: JSONの文字列, updatedAt, device }`、onSnapshot でほかの端末の変更を反映）。Firebase は画面が落ち着いてから先読みする（押してから読むと iPhone の Safari でログインの窓が止められるため）。設定は `src/firebase-config.js`（プロジェクト itlegends-45d70）。この作業環境からは Google のログイン画面に行けないので、同期は偽の Firebase で2台の端末を再現して確認している
- バランス確認は、1日3回のぞく自動プレイのシミュレーションで行った（効率的に遊んで11人そろうのに約3か月）

スタート画面の絵（タイトル・アプリのアイコン・職種9つ）。職種はいまは線のアイコン（ユーザー指示）だが、3Dの絵に戻すか迷っているので assets/jobs/ に残し、`?jobart=3d` で見られる（main.js の JOB_ART）は `NODE_USE_ENV_PROXY=1 node pipeline/art.mjs [id]` で Gemini に作らせる（1枚約6円、元画像は pipeline/out/art/、軽くした画像は assets/）

| 項目 | クレジット |
| --- | --- |
| 3Dモデル（高品質テクスチャ） | 40 |
| 骨組み | 25 |
| 動き 1種類 | 10 |
| 例: モデル＋骨組み＋動き4種類 | 105（約160円） |

`pipeline/out/*.json` は Tripo のタスクID。スクリプトが再利用するので消さない（Git に入れている）。

## 偉人ごとの状態（2026-09-30 時点、Tripo 残高 160）
- **jobs**: 完成。高品質モデル＋骨組み＋動き4種類（greet_01, walk, fold_arms, agree）。基調講演風の暗いステージ、光る Apple ロゴ（assets/apple-logo.svg）、初代 iPhone、セリフ3つ
- **zuckerberg**: 完成。パーカー姿の高品質モデル＋骨組み＋動き4種類（greet_01, walk, fold_arms, agree）。夜の寮の部屋ステージ（`stage: 'dorm'`、光る Facebook の「f」、thefacebook 画面のノートPC、ベッド、机）、小物 `laptop`（小さな机ごと床に置く）・`vr`（まだ宙に浮く）、セリフ3つ。服は data.js の `outfit` で指定（generate.mjs が Gemini に渡す）
- **turing**: 標準テクスチャの古いモデル。ユーザーは「最初の頃の画像の方が似ていた」と言っている
- ほかの8人: 未生成（仮キャラ）
