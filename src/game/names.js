// 一般社員の名前と見た目
const SEI = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '清水', '森', '池田', '橋本', '石川', '前田', '藤田', '岡田', '後藤', '長谷川', '村上', '近藤'];
const MEI = ['翔太', '陽菜', '蓮', '結衣', '大輝', '美咲', '悠斗', 'さくら', '拓海', '葵', '健太', '七海', '颯', '彩花', '湊', '凛', '陸', '真央', '直樹', '愛', '亮', '舞', '誠', '遥', '優', '千尋', '慎吾', '恵', '光', '奈々'];
const SKINS = [0xf6d7c3, 0xf3d2bd, 0xeac0a0, 0xd9a882, 0xf8dccb];
const HAIRS = [0x2a1d14, 0x3b2417, 0x1d1a1a, 0x6b4a2f, 0x8a6a4a, 0x4a3426];
const STYLES = ['short', 'side', 'long', 'bun', 'short', 'side'];

export function randomPerson(rand) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  return {
    name: `${pick(SEI)} ${pick(MEI)}`,
    look: { skin: pick(SKINS), hairColor: pick(HAIRS), hairStyle: pick(STYLES), glasses: rand() < 0.3 },
  };
}

const PRODUCT_NAMES = {
  web: ['まちナビ', 'つなぐ広場', 'みんなの献立', 'ひとことノート', 'しごとマッチ', 'おでかけ地図'],
  app: ['ポケット家計簿', 'ねむログ', 'あるくん', 'まいにち英単語', 'ペットだより', 'ワリカンさん'],
  game: ['ピコピコ探検隊', 'ねこタワー', 'ことばパズル', 'スペースわんこ', 'ドット農園', '迷宮のコード'],
  biz: ['らくらく勤怠', 'クラウド台帳', '在庫まもる君', 'あんしん会計', 'スマート受付', 'みえる日報'],
  ai: ['AIおしゃべり先生', 'みらい予報', 'AI翻訳くん', 'えがくAI', 'AI秘書', 'しらべるAI'],
};
export function productName(genre, rand) {
  const list = PRODUCT_NAMES[genre];
  return list[Math.floor(rand() * list.length)];
}
