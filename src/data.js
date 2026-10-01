// 偉人データ。look はGLBモデルが無いときに使う仮の3Dキャラの見た目。
// hairStyle: short | side | long | bun | bald | receding
// show はステージでの動き・セリフ・小物（任意。src/show.js 参照）
export const LEGENDS = [
  {
    id: 'lovelace',
    name: 'エイダ・ラブレス',
    nameEn: 'Ada Lovelace',
    wiki: 'Ada_Lovelace',
    years: '1815–1852',
    rarity: 'SSR',
    title: '世界初のプログラマー',
    summary:
      'チャールズ・バベッジが設計した計算機「解析機関」の論文に長い注釈を書き、ベルヌーイ数を計算する手順を示しました。これが世界初のコンピュータプログラムと呼ばれています。',
    achievements: [
      '解析機関でベルヌーイ数を求める手順（アルゴリズム）を記述（1843年）',
      '計算機は数だけでなく音楽や記号も扱えるかもしれない、と見抜いた',
      'プログラミング言語「Ada」の名前の由来になった',
    ],
    look: { skin: 0xf6d7c3, hairStyle: 'bun', hairColor: 0x3b2417, shirt: 0x6a4c93 },
  },
  {
    id: 'turing',
    name: 'アラン・チューリング',
    nameEn: 'Alan Turing',
    wiki: 'Alan_Turing',
    years: '1912–1954',
    rarity: 'SSR',
    title: 'コンピュータ科学の父',
    summary:
      '「チューリングマシン」という考え方で、計算とは何かを数学的に定義しました。第二次世界大戦中はドイツ軍の暗号エニグマの解読に大きく貢献しました。',
    achievements: [
      'チューリングマシンを考案し、計算の理論的な土台を作った（1936年）',
      'ブレッチリー・パークでエニグマ暗号の解読に貢献',
      '機械が知的かを判定する「チューリングテスト」を提案（1950年）',
    ],
    look: { skin: 0xf3d2bd, hairStyle: 'side', hairColor: 0x3a2a1e, shirt: 0x5b6b7c },
  },
  {
    id: 'vonneumann',
    name: 'ジョン・フォン・ノイマン',
    nameEn: 'John von Neumann',
    wiki: 'John_von_Neumann',
    years: '1903–1957',
    rarity: 'SR',
    title: '万能の天才',
    summary:
      'プログラムとデータを同じメモリに置く「プログラム内蔵方式」をまとめ、今のほとんどのコンピュータの基本設計（ノイマン型）の元になりました。数学や物理でも活躍しました。',
    achievements: [
      'EDVACの報告書でプログラム内蔵方式を示した（1945年）',
      'ゲーム理論の基礎を築いた',
      '乱数を使って計算するモンテカルロ法の発展に貢献',
    ],
    look: { skin: 0xf1cfb6, hairStyle: 'receding', hairColor: 0x2e2620, shirt: 0x4a4f5a },
  },
  {
    id: 'hopper',
    name: 'グレース・ホッパー',
    nameEn: 'Grace Hopper',
    wiki: 'Grace_Hopper',
    years: '1906–1992',
    rarity: 'SR',
    title: 'コンパイラの母',
    summary:
      'アメリカ海軍の軍人でプログラマー。人間が読みやすい言葉でプログラムを書き、それを機械語に変換する「コンパイラ」を早くから作り、COBOLの誕生につなげました。',
    achievements: [
      '初期のコンパイラ「A-0」を開発（1952年）',
      '英語に近い言語FLOW-MATICを作り、COBOLの土台になった',
      'コンピュータに挟まった蛾の記録で「バグ」という言葉を有名にした',
    ],
    look: { skin: 0xf4d6c6, hairStyle: 'short', hairColor: 0xd9d9d9, shirt: 0x1f2d4d },
  },
  {
    id: 'hamilton',
    name: 'マーガレット・ハミルトン',
    nameEn: 'Margaret Hamilton',
    wiki: 'Margaret_Hamilton_(software_engineer)',
    years: '1936–',
    rarity: 'SR',
    title: '月へ導いたエンジニア',
    summary:
      'アポロ計画で宇宙船に載せるソフトウェアの開発チームを率いました。「ソフトウェア・エンジニアリング」という言葉を広めた人でもあります。',
    achievements: [
      'MITでアポロ誘導コンピュータのソフトウェア開発を指揮',
      'アポロ11号の着陸直前のトラブルでも止まらない設計を実現',
      'アメリカ大統領自由勲章を受章（2016年）',
    ],
    look: { skin: 0xf6d9c4, hairStyle: 'long', hairColor: 0x5a3b22, shirt: 0xc9a227, glasses: true },
  },
  {
    id: 'ritchie',
    name: 'デニス・リッチー',
    nameEn: 'Dennis Ritchie',
    wiki: 'Dennis_Ritchie',
    years: '1941–2011',
    rarity: 'SR',
    title: 'C言語の生みの親',
    summary:
      'ベル研究所でC言語を作り、ケン・トンプソンと一緒にOS「UNIX」を開発しました。今のOSやプログラミング言語の多くがこの2つの影響を受けています。',
    achievements: [
      'C言語を開発（1972年ごろ）',
      'ケン・トンプソンとUNIXを開発',
      'チューリング賞を受賞（1983年）',
    ],
    look: { skin: 0xf0cdb4, hairStyle: 'short', hairColor: 0x2b2118, shirt: 0x7a5c3e, beard: true, glasses: true },
  },
  {
    id: 'bernerslee',
    name: 'ティム・バーナーズ＝リー',
    nameEn: 'Tim Berners-Lee',
    wiki: 'Tim_Berners-Lee',
    years: '1955–',
    rarity: 'SR',
    title: 'Webの発明者',
    summary:
      'CERN（欧州原子核研究機構）でWorld Wide Webを考え出しました。HTML・HTTP・URLの仕組みと、最初のWebブラウザとWebサーバーを作りました。',
    achievements: [
      'World Wide Webを提案（1989年）',
      'HTML・HTTP・URLと最初のブラウザ／サーバーを作った',
      'Webの標準を決める団体W3Cを創設（1994年）',
    ],
    look: { skin: 0xf5d5c0, hairStyle: 'receding', hairColor: 0x9c8466, shirt: 0x3d6fb6 },
  },
  {
    id: 'torvalds',
    name: 'リーナス・トーバルズ',
    nameEn: 'Linus Torvalds',
    wiki: 'Linus_Torvalds',
    years: '1969–',
    rarity: 'R',
    title: 'Linuxの作者',
    summary:
      '大学生のときにOSの中心部分「Linuxカーネル」を作って公開しました。今ではサーバーやAndroidで広く使われています。バージョン管理ツールGitも作りました。',
    achievements: [
      'Linuxカーネルを公開（1991年）',
      '世界中の開発者と協力するオープンソース開発を広めた',
      'バージョン管理システムGitを開発（2005年）',
    ],
    look: { skin: 0xf6d8c5, hairStyle: 'receding', hairColor: 0xa08058, shirt: 0x2f6e8f, glasses: true },
  },
  {
    id: 'jobs',
    name: 'スティーブ・ジョブズ',
    nameEn: 'Steve Jobs',
    wiki: 'Steve_Jobs',
    years: '1955–2011',
    rarity: 'R',
    title: '未来を形にした人',
    summary:
      'スティーブ・ウォズニアックとAppleを創業し、Macintosh・iPod・iPhoneなど、誰でも使いやすいコンピュータ製品を世に送り出しました。',
    achievements: [
      'ウォズニアックらとAppleを創業（1976年）',
      'マウスで操作するMacintoshを発表（1984年）',
      'iPhoneを発表し、スマートフォンの時代を開いた（2007年）',
    ],
    look: { skin: 0xf0cfb8, hairStyle: 'short', hairColor: 0x4a4038, shirt: 0x111111, glasses: true, beard: true },
    // 基調講演のようにステージを歩き回って話す
    show: {
      stage: 'keynote',
      props: ['appleLogo'],
      lines: [
        { text: 'ハングリーであれ。愚かであれ。', sub: 'Stay hungry, stay foolish.', anim: 'agree' },
        { text: 'もうひとつだけ…', sub: 'One more thing…', prop: 'phone', anim: 'fold_arms', animFrom: 1.5 },
        { text: '今日、Appleは電話を再発明する。', anim: 'greet_01' },
      ],
    },
  },
  {
    id: 'gates',
    name: 'ビル・ゲイツ',
    nameEn: 'Bill Gates',
    wiki: 'Bill_Gates',
    years: '1955–',
    rarity: 'R',
    title: 'パソコンを全員の机に',
    summary:
      'ポール・アレンとMicrosoftを創業し、MS-DOSやWindowsでパソコンを世界中に広めました。その後は財団をつくり、健康や教育の支援に取り組んでいます。',
    achievements: [
      'ポール・アレンとMicrosoftを創業（1975年）',
      'MS-DOSとWindowsでパソコンの普及を後押し',
      'ビル＆メリンダ・ゲイツ財団で世界の健康問題に取り組む',
    ],
    look: { skin: 0xf6dac8, hairStyle: 'side', hairColor: 0x9a7a55, shirt: 0x6b8fb3, glasses: true },
    // おなじみの、襟つきシャツにセーターの姿で作る
    outfit: 'a light blue collared button-down shirt under a navy blue V-neck sweater, beige chino pants and brown loafers',
    // 初期の Microsoft の夜のオフィスで話す
    show: {
      stage: 'msoffice',
      props: ['msOffice'],
      lines: [
        { text: 'すべての机と家庭に、コンピューターを。', sub: 'A computer on every desk and in every home.', prop: 'retroPC', anim: 'agree' },
        { text: '成功は、最低の教師だ。', sub: 'Success is a lousy teacher.', anim: 'fold_arms', animFrom: 1.5 },
        { text: 'すべての命は、等しい価値を持つ。', sub: 'All lives have equal value.', prop: 'globe', anim: 'greet_01' },
      ],
    },
  },
  {
    id: 'zuckerberg',
    name: 'マーク・ザッカーバーグ',
    nameEn: 'Mark Zuckerberg',
    wiki: 'Mark_Zuckerberg',
    years: '1984–',
    rarity: 'R',
    title: '世界をつなぐSNSをつくった人',
    summary:
      'ハーバード大学の寮の一室でFacebookを立ち上げ、世界中の人が友だちや家族とつながるSNSに育てました。のちに会社名をMetaに変え、VRやAIにも力を入れています。',
    achievements: [
      '大学の仲間とFacebookを立ち上げ（2004年）',
      'InstagramやWhatsAppを買収し、数十億人が使うサービス群に',
      '会社名をMetaに変え、VR・メタバースやAIの開発を進める（2021年）',
    ],
    look: { skin: 0xf6d7c6, hairStyle: 'short', hairColor: 0x7a5a3c, shirt: 0x8a8f96 },
    // 写真はスーツ姿なので、おなじみの服装を指定してちびキャラ画像を作る
    outfit: 'a plain dark navy zip-up hoodie over a gray T-shirt, dark blue jeans and simple gray sneakers',
    // Facebook を作ったハーバードの寮の部屋で話す
    show: {
      stage: 'dorm',
      props: ['dormRoom'],
      lines: [
        { text: '素早く動いて、壊せ。', sub: 'Move fast and break things.', prop: 'laptop', anim: 'agree' },
        { text: '完璧を目指すより、まず終わらせろ。', sub: 'Done is better than perfect.', anim: 'fold_arms', animFrom: 1.5 },
        { text: 'いちばんのリスクは、リスクを取らないことだ。', sub: 'The biggest risk is not taking any risk.', prop: 'vr', anim: 'greet_01' },
      ],
    },
  },
  {
    id: 'ek',
    name: 'ダニエル・エク',
    nameEn: 'Daniel Ek',
    wiki: 'Daniel_Ek',
    years: '1983–',
    rarity: 'R',
    title: '音楽を聴き放題にした人',
    summary:
      'スウェーデンでSpotifyを立ち上げ、月額で音楽が聴き放題になる仕組みを広めました。違法なダウンロードが当たり前だった時代に、アーティストにもお金が届く形をつくりました。',
    achievements: [
      'マーティン・ロレンツォンとSpotifyを創業（2006年）',
      '定額で聴き放題の音楽配信を世界に広める',
      'ポッドキャストやオーディオブックにも広げる',
    ],
    look: { skin: 0xf3d6c4, hairStyle: 'bald', hairColor: 0x6b5a48, shirt: 0x2a2a2e },
    // ふだんの、黒いTシャツにパーカーの姿で作る
    outfit: 'a plain black crew-neck T-shirt under an open dark charcoal zip-up hoodie, black slim jeans and white sneakers',
  },
  {
    id: 'bezos',
    name: 'ジェフ・ベゾス',
    nameEn: 'Jeff Bezos',
    wiki: 'Jeff_Bezos',
    years: '1964–',
    rarity: 'R',
    title: 'ネットで何でも買える世界をつくった人',
    summary:
      'ガレージでネットの本屋Amazonを始め、何でも届く巨大なお店に育てました。社内のために作ったサーバーの仕組みをAWSとして貸し出し、クラウドの時代を切り開きました。',
    achievements: [
      'ガレージでAmazonを創業（1994年）',
      'AWSでクラウドを世界に広める（2006年）',
      '宇宙ロケットの会社ブルーオリジンを設立',
    ],
    look: { skin: 0xf2d2bc, hairStyle: 'bald', hairColor: 0x6b5a48, shirt: 0x8fb0d8 },
    // おなじみの、シャツにジャケットの姿で作る
    outfit: 'a light blue button-down shirt with an open collar, a navy blue blazer, navy chino pants and brown leather shoes',
  },
];

export const RARITY = {
  SSR: { rate: 0.05, color: 0xffc83d, css: '#ffc83d' },
  SR: { rate: 0.3, color: 0xb57bff, css: '#b57bff' },
  R: { rate: 0.65, color: 0x5fb4ff, css: '#5fb4ff' },
};

export const byId = Object.fromEntries(LEGENDS.map((l) => [l.id, l]));
