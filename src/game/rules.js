// ゲームのルールと数字（バランス調整はこのファイルで行う）
// 能力は4つ: idea 発想 / tech 技術 / plan 設計 / talk 伝える
export const STATS = { idea: '発想', tech: '技術', plan: '設計', talk: '伝える' };
export const STAT_KEYS = Object.keys(STATS);

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;

// 一般の人の職種。w は伸びやすい能力の重み、perk はその職種ならではの得意
// perk の種類（state.js の effects で使う）
//   teamSpeed / teamReward / teamSuccess / teamQuality / teamXp … その人が参加した仕事・開発だけに効く
//   income / offers / nextTrend … 会社にいるだけで効く
// desc: 仲間を押したときの詳しい画面に出す、その職種がどんな仕事か（2026-10-04 ユーザー指示）
// 依頼ごとに得意な職種が2つ決まっていて（TASKS の jobs）、その職種の人は力が JOB_GOOD 倍（2026-10-04 ユーザー指示）
// どの職種も得意な依頼は全体で18〜20件。peak は得意な依頼がいちばん多い時期（early 序盤＝自宅〜ガレージ / mid 中盤＝事務所〜本社ビル / late 後半＝その先）
export const JOB_GOOD = 1.5;
export const PEAK_NAMES = { early: '序盤', mid: '中盤', late: '後半' };
export const JOBS = {
  se: { name: 'SE', full: 'システムエンジニア', desc: 'お客さんの「こうしたい」を聞いて、システムの設計図を作る', w: { idea: 1, tech: 2, plan: 3, talk: 1 }, perk: { teamSuccess: 0.15 }, perkText: '成功率 +15%', goodText: '会社や店の仕組みづくり', peak: 'mid', shirt: 0x4a78c2 },
  pg: { name: 'プログラマー', full: 'プログラマー', desc: '設計図をもとにプログラムを書き、動くものを作る', w: { idea: 1, tech: 3.5, plan: 1, talk: 0.5 }, perk: { teamSpeed: 0.15 }, perkText: '速さ +15%', goodText: 'アプリやプログラムづくり', peak: 'early', shirt: 0x2f2f3a },
  infra: { name: 'インフラ', full: 'インフラエンジニア', desc: 'サーバーやネットワークなど、システムが動く土台を作って守る', w: { idea: 0.5, tech: 3, plan: 2, talk: 0.5 }, perk: { teamRep: 0.2 }, perkText: '評判 +20%', goodText: 'パソコン・ネットワーク・サーバー', peak: 'early', shirt: 0x3f8f6b },
  designer: { name: 'デザイナー', full: 'デザイナー', desc: '画面の見た目と使いやすさを考えて、形にする', w: { idea: 3.5, tech: 1, plan: 1, talk: 1.5 }, perk: { teamQuality: 0.2 }, perkText: '製品の出来 +20%', goodText: 'ホームページやアプリの見た目', peak: 'early', shirt: 0xe0607e },
  data: { name: 'データ分析', full: 'データサイエンティスト', desc: 'たくさんのデータを分析して、次の流行や打つ手を見つける', w: { idea: 2, tech: 2.5, plan: 1.5, talk: 0.5 }, perk: { nextTrend: 1 }, perkText: '次の流行が見える', goodText: 'データ分析やAI', peak: 'late', shirt: 0x7a5cc4 },
  pm: { name: 'PM', full: 'プロジェクトマネージャー', desc: '予定・お金・人をまとめて、期限までに完成させる責任者', w: { idea: 1, tech: 1, plan: 2.5, talk: 2.5 }, perk: { teamSpeed: 0.1, teamSuccess: 0.05 }, perkText: '速さ +10%  成功率 +5%', goodText: 'チームでの開発のとりまとめ', peak: 'mid', shirt: 0x2d6ea8 },
  gm: { name: 'GM', full: 'ゼネラルマネージャー', desc: '部門全体をまとめて人を育て、事業をうまく回す', w: { idea: 2, tech: 1, plan: 2, talk: 2 }, perk: { teamXp: 0.5 }, perkText: 'チームの成長 +50%', goodText: '大きな事業や計画', peak: 'late', shirt: 0x50505a },
  consul: { name: 'コンサル', full: 'ITコンサルタント', desc: '会社の困りごとを聞いて、ITでの解決策を提案する', w: { idea: 2, tech: 1, plan: 2, talk: 3 }, perk: { teamReward: 0.2 }, perkText: '報酬 +20%', goodText: 'IT導入や戦略の相談', peak: 'late', shirt: 0x24324a },
  sales: { name: '営業', full: 'IT営業', desc: '製品やサービスを紹介して、仕事の依頼を取ってくる', w: { idea: 1, tech: 0.5, plan: 1, talk: 4 }, perk: { offers: 0.25 }, perkText: '依頼 ×1.25', goodText: 'お店やお客さん向けのサービス', peak: 'mid', shirt: 0xc9822c },
};

