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
    // 1840 年代のロンドンの夜の客間（バベッジの機関の歯車、ろうそくの明かり）で話す
    show: {
      stage: 'victorian',
      props: ['victorian'],
      lines: [
        { text: '解析機関は、織機が花を織るように、代数の模様を織る。', sub: 'The Analytical Engine weaves algebraical patterns just as the Jacquard loom weaves flowers and leaves.', prop: 'punchCards', anim: 'agree' },
        { text: '想像力こそ、発見する力。', sub: 'Imagination is the Discovering Faculty, pre-eminently.', anim: 'fold_arms', animFrom: 1.5 },
        { text: 'この機械は、音楽さえ作れるかもしれない。', sub: 'The engine might compose elaborate and scientific pieces of music.', prop: 'notes', anim: 'greet_01' },
      ],
    },
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
    // プリンストン高等研究所（黒板にゲーム理論とノイマン型の図、真空管の IAS マシン）で話す
    show: {
      stage: 'ias',
      props: ['ias'],
      lines: [
        { text: '数学が簡単に思えないのは、人生がどれほど複雑か知らないからだ。', sub: 'If people do not believe that mathematics is simple, it is only because they do not realize how complicated life is.', anim: 'agree' },
        { text: '数学は理解するものではない。慣れるものだ。', sub: 'In mathematics you don\'t understand things. You just get used to them.', anim: 'fold_arms', animFrom: 1.5 },
        { text: '現実の人生は、はったりでできている。', sub: 'Real life consists of bluffing.', prop: 'cards', anim: 'greet_01' },
      ],
    },
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
    // ハーバード大学の Mark II の部屋（壁に「最初のバグ」の蛾を貼った記録）で話す
    show: {
      stage: 'harvard',
      props: ['harvard'],
      lines: [
        { text: '許可をもらうより、あとで謝る方が簡単。', sub: 'It\'s easier to ask forgiveness than it is to get permission.', anim: 'agree' },
        { text: 'いちばん危ない言葉は「ずっとこうしてきた」。', sub: 'The most dangerous phrase is "We\'ve always done it this way."', anim: 'fold_arms', animFrom: 1.5 },
        { text: 'これが1ナノ秒。光が進む長さです。', sub: 'This is a nanosecond.', prop: 'nanosecond', anim: 'greet_01' },
      ],
    },
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
    // 1969 年の MIT の研究室（窓の外に月、背の高さほどのプログラムの紙の山、NASA のマーク）で話す
    show: {
      stage: 'apollo',
      props: ['apollo'],
      lines: [
        { text: '先駆者になるしかなかった。', sub: 'There was no choice but to be pioneers.', anim: 'agree' },
        { text: '警報が鳴っても、止まらないソフトを。', sub: 'Program alarm 1202, and the software kept going.', prop: 'eagle', anim: 'fold_arms', animFrom: 1.5 },
        { text: '振り返れば、私たちは世界一幸運だった。', sub: 'Looking back, we were the luckiest people in the world.', anim: 'greet_01' },
      ],
    },
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
    // ベル研究所の夜（PDP-11 と UNIX の図）で話す
    show: {
      stage: 'bell',
      props: ['bell'],
      lines: [
        { text: 'UNIXは単純だ。ただ、その単純さを分かるには天才がいる。', sub: 'UNIX is very simple, it just needs a genius to understand its simplicity.', anim: 'agree' },
        { text: '新しい言語は、その言語で書いて覚える。', sub: 'The only way to learn a new programming language is by writing programs in it.', prop: 'helloC', anim: 'fold_arms', animFrom: 1.5 },
        { text: 'Cはくせがあり、欠点もある。そして大成功した。', sub: 'C is quirky, flawed, and an enormous success.', prop: 'krBook', anim: 'greet_01' },
      ],
    },
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
    // CERN の 1990 年の事務所（窓の外にジュラの山、壁で光る WWW のマーク）で話す
    show: {
      stage: 'cern',
      props: ['cern'],
      lines: [
        { text: 'Webは、みんなのためのもの。', sub: 'This is for everyone.', anim: 'agree' },
        { text: 'Webは、技術より人のつながりから生まれた。', sub: 'The Web is more a social creation than a technical one.', anim: 'fold_arms', animFrom: 1.5 },
        { text: 'このマシンはサーバー。電源を切らないで！', sub: 'This machine is a server. DO NOT POWER IT DOWN!!', prop: 'nextCube', anim: 'greet_01' },
      ],
    },
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
    // ヘルシンキの冬の夜の学生部屋（雪の窓、壁に Linux のペンギン）で話す
    show: {
      stage: 'helsinki',
      props: ['helsinki'],
      lines: [
        { text: '口で言うのは簡単。コードを見せて。', sub: 'Talk is cheap. Show me the code.', anim: 'fold_arms' },
        { text: 'ただの趣味。大きなものにはならないよ。', sub: 'Just a hobby, won\'t be big and professional.', prop: 'linuxTerm', anim: 'agree' },
        { text: 'いいプログラマーは、楽しいから書く。', sub: 'Most good programmers do programming because it is fun to program.', prop: 'gitTree', anim: 'greet_01' },
      ],
    },
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
    // 1回目は顔が横に広くなったので、細めの顔を指定する
    face: 'a slim, slightly long oval face that is clearly narrower than it is wide, with a defined jawline and a pointed chin, not round or chubby; short light stubble on the jaw and chin; a closely shaved head',
    // ふだんの、黒いTシャツにパーカーの姿で作る
    outfit: 'a plain black crew-neck T-shirt under an open dark charcoal zip-up hoodie, black slim jeans and white sneakers',
    // Spotify を始めたストックホルムの夜のスタジオで話す
    show: {
      stage: 'studio',
      props: ['studio'],
      lines: [
        { text: '海賊版に勝つには、海賊版より便利なものを作ればいい。', sub: 'The only way to beat piracy is to be better than piracy.', prop: 'turntable', anim: 'agree' },
        { text: '人の創造力を、解き放つ。', sub: 'Unlock the potential of human creativity.', anim: 'fold_arms', animFrom: 1.5 },
        { text: 'すべての人に、音楽を。', sub: 'Music for everyone.', prop: 'headphones', anim: 'greet_01' },
      ],
    },
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
    // Amazon を始めたガレージで話す
    show: {
      stage: 'garage',
      props: ['garage'],
      lines: [
        { text: 'ビジョンには頑固に、細かいことには柔軟に。', sub: 'Be stubborn on vision, flexible on details.', prop: 'doorDesk', anim: 'agree' },
        { text: 'いつだって「1日目」だ。', sub: "It's always Day 1.", anim: 'fold_arms', animFrom: 1.5 },
        { text: '失敗と発明は、切り離せない双子だ。', sub: 'Failure and invention are inseparable twins.', prop: 'rocket', anim: 'greet_01' },
      ],
    },
  },
  {
    id: 'maezawa',
    name: '前澤友作',
    nameEn: 'Yusaku Maezawa',
    wiki: 'Yusaku_Maezawa',
    years: '1975–',
    rarity: 'R',
    title: '服をネットで買う時代をつくった人',
    summary:
      'CDの通信販売から始めた会社で、服をネットで買えるお店ZOZOTOWNを開き、日本一のファッション通販に育てました。会社を売ったあと、民間人として宇宙ステーションに行きました。',
    achievements: [
      'ファッション通販サイトZOZOTOWNを開設（2004年）',
      '体のサイズを測る服ZOZOSUITを発表（2018年）',
      '日本の民間人として初めて国際宇宙ステーションに滞在（2021年）',
    ],
    look: { skin: 0xf2d0b8, hairStyle: 'side', hairColor: 0x3a2a20, shirt: 0x1f2d55 },
    // 宇宙ステーションに行ったときの紺のフライトスーツで作る（文字やマークは付けない）
    outfit: 'a navy blue astronaut flight suit jumpsuit with a few simple white and red stripes across the chest, without any logos, patches or text, and white sneakers',
    // 2021年に行った国際宇宙ステーションの中で話す
    show: {
      stage: 'iss',
      props: ['iss'],
      lines: [
        { text: '世界中をカッコよく、世界中に笑顔を。', sub: 'Inspire the world. Deliver joy every day.', prop: 'zozosuit', anim: 'agree' },
        { text: '月に行きます。', sub: 'I choose to go to the Moon!', prop: 'moon', anim: 'greet_01' },
        { text: '宇宙から見た地球は、本当に美しい。', sub: 'The Earth from space is truly beautiful.', anim: 'fold_arms', animFrom: 1.5 },
      ],
    },
  },
  {
    id: 'matz',
    name: 'まつもとゆきひろ',
    nameEn: 'Yukihiro Matsumoto',
    wiki: 'Yukihiro_Matsumoto',
    years: '1965–',
    rarity: 'R',
    title: 'Rubyの父',
    summary:
      'プログラムを書く人が楽しく書けることを大切にした言語Rubyを作りました。日本生まれの言語として世界に広まり、Ruby on Railsとともに多くのWebサービスを支えています。',
    achievements: [
      'プログラミング言語Rubyを公開（1995年）',
      'Ruby on Railsの登場で、世界中のWeb開発に広まる（2004年〜）',
      '日本で生まれた言語として初めて国際規格（ISO）になる（2012年）',
    ],
    look: { skin: 0xf0cfb4, hairStyle: 'short', hairColor: 0x1d1a1a, shirt: 0x5a5a60 },
    // ユーザーからもらった写真が元。メガネは細い銀のふち（下半分にふちがない）、ひげは短い無精ひげ
    face: 'an East Asian Japanese man in his fifties with thick black hair with some gray strands, short on the sides and swept up and slightly messy on top; thin silver half-rim glasses with narrow rectangular lenses and no frame on the bottom of the lenses; short light stubble around the mouth and on the chin, a thin mustache, not a full beard; a gentle, kind smile with slightly narrowed eyes',
    outfit: 'a gray textured blazer over a black collared shirt with the top button open, dark gray trousers and black leather shoes',
    // Ruby を育てた島根・松江の夜の書斎で話す
    show: {
      stage: 'matsue',
      props: ['matsue'],
      lines: [
        { text: 'プログラマーを、幸せに。', sub: 'Make programmers happy.', anim: 'agree' },
        { text: '機械ではなく、人間に目を向けよう。', sub: 'We need to focus on humans, not machines.', anim: 'fold_arms', animFrom: 1.5 },
        { text: '楽しんでプログラミングしよう。', sub: 'Enjoy programming!', prop: 'rubyCode', anim: 'greet_01' },
      ],
    },
  },
  {
    id: 'musk',
    name: 'イーロン・マスク',
    nameEn: 'Elon Musk',
    wiki: 'Elon_Musk',
    years: '1971–',
    rarity: 'SR',
    title: '火星を目指す起業家',
    summary:
      'ネット決済のPayPalのもとになる会社を作ったあと、ロケットのSpaceXと電気自動車のTeslaを率いました。宇宙から届くインターネットStarlinkも広めています。',
    achievements: [
      'ネット決済の会社X.com（のちのPayPal）を創業（1999年）',
      'SpaceXを設立し、着地して再利用できるロケットを実現（2002年〜）',
      'Teslaで電気自動車を広め、衛星インターネットStarlinkを始める',
    ],
    look: { skin: 0xf3d3bf, hairStyle: 'short', hairColor: 0x3b2c22, shirt: 0x111111 },
    outfit: 'a plain black T-shirt under an open black bomber jacket, black jeans and black sneakers',
    // SpaceX のロケット工場の夜（窓の外に発射台と銀のロケット）で話す
    show: {
      stage: 'spacex',
      props: ['spacex'],
      lines: [
        { text: '人類を、いくつもの星に住める種に。', sub: 'Make life multiplanetary.', anim: 'agree' },
        { text: '大事なことなら、勝ち目が薄くてもやる。', sub: 'When something is important enough, you do it even if the odds are not in your favor.', prop: 'starship', anim: 'fold_arms', animFrom: 1.5 },
        { text: '火星で死にたい。ただし、墜落ではなく。', sub: 'I\'d like to die on Mars. Just not on impact.', prop: 'mars', anim: 'greet_01' },
      ],
    },
  },
  {
    id: 'page',
    name: 'ラリー・ペイジ',
    nameEn: 'Larry Page',
    wiki: 'Larry_Page',
    years: '1973–',
    rarity: 'R',
    title: '世界の情報を検索できるようにした人',
    summary:
      'スタンフォード大学の大学院でセルゲイ・ブリンとGoogleを作りました。多くのページからリンクされているページほど大切、と考える仕組みで、検索を大きく変えました。',
    achievements: [
      'ページの大切さを決める仕組みPageRankを考えた（1996年）',
      'セルゲイ・ブリンとGoogleを創業（1998年）',
      'Androidを買収し、親会社Alphabetをつくる（2015年）',
    ],
    look: { skin: 0xf2d3bf, hairStyle: 'short', hairColor: 0x8c8a88, shirt: 0x8a8d92 },
    outfit: 'a casual gray crew-neck sweater over a white T-shirt, dark blue jeans and gray sneakers',
    // Google を始めたスタンフォードの研究室（PageRank のホワイトボード、レゴの箱のサーバー）で話す
    show: {
      stage: 'stanford',
      props: ['stanford'],
      lines: [
        { text: '世界中の情報を整理し、誰もが使えるようにする。', sub: 'Organize the world\'s information and make it universally accessible and useful.', prop: 'searchBox', anim: 'agree' },
        { text: '不可能なことは、ほどよく無視しよう。', sub: 'Have a healthy disregard for the impossible.', anim: 'fold_arms', animFrom: 1.5 },
        { text: '大きすぎる夢の方が、かえって進みやすい。', sub: 'It is often easier to make progress on mega-ambitious dreams.', anim: 'greet_01' },
      ],
    },
  },
  {
    id: 'huang',
    name: 'ジェンスン・フアン',
    nameEn: 'Jensen Huang',
    wiki: 'Jensen_Huang',
    years: '1963–',
    rarity: 'SR',
    title: 'AIの時代を支える半導体の人',
    summary:
      'ゲームの絵を速く描くための部品GPUを作るNVIDIAを創業しました。同じ計算を一度にたくさんこなすGPUがAIの学習に欠かせなくなり、AIの時代を支えています。',
    achievements: [
      '仲間とNVIDIAを創業（1993年）',
      'GPU「GeForce 256」を発表（1999年）',
      'GPUでAIを学習させる仕組みCUDAを広める（2006年〜）',
    ],
    look: { skin: 0xe9c7a8, hairStyle: 'short', hairColor: 0x8a8a8a, shirt: 0x161616, glasses: true },
    // おなじみの黒い革ジャンの姿で作る
    outfit: 'his signature black leather biker jacket over a plain black T-shirt, black jeans and black shoes',
    // NVIDIA の基調講演（黒に緑の回路の線）で話す
    show: {
      stage: 'gtc',
      props: ['gtc'],
      lines: [
        { text: 'たくさん買うほど、たくさん得をする。', sub: 'The more you buy, the more you save.', prop: 'gpu', anim: 'greet_01' },
        { text: 'うちの会社は、つぶれるまであと30日。', sub: 'Our company is thirty days from going out of business.', anim: 'fold_arms', animFrom: 1.5 },
        { text: 'みなさんに、たっぷりの痛みと苦しみを。', sub: 'I wish upon you ample doses of pain and suffering.', anim: 'agree' },
      ],
    },
  },
  {
    id: 'son',
    name: '孫正義',
    nameEn: 'Masayoshi Son',
    wiki: 'Masayoshi_Son',
    years: '1957–',
    rarity: 'R',
    title: '未来に賭ける投資家',
    summary:
      'パソコンのソフトを売る会社ソフトバンクを作り、インターネットや携帯電話の事業に広げました。Yahoo!やアリババなど、伸びる会社に早くから投資してきました。',
    achievements: [
      'ソフトバンクを創業（1981年）',
      'Yahoo! JAPANを立ち上げ（1996年）、アリババに早くから投資',
      '日本でiPhoneを売り出す（2008年）、大型の投資ファンドをつくる',
    ],
    look: { skin: 0xecc9aa, hairStyle: 'receding', hairColor: 0x8a8a8a, shirt: 0x2c3a52 },
    outfit: 'a dark navy business suit with a white dress shirt and no tie, black leather shoes',
    // ソフトバンクを始めた 1981 年の小さな事務所（みかん箱の上で「1兆、2兆」と話した）で話す
    show: {
      stage: 'softbank',
      props: ['softbank'],
      lines: [
        { text: 'いずれ売上を、豆腐のように1兆、2兆と数える。', sub: 'Someday we will count our sales by the trillion.', anim: 'greet_01' },
        { text: '志高く。', sub: 'Aim high.', anim: 'agree' },
        { text: '情報革命で、人々を幸せに。', sub: 'Happiness for everyone through the Information Revolution.', prop: 'phone', anim: 'fold_arms', animFrom: 1.5 },
      ],
    },
  },
  {
    id: 'altman',
    name: 'サム・アルトマン',
    nameEn: 'Sam Altman',
    wiki: 'Sam_Altman',
    years: '1985–',
    rarity: 'SR',
    title: 'ChatGPTを世に出した人',
    summary:
      'スタートアップを育てるY Combinatorの代表を務めたあと、OpenAIを率いてChatGPTを公開しました。話しかけるだけで使えるAIを、世界中の人に広めました。',
    achievements: [
      'スタートアップ養成所Y Combinatorの代表に（2014年）',
      'OpenAIの共同設立（2015年）',
      'ChatGPTを公開し、数か月で1億人が使う（2022年）',
    ],
    look: { skin: 0xf1d1bd, hairStyle: 'short', hairColor: 0x6a5440, shirt: 0x2a2f38 },
    outfit: 'a plain navy crew-neck sweater, dark blue jeans and white sneakers',
    // OpenAI の明るい事務所で話す
    show: {
      stage: 'openai',
      props: ['openai'],
      lines: [
        { text: '汎用AIを、すべての人類のために。', sub: 'Ensure that AGI benefits all of humanity.', anim: 'agree' },
        { text: '一日は長いが、十年は短い。', sub: 'The days are long but the decades are short.', anim: 'fold_arms', animFrom: 1.5 },
        { text: '速く動こう。遅さはどこにでも広がる。', sub: 'Move faster. Slowness anywhere justifies slowness everywhere.', prop: 'chat', anim: 'greet_01' },
      ],
    },
  },
  {
    id: 'wozniak',
    name: 'スティーブ・ウォズニアック',
    nameEn: 'Steve Wozniak',
    wiki: 'Steve_Wozniak',
    years: '1950–',
    rarity: 'R',
    title: 'ガレージでApple Iを作った技術者',
    summary:
      'ジョブズとAppleを作り、最初のパソコンApple Iと、大ヒットしたApple IIをほとんど1人で設計しました。いたずら好きで、教えることも大好きです。',
    achievements: [
      'Apple Iを1人で設計し、ジョブズとAppleを創業（1976年）',
      'カラー表示のパソコンApple IIを設計し、大ヒット（1977年）',
      'Appleを離れたあと、子どもたちにコンピュータを教える',
    ],
    look: { skin: 0xf0cfb8, hairStyle: 'short', hairColor: 0x9a948c, shirt: 0x2b2b2b },
    outfit: 'a plain dark charcoal polo shirt, dark blue jeans and black sneakers',
    // Apple I を作った 1976 年の作業部屋（夜）で話す
    show: {
      stage: 'woz',
      props: ['woz1976'],
      lines: [
        { text: 'お金のためじゃない。いいコンピュータを作りたかった。', sub: 'My goal wasn\'t to make a ton of money. It was to build good computers.', prop: 'appleOne', anim: 'greet_01' },
        { text: '窓から投げ捨てられないコンピュータは、信用するな。', sub: 'Never trust a computer you can\'t throw out a window.', anim: 'fold_arms', animFrom: 1.5 },
        { text: '賢い人が働く場所では、ドアに鍵はかかっていない。', sub: 'Wherever smart people work, doors are unlocked.', prop: 'appleII', anim: 'agree' },
      ],
    },
  },
  {
    id: 'iwata',
    name: '岩田聡',
    nameEn: 'Satoru Iwata',
    wiki: 'Satoru_Iwata',
    years: '1959–2015',
    rarity: 'R',
    title: 'ゲームを みんなのものにした社長',
    summary:
      'HAL研究所のプログラマーから任天堂の社長になりました。DSとWiiで、ふだんゲームをしない人にも遊びを広げました。',
    achievements: [
      'HAL研究所で『星のカービィ』などを開発',
      '任天堂の社長に（2002年）',
      'ニンテンドーDSとWiiを世に出す（2004・2006年）',
    ],
    look: { skin: 0xf0d2b8, hairStyle: 'side', hairColor: 0x1e1a18, shirt: 0x2a3348, glasses: true },
    outfit: 'a dark navy business suit, a white collared shirt and a plain dark navy tie, black shoes',
    face: 'an East Asian Japanese man in his fifties with neatly combed short black hair parted on the side, thin oval wire-rimmed glasses, a round friendly face and a warm gentle smile',
    // 任天堂の発表会で話す
    show: {
      stage: 'nintendo',
      props: ['nintendo'],
      lines: [
        { text: '名刺の上では社長。頭の中ではゲーム開発者。でも心は、ゲーマーです。', sub: 'On my business card, I am a corporate president. In my mind, I am a game developer. But in my heart, I am a gamer.', anim: 'greet_01' },
        { text: 'ゲームは何より、楽しくなければいけない。すべての人にとって。', sub: 'Above all, video games are meant to be just one thing: fun for everyone.', prop: 'ds', anim: 'agree' },
        { text: '直接、みなさんにお伝えします。', sub: 'Directly.', prop: 'wiiRemote', anim: 'fold_arms', animFrom: 1.5 },
      ],
    },
  },
  {
    id: 'guido',
    name: 'ガイド・ヴァン・ロッサム',
    nameEn: 'Guido van Rossum',
    wiki: 'Guido_van_Rossum',
    years: '1956–',
    rarity: 'R',
    title: 'Pythonをつくった人',
    summary:
      'オランダの研究所で、読みやすさを大切にしたプログラミング言語Pythonを作りました。いまはAIやデータ分析でいちばん使われる言語の1つです。',
    achievements: [
      'Pythonを公開（1991年）',
      'Googleで働き、Pythonを広める（2005年〜）',
      '長く「やさしい終身独裁者」としてPythonをまとめた',
    ],
    look: { skin: 0xf3d6c4, hairStyle: 'receding', hairColor: 0x9a948c, shirt: 0x2f4f7a, glasses: true },
    outfit: 'a plain dark blue crew-neck T-shirt with no print, khaki trousers and brown shoes',
    // Python が生まれた 1989 年のクリスマスのアムステルダムで話す
    show: {
      stage: 'amsterdam',
      props: ['amsterdam'],
      lines: [
        { text: 'クリスマスの1週間、暇つぶしに始めた趣味だった。', sub: 'I was looking for a hobby programming project that would keep me occupied during the week around Christmas.', anim: 'greet_01' },
        { text: 'プログラムは、書くより読まれることの方がずっと多い。', sub: 'Code is read much more often than it is written.', prop: 'pyCode', anim: 'agree' },
        { text: '美しいは、醜いよりいい。', sub: 'Beautiful is better than ugly.', anim: 'fold_arms', animFrom: 1.5 },
      ],
    },
  },
  {
    id: 'nadella',
    name: 'サティア・ナデラ',
    nameEn: 'Satya Nadella',
    wiki: 'Satya_Nadella',
    years: '1967–',
    rarity: 'SR',
    title: 'Microsoftをクラウドで立て直した人',
    summary:
      'インド生まれの技術者で、Microsoftの3代目のCEOになりました。会社をクラウドとAIの会社に生まれ変わらせました。',
    achievements: [
      'Microsoftのクラウド事業を率いる',
      'Microsoftの3代目CEOに（2014年）',
      'GitHubを買収し、OpenAIと組む',
    ],
    look: { skin: 0xa77a58, hairStyle: 'bald', hairColor: 0x2a2420, shirt: 0x1d1f24, glasses: true },
    outfit: 'a black crew-neck sweater over a white collared shirt, dark grey trousers and black shoes',
    // 今の Microsoft の明るい事務所で話す
    show: {
      stage: 'redmond',
      props: ['redmond'],
      lines: [
        { text: 'この業界は伝統を尊重しない。尊重するのは革新だけだ。', sub: 'Our industry does not respect tradition. It only respects innovation.', prop: 'cloud', anim: 'greet_01' },
        { text: '何でも知っている人より、何でも学ぶ人になれ。', sub: 'Don\'t be a know-it-all, be a learn-it-all.', anim: 'agree' },
        { text: '地球上のすべての人と組織が、より多くを成し遂げられるように。', sub: 'Empower every person and every organization on the planet to achieve more.', prop: 'cricketBat', anim: 'fold_arms', animFrom: 1.5 },
      ],
    },
  },
  {
    id: 'dorsey',
    name: 'ジャック・ドーシー',
    nameEn: 'Jack Dorsey',
    wiki: 'Jack_Dorsey',
    years: '1976–',
    rarity: 'R',
    title: 'Twitterをつくった人',
    summary:
      '140文字でつぶやくTwitter（いまのX）を共同で作りました。お店のスマホ決済のSquareも始めました。',
    achievements: [
      '最初のツイート「just setting up my twttr」（2006年）',
      'スマホでカード払いができるSquareを創業（2009年）',
      'Twitterに戻りCEOを務める（2015年）',
    ],
    look: { skin: 0xf2d4c0, hairStyle: 'short', hairColor: 0x3a2c22, shirt: 0x111111, beard: true },
    outfit: 'a plain black T-shirt with no print, black jeans and black boots',
    // Twitter を始めたサンフランシスコの夜の事務所で話す
    show: {
      stage: 'twttr',
      props: ['twttr'],
      lines: [
        { text: 'just setting up my twttr', sub: 'The first tweet, 2006.', prop: 'tweet', anim: 'greet_01' },
        { text: '細部をすべて完璧に。そして、完璧にする細部の数をしぼれ。', sub: 'Make every detail perfect and limit the number of details to perfect.', anim: 'fold_arms', animFrom: 1.5 },
        { text: '成功は、決して偶然ではない。', sub: 'Success is never accidental.', prop: 'squareReader', anim: 'agree' },
      ],
    },
  },
  {
    id: 'mikitani',
    name: '三木谷浩史',
    nameEn: 'Hiroshi Mikitani',
    wiki: 'Hiroshi_Mikitani',
    years: '1965–',
    rarity: 'R',
    title: '楽天をつくった人',
    summary:
      '銀行を辞めて、たった13のお店からネット通販の楽天市場を始めました。カードや銀行、携帯電話まで広げました。',
    achievements: [
      '楽天市場を開く（1997年、13店から）',
      'プロ野球の東北楽天ゴールデンイーグルスをつくる（2004年）',
      '社内の公用語を英語にした（2012年）',
    ],
    look: { skin: 0xf0d2b8, hairStyle: 'side', hairColor: 0x1e1a18, shirt: 0x1f2433 },
    outfit: 'a dark navy business suit, a white collared shirt and a crimson red tie, black shoes',
    // 楽天を始めた 1997 年の東京の小さな事務所で話す
    show: {
      stage: 'rakuten',
      props: ['rakuten'],
      lines: [
        { text: 'インターネットで、日本を元気にしたい。', sub: 'Empower Japan through the internet.', prop: 'mallScreen', anim: 'greet_01' },
        { text: '常に改善、常に前進。', sub: 'Always improve, always advance.', anim: 'agree' },
        { text: 'スピード!! スピード!! スピード!!', sub: 'Speed!! Speed!! Speed!!', prop: 'baseball', anim: 'fold_arms', animFrom: 1.5 },
      ],
    },
  },
  {
    id: 'hassabis',
    name: 'デミス・ハサビス',
    nameEn: 'Demis Hassabis',
    wiki: 'Demis_Hassabis',
    years: '1976–',
    rarity: 'SR',
    title: 'AIで囲碁とタンパク質の謎を解いた人',
    summary:
      '子どものころはチェスの天才、若いころはゲームを作っていました。DeepMindを作り、囲碁のAlphaGoや、タンパク質の形を当てるAlphaFoldを生み、ノーベル化学賞を受けました。',
    achievements: [
      'DeepMindを創業（2010年）',
      'AlphaGoが囲碁の世界トップに勝つ（2016年）',
      'AlphaFoldでノーベル化学賞（2024年）',
    ],
    look: { skin: 0xe6c3a6, hairStyle: 'receding', hairColor: 0x2a2420, shirt: 0x223049 },
    outfit: 'a plain navy crew-neck sweater over a light blue collared shirt, dark trousers and black shoes',
    // DeepMind のロンドンの事務所で話す
    show: {
      stage: 'deepmind',
      props: ['deepmind'],
      lines: [
        { text: '知能の謎を解き、それでほかのすべてを解く。', sub: 'Solve intelligence, and then use that to solve everything else.', anim: 'greet_01' },
        { text: 'あの37手目は、人には思いつかない一手だった。', sub: 'Move 37 was a move no human would have played.', prop: 'goBoard', anim: 'fold_arms', animFrom: 1.5 },
        { text: 'AI は、人類がつくるいちばん役に立つ技術になりうる。', sub: 'AI could be the most beneficial technology humanity has ever invented.', prop: 'protein', anim: 'agree' },
      ],
    },
  },
  {
    id: 'shannon',
    name: 'クロード・シャノン',
    nameEn: 'Claude Shannon',
    wiki: 'Claude_Shannon',
    years: '1916–2001',
    rarity: 'SR',
    title: '情報理論の父',
    summary:
      'あらゆる情報を0と1の「ビット」で表せることを示し、デジタルの通信の土台を作りました。一輪車とジャグリングが大好きでした。',
    achievements: [
      '電気のスイッチで論理の計算ができると示した（1937年）',
      '情報理論を発表し「ビット」を広めた（1948年）',
      '迷路を覚える機械のネズミ「テセウス」を作った',
    ],
    look: { skin: 0xf3d6c4, hairStyle: 'side', hairColor: 0x6a5440, shirt: 0x6b6458 },
    outfit: 'a 1950s grey tweed jacket, a white collared shirt with a narrow dark tie, grey trousers and brown shoes',
    face: 'a slim American man in his thirties with short wavy brown hair combed back, no glasses, a long narrow face and a friendly smile',
    // 1948 年のベル研究所の研究室で話す
    show: {
      stage: 'shannon',
      props: ['shannonLab'],
      lines: [
        { text: '情報とは、不確かさを減らすものだ。', sub: 'Information is the resolution of uncertainty.', anim: 'greet_01' },
        { text: '物がどう組み立てられているか、ただ不思議だった。', sub: 'I just wondered how things were put together.', prop: 'theseus', anim: 'agree' },
        { text: '役に立つかより、面白いかで研究してきた。', sub: 'I\'ve always pursued my interests without much regard for financial value or value to the world.', prop: 'juggle', anim: 'fold_arms', animFrom: 1.5 },
      ],
    },
  },
];

// rarity はレジェンドの並び順だけに使う（画面にランクは出さない。ユーザー指示 2026-10-01）
export const RARITY = {
  SSR: { rate: 0.05, color: 0xffc83d, css: '#ffc83d' },
  SR: { rate: 0.3, color: 0xb57bff, css: '#b57bff' },
  R: { rate: 0.65, color: 0x5fb4ff, css: '#5fb4ff' },
};

export const byId = Object.fromEntries(LEGENDS.map((l) => [l.id, l]));
