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
export const JOBS = {
  se: { name: 'SE', full: 'システムエンジニア', w: { idea: 1, tech: 2, plan: 3, talk: 1 }, perk: { teamReward: 0.1 }, perkText: '担当した仕事の報酬 +10%', shirt: 0x4a78c2 },
  pg: { name: 'プログラマー', full: 'プログラマー', w: { idea: 1, tech: 3.5, plan: 1, talk: 0.5 }, perk: { teamSpeed: 0.15 }, perkText: '担当した仕事が 15% 早く終わる', shirt: 0x2f2f3a },
  infra: { name: 'インフラ', full: 'インフラエンジニア', w: { idea: 0.5, tech: 3, plan: 2, talk: 0.5 }, perk: { teamSuccess: 0.1 }, perkText: '担当した仕事の成功率 +10%', shirt: 0x3f8f6b },
  designer: { name: 'デザイナー', full: 'デザイナー', w: { idea: 3.5, tech: 1, plan: 1, talk: 1.5 }, perk: { teamQuality: 0.2 }, perkText: '開発した製品の出来 +20%', shirt: 0xe0607e },
  data: { name: 'データ分析', full: 'データサイエンティスト', w: { idea: 2, tech: 2.5, plan: 1.5, talk: 0.5 }, perk: { nextTrend: 1 }, perkText: '次の流行が前もって分かる', shirt: 0x7a5cc4 },
  pm: { name: 'PM', full: 'プロジェクトマネージャー', w: { idea: 1, tech: 1, plan: 2.5, talk: 2.5 }, perk: { teamSpeed: 0.1, teamSuccess: 0.05 }, perkText: 'チームの仕事が 10% 早く、成功率 +5%', shirt: 0x2d6ea8 },
  gm: { name: 'GM', full: 'ゼネラルマネージャー', w: { idea: 2, tech: 1, plan: 2, talk: 2 }, perk: { teamXp: 0.5 }, perkText: 'チーム全員の成長 +50%', shirt: 0x50505a },
  consul: { name: 'コンサル', full: 'ITコンサルタント', w: { idea: 2, tech: 1, plan: 2, talk: 3 }, perk: { teamReward: 0.2 }, perkText: '担当した仕事の報酬 +20%', shirt: 0x24324a },
  sales: { name: '営業', full: 'IT営業', w: { idea: 1, tech: 0.5, plan: 1, talk: 4 }, perk: { offers: 1 }, perkText: '届く依頼が 1 件増える', shirt: 0xc9822c },
};

// 会社の広さ。cap は入れる人数（自分も含む）、tier は受けられる仕事の大きさ
export const OFFICES = [
  { name: '自宅の部屋', cap: 2, cost: 0, rep: 0, floor: 0xd8c3a5, wall: 0xf1e6d6 },
  { name: 'ガレージ', cap: 4, cost: 300_000, rep: 30, floor: 0x9a9a9a, wall: 0xc9c2b4 },
  { name: '小さな事務所', cap: 7, cost: 2_000_000, rep: 150, floor: 0xb59a76, wall: 0xeeeeea },
  { name: 'オフィスビル', cap: 12, cost: 15_000_000, rep: 600, floor: 0x8f9bab, wall: 0xe4e8ef },
  { name: '本社ビル', cap: 20, cost: 100_000_000, rep: 2000, floor: 0x6f6a80, wall: 0xf5f3fa },
];

// 仕事（受託）の大きさごとの数字。rate は1時間あたりの報酬の目安
export const TIERS = [
  { rate: 6_000, diff: [14, 24], team: 2, hours: [1, 2, 4, 8], rep: 1 },
  { rate: 15_000, diff: [35, 60], team: 3, hours: [2, 4, 8, 12], rep: 3 },
  { rate: 40_000, diff: [80, 130], team: 4, hours: [4, 8, 12, 24], rep: 8 },
  { rate: 100_000, diff: [180, 280], team: 5, hours: [8, 12, 24, 36], rep: 20 },
  { rate: 250_000, diff: [380, 560], team: 6, hours: [12, 24, 36, 48], rep: 50 },
];