// 会社の広さ。cap は入れる人数（自分も含む）、tier は受けられる仕事の大きさ
// lv は面接に来る人のレベルの幅、temp は派遣で来る人のレベル（大きな会社ほど育った人が来る）
// about: 次のオフィスを押したときに出す一言（中は影だけ見せるので、どんな所かの手がかり）
// 見た目（床・壁・窓・机・飾り）は office-decor.js の THEMES
// 本社ビルのあと（2026-10-01 ユーザー指示「終わりが見えないくらいやり込めるように」）: 高層タワー → … → 宇宙ステーション
export const OFFICES = [
  { name: '自宅の部屋', cap: 2, cost: 0, rep: 0, lv: [1, 2], about: '散らかった、ひとりの部屋', temp: 1 }, // 古くて薄汚れた部屋
  { name: 'ガレージ', cap: 4, cost: 300_000, rep: 30, lv: [1, 3], about: 'シャッターの奥の、仲間の秘密基地', temp: 3 },
  { name: '小さな事務所', cap: 7, cost: 2_000_000, rep: 150, lv: [1, 5], about: '付箋とフィギュアの、はじめての事務所', temp: 5 },
  { name: 'オフィスビル', cap: 12, cost: 15_000_000, rep: 600, lv: [1, 7], about: '仕切りと会議室の、ふつうの会社', temp: 7 },
  { name: '本社ビル', cap: 20, cost: 100_000_000, rep: 2000, lv: [1, 8], about: 'ガラスの会議室とラウンジの本社', temp: 9 },
  { name: '高層タワー', cap: 28, cost: 300_000_000, rep: 6000, lv: [6, 16], about: '空に近い、ガラス張りのフロア', temp: 14 },
  { name: 'テックキャンパス', cap: 38, cost: 1_200_000_000, rep: 15000, lv: [12, 26], about: '緑に囲まれた、自由なキャンパス', temp: 22 },
  { name: '世界本社', cap: 50, cost: 5_000_000_000, rep: 40000, lv: [20, 36], about: '世界をつなぐ、光の大画面', temp: 30 },
  { name: 'スマートシティ', cap: 64, cost: 20_000_000_000, rep: 100000, lv: [28, 48], about: '夜のネオンと、浮かぶ光の画面', temp: 40 },
  { name: '宇宙ステーション', cap: 80, cost: 100_000_000_000, rep: 250000, lv: [38, 62], about: '地球を見下ろす、宇宙の会社', temp: 52 },
];
// いちばん上の会社のあとは、いくらでも増築できる（1回ごとに席 +FLOOR_CAP。費用は FLOOR_COST から FLOOR_GROW 倍ずつ上がる）
export const FLOOR_CAP = 8;
export const FLOOR_COST = 30_000_000_000;
export const FLOOR_GROW = 1.35;

// 仕事（受託）の大きさごとの数字。rate は1時間あたりの報酬の目安。xp は成長の倍率（大きな仕事ほど育つ）
export const TIERS = [
  { rate: 6_000, diff: [14, 24], team: 2, hours: [1, 2, 4, 8], rep: 1 },
  { rate: 15_000, diff: [35, 60], team: 3, hours: [2, 4, 8, 12], rep: 3 },
  { rate: 40_000, diff: [80, 130], team: 4, hours: [4, 8, 12, 24], rep: 8 },
  { rate: 100_000, diff: [180, 280], team: 5, hours: [8, 12, 24, 36], rep: 20 },
  { rate: 250_000, diff: [380, 560], team: 6, hours: [12, 24, 36, 48], rep: 50 },
  { rate: 600_000, diff: [600, 820], team: 7, hours: [12, 24, 36, 48], rep: 120, xp: 1.6 },
  { rate: 1_500_000, diff: [850, 1150], team: 8, hours: [24, 36, 48, 72], rep: 280, xp: 2.6 },
  { rate: 4_000_000, diff: [1150, 1550], team: 9, hours: [24, 36, 48, 72], rep: 650, xp: 4.1 },
  { rate: 10_000_000, diff: [1500, 2100], team: 10, hours: [36, 48, 72, 96], rep: 1500, xp: 6.6 },
  { rate: 25_000_000, diff: [2200, 3100], team: 12, hours: [48, 72, 96, 120], rep: 3500, xp: 10.5 },
];

