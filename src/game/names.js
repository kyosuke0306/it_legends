// 一般社員の名前と見た目
const SEI = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '清水', '森', '池田', '橋本', '石川', '前田', '藤田', '岡田', '後藤', '長谷川', '村上', '近藤'];
const MEI = ['翔太', '陽菜', '蓮', '結衣', '大輝', '美咲', '悠斗', 'さくら', '拓海', '葵', '健太', '七海', '颯', '彩花', '湊', '凛', '陸', '真央', '直樹', '愛', '亮', '舞', '誠', '遥', '優', '千尋', '慎吾', '恵', '光', '奈々'];
const SKINS = [0xf6d7c3, 0xf3d2bd, 0xeac0a0, 0xd9a882, 0xf8dccb];
const HAIRS = [0x2a1d14, 0x3b2417, 0x1d1a1a, 0x6b4a2f, 0x8a6a4a, 0x4a3426];
const STYLES = ['short', 'side', 'long', 'bun', 'short', 'side'];

// CEO の顔を選ぶときの色と髪形（main.js の faceEditor）
export const FACE_OPTIONS = {
  skin: [0xfbe3d3, 0xf6d7c3, 0xeac0a0, 0xd9a882, 0xc68e64, 0x8d5a3b, 0x6e4329],
  hairColor: [0x1d1a1a, 0x3b2417, 0x6b4a2f, 0x8a6a4a, 0xe0c068, 0xa0482a, 0xc8c8d0, 0x4a5ad8],
  // 髪形は男女で分ける（男女が見分けやすいように）
  hairStyle: { m: ['short', 'side', 'spiky', 'mash'], f: ['long', 'bob', 'ponytail', 'bun'] },
};

// 海外から来た人の名前（カタカナ）。order: 'first' は「名・姓」、'last' は「姓・名」の順
const LIGHT = [0xfbe3d3, 0xf6d7c3, 0xf3cdb4];
const TAN = [0xd9a882, 0xc68e64, 0xb97c50];
const DARK = [0x8d5a3b, 0x6e4329, 0x5e3a26];
const BLOND = [0xe0c068, 0xc9a050, 0xa0482a, 0x6b4a2f, 0x3b2417];
const BLACK = [0x1d1a1a, 0x2a1d14, 0x3b2417];
const ABROAD = [
  { order: 'first', first: ['エミリー', 'ジェームズ', 'オリビア', 'マイケル', 'ソフィア', 'ノア', 'エマ', 'ダニエル'], last: ['スミス', 'ジョンソン', 'ブラウン', 'ミラー', 'ウィルソン', 'テイラー'], skins: LIGHT, hairs: BLOND },
  { order: 'first', first: ['ルーカス', 'アンナ', 'マティアス', 'エレナ', 'ヨハン', 'クララ'], last: ['ミュラー', 'ロッシ', 'ペトロフ', 'ヤンセン', 'デュボワ'], skins: LIGHT, hairs: BLOND },
  { order: 'first', first: ['ラジ', 'プリヤ', 'アルジュン', 'アナンヤ', 'ヴィクラム'], last: ['パテル', 'シャルマ', 'クマール', 'ラオ'], skins: TAN, hairs: BLACK },
  { order: 'last', first: ['ウェイ', 'ジン', 'メイ', 'ハオ', 'リン'], last: ['チェン', 'ワン', 'リー', 'ジャン'], skins: [0xf3d2bd, 0xeac0a0], hairs: BLACK },
  { order: 'last', first: ['ミンジュン', 'ソヨン', 'ジフ', 'ハユン'], last: ['キム', 'パク', 'イ', 'チェ'], skins: [0xf6d7c3, 0xf3d2bd], hairs: BLACK },
  { order: 'last', first: ['ラン', 'ミン', 'トゥアン', 'ハー'], last: ['グエン', 'チャン', 'レ'], skins: [0xeac0a0, 0xd9a882], hairs: BLACK },
  { order: 'first', first: ['マリア', 'カルロス', 'ルシア', 'ディエゴ', 'ガブリエル'], last: ['ガルシア', 'ロドリゲス', 'シルバ', 'ロペス'], skins: TAN, hairs: [0x2a1d14, 0x3b2417, 0x6b4a2f] },
  { order: 'first', first: ['アマラ', 'クワメ', 'ファトゥ', 'チディ'], last: ['オコンクォ', 'メンサー', 'ディアロ', 'アデイェミ'], skins: DARK, hairs: BLACK },
];

// 半分くらいは海外から来た人
export function randomPerson(rand) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const look = { hairStyle: pick(STYLES), glasses: rand() < 0.3 };
  if (rand() < 0.5) return { name: `${pick(SEI)} ${pick(MEI)}`, look: { ...look, skin: pick(SKINS), hairColor: pick(HAIRS) } };
  const r = pick(ABROAD);
  const f = pick(r.first);
  const l = pick(r.last);
  return { name: r.order === 'first' ? `${f}・${l}` : `${l}・${f}`, look: { ...look, skin: pick(r.skins), hairColor: pick(r.hairs) } };
}

const PRODUCT_NAMES = {
  web: ['まちナビ', 'つなぐ広場', 'みんなの献立', 'ひとことノート', 'しごとマッチ', 'おでかけ地図'],
  app: ['ポケット家計簿', 'ねむログ', 'あるくん', 'まいにち英単語', 'ペットだより', 'ワリカンさん'],
  game: ['ピコピコ探検隊', 'ねこタワー', 'ことばパズル', 'スペースわんこ', 'ドット農園', '迷宮のコード'],
  biz: ['らくらく勤怠', 'クラウド台帳', '在庫まもる君', 'あんしん会計', 'スマート受付', 'みえる日報'],
  ai: ['AIおしゃべり先生', 'みらい予報', 'AI翻訳くん', 'えがくAI', 'AI秘書', 'しらべるAI'],
  cloud: ['そらクラウド', 'くもの上', 'どこでもサーバー', 'ノアの箱', 'スカイベース'],
  sns: ['つぶやきの森', 'みんなのわ', 'ひろがるタイムライン', 'フレンズ広場', 'いいね通り'],
  car: ['オートパイロット', 'まかせて号', 'みちしるべ', 'ねむれるドライブ', 'ゼロ事故'],
  quantum: ['キュービット', 'ゆらぎ計算機', 'シュレディンガー', 'りょうしの箱'],
  satnet: ['ほしのネット', 'そらつなぎ', 'オービットリンク', 'どこでも圏内'],
  agi: ['ともだちAI', 'ちきゅうの知恵', 'オメガ', 'ソフィア'],
};
export function productName(genre, rand) {
  const list = PRODUCT_NAMES[genre];
  return list[Math.floor(rand() * list.length)];
}
