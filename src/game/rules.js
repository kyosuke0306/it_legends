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
  se: { name: 'SE', full: 'システムエンジニア', w: { idea: 1, tech: 2, plan: 3, talk: 1 }, perk: { teamReward: 0.1 }, perkText: '報酬 +10%', shirt: 0x4a78c2 },
  pg: { name: 'プログラマー', full: 'プログラマー', w: { idea: 1, tech: 3.5, plan: 1, talk: 0.5 }, perk: { teamSpeed: 0.15 }, perkText: '速さ +15%', shirt: 0x2f2f3a },
  infra: { name: 'インフラ', full: 'インフラエンジニア', w: { idea: 0.5, tech: 3, plan: 2, talk: 0.5 }, perk: { teamSuccess: 0.1 }, perkText: '成功率 +10%', shirt: 0x3f8f6b },
  designer: { name: 'デザイナー', full: 'デザイナー', w: { idea: 3.5, tech: 1, plan: 1, talk: 1.5 }, perk: { teamQuality: 0.2 }, perkText: '製品の出来 +20%', shirt: 0xe0607e },
  data: { name: 'データ分析', full: 'データサイエンティスト', w: { idea: 2, tech: 2.5, plan: 1.5, talk: 0.5 }, perk: { nextTrend: 1 }, perkText: '次の流行が見える', shirt: 0x7a5cc4 },
  pm: { name: 'PM', full: 'プロジェクトマネージャー', w: { idea: 1, tech: 1, plan: 2.5, talk: 2.5 }, perk: { teamSpeed: 0.1, teamSuccess: 0.05 }, perkText: '速さ +10%  成功率 +5%', shirt: 0x2d6ea8 },
  gm: { name: 'GM', full: 'ゼネラルマネージャー', w: { idea: 2, tech: 1, plan: 2, talk: 2 }, perk: { teamXp: 0.5 }, perkText: 'チームの成長 +50%', shirt: 0x50505a },
  consul: { name: 'コンサル', full: 'ITコンサルタント', w: { idea: 2, tech: 1, plan: 2, talk: 3 }, perk: { teamReward: 0.2 }, perkText: '報酬 +20%', shirt: 0x24324a },
  sales: { name: '営業', full: 'IT営業', w: { idea: 1, tech: 0.5, plan: 1, talk: 4 }, perk: { offers: 1 }, perkText: '依頼 +1件', shirt: 0xc9822c },
};