// 仕事の種類。cat は偉人と出会う条件に使う
export const TASKS = [
  // tier 0
  { tier: 0, cat: 'web', title: '商店街のお店のホームページ直し', w: { idea: 2, tech: 1, plan: 0, talk: 1 } },
  { tier: 0, cat: 'infra', title: 'ご近所のパソコン設定のお手伝い', w: { idea: 0, tech: 2, plan: 1, talk: 1 } },
  { tier: 0, cat: 'consult', title: '町内会の名簿づくりを自動化', w: { idea: 1, tech: 1, plan: 2, talk: 0 } },
  { tier: 0, cat: 'app', title: '小さなアプリの不具合直し', w: { idea: 0, tech: 3, plan: 1, talk: 0 } },
  { tier: 0, cat: 'web', title: 'カフェの予約ページ作り', w: { idea: 1, tech: 2, plan: 1, talk: 0 } },
  // tier 1
  { tier: 1, cat: 'web', title: '中小企業のWebサイト制作', w: { idea: 2, tech: 2, plan: 1, talk: 1 } },
  { tier: 1, cat: 'app', title: '美容室の予約システム開発', w: { idea: 1, tech: 2, plan: 2, talk: 1 } },
  { tier: 1, cat: 'infra', title: '会社のサーバーのお引っ越し', w: { idea: 0, tech: 3, plan: 2, talk: 0 } },
  { tier: 1, cat: 'consult', title: '工場のIT導入の相談', w: { idea: 1, tech: 0, plan: 2, talk: 3 } },
  // tier 2
  { tier: 2, cat: 'web', title: 'ネットショップの立ち上げ', w: { idea: 2, tech: 2, plan: 2, talk: 1 } },
  { tier: 2, cat: 'app', title: '人気店のスマホアプリ開発', w: { idea: 2, tech: 3, plan: 1, talk: 1 } },
  { tier: 2, cat: 'infra', title: 'オープンソースで社内システムを刷新', w: { idea: 1, tech: 3, plan: 2, talk: 0 } },
  { tier: 2, cat: 'consult', title: '地方銀行のIT戦略づくり', w: { idea: 1, tech: 1, plan: 2, talk: 3 } },
  // tier 3
  { tier: 3, cat: 'infra', title: '大手企業のクラウド移行', w: { idea: 0, tech: 3, plan: 3, talk: 1 } },
  { tier: 3, cat: 'ai', title: 'AIで売上を予測するシステム', w: { idea: 2, tech: 3, plan: 1, talk: 0 } },
  { tier: 3, cat: 'web', title: '全国チェーンの会員サービス開発', w: { idea: 2, tech: 2, plan: 2, talk: 2 } },
  { tier: 3, cat: 'space', title: '人工衛星の管制ソフト開発', w: { idea: 1, tech: 3, plan: 3, talk: 0 } },
  // tier 4
  { tier: 4, cat: 'space', title: '月面探査機の着陸プログラム', w: { idea: 1, tech: 3, plan: 4, talk: 0 } },
  { tier: 4, cat: 'ai', title: '会話できるAIアシスタントの開発', w: { idea: 3, tech: 3, plan: 1, talk: 1 } },
  { tier: 4, cat: 'infra', title: '全国の交通ICカードの基盤づくり', w: { idea: 0, tech: 3, plan: 3, talk: 1 } },
];
export const CAT_NAMES = { web: 'Web', app: 'アプリ', infra: 'インフラ', consult: '相談', ai: 'AI', space: '宇宙' };

// 自社製品（投資）。need は「ふつうの出来」に必要な力、cost は開発費、hours は開発にかかる時間
export const GENRES = {
  web: { name: 'Webサービス', cost: 100_000, hours: 24, need: 40, office: 0, w: { idea: 1, tech: 1, plan: 1, talk: 1 } },
  app: { name: 'スマホアプリ', cost: 250_000, hours: 36, need: 70, office: 1, w: { idea: 2, tech: 2, plan: 1, talk: 1 } },
  game: { name: 'ゲーム', cost: 500_000, hours: 48, need: 110, office: 1, w: { idea: 3, tech: 2, plan: 1, talk: 0 } },
  biz: { name: '業務ソフト', cost: 1_000_000, hours: 48, need: 160, office: 2, w: { idea: 0, tech: 2, plan: 3, talk: 1 } },
  ai: { name: 'AIサービス', cost: 5_000_000, hours: 72, need: 300, office: 3, w: { idea: 2, tech: 3, plan: 1, talk: 0 } },
};
export const PRODUCT_RATE = 0.006; // ふつうの出来なら1時間に開発費の 0.6% を稼ぐ
export const PRODUCT_HALF_LIFE = 7 * DAY; // 収入が半分になるまでの時間
export const TREND_PERIOD = 2 * DAY; // 流行が変わる間隔

export const START_MONEY = 100_000;
export const OFFER_EVERY = 2 * HOUR; // 新しい依頼が届く間隔
export const OFFER_LIFE = 18 * HOUR; // 依頼の受付期限
export const BASE_OFFERS = 4;
export const CANDIDATE_EVERY = DAY; // 採用候補が入れ替わる間隔
export const ENCOUNTER_PER_HOUR = 1 / 110; // 条件を満たした偉人と出会う確率（1時間あたり。平均4〜5日に1回）
export const ENCOUNTER_LIFE = DAY; // 出会いのチャンスが続く時間
export const RETRY_COOLDOWN = 3 * DAY; // 断られた偉人に次に会えるまで
export const MAX_CATCHUP = 30 * DAY; // 留守の間に進める最大の時間