// 仕事の種類。cat は偉人と出会う条件に使う
export const TASKS = [
  // tier 0
  { tier: 0, cat: 'web', title: '商店街のお店のホームページ直し', jobs: ['designer', 'pg'], w: { idea: 2, tech: 1, plan: 0, talk: 1 } },
  { tier: 0, cat: 'infra', title: 'ご近所のパソコン設定のお手伝い', jobs: ['infra', 'sales'], w: { idea: 0, tech: 2, plan: 1, talk: 1 } },
  { tier: 0, cat: 'consult', title: '町内会の名簿づくりを自動化', jobs: ['se', 'pg'], w: { idea: 1, tech: 1, plan: 2, talk: 0 } },
  { tier: 0, cat: 'app', title: '小さなアプリの不具合直し', jobs: ['pg', 'se'], w: { idea: 0, tech: 3, plan: 1, talk: 0 } },
  { tier: 0, cat: 'web', title: 'カフェの予約ページ作り', jobs: ['designer', 'se'], w: { idea: 1, tech: 2, plan: 1, talk: 0 } },
  { tier: 0, cat: 'web', title: 'パン屋さんのお知らせページ作り', jobs: ['designer', 'sales'], w: { idea: 2, tech: 1, plan: 0, talk: 1 } },
  { tier: 0, cat: 'web', title: 'ブログのデザイン直し', jobs: ['designer', 'sales'], w: { idea: 3, tech: 1, plan: 0, talk: 0 } },
  { tier: 0, cat: 'app', title: 'スマホの写真整理アプリの手直し', jobs: ['pg', 'designer'], w: { idea: 1, tech: 2, plan: 1, talk: 0 } },
  { tier: 0, cat: 'app', title: 'サークルの出欠アプリ作り', jobs: ['pg', 'pm'], w: { idea: 1, tech: 2, plan: 1, talk: 0 } },
  { tier: 0, cat: 'infra', title: '家のWi-Fiがつながらない相談', jobs: ['infra', 'sales'], w: { idea: 0, tech: 2, plan: 1, talk: 1 } },
  { tier: 0, cat: 'infra', title: 'お店のレジのパソコンの修理', jobs: ['infra', 'pg'], w: { idea: 0, tech: 2, plan: 1, talk: 1 } },
  { tier: 0, cat: 'consult', title: 'Excel の表を自動で集計', jobs: ['data', 'consul'], w: { idea: 0, tech: 1, plan: 2, talk: 1 } },
  { tier: 0, cat: 'consult', title: 'おじいちゃんのスマホ教室', jobs: ['sales', 'consul'], w: { idea: 0, tech: 1, plan: 1, talk: 3 } },
  { tier: 0, cat: 'consult', title: '古いパソコンのデータを救出', jobs: ['infra', 'data'], w: { idea: 0, tech: 3, plan: 1, talk: 0 } },
  // tier 1
  { tier: 1, cat: 'web', title: '中小企業のWebサイト制作', jobs: ['designer', 'sales'], w: { idea: 2, tech: 2, plan: 1, talk: 1 } },
  { tier: 1, cat: 'app', title: '美容室の予約システム開発', jobs: ['se', 'pg'], w: { idea: 1, tech: 2, plan: 2, talk: 1 } },
  { tier: 1, cat: 'infra', title: '会社のサーバーのお引っ越し', jobs: ['infra', 'pm'], w: { idea: 0, tech: 3, plan: 2, talk: 0 } },
  { tier: 1, cat: 'consult', title: '工場のIT導入の相談', jobs: ['consul', 'infra'], w: { idea: 1, tech: 0, plan: 2, talk: 3 } },
  { tier: 1, cat: 'web', title: '病院のホームページ作り', jobs: ['designer', 'se'], w: { idea: 2, tech: 1, plan: 1, talk: 1 } },
  { tier: 1, cat: 'web', title: '地元の観光案内サイト', jobs: ['designer', 'gm'], w: { idea: 3, tech: 1, plan: 1, talk: 1 } },
  { tier: 1, cat: 'app', title: '塾の宿題アプリ開発', jobs: ['pg', 'designer'], w: { idea: 2, tech: 2, plan: 1, talk: 1 } },
  { tier: 1, cat: 'app', title: '農家の出荷管理アプリ', jobs: ['pg', 'data'], w: { idea: 1, tech: 2, plan: 2, talk: 1 } },
  { tier: 1, cat: 'infra', title: '事務所のネットワーク工事', jobs: ['infra', 'pm'], w: { idea: 0, tech: 3, plan: 2, talk: 0 } },
  { tier: 1, cat: 'infra', title: 'ウイルス対策の見直し', jobs: ['infra', 'se'], w: { idea: 0, tech: 3, plan: 1, talk: 1 } },
  { tier: 1, cat: 'consult', title: '商店街のキャッシュレス導入', jobs: ['sales', 'gm'], w: { idea: 1, tech: 0, plan: 2, talk: 3 } },
  // tier 2
  { tier: 2, cat: 'web', title: 'ネットショップの立ち上げ', jobs: ['designer', 'sales'], w: { idea: 2, tech: 2, plan: 2, talk: 1 } },
  { tier: 2, cat: 'app', title: '人気店のスマホアプリ開発', jobs: ['pg', 'designer'], w: { idea: 2, tech: 3, plan: 1, talk: 1 } },
  { tier: 2, cat: 'infra', title: 'オープンソースで社内システムを刷新', jobs: ['infra', 'se'], w: { idea: 1, tech: 3, plan: 2, talk: 0 } },
  { tier: 2, cat: 'consult', title: '地方銀行のIT戦略づくり', jobs: ['consul', 'gm'], w: { idea: 1, tech: 1, plan: 2, talk: 3 } },
  { tier: 2, cat: 'web', title: '旅館の予約サイトの作り直し', jobs: ['se', 'sales'], w: { idea: 2, tech: 2, plan: 2, talk: 1 } },
  { tier: 2, cat: 'web', title: 'ファッション通販のサイト作り', jobs: ['designer', 'pm'], w: { idea: 3, tech: 2, plan: 1, talk: 1 } },
  { tier: 2, cat: 'app', title: 'フィットネスジムの会員アプリ', jobs: ['pg', 'pm'], w: { idea: 2, tech: 3, plan: 1, talk: 1 } },
  { tier: 2, cat: 'app', title: 'タクシーを呼べるアプリ', jobs: ['pm', 'se'], w: { idea: 1, tech: 3, plan: 2, talk: 1 } },
  { tier: 2, cat: 'infra', title: '市役所のサーバー入れ替え', jobs: ['infra', 'pm'], w: { idea: 0, tech: 3, plan: 3, talk: 0 } },
  { tier: 2, cat: 'consult', title: '病院の電子カルテ導入', jobs: ['se', 'sales'], w: { idea: 1, tech: 1, plan: 3, talk: 2 } },
  // tier 3
  { tier: 3, cat: 'infra', title: '大手企業のクラウド移行', jobs: ['infra', 'gm'], w: { idea: 0, tech: 3, plan: 3, talk: 1 } },
  { tier: 3, cat: 'ai', title: 'AIで売上を予測するシステム', jobs: ['data', 'sales'], w: { idea: 2, tech: 3, plan: 1, talk: 0 } },
  { tier: 3, cat: 'web', title: '全国チェーンの会員サービス開発', jobs: ['se', 'sales'], w: { idea: 2, tech: 2, plan: 2, talk: 2 } },
  { tier: 3, cat: 'space', title: '人工衛星の管制ソフト開発', jobs: ['pg', 'pm'], w: { idea: 1, tech: 3, plan: 3, talk: 0 } },
  { tier: 3, cat: 'ai', title: '工場の不良品を見つけるAI', jobs: ['data', 'gm'], w: { idea: 1, tech: 3, plan: 2, talk: 0 } },
  { tier: 3, cat: 'ai', title: 'お客さんの問い合わせに答えるAI', jobs: ['data', 'sales'], w: { idea: 2, tech: 3, plan: 1, talk: 1 } },
  { tier: 3, cat: 'web', title: '全国ニュースサイトの作り直し', jobs: ['designer', 'se'], w: { idea: 2, tech: 3, plan: 2, talk: 1 } },
  { tier: 3, cat: 'app', title: '鉄道会社の乗換案内アプリ', jobs: ['se', 'pm'], w: { idea: 1, tech: 3, plan: 2, talk: 1 } },
  { tier: 3, cat: 'infra', title: '大学のネットワークを丸ごと更新', jobs: ['infra', 'pm'], w: { idea: 0, tech: 3, plan: 3, talk: 1 } },
  { tier: 3, cat: 'consult', title: '大手スーパーのデータ活用', jobs: ['data', 'consul'], w: { idea: 2, tech: 1, plan: 2, talk: 3 } },
  { tier: 3, cat: 'space', title: '気象衛星の画像処理', jobs: ['pm', 'se'], w: { idea: 1, tech: 3, plan: 2, talk: 0 } },
  // tier 4
  { tier: 4, cat: 'space', title: '月面探査機の着陸プログラム', jobs: ['pg', 'pm'], w: { idea: 1, tech: 3, plan: 4, talk: 0 } },
  { tier: 4, cat: 'ai', title: '会話できるAIアシスタントの開発', jobs: ['data', 'designer'], w: { idea: 3, tech: 3, plan: 1, talk: 1 } },
  { tier: 4, cat: 'infra', title: '全国の交通ICカードの基盤づくり', jobs: ['infra', 'se'], w: { idea: 0, tech: 3, plan: 3, talk: 1 } },
  { tier: 4, cat: 'space', title: 'ロケット打ち上げの管制システム', jobs: ['pm', 'infra'], w: { idea: 1, tech: 3, plan: 4, talk: 0 } },
  { tier: 4, cat: 'ai', title: '翻訳AIの開発', jobs: ['data', 'pg'], w: { idea: 2, tech: 3, plan: 2, talk: 0 } },
  { tier: 4, cat: 'web', title: '国の手続きをネットでできるように', jobs: ['se', 'consul'], w: { idea: 1, tech: 2, plan: 3, talk: 2 } },
  { tier: 4, cat: 'app', title: '全国の病院をつなぐ予約アプリ', jobs: ['gm', 'sales'], w: { idea: 1, tech: 2, plan: 3, talk: 2 } },
  { tier: 4, cat: 'consult', title: '大手銀行のシステム統合の相談', jobs: ['consul', 'se'], w: { idea: 1, tech: 1, plan: 3, talk: 3 } },
  // tier 5（高層タワー）
  { tier: 5, cat: 'web', title: '動画配信サービスの基盤づくり', jobs: ['infra', 'designer'], w: { idea: 1, tech: 3, plan: 2, talk: 0 } },
  { tier: 5, cat: 'app', title: '全国の銀行アプリの作り直し', jobs: ['designer', 'pg'], w: { idea: 1, tech: 2, plan: 3, talk: 1 } },
  { tier: 5, cat: 'infra', title: '国の行政システムのクラウド化', jobs: ['infra', 'consul'], w: { idea: 0, tech: 3, plan: 3, talk: 1 } },
  { tier: 5, cat: 'consult', title: '世界的な自動車メーカーのDX戦略', jobs: ['consul', 'gm'], w: { idea: 2, tech: 0, plan: 2, talk: 3 } },
  { tier: 5, cat: 'ai', title: '病院の画像診断AI', jobs: ['data', 'consul'], w: { idea: 1, tech: 3, plan: 2, talk: 0 } },
  { tier: 5, cat: 'space', title: '民間宇宙船の操縦ソフト', jobs: ['pm', 'gm'], w: { idea: 1, tech: 3, plan: 3, talk: 0 } },
  { tier: 5, cat: 'web', title: '世界的なSNSの日本版づくり', jobs: ['designer', 'sales'], w: { idea: 3, tech: 2, plan: 1, talk: 1 } },
  // tier 6（テックキャンパス）
  { tier: 6, cat: 'ai', title: '自動運転車のAI開発', jobs: ['data', 'pg'], w: { idea: 2, tech: 3, plan: 2, talk: 0 } },
  { tier: 6, cat: 'infra', title: '海底ケーブルの通信網づくり', jobs: ['infra', 'gm'], w: { idea: 0, tech: 3, plan: 3, talk: 1 } },
  { tier: 6, cat: 'space', title: '宇宙望遠鏡のデータ解析', jobs: ['data', 'se'], w: { idea: 2, tech: 3, plan: 2, talk: 0 } },
  { tier: 6, cat: 'web', title: '世界で使われる検索エンジン', jobs: ['data', 'sales'], w: { idea: 2, tech: 3, plan: 1, talk: 1 } },
  { tier: 6, cat: 'app', title: '1億人が使う決済アプリ', jobs: ['se', 'gm'], w: { idea: 1, tech: 2, plan: 3, talk: 1 } },
  { tier: 6, cat: 'consult', title: '世界の空港をつなぐ計画', jobs: ['gm', 'consul'], w: { idea: 1, tech: 1, plan: 3, talk: 3 } },
  { tier: 6, cat: 'ai', title: '工場をまるごと動かすAI', jobs: ['data', 'gm'], w: { idea: 1, tech: 3, plan: 3, talk: 0 } },
  // tier 7（世界本社）
  { tier: 7, cat: 'ai', title: '1か月先の天気を当てるAI', jobs: ['data', 'pm'], w: { idea: 2, tech: 3, plan: 2, talk: 0 } },
  { tier: 7, cat: 'infra', title: '世界のデータセンターをつなぐ', jobs: ['infra', 'gm'], w: { idea: 0, tech: 3, plan: 3, talk: 1 } },
  { tier: 7, cat: 'space', title: '火星探査車の自動運転', jobs: ['pg', 'data'], w: { idea: 1, tech: 3, plan: 3, talk: 0 } },
  { tier: 7, cat: 'consult', title: '国の通貨のデジタル化', jobs: ['consul', 'se'], w: { idea: 1, tech: 1, plan: 3, talk: 3 } },
  { tier: 7, cat: 'app', title: '世界同時配信のオンラインゲーム', jobs: ['designer', 'pm'], w: { idea: 3, tech: 3, plan: 1, talk: 0 } },
  { tier: 7, cat: 'web', title: '世界の学校をつなぐ授業サイト', jobs: ['pg', 'gm'], w: { idea: 2, tech: 2, plan: 2, talk: 2 } },
  { tier: 7, cat: 'ai', title: '災害を予測するAI', jobs: ['data', 'consul'], w: { idea: 2, tech: 3, plan: 2, talk: 0 } },
  // tier 8（スマートシティ）
  { tier: 8, cat: 'ai', title: '新しい薬を見つけるAI', jobs: ['data', 'consul'], w: { idea: 3, tech: 3, plan: 1, talk: 0 } },
  { tier: 8, cat: 'space', title: '月面基地の生命維持システム', jobs: ['gm', 'pm'], w: { idea: 1, tech: 3, plan: 4, talk: 0 } },
  { tier: 8, cat: 'infra', title: '量子暗号の通信網', jobs: ['infra', 'consul'], w: { idea: 1, tech: 4, plan: 2, talk: 0 } },
  { tier: 8, cat: 'web', title: '街じゅうのセンサーをつなぐ', jobs: ['data', 'gm'], w: { idea: 1, tech: 3, plan: 3, talk: 1 } },
  { tier: 8, cat: 'app', title: '街の全員が使う暮らしのアプリ', jobs: ['designer', 'sales'], w: { idea: 2, tech: 2, plan: 2, talk: 2 } },
  { tier: 8, cat: 'consult', title: '空飛ぶクルマの交通ルールづくり', jobs: ['consul', 'gm'], w: { idea: 1, tech: 1, plan: 3, talk: 3 } },
  // tier 9（宇宙ステーション）
  { tier: 9, cat: 'space', title: '火星の都市の管制システム', jobs: ['gm', 'pm'], w: { idea: 1, tech: 3, plan: 4, talk: 1 } },
  { tier: 9, cat: 'ai', title: '人と話せる汎用AI', jobs: ['data', 'consul'], w: { idea: 3, tech: 4, plan: 1, talk: 1 } },
  { tier: 9, cat: 'infra', title: '地球全体の電力網の制御', jobs: ['infra', 'consul'], w: { idea: 0, tech: 3, plan: 4, talk: 1 } },
  { tier: 9, cat: 'app', title: '全人類の通訳アプリ', jobs: ['pg', 'sales'], w: { idea: 2, tech: 3, plan: 1, talk: 3 } },
];
export const CAT_NAMES = { web: 'Web', app: 'アプリ', infra: 'インフラ', consult: '相談', ai: 'AI', space: '宇宙' };

