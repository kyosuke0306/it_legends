# IT Legends — 作業メモ（Claude 向け）

ITの偉人をガチャで集めるブラウザゲーム。公開先: https://kyosuke0306.github.io/it_legends/ （GitHub Pages, main ブランチ）

## ユーザーとの約束
- **変更したら確認して main に push し、公開まで行う**（作業ブランチにも push）。公開後はサイトに反映されたか確認する
- **指示された偉人以外は生成しない**（Tripo のクレジットは有料）。まず1人で見せてから広げる
- クレジットを使う前に、1体あたりの見込み（下表）を伝える。結果は画像・動画で見せる
- 日本語で、専門用語は避けて説明する

## 環境
- `GEMINI_API_KEY` / `TRIPO_API_KEY` は環境変数に設定済み
- Node の fetch はプロキシを通らないので `NODE_USE_ENV_PROXY=1 node ...` で実行する
- 必要なホスト: en.wikipedia.org, upload.wikimedia.org, generativelanguage.googleapis.com, api.tripo3d.ai, tripo-data.rg1.data.tripo3d.com（Tripo の GLB 配信）
- 残高確認: `curl -sS -H "Authorization: Bearer $TRIPO_API_KEY" https://api.tripo3d.ai/v2/openapi/user/balance`
- 画面確認は Playwright（Chromium は `--use-gl=angle --use-angle=swiftshader`）。CDN の three.js は `npm i three@0.170.0` したものを route で差し替えると確実

## 3Dキャラを作る流れ（ジョブズで確立）
1. `node pipeline/generate.mjs <id> --fetch-photo --image-only` … Gemini のちびキャラ画像だけ作って見せる（安い）
2. OK なら `node pipeline/generate.mjs <id>` … 確認済みの画像を Tripo で3D化（高品質テクスチャ・PBRなし、40 クレジット）→ 自動で軽量化
   - 作り直すときは `models/<id>.glb` と `pipeline/out/<id>_task.json` を消す（画像も作り直すなら `--force`）
3. `npm install` 後 `node pipeline/rig.mjs <id> greet_01 walk fold_arms agree` … 骨組み(25)＋動き(10/種類)→1つの GLB にまとめ、首より上を頭の骨だけで動かし（メガネの歪み防止）、軽量化
   - 動きはまとめて頼むと最後の1つしか入らない（料金は全部かかる）ので、スクリプトは1つずつ頼む
   - 動きの一覧: https://developers.tripo3d.ai/en/docs/animations-retarget （preset:biped:<名前>）
4. `src/data.js` の `show` にセリフ・動き・小物・ステージを書く（`src/show.js`）。小物や背景は show.js の `PROPS` に three.js で作る
5. ゲームで動画・スクショを撮って見せる → main に push

| 項目 | クレジット |
| --- | --- |
| 3Dモデル（高品質テクスチャ） | 40 |
| 骨組み | 25 |
| 動き 1種類 | 10 |
| 例: モデル＋骨組み＋動き4種類 | 105（約160円） |

`pipeline/out/*.json` は Tripo のタスクID。スクリプトが再利用するので消さない（Git に入れている）。

## 偉人ごとの状態（2026-09-30 時点、Tripo 残高 265）
- **jobs**: 完成。高品質モデル＋骨組み＋動き4種類（greet_01, walk, fold_arms, agree）。基調講演風の暗いステージ、光る Apple ロゴ（assets/apple-logo.svg）、初代 iPhone、セリフ3つ
- **zuckerberg**: 標準テクスチャの古いモデル（つや消しのみ）。骨組み・show なし。Gemini 画像は紺のスーツ姿（`pipeline/out/zuckerberg_chibi.png`）
- **turing**: 標準テクスチャの古いモデル。ユーザーは「最初の頃の画像の方が似ていた」と言っている
- ほかの8人: 未生成（仮キャラ）