// 会社の広さ。cap は入れる人数（自分も含む）、tier は受けられる仕事の大きさ
// lv は面接に来る人のレベルの幅、temp は派遣で来る人のレベル（大きな会社ほど育った人が来る）
// 見た目（床・壁・窓・机・飾り）は office-decor.js の THEMES
// 本社ビルのあと（2026-10-01 ユーザー指示「終わりが見えないくらいやり込めるように」）: 高層タワー → … → 宇宙ステーション
export const OFFICES = [
  { name: '自宅の部屋', cap: 2, cost: 0, rep: 0, lv: [1, 2], temp: 1 }, // 古くて薄汚れた部屋
  { name: 'ガレージ', cap: 4, cost: 300_000, rep: 30, lv: [1, 3], temp: 3 },
  { name: '小さな事務所', cap: 7, cost: 2_000_000, rep: 150, lv: [1, 5], temp: 5 },
  { name: 'オフィスビル', cap: 12, cost: 15_000_000, rep: 600, lv: [1, 7], temp: 7 },
  { name: '本社ビル', cap: 20, cost: 100_000_000, rep: 2000, lv: [1, 8], temp: 9 },
  { name: '高層タワー', cap: 28, cost: 300_000_000, rep: 6000, lv: [6, 16], temp: 14 },
  { name: 'テックキャンパス', cap: 38, cost: 1_200_000_000, rep: 15000, lv: [12, 26], temp: 22 },
  { name: '世界本社', cap: 50, cost: 5_000_000_000, rep: 40000, lv: [20, 36], temp: 30 },
  { name: 'スマートシティ', cap: 64, cost: 20_000_000_000, rep: 100000, lv: [28, 48], temp: 40 },
  { name: '宇宙ステーション', cap: 80, cost: 100_000_000_000, rep: 250000, lv: [38, 62], temp: 52 },
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
  // tier 5（高層タワー）
  { tier: 5, cat: 'web', title: '動画配信サービスの基盤づくり', w: { idea: 1, tech: 3, plan: 2, talk: 0 } },
  { tier: 5, cat: 'app', title: '全国の銀行アプリの作り直し', w: { idea: 1, tech: 2, plan: 3, talk: 1 } },
  { tier: 5, cat: 'infra', title: '国の行政システムのクラウド化', w: { idea: 0, tech: 3, plan: 3, talk: 1 } },
  { tier: 5, cat: 'consult', title: '世界的な自動車メーカーのDX戦略', w: { idea: 2, tech: 0, plan: 2, talk: 3 } },
  { tier: 5, cat: 'ai', title: '病院の画像診断AI', w: { idea: 1, tech: 3, plan: 2, talk: 0 } },
  // tier 6（テックキャンパス）
  { tier: 6, cat: 'ai', title: '自動運転車のAI開発', w: { idea: 2, tech: 3, plan: 2, talk: 0 } },
  { tier: 6, cat: 'infra', title: '海底ケーブルの通信網づくり', w: { idea: 0, tech: 3, plan: 3, talk: 1 } },
  { tier: 6, cat: 'space', title: '宇宙望遠鏡のデータ解析', w: { idea: 2, tech: 3, plan: 2, talk: 0 } },
  { tier: 6, cat: 'web', title: '世界で使われる検索エンジン', w: { idea: 2, tech: 3, plan: 1, talk: 1 } },
  { tier: 6, cat: 'app', title: '1億人が使う決済アプリ', w: { idea: 1, tech: 2, plan: 3, talk: 1 } },
  // tier 7（世界本社）
  { tier: 7, cat: 'ai', title: '1か月先の天気を当てるAI', w: { idea: 2, tech: 3, plan: 2, talk: 0 } },
  { tier: 7, cat: 'infra', title: '世界のデータセンターをつなぐ', w: { idea: 0, tech: 3, plan: 3, talk: 1 } },
  { tier: 7, cat: 'space', title: '火星探査車の自動運転', w: { idea: 1, tech: 3, plan: 3, talk: 0 } },
  { tier: 7, cat: 'consult', title: '国の通貨のデジタル化', w: { idea: 1, tech: 1, plan: 3, talk: 3 } },
  { tier: 7, cat: 'app', title: '世界同時配信のオンラインゲーム', w: { idea: 3, tech: 3, plan: 1, talk: 0 } },
  // tier 8（スマートシティ）
  { tier: 8, cat: 'ai', title: '新しい薬を見つけるAI', w: { idea: 3, tech: 3, plan: 1, talk: 0 } },
  { tier: 8, cat: 'space', title: '月面基地の生命維持システム', w: { idea: 1, tech: 3, plan: 4, talk: 0 } },
  { tier: 8, cat: 'infra', title: '量子暗号の通信網', w: { idea: 1, tech: 4, plan: 2, talk: 0 } },
  { tier: 8, cat: 'web', title: '街じゅうのセンサーをつなぐ', w: { idea: 1, tech: 3, plan: 3, talk: 1 } },
  // tier 9（宇宙ステーション）
  { tier: 9, cat: 'space', title: '火星の都市の管制システム', w: { idea: 1, tech: 3, plan: 4, talk: 1 } },
  { tier: 9, cat: 'ai', title: '人と話せる汎用AI', w: { idea: 3, tech: 4, plan: 1, talk: 1 } },
  { tier: 9, cat: 'infra', title: '地球全体の電力網の制御', w: { idea: 0, tech: 3, plan: 4, talk: 1 } },
  { tier: 9, cat: 'app', title: '全人類の通訳アプリ', w: { idea: 2, tech: 3, plan: 1, talk: 3 } },
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

export const START_MONEY = 100_000;
export const FIRST_OFFER_HOURS = [1 / 6, 0.5, 1]; // 始めたときの依頼の時間（10分・30分・1時間。2026-10-03 序盤を速く）
export const OFFER_EVERY = 2 * HOUR; // 新しい依頼が届く間隔
export const OFFER_LIFE = 18 * HOUR; // 依頼の受付期限
export const BASE_OFFERS = 4;
// 要員派遣: お金を払うと、席の数を超えて仕事の間だけ人を借りられる（仕事が終わると帰る。成長はしない）
// 1人ぶんの料金は仕事の報酬の TEMP_FEE 倍。来る人は今の会社で雇える人くらいの腕で、その仕事に向いた職種
export const TEMP_FEE = 0.3;
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
export const ENCOUNTER_PER_HOUR = 1 / 110; // 条件を満たした偉人と出会う確率（1時間あたり。平均4〜5日に1回）
export const ENCOUNTER_LIFE = DAY; // 出会いのチャンスが続く時間
export const RETRY_COOLDOWN = 3 * DAY; // 断られた偉人に次に会えるまで
// CEO の過ごし方（無料。いつもどれか1つを選んでいる）。選んだものに合った出来事がまれに起きる（1時間ごとに判定）
//   event: legend 偉人と偶然出会う（条件を満たしていなくても） / luck 臨時収入 / walkin 入社したい人が面接に来る
export const ACTIVITIES = {
  // 散歩はご近所で仕事の相談も受ける（平均4時間に1件、依頼の上限を WALK_OFFER_EXTRA 件こえて届く）
  walk: { name: '散歩', icon: 'walk', event: 'legend', perHour: 1 / 400, offerPerHour: 1 / 4 }, // 平均17日に1回くらい
  net: { name: 'ネット', icon: 'globe', event: 'luck', perHour: 1 / 36 }, // 平均1日半に1回くらい
  meetup: { name: '勉強会', icon: 'seminar', event: 'walkin', perHour: 1 / 48 }, // 平均2日に1回くらい
};
export const DEFAULT_ACTIVITY = 'net';
export const WALK_OFFER_EXTRA = 2;
export const WALKIN_LIFE = DAY; // 訪ねてきた人が待ってくれる時間
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
    ability: { income: 0.25 },
    abilityText: '全製品の収入 +25%',
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
    ability: { hireCost: 0.5, teamSpeed: 0.2 },
    abilityText: '雇う費用 半分  速さ +20%',
    quit: 25,
    quitText: '「自分のやり方でやる」と言って去った',
    scene: 'ペンギンのぬいぐるみを持った青年が、サーバーをのぞきこんでいる…',
  },
  ritchie: {
    stats: { idea: 60, tech: 100, plan: 85, talk: 35 },
    meet: { tasks: 120, office: 3 },
    hint: '仕事を 120 回こなし、オフィスビルを構えると…',
    join: 0.3,
    ability: { statAll: { tech: 0.15 } },
    abilityText: '全員の技術 +15%',
    scene: 'ひげの男が、分厚いプログラミングの本を静かに読んでいる…',
  },
  bernerslee: {
    stats: { idea: 90, tech: 85, plan: 80, talk: 60 },
    meet: { cat: { web: 30 }, rep: 1500 },
    hint: 'Web の仕事を 30 回こなし、評判が 1500 を超えると…',
    join: 0.3,
    ability: { offers: 2, incomeGenre: { web: 0.3 } },
    abilityText: '依頼 +2件  Web の収入 +30%',
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
    ability: { teamSpeed: 0.4, teamReward: 0.2 },
    abilityText: '速さ +40%  報酬 +20%',
    quit: 30,
    quitText: 'ほかの研究所に呼ばれて去った',
    scene: '暗算で何かを一瞬で解いた紳士が、にやりと笑った…',
  },
  turing: {
    stats: { idea: 100, tech: 100, plan: 80, talk: 40 },
    meet: { cat: { ai: 10 } },
    hint: 'AI の仕事を 10 回こなすと…',
    join: 0.2,
    ability: { teamSuccess: 0.2, incomeGenre: { ai: 0.6 } },
    abilityText: '成功率 +20%  AI の収入 +60%',
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
    abilityText: '全製品の収入 +20%  依頼 +1件',
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