// 自社製品（投資）。need は「ふつうの出来」に必要な力、cost は開発費、hours は開発にかかる時間
export const GENRES = {
  web: { name: 'Webサービス', cost: 100_000, hours: 24, need: 40, office: 0, w: { idea: 1, tech: 1, plan: 1, talk: 1 } },
  app: { name: 'スマホアプリ', cost: 250_000, hours: 36, need: 70, office: 1, w: { idea: 2, tech: 2, plan: 1, talk: 1 } },
  game: { name: 'ゲーム', cost: 500_000, hours: 48, need: 110, office: 1, w: { idea: 3, tech: 2, plan: 1, talk: 0 } },
  biz: { name: '業務ソフト', cost: 1_000_000, hours: 48, need: 160, office: 2, w: { idea: 0, tech: 2, plan: 3, talk: 1 } },
  ai: { name: 'AIサービス', cost: 5_000_000, hours: 72, need: 300, office: 3, w: { idea: 2, tech: 3, plan: 1, talk: 0 } },
  // 大きな会社でだけ作れる製品（本社ビルから）
  cloud: { name: 'クラウド基盤', cost: 30_000_000, hours: 96, need: 450, office: 4, w: { idea: 0, tech: 3, plan: 3, talk: 0 } },
  sns: { name: 'SNS', cost: 150_000_000, hours: 120, need: 700, office: 5, w: { idea: 3, tech: 2, plan: 1, talk: 2 } },
  car: { name: '自動運転', cost: 800_000_000, hours: 144, need: 1100, office: 6, w: { idea: 1, tech: 3, plan: 3, talk: 0 } },
  quantum: { name: '量子コンピュータ', cost: 4_000_000_000, hours: 168, need: 1700, office: 7, w: { idea: 2, tech: 4, plan: 2, talk: 0 } },
  satnet: { name: '宇宙インターネット', cost: 20_000_000_000, hours: 240, need: 2500, office: 8, w: { idea: 1, tech: 3, plan: 3, talk: 1 } },
  agi: { name: '汎用AI', cost: 100_000_000_000, hours: 336, need: 3800, office: 9, w: { idea: 3, tech: 4, plan: 2, talk: 1 } },
};
export const PRODUCT_RATE = 0.006; // ふつうの出来なら1時間に開発費の 0.6% を稼ぐ
export const PRODUCT_HALF_LIFE = 7 * DAY; // 収入が半分になるまでの時間
export const TREND_PERIOD = 2 * DAY; // 流行が変わる間隔
// 販売終了にも意味を持たせる（2026-10-07 ユーザー指示）
// 維持費: 1時間に、ふつうの出来・流行1倍で発売したときの稼ぎの PRODUCT_UPKEEP 倍（サーバー代など）。出来・流行・レジェンドには左右されない
// 古くなって稼ぎが維持費を下回ると赤字になる（ふつうの出来で約3週間、出来が良いほど長く持つ）
export const PRODUCT_UPKEEP = 0.1;
// 売却: やめるときに、今の1時間のもうけ（稼ぎ − 維持費）の SELL_HOURS 時間ぶんで売れる。赤字なら 0 円（ただやめるだけ）
export const SELL_HOURS = 48;
// 同じ種類の製品は、開発中も含めて同時に PRODUCT_MAX までしか持てない（種類ごとなので、後半でも Web の枠はほかの製品と取り合わない）
export const PRODUCT_MAX = 3;
// ブランド力（2026-10-07 ユーザー指示）: 大きな会社が出す製品ほどよく売れる。作れるようになった会社より1つ大きくなるごとに売上 ×BRAND_STEP
// 安い製品ほど差が開くので、後半の Web でも売上が伸びる（自宅で作れる Web は本社ビルで約10倍、宇宙ステーションで約200倍）。維持費は増えない
export const BRAND_STEP = 1.8;