// 偉人の「出会いの条件」と「特別な力」。時を超えて現代に現れる
// meet: rep 評判 / office 会社の広さ / cat: { 種類: 回数 } / products 製品数 / staff 一般社員数 / legends 偉人の数 / tasks 仕事の総数
// join: 口説いて仲間になる確率
export const LEGEND_RULES = {
  jobs: {
    stats: { idea: 95, tech: 35, plan: 60, talk: 100 },
    meet: { office: 1, rep: 40 },
    hint: 'ガレージで会社をやっていると…',
    join: 0.4,
    ability: { teamQuality: 0.6, income: 0.1 },
    abilityText: '開発に参加すると製品の出来 +60%、会社の全製品の収入 +10%',
    scene: 'ガレージの前で、黒いタートルネックの男がこちらを見ている…',
  },
  gates: {
    stats: { idea: 70, tech: 75, plan: 85, talk: 80 },
    meet: { products: 3, rep: 100 },
    hint: '自社製品を 3 つ売り出すと…',
    join: 0.4,
    ability: { income: 0.25 },
    abilityText: '会社の全製品の収入 +25%',
    scene: '製品の売れ行きを熱心に調べている眼鏡の若者がいる…',
  },
  zuckerberg: {
    stats: { idea: 80, tech: 80, plan: 50, talk: 60 },
    meet: { cat: { web: 10 }, rep: 60 },
    hint: 'Web の仕事を 10 回こなすと…',
    join: 0.4,
    ability: { incomeGenre: { web: 0.6, app: 0.3 } },
    abilityText: 'Webサービスの収入 +60%、スマホアプリの収入 +30%',
    scene: 'パーカー姿の学生が、ノートPCで何かを作っている…',
  },
  torvalds: {
    stats: { idea: 55, tech: 100, plan: 75, talk: 40 },
    meet: { cat: { infra: 10 } },
    hint: 'インフラの仕事を 10 回こなすと…',
    join: 0.4,
    ability: { hireCost: 0.5, teamSpeed: 0.2 },
    abilityText: '一般社員を雇う費用が半分、参加した仕事が 20% 早く終わる',
    scene: 'ペンギンのぬいぐるみを持った青年が、サーバーをのぞきこんでいる…',
  },
  ritchie: {
    stats: { idea: 60, tech: 100, plan: 85, talk: 35 },
    meet: { tasks: 120, office: 3 },
    hint: '仕事を 120 回こなし、オフィスビルを構えると…',
    join: 0.3,
    ability: { statAll: { tech: 0.15 } },
    abilityText: '会社の全員の技術 +15%',
    scene: 'ひげの男が、分厚いプログラミングの本を静かに読んでいる…',
  },
  bernerslee: {
    stats: { idea: 90, tech: 85, plan: 80, talk: 60 },
    meet: { cat: { web: 30 }, rep: 1500 },
    hint: 'Web の仕事を 30 回こなし、評判が 1500 を超えると…',
    join: 0.3,
    ability: { offers: 2, incomeGenre: { web: 0.3 } },
    abilityText: '届く依頼が 2 件増える、Webサービスの収入 +30%',
    scene: '「情報をつなぐ仕組み」の図を描いている紳士がいる…',
  },
  hopper: {
    stats: { idea: 75, tech: 85, plan: 80, talk: 85 },
    meet: { staff: 8 },
    hint: '一般社員を 8 人以上雇うと…',
    join: 0.3,
    ability: { xpAll: 1 },
    abilityText: '会社の全員の成長が 2 倍',
    scene: '海軍の制服の女性が、若手社員にていねいに教えている…',
  },
  hamilton: {
    stats: { idea: 70, tech: 90, plan: 100, talk: 55 },
    meet: { cat: { space: 3 } },
    hint: '宇宙の仕事を 3 回やりとげると…',
    join: 0.3,
    ability: { alwaysSuccess: 1 },
    abilityText: '参加した仕事は必ず成功する',
    scene: '背丈ほどのプログラムの紙の束の横に、女性が立っている…',
  },
  vonneumann: {
    stats: { idea: 100, tech: 95, plan: 90, talk: 70 },
    meet: { rep: 5000 },
    hint: '評判が 5000 を超えると…',
    join: 0.3,
    ability: { teamSpeed: 0.4, teamReward: 0.2 },
    abilityText: '参加した仕事が 40% 早く終わり、報酬 +20%',
    scene: '暗算で何かを一瞬で解いた紳士が、にやりと笑った…',
  },
  turing: {
    stats: { idea: 100, tech: 100, plan: 80, talk: 40 },
    meet: { cat: { ai: 10 } },
    hint: 'AI の仕事を 10 回こなすと…',
    join: 0.2,
    ability: { teamSuccess: 0.2, incomeGenre: { ai: 0.6 } },
    abilityText: '参加した仕事の成功率 +20%、AIサービスの収入 +60%',
    scene: '「機械は考えることができるか？」とつぶやく青年がいる…',
  },
  lovelace: {
    stats: { idea: 100, tech: 80, plan: 85, talk: 75 },
    meet: { legends: 8 },
    hint: '偉人が 8 人以上集まると…',
    join: 0.2,
    ability: { teamQuality: 0.8, decaySlow: 0.5 },
    abilityText: '開発に参加すると製品の出来 +80%、製品の収入が長持ちする',
    scene: '19世紀のドレスの女性が、計算機の設計図に見入っている…',
  },
};

