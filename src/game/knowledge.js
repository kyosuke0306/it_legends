// 知識ノート。遊んでいると少しずつたまる「IT」「人物」「IT会社」のカード（読まなくても遊べる。おまけの楽しみ）
// unlock: どうすると手に入るか（state.js が見る）
//   { cat: 'web' }   … その種類の仕事に成功したとき（同じ種類のカードを前から順に）
//   { tasks: n }     … 仕事の成功が n 回になったとき
//   { job: 'se' }    … その職種の人が会社に入ったとき（主人公を含む）
//   { office: n }    … その広さに引っ越したとき
//   { genre: 'web' } … その製品を初めて発売したとき
//   { legend: id, level } … その偉人が仲間になったとき（level があれば、そのレベルになったとき）
export const NOTE_KINDS = { it: 'IT', person: '人物', company: 'IT会社' };

export const NOTES = [
  // ---------- IT ----------
  { id: 'web-how', kind: 'it', unlock: { cat: 'web' }, title: 'Webページが表示されるしくみ', text: 'ブラウザがサーバーに「このページをください」と頼むと、HTML（文章と骨組み）・CSS（見た目）・JavaScript（動き）が送られてきて、ブラウザが画面に組み立てます。' },
  { id: 'web-https', kind: 'it', unlock: { cat: 'web' }, title: 'HTTPS の「S」', text: 'S は Secure（安全）の頭文字。通信を暗号化して、途中で盗み見られたり書き換えられたりしないようにします。アドレス欄の鍵マークが目印です。' },
  { id: 'web-dns', kind: 'it', unlock: { cat: 'web' }, title: 'ドメインとDNS', text: '「example.com」のような名前を、コンピュータの住所である IP アドレス（数字の並び）に変換するのが DNS。インターネットの電話帳のような仕組みです。' },
  { id: 'web-responsive', kind: 'it', unlock: { cat: 'web' }, title: 'レスポンシブデザイン', text: '1つのWebページが、スマホ・タブレット・パソコンなど画面の大きさに合わせて並び方を変える作り方。いまのWebではほぼ当たり前になっています。' },
  { id: 'infra-server', kind: 'it', unlock: { cat: 'infra' }, title: 'サーバーとは', text: '頼まれたときに情報やサービスを返す役目のコンピュータ。Webサイト・メール・ゲームのデータなどは、どこかのサーバーが24時間動いて届けています。' },
  { id: 'infra-cloud', kind: 'it', unlock: { cat: 'infra' }, title: 'クラウド', text: '自分でサーバーを買わずに、巨大なデータセンターのコンピュータを必要なぶんだけ借りて使う仕組み。2006年に始まった Amazon の AWS が先がけで、Microsoft Azure や Google Cloud などが続きました。' },
  { id: 'infra-oss', kind: 'it', unlock: { cat: 'infra' }, title: 'オープンソース', text: 'プログラムの設計図（ソースコード）を公開し、誰でも使ったり直したり配ったりできるようにしたソフト。Linux や Firefox が有名で、世界中の人が協力して育てています。' },
  { id: 'infra-backup', kind: 'it', unlock: { cat: 'infra' }, title: 'バックアップの「3-2-1」', text: 'データのコピーを3つ持ち、2種類の保存先に分け、1つは離れた場所に置く、という考え方。故障や災害があってもデータを守れます。' },
  { id: 'app-bug', kind: 'it', unlock: { cat: 'app' }, title: '「バグ」の有名な話', text: '1947年、ハーバード大学の計算機 Mark II から本物の蛾（バグ）が見つかり、「バグが見つかった最初の実例」として作業日誌に貼られました。グレース・ホッパーが好んで話したエピソードです（「バグ」という言葉自体はそれ以前からありました）。' },
  { id: 'app-test', kind: 'it', unlock: { cat: 'app' }, title: 'テスト', text: '作ったプログラムが正しく動くか確かめる工程。部品ごとに確かめる「単体テスト」、組み合わせて確かめる「結合テスト」などがあり、開発の時間の大きな割合をしめます。' },
  { id: 'app-git', kind: 'it', unlock: { cat: 'app' }, title: 'Git（バージョン管理）', text: 'プログラムの変更の歴史を記録し、たくさんの人が同時に作業しても混ざらないようにする道具。2005年にリーナス・トーバルズが Linux の開発のために作り、いまでは世界中で使われています。' },
  { id: 'app-store', kind: 'it', unlock: { cat: 'app' }, title: 'アプリストアの登場', text: '2008年に iPhone の App Store が始まり、個人や小さな会社でも世界中にアプリを届けられるようになりました。同じ年に Android のストアも始まりました。' },
  { id: 'consult-req', kind: 'it', unlock: { cat: 'consult' }, title: '要件定義', text: '「何を作るか」をお客さんと決める、開発の最初の工程。ここがあいまいだと、作ったあとで「思っていたのと違う」となりがちで、いちばん大事な工程とも言われます。' },
  { id: 'consult-agile', kind: 'it', unlock: { cat: 'consult' }, title: 'ウォーターフォールとアジャイル', text: '最初に全部決めて順番に作るのがウォーターフォール。小さく作って見せては直す、をくり返すのがアジャイル。作るものや状況によって使い分けます。' },
  { id: 'consult-dx', kind: 'it', unlock: { cat: 'consult' }, title: 'DX（デジタルトランスフォーメーション）', text: 'ITを使って仕事のやり方や商売の形そのものを変えること。紙をパソコンに置きかえるだけでなく、データを活かして新しい価値を生むのが目的です。' },
  { id: 'ai-ml', kind: 'it', unlock: { cat: 'ai' }, title: '機械学習', text: '人がルールを一つずつ書く代わりに、たくさんのデータからコンピュータに規則を見つけさせる方法。迷惑メールの判定や商品のおすすめなどに使われています。' },
  { id: 'ai-name', kind: 'it', unlock: { cat: 'ai' }, title: '「人工知能」という言葉', text: '1956年にアメリカで開かれた「ダートマス会議」を呼びかける提案書（1955年）で、ジョン・マッカーシーらが「人工知能（Artificial Intelligence）」という言葉を使ったのが始まりとされています。' },
  { id: 'ai-llm', kind: 'it', unlock: { cat: 'ai' }, title: '生成AIと大規模言語モデル', text: '大量の文章で学習し、続きの言葉を予測することで文章を作るAIを大規模言語モデル（LLM）と呼びます。文章・画像・音楽などを作るAIをまとめて生成AIと言います。' },
  { id: 'space-agc', kind: 'it', unlock: { cat: 'space' }, title: 'アポロ誘導コンピュータ', text: '1969年の月着陸を支えた宇宙船のコンピュータ。記憶できる量はおよそ70KBほどで、いまのスマホの100万分の1以下でした。' },
  { id: 'space-1202', kind: 'it', unlock: { cat: 'space' }, title: '1202アラーム', text: 'アポロ11号の着陸直前、コンピュータが「処理が追いつかない」という警報を出しました。大事な仕事を優先して続ける設計になっていたおかげで、着陸を続けられました。' },
  { id: 'gen-bit', kind: 'it', unlock: { tasks: 3 }, title: 'ビットとバイト', text: 'コンピュータは 0 と 1 だけで情報を扱います。その1けたが1ビット、8ビットまとめて1バイト。1バイトで 256 通りを表せます。' },
  { id: 'gen-moore', kind: 'it', unlock: { tasks: 15 }, title: 'ムーアの法則', text: 'チップにのせられる部品（トランジスタ）の数はおよそ2年ごとに2倍になる、という予測。インテルの創業者の一人ゴードン・ムーアが1965年に示し、のちに2年ごとに修正しました。長いあいだ、コンピュータの進化の目安になりました。' },

  // ---------- 人物（偉人ごとに2つ。仲間になったときと、レベル3になったとき） ----------
  { id: 'p-jobs-1', kind: 'person', unlock: { legend: 'jobs' }, title: 'ジョブズ：ガレージからの出発', text: '1976年、スティーブ・ウォズニアックらと Apple を創業。最初の製品 Apple I は手作りの基板で、ジョブズの実家のガレージが創業の地として知られています。' },
  { id: 'p-jobs-2', kind: 'person', unlock: { legend: 'jobs', level: 3 }, title: 'ジョブズ：追い出されて、戻ってきた', text: '1985年、自分で作った Apple を去ることに。その間に NeXT とピクサーを育て、1997年に Apple へ復帰。iMac・iPod・iPhone で会社を立て直しました。' },
  { id: 'p-gates-1', kind: 'person', unlock: { legend: 'gates' }, title: 'ゲイツ：中学生プログラマー', text: '13歳ごろに学校のコンピュータでプログラミングに夢中になりました。1975年、幼なじみのポール・アレンと Microsoft を創業します。' },
  { id: 'p-gates-2', kind: 'person', unlock: { legend: 'gates', level: 3 }, title: 'ゲイツ：売り切らない契約', text: 'IBM のパソコン向けの OS（MS-DOS）を、IBM に売り切らず、ほかのメーカーにも売れる形で提供したことが大成功のきっかけに。のちに財団を作り、病気や貧困と闘う活動に力を注ぎました。' },
  { id: 'p-zuckerberg-1', kind: 'person', unlock: { legend: 'zuckerberg' }, title: 'ザッカーバーグ：寮の部屋から', text: '2004年、ハーバード大学の寮の部屋で「thefacebook」を公開。最初はハーバードの学生だけが使えるサービスでしたが、あっという間にほかの大学、そして世界へ広がりました。' },
  { id: 'p-zuckerberg-2', kind: 'person', unlock: { legend: 'zuckerberg', level: 3 }, title: 'ザッカーバーグ：Meta へ', text: '2021年に会社の名前を Facebook から Meta に変えました。SNS だけでなく、VR やメタバース、AI の開発に大きく力を入れています。' },
  { id: 'p-torvalds-1', kind: 'person', unlock: { legend: 'torvalds' }, title: 'トーバルズ：ただの趣味', text: '1991年、フィンランドの21歳の大学生だったトーバルズは「ただの趣味で OS を作っている」とネットに投稿。これが Linux の始まりで、いまではサーバーやスマホ（Android）の中で動いています。' },
  { id: 'p-torvalds-2', kind: 'person', unlock: { legend: 'torvalds', level: 3 }, title: 'トーバルズ：Git も作った', text: 'Linux の開発で使っていた道具が使えなくなったとき、自分で作ってしまったのが Git。いまでは世界中の開発者が使う定番の道具です。' },
  { id: 'p-ritchie-1', kind: 'person', unlock: { legend: 'ritchie' }, title: 'リッチー：C言語とUNIX', text: '1970年代、アメリカのベル研究所でケン・トンプソンとともに OS の UNIX と、プログラミング言語 C を作りました。いまの多くの OS や言語が、その影響を受けています。' },
  { id: 'p-ritchie-2', kind: 'person', unlock: { legend: 'ritchie', level: 3 }, title: 'リッチー：hello, world', text: 'ブライアン・カーニハンと書いた本『プログラミング言語C』（1978年）の最初の例が、画面に「hello, world」と出すプログラム。いまもプログラミング入門の定番です。' },
  { id: 'p-bernerslee-1', kind: 'person', unlock: { legend: 'bernerslee' }, title: 'バーナーズ＝リー：研究所の困りごと', text: 'スイスの CERN（欧州原子核研究機構）で、研究者どうしの情報共有を楽にするため1989年に Web を提案。1990年に最初の Web サーバーとブラウザを作りました。' },
  { id: 'p-bernerslee-2', kind: 'person', unlock: { legend: 'bernerslee', level: 3 }, title: 'バーナーズ＝リー：みんなのものに', text: '1993年、CERN は Web の技術を誰でも無料で使えるように公開しました。特許でお金を取らなかったからこそ、Web は世界中に広がりました。' },
  { id: 'p-hopper-1', kind: 'person', unlock: { legend: 'hopper' }, title: 'ホッパー：ことばでプログラムを', text: '1952年ごろ、プログラムを機械の数字ではなく人に分かる言葉に近い形で書き、それを変換する「コンパイラ」を作りました。この考えは事務用の言語 COBOL につながります。' },
  { id: 'p-hopper-2', kind: 'person', unlock: { legend: 'hopper', level: 3 }, title: 'ホッパー：ナノ秒の針金', text: '講演では約30cmの電線を配り、「これが光が10億分の1秒（1ナノ秒）に進む距離」と見せました。むだな待ち時間がどれだけもったいないかを、目で分かるように伝えたのです。' },
  { id: 'p-hamilton-1', kind: 'person', unlock: { legend: 'hamilton' }, title: 'ハミルトン：月へのプログラム', text: 'アポロ計画で宇宙船のソフトウェアを作るチームを率いました。「ソフトウェア・エンジニアリング（ソフトウェア工学）」という言葉を広めた一人でもあります。' },
  { id: 'p-hamilton-2', kind: 'person', unlock: { legend: 'hamilton', level: 3 }, title: 'ハミルトン：背丈ほどのコード', text: '自分の背丈ほどに積み上げたプログラムの印刷の横に立つ写真が有名です。2016年、アメリカで民間人に贈られる最高の勲章「大統領自由勲章」を受けました。' },
  { id: 'p-vonneumann-1', kind: 'person', unlock: { legend: 'vonneumann' }, title: 'ノイマン：いまのコンピュータの形', text: 'プログラムもデータと同じようにメモリに入れておく方式を、1945年の報告書にまとめました。「ノイマン型」と呼ばれ、いまのほとんどのコンピュータがこの形です。' },
  { id: 'p-vonneumann-2', kind: 'person', unlock: { legend: 'vonneumann', level: 3 }, title: 'ノイマン：ゲーム理論', text: '経済学者モルゲンシュテルンと『ゲームの理論と経済行動』（1944年）を書き、人や会社の駆け引きを数学で考える「ゲーム理論」の土台を作りました。' },
  { id: 'p-turing-1', kind: 'person', unlock: { legend: 'turing' }, title: 'チューリング：暗号との闘い', text: '第二次世界大戦中、イギリスのブレッチリー・パークで、ドイツ軍の暗号機エニグマを解く機械「ボンブ」の設計に関わりました。' },
  { id: 'p-turing-2', kind: 'person', unlock: { legend: 'turing', level: 3 }, title: 'チューリング：名前のついた賞', text: 'コンピュータ科学でもっとも名誉ある賞は「チューリング賞」と名づけられ、「コンピュータ科学のノーベル賞」とも呼ばれています。' },
  { id: 'p-lovelace-1', kind: 'person', unlock: { legend: 'lovelace' }, title: 'ラブレス：詩人の娘', text: '父は有名な詩人バイロン。母は娘に数学をしっかり学ばせました。のちに計算機を考えたチャールズ・バベッジと出会い、その仕組みに夢中になります。' },
  { id: 'p-lovelace-2', kind: 'person', unlock: { legend: 'lovelace', level: 3 }, title: 'ラブレス：エイダの日', text: '毎年10月の第2火曜日は「エイダ・ラブレス・デー」。科学や技術の分野で活躍する女性をたたえる日になっています。' },

  // ---------- IT会社 ----------
  { id: 'c-contract', kind: 'company', unlock: { tasks: 1 }, title: '受託開発と自社開発', text: 'お客さんに頼まれたものを作ってお金をもらうのが受託開発。自分たちで考えた製品を作って売るのが自社開発。受託は安定しやすく、自社製品は当たれば大きいけれどリスクもあります。' },
  { id: 'c-sier', kind: 'company', unlock: { tasks: 10 }, title: 'SIer（エスアイヤー）', text: '企業のシステムづくりを、相談から設計・開発・運用までまとめて引き受ける会社のこと。日本では大きな SIer の下に何社もの会社が入る「多重下請け」も多いと言われます。' },
  { id: 'c-job-se', kind: 'company', unlock: { job: 'se' }, title: 'SE（システムエンジニア）の仕事', text: 'お客さんの要望を聞き、どんな機能をどう作るかという設計図を作ります。会社によってはプログラムも書き、お客さんと開発チームをつなぐ役目も担います。' },
  { id: 'c-job-pg', kind: 'company', unlock: { job: 'pg' }, title: 'プログラマーの仕事', text: '設計にそってプログラムを書き、動かして確かめ、まちがいを直します。新しい技術を学び続けるのも大事な仕事です。' },
  { id: 'c-job-infra', kind: 'company', unlock: { job: 'infra' }, title: 'インフラエンジニアの仕事', text: 'サーバーやネットワークなど、システムが動く土台を作り、止まらないように見守ります。トラブルが起きたら夜中でも駆けつけることも。' },
  { id: 'c-job-designer', kind: 'company', unlock: { job: 'designer' }, title: 'デザイナーの仕事（UI/UX）', text: '画面の見た目（UI）だけでなく、使う人が迷わず気持ちよく使えるか（UX）を考えます。実際に使ってもらって改善をくり返します。' },
  { id: 'c-job-data', kind: 'company', unlock: { job: 'data' }, title: 'データサイエンティストの仕事', text: 'たくさんのデータを集めて分析し、「何が売れそうか」「どこに問題があるか」を見つけます。AI を作る仕事にもつながります。' },
  { id: 'c-job-pm', kind: 'company', unlock: { job: 'pm' }, title: 'PM（プロジェクトマネージャー）の仕事', text: 'プロジェクトの予定・予算・人の割りふりをまとめ、期限までに完成させる責任者。問題を早く見つけて手を打つのが腕の見せどころです。' },
  { id: 'c-job-gm', kind: 'company', unlock: { job: 'gm' }, title: 'GM（ゼネラルマネージャー）の仕事', text: '事業全体の責任者。売上や利益の目標を立て、人やお金をどこに使うかを決めます。チームを育てるのも大事な役目です。' },
  { id: 'c-job-consul', kind: 'company', unlock: { job: 'consul' }, title: 'ITコンサルタントの仕事', text: '会社の困りごとを聞き、ITでどう解決するかを提案します。どのシステムを入れるか、仕事の流れをどう変えるかまで考えます。' },
  { id: 'c-job-sales', kind: 'company', unlock: { job: 'sales' }, title: 'IT営業の仕事', text: 'お客さんを見つけ、困りごとを聞いて自社の製品やサービスを提案し、契約につなげます。技術にくわしい営業は「セールスエンジニア」とも呼ばれます。' },
  { id: 'c-garage', kind: 'company', unlock: { office: 1 }, title: 'ガレージ創業の伝説', text: 'HP（1939年）、Apple、Amazon、Google など、ガレージから始まったIT企業はたくさんあります。HP が生まれたガレージは「シリコンバレー発祥の地」と呼ばれています。' },
  { id: 'c-startup', kind: 'company', unlock: { office: 2 }, title: 'スタートアップと投資家', text: '新しいアイデアで急成長をめざす若い会社をスタートアップと呼びます。ベンチャーキャピタル（VC）などの投資家からお金を集め、成長を早めます。' },
  { id: 'c-unicorn', kind: 'company', unlock: { office: 3 }, title: 'ユニコーン企業と上場', text: '会社の価値が10億ドル以上と評価される、株式を上場していないスタートアップを「ユニコーン」と呼びます。上場すると、株を証券取引所で誰でも売り買いできるようになります。' },
  { id: 'c-bigtech', kind: 'company', unlock: { office: 4 }, title: 'ビッグテック', text: 'Google（Alphabet）・Apple・Meta・Amazon・Microsoft などの巨大IT企業をまとめてビッグテックと呼びます。頭文字から GAFAM と呼ぶこともあります。' },
  { id: 'c-ads', kind: 'company', unlock: { genre: 'web' }, title: '無料サービスのもうけ方', text: '検索やSNSの多くは無料で使え、広告を出す会社からお金をもらってもうけています。月額料金をもらう「サブスク」や、基本無料で一部だけ有料にする形もあります。' },
  { id: 'c-appfee', kind: 'company', unlock: { genre: 'app' }, title: 'アプリストアの手数料', text: 'アプリの売上の一部は、ストアを運営する会社に手数料として払います。多くの場合15〜30%ほどです。' },
  { id: 'c-game', kind: 'company', unlock: { genre: 'game' }, title: 'ゲームのビジネス', text: '買い切りのほか、基本無料で遊べてアイテムなどにお金を払う形が広まりました。大ヒットは一握りで、当たり外れの大きい業界です。' },
  { id: 'c-saas', kind: 'company', unlock: { genre: 'biz' }, title: 'SaaS（サース）', text: 'ソフトを買ってパソコンに入れる代わりに、インターネット経由で月額などで使う形。会計・勤怠・営業管理などの業務ソフトで広く使われています。' },
  { id: 'c-gpu', kind: 'company', unlock: { genre: 'ai' }, title: 'AIとGPU', text: '大きなAIを学習させるには、GPU という計算の得意な部品を大量に使います。そのため AI の開発には巨額のお金がかかり、GPU を作る会社も大きく成長しました。' },
];

export const noteById = Object.fromEntries(NOTES.map((n) => [n.id, n]));

// まだ持っていないカードのヒント
export function noteHint(n) {
  const u = n.unlock;
  if (u.cat) return '仕事をこなすと…';
  if (u.tasks) return `仕事を ${u.tasks} 回こなすと…`;
  if (u.job) return 'この職種の人が入社すると…';
  if (u.office != null) return '会社を広げると…';
  if (u.genre) return '新しい種類の製品を出すと…';
  if (u.legend) return u.level ? '仲間の偉人が育つと…' : '偉人が仲間になると…';
  return '';
}