export const START_MONEY = 100_000;
export const FIRST_OFFER_HOURS = [1 / 60, 1 / 6, 0.5]; // 始めたときの依頼の時間（1分・10分・30分。2026-10-03 序盤を速く。案内で選ぶ最初の仕事はすぐ終わるように）
// 1時間ごとに新しい依頼が届く確率は、会社の評判で決まる（並んでいる数が上限より少ないときだけ）
// 確率 = (OFFER_BASE + OFFER_PER_DIGIT × log10(評判+1)) × 営業・レジェンドの倍率（offers: 0.25 なら ×1.25。重ねると掛け算）。100% を超えたぶんは同じ1時間に2件目以降が届く
// 並べておける数に上限はない（18時間で期限切れになるので、溜まるのは平均「確率×18件」くらい）
// 評判 0 で 20%（平均5時間に1件）、30 で 35%、600 で 48%、6000 で 58%、25万で 74%
export const OFFER_BASE = 0.2;
export const OFFER_PER_DIGIT = 0.1;
export const OFFER_LIFE = 18 * HOUR; // 依頼の受付期限（過ぎると消える）
export const OFFER_SOON = 3 * HOUR; // 期限がこれより近い依頼は赤く出す
// 要員派遣: お金を払うと、席の数を超えて仕事の間だけ人を借りられる（仕事が終わると帰る。成長はしない）
// 1人ぶんの料金は仕事の報酬の TEMP_FEE 倍。来る人は今の会社で雇える人くらいの腕で、その仕事に向いた職種
export const TEMP_FEE = 0.3;

// 派遣（2026-10-06 ユーザー指示「派遣は期間を決めて雇う、SES は依頼の時のみ」）
// 期間を決めて人を借りる。席を使い、社員と同じようにどの仕事にも回せる。成長はしない。料金は前払い
// 1日の料金は同じ腕の社員の給料の HAKEN_RATE 倍（派遣会社の取り分）。来る人は今の会社の面接でいちばん育った人くらい
// 紹介予定派遣は料金が HAKEN_INTRO 倍で、期間中か終わったあとに安く社員にできる（給料 INTRO_HIRE 日分。ふつうの採用は5日分）
export const HAKEN_DAYS = [3, 7, 14];
export const HAKEN_RATE = 1.5;
export const HAKEN_INTRO = 1.2;
export const INTRO_HIRE = 3;
export const INTRO_WAIT = 1; // 紹介予定派遣の期間が終わったあと、社員になるか返事を待ってくれる日数
// 人数が多いほど早く終わる。1人増えるごとに TEAM_SPEEDUP ぶん速くなる（2人で 1.3倍、3人で 1.6倍…）
export const TEAM_SPEEDUP = 0.3;
// 仕事が終わったときの評判。力が必要な分の GREAT 倍以上なら出来が良い（評判 1.5倍）、足りないままの成功は 0.7倍
// 希望納期（依頼の時間）の EARLY 倍以内に終われば +50%。失敗すると評判が FAIL_REP 倍ぶん下がる
export const REP_GREAT = 1.5;
export const REP_EARLY = 0.75;
export const FAIL_REP = 0.5;
export const CANDIDATE_EVERY = DAY;
// 面接に来た人は、選ばれないまま CANDIDATE_LIFE（日数の幅）がたつと辞退していなくなる。並んで待てるのは MAX_CANDIDATES 人まで
export const CANDIDATE_LIFE = [1, 2.5];
export const MAX_CANDIDATES = 5; // 採用候補が入れ替わる間隔
// 1日に面接に来る人の数（会社の広さごとの平均）。小さいうちはなかなか来ないので、勉強会で人を呼ぶ
export const CANDIDATES_PER_DAY = [0.25, 1, 2, 3, 3, 3, 4, 4, 5, 5];
// 求人広告（お金を出して期限つきで出す）。出している間は、ふだんとは別に面接に来る人が増える。出している間は出し直せない
// 種類（グレード）ごとに費用・効果・長さが違う（2026-10-04 ユーザー指示「ビラ配り・SNS など。値段や効果、長さもグレードで」）
//   hours: 費用（今の会社の仕事 何時間ぶんの報酬か） / days: 出している日数 / per: 1日に来る人（平均。ふだんの人数が多い会社では per×ふだんの人数÷2）
//   power: 画面に出す効果の強さ（棒の数）
export const ADS = [
  { name: '張り紙', icon: 'paper', hours: 2, days: 2, per: 1, power: 1 },
  { name: '求人サイト', icon: 'globe', hours: 6, days: 3, per: 2, power: 2 },
  { name: 'SNSで募集', icon: 'bubble', hours: 14, days: 5, per: 3, power: 3 },
  { name: '転職エージェント', icon: 'people', hours: 40, days: 7, per: 4.5, power: 4 },
];
// 宣伝（仕事の求人広告にあたるもの）。出している間は依頼の届く確率が boost 倍
export const PRS = [
  { name: 'ビラ配り', icon: 'paper', hours: 3, days: 2, boost: 1.5, power: 1 },
  { name: 'ネット広告', icon: 'globe', hours: 8, days: 3, boost: 2, power: 2 },
  { name: 'SNSで宣伝', icon: 'bubble', hours: 20, days: 5, boost: 2.5, power: 3 },
  { name: 'テレビCM', icon: 'tv', hours: 60, days: 7, boost: 3.5, power: 4 },
];
// 条件をつける（お金を足すと、来る人・依頼をしぼれる。2026-10-04 ユーザー指示「Web系の募集、デザイナーの募集など」）
//   cat: 種類（求人は、その種類の依頼が得意な職種の人だけ来る。宣伝は、増えたぶんの依頼がその種類になる） / job: 職種（求人だけ）
//   費用がこの倍になる（+30% / +60%）。種類・職種はいくつでも選べて、いくつ選んでも費用は同じ（2026-10-04 ユーザー指示「複数にできるか」）
export const COND_COST = { cat: 1.3, job: 1.6 };
export const DEFAULT_AD = 1; // 種類を選べるようになる前に出した広告は「求人サイト」「ネット広告」
export const ENCOUNTER_PER_HOUR = 1 / 110; // 条件を満たした偉人と出会う確率（1時間あたり。平均4〜5日に1回）
export const ENCOUNTER_LIFE = DAY; // 出会いのチャンスが続く時間
export const RETRY_COOLDOWN = 3 * DAY; // 断られた偉人に次に会えるまで
// CEO の過ごし方（無料。いつもどれか1つを選んでいる）。選んだものに合った出来事がまれに起きる（1時間ごとに判定）
//   event: legend 偉人と偶然出会う（条件を満たしていなくても） / luck 臨時収入 / walkin 入社したい人が面接に来る
export const ACTIVITIES = {
  // 散歩はご近所で仕事の相談も受ける（平均4時間に1件。ふつうの依頼とは別に届く）
  walk: { name: '散歩', icon: 'walk', event: 'legend', perHour: 1 / 400, offerPerHour: 1 / 4 }, // 平均17日に1回くらい
  net: { name: 'ネット', icon: 'globe', event: 'luck', perHour: 1 / 36 }, // 平均1日半に1回くらい
  meetup: { name: '勉強会', icon: 'seminar', event: 'walkin', perHour: 1 / 48 }, // 平均2日に1回くらい
};
export const DEFAULT_ACTIVITY = 'net';
// 臨時収入（ネットで見つかる）。amount は今の会社の仕事1時間ぶんの報酬の何倍か
export const LUCKS = [
  { title: '昔作ったアプリの広告収入', amount: [2, 4] },
  { title: 'IT導入補助金を見つけた', amount: [4, 8] },
  { title: 'オンラインのハッカソンで優勝', amount: [3, 6] },
  { title: '脆弱性を見つけた報奨金', amount: [3, 7] },
  { title: 'ブログが話題になった', amount: [1, 3] },
  { title: 'ドメインが高く売れた', amount: [5, 10] },
];
// 冷やかし：仕事中（仕事か開発が動いている間）に、まだ仲間でないレジェンドがライバルとして事務所に来る（1時間ごとに判定）
// お金を減らされるか、手の空いている社員を引き抜かれる。来たレジェンドは RIVAL_STAY のあいだ事務所にいる
export const RIVAL_PER_HOUR = 1 / 96; // 仕事をし続けて平均4日に1回くらい
export const RIVAL_POACH = 0.25; // 社員を引き抜かれる確率（社員が2人以上いて、手の空いている社員がいるとき。最後の1人は取られない）
export const RIVAL_STAY = 20 * 60_000;
export const RIVAL_GRACE = 3 * DAY; // 始めてからしばらくは冷やかしに来ない（最初から取られると理不尽に感じるため。2026-10-03）
export const LEGEND_SETTLE = 7 * DAY; // 仲間になって（戻って）しばらくは辞めない
// お金を減らされるとき。amount は今の会社の仕事1時間ぶんの報酬の何倍か
export const RIVAL_HITS = [
  { title: '安い値段で仕事を横取りされた', amount: [3, 6] },
  { title: 'お客さんに悪いうわさを広められた', amount: [2, 5] },
  { title: '高いパソコンを壊された', amount: [2, 4] },
  { title: 'ライバル製品で客を持っていかれた', amount: [4, 8] },
];
// 辞めたレジェンドを呼び戻すお金：今の会社の仕事 REHIRE_HOURS 時間ぶんの報酬
export const REHIRE_HOURS = 120;
export const MAX_CATCHUP = 30 * DAY; // 留守の間に進める最大の時間

// 偉人の「出会いの条件」と「特別な力」。時を超えて現代に現れる
// quit: 我の強いレジェンドは、仲間になっても平均この日数で自分から辞任する（性格による。無いものは辞めない）
//   辞めたあとは REHIRE_HOURS ぶんの高いお金で呼び戻すか、また出会うのを待つ（レベルはそのまま）
// meet: rep 評判 / office 会社の広さ / cat: { 種類: 回数 } / products 製品数 / staff 一般社員数 / legends 偉人の数 / tasks 仕事の総数
// join: 口説いて仲間になる確率
export const LEGEND_RULES = {
  jobs: {
    stats: { idea: 95, tech: 35, plan: 60, talk: 100 },
    meet: { office: 1, rep: 40 },
    hint: 'ガレージで会社をやっていると…',
    join: 0.4,
    ability: { teamQuality: 0.6, income: 0.1 },
    abilityText: '製品の出来 +60%  全製品の収入 +10%',
    quit: 20,
    quitText: '「自分の会社をつくる」と言って去った',
    scene: 'ガレージの前で、黒いタートルネックの男がこちらを見ている…',
  },
  gates: {
    stats: { idea: 70, tech: 75, plan: 85, talk: 80 },
    meet: { products: 3, rep: 100 },
    hint: '自社製品を 3 つ売り出すと…',
    join: 0.4,
    ability: { income: 0.4 },
    abilityText: '全製品の収入 +40%',
    quit: 50,
    quitText: '「自分の会社を始める」と去った',
    scene: '製品の売れ行きを熱心に調べている眼鏡の若者がいる…',
  },
  zuckerberg: {
    stats: { idea: 80, tech: 80, plan: 50, talk: 60 },
    meet: { cat: { web: 10 }, rep: 60 },
    hint: 'Web の仕事を 10 回こなすと…',
    join: 0.4,
    ability: { incomeGenre: { web: 0.6, app: 0.3 } },
    abilityText: 'Web の収入 +60%  アプリの収入 +30%',
    quit: 40,
    quitText: '「自分のサービスを作る」と寮に戻った',
    scene: 'パーカー姿の学生が、ノートPCで何かを作っている…',
  },
  torvalds: {
    stats: { idea: 55, tech: 100, plan: 75, talk: 40 },
    meet: { cat: { infra: 10 } },
    hint: 'インフラの仕事を 10 回こなすと…',
    join: 0.4,
    ability: { hireCost: 0.5, teamSpeed: 0.3, teamSuccess: 0.1 },
    abilityText: '雇う費用 半分  速さ +30%  成功率 +10%',
    quit: 25,
    quitText: '「自分のやり方でやる」と言って去った',
    scene: 'ペンギンのぬいぐるみを持った青年が、サーバーをのぞきこんでいる…',
  },
  ritchie: {
    stats: { idea: 60, tech: 100, plan: 85, talk: 35 },
    meet: { tasks: 120, office: 3 },
    hint: '仕事を 120 回こなし、オフィスビルを構えると…',
    join: 0.3,
    ability: { statAll: { tech: 0.25 } },
    abilityText: '全員の技術 +25%',
    scene: 'ひげの男が、分厚いプログラミングの本を静かに読んでいる…',
  },
  bernerslee: {
    stats: { idea: 90, tech: 85, plan: 80, talk: 60 },
    meet: { cat: { web: 30 }, rep: 1500 },
    hint: 'Web の仕事を 30 回こなし、評判が 1500 を超えると…',
    join: 0.3,
    ability: { offers: 1, incomeGenre: { web: 0.5 } },
    abilityText: '依頼 ×2  Web の収入 +50%',
    scene: '「情報をつなぐ仕組み」の図を描いている紳士がいる…',
  },
  hopper: {
    stats: { idea: 75, tech: 85, plan: 80, talk: 85 },
    meet: { staff: 8 },
    hint: '一般社員を 8 人以上雇うと…',
    join: 0.3,
    ability: { xpAll: 1 },
    abilityText: '全員の成長 2倍',
    scene: '海軍の制服の女性が、若手社員にていねいに教えている…',
  },
  hamilton: {
    stats: { idea: 70, tech: 90, plan: 100, talk: 55 },
    meet: { cat: { space: 3 } },
    hint: '宇宙の仕事を 3 回やりとげると…',
    join: 0.3,
    ability: { alwaysSuccess: 1 },
    abilityText: '担当した仕事は必ず成功',
    scene: '背丈ほどのプログラムの紙の束の横に、女性が立っている…',
  },
  vonneumann: {
    stats: { idea: 100, tech: 95, plan: 90, talk: 70 },
    meet: { rep: 5000 },
    hint: '評判が 5000 を超えると…',
    join: 0.3,
    ability: { teamSpeed: 0.4, teamReward: 0.4 },
    abilityText: '速さ +40%  報酬 +40%',
    quit: 30,
    quitText: 'ほかの研究所に呼ばれて去った',
    scene: '暗算で何かを一瞬で解いた紳士が、にやりと笑った…',
  },
  turing: {
    stats: { idea: 100, tech: 100, plan: 80, talk: 40 },
    meet: { cat: { ai: 10 } },
    hint: 'AI の仕事を 10 回こなすと…',
    join: 0.2,
    ability: { teamSuccess: 0.3, incomeGenre: { ai: 1 } },
    abilityText: '成功率 +30%  AI の収入 2倍',
    scene: '「機械は考えることができるか？」とつぶやく青年がいる…',
  },
  lovelace: {
    stats: { idea: 100, tech: 80, plan: 85, talk: 75 },
    meet: { legends: 8 },
    hint: 'レジェンドが 8 人以上集まると…',
    join: 0.2,
    ability: { teamQuality: 0.8, decaySlow: 0.5 },
    abilityText: '製品の出来 +80%  収入が長持ち',
    scene: '19世紀のドレスの女性が、計算機の設計図に見入っている…',
  },
  ek: {
    stats: { idea: 85, tech: 75, plan: 65, talk: 70 },
    meet: { cat: { app: 10 }, products: 2 },
    hint: 'アプリの仕事を 10 回こなし、製品を 2 つ出すと…',
    join: 0.4,
    ability: { incomeGenre: { app: 0.5 }, decaySlow: 0.3 },
    abilityText: 'アプリの収入 +50%  収入が長持ち',
    scene: 'ヘッドホンをした若者が、音楽を聴きながら何かを考えている…',
  },
  bezos: {
    stats: { idea: 80, tech: 70, plan: 90, talk: 80 },
    meet: { office: 2, cat: { web: 15 } },
    hint: '小さな事務所を構え、Web の仕事を 15 回こなすと…',
    join: 0.3,
    ability: { income: 0.2, offers: 1 },
    abilityText: '全製品の収入 +20%  依頼 ×2',
    quit: 35,
    quitText: '「宇宙ロケットの会社に専念する」と去った',
    scene: '段ボール箱の山の前で、大きな声で笑う男がいる…',
  },
  maezawa: {
    stats: { idea: 85, tech: 55, plan: 75, talk: 90 },
    meet: { cat: { web: 20 }, products: 3 },
    hint: 'Web の仕事を 20 回こなし、製品を 3 つ出すと…',
    join: 0.4,
    // お金配りで有名なので、臨時収入が2倍
    ability: { incomeGenre: { web: 0.4 }, luck: 1 },
    abilityText: 'Web の収入 +40%  臨時収入 2倍',
    quit: 30,
    quitText: '「宇宙へ行く」と言って会社を去った',
    scene: '水玉もようの全身スーツを手に、にこにこしている男がいる…',
  },
  matz: {
    stats: { idea: 85, tech: 90, plan: 75, talk: 70 },
    meet: { cat: { web: 15 }, staff: 3 },
    hint: 'Web の仕事を 15 回こなし、社員を 3 人雇うと…',
    join: 0.4,
    // 「プログラマーを幸せにする」言語を作った人なので、みんなが早く育ち、仕事も速くなる
    ability: { xpAll: 0.3, teamSpeed: 0.15 },
    abilityText: '全員の成長 +30%  速さ +15%',
    scene: '赤い宝石を手に、楽しそうにプログラムを書くメガネの男がいる…',
  },
};

