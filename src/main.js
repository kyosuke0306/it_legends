// 画面まわり。ゲームの中身は game/state.js、数字は game/rules.js
// 文字は少なく、アイコンと数字で見せる（絵文字は使わない。アイコンは icons.js）
import { LEGENDS, byId } from './data.js';
const LEGEND_COLOR = 0xf0b93a; // レジェンドはランクを付けず、みんな同じ金色（ユーザー指示 2026-10-01）
import { createCharacter, preloadCharacters, thumbnailUrl } from './character.js';
import { Stage, renderThumbnail } from './stage.js';
import { buildPerson } from './outfits.js';
import { Office } from './office.js';
import { themeOf } from './office-decor.js';
import { VERSION } from './version.js';
import { icon } from './icons.js';
import * as G from './game/state.js';
import * as R from './game/rules.js';
import { FACE_OPTIONS } from './game/names.js';
import * as cloud from './cloud.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
document.getElementById('version').textContent = VERSION;
document.getElementById('title-ver').textContent = VERSION;
$('#open-settings').innerHTML = icon('gear');
document.querySelectorAll('.tab').forEach((t) => t.insertAdjacentHTML('afterbegin', icon(t.dataset.icon)));

// iPhone の Safari は2本指で画面ごと拡大できてしまう（描く画面がはみ出す）ので止める。3Dの部屋の2本指は別に動く
document.addEventListener('gesturestart', (e) => e.preventDefault());

// 記録は3つまで（2026-10-04 ユーザー指示）。1 はもとからの場所（今までの記録はそのまま 1 になる）、2・3 は別の場所
const SAVE_KEY = 'it_legends.save.v1';
const SLOT_KEY = 'it_legends.slot'; // いま遊んでいる記録の番号
const saveKey = (slot) => (slot === 1 ? SAVE_KEY : `${SAVE_KEY}.${slot}`);
let slot = 1;
try {
  slot = cloud.SLOTS.includes(+localStorage.getItem(SLOT_KEY)) ? +localStorage.getItem(SLOT_KEY) : 1;
} catch {}
let S = null; // ゲームの状態
let view = 'office';
let office;

// ---------- 保存 ----------
function loadLocal(n = slot) {
  try {
    const s = JSON.parse(localStorage.getItem(saveKey(n)));
    return s?.v === 1 ? G.migrate(s) : null;
  } catch {
    return null;
  }
}
function save() {
  if (!S) return;
  S.savedAt = Date.now();
  try {
    localStorage.setItem(saveKey(slot), JSON.stringify(S));
  } catch {}
  cloud.changed();
}
// 裏に回ったら保存して通信を切り、戻ったらつなぎ直す（通信を少なくする）
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    save();
    cloud.sleep();
  } else cloud.wake();
});

// ---------- 表示の小道具 ----------
const pct = (x) => `${Math.round(x * 100)}%`;
// お金は短く（12.3万 / 1.2億 / 3.4兆）
function money(n) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e12) return `${sign}${(a / 1e12).toFixed(a >= 1e13 ? 0 : 1)}兆`;
  if (a >= 1e8) return `${sign}${(a / 1e8).toFixed(a >= 1e9 ? 0 : 1)}億`;
  if (a >= 1e4) return `${sign}${(a / 1e4).toFixed(a >= 1e5 ? 0 : 1)}万`;
  return `${sign}${Math.round(a).toLocaleString('ja-JP')}`;
}
const yen = (n) => `${money(n)}円`;
const signYen = (n) => `${n < 0 ? '-' : '+'}${yen(Math.abs(n))}`; // 増減（+1,000円 / -1,000円）
function dur(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 && h < 10 ? `${h}時間${m % 60}分` : `${h}時間`;
  return h % 24 ? `${Math.floor(h / 24)}日${h % 24}時間` : `${Math.floor(h / 24)}日`;
}
// 依頼の種類の札（Web・アプリ・インフラ…）。色は種類ごと（.cat-web など）。レジェンドの出会いの条件と見比べられるように
const goodTag = '<span class="good-tag">得意</span>';
const catTag = (cat) => `<span class="cat-tag cat-${cat}">${R.CAT_NAMES[cat]}</span>`;
const val = (name, text, cls = '') => `<span class="val ${cls}">${icon(name)}${text}</span>`;
// 派遣の人・紹介予定派遣で来ていた面接の人の札
const hakenTag = (m) =>
  m.haken ? `<span class="haken-tag ${m.haken.intro ? 'intro' : ''}">${m.haken.intro ? '紹介予定派遣' : '派遣'}</span>` : m.intro ? '<span class="haken-tag intro">紹介予定派遣</span>' : '';
const jobShort = (m) => (m.kind === 'legend' ? 'レジェンド' : R.JOBS[m.job].name);
const perkText = (m) => (m.kind === 'legend' ? R.LEGEND_RULES[m.legend].abilityText : R.JOBS[m.job].perkText);
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
function avatar(m) {
  if (m.kind === 'legend') return `<span class="av legend" style="--c:var(--gold)"><img data-thumb="${m.legend}" alt=""></span>`;
  const c = m.kind === 'hero' ? 'var(--accent)' : hex(R.JOBS[m.job].shirt);
  // 3D の姿から作った顔の絵。できるまでは名前の1文字を出し、できたら差し替える（faceFor）
  const k = faceKey(m);
  const src = faceFor(m);
  const inner = src ? `<img src="${src}" alt="">` : esc(m.name.replace(/\s.*/, '').slice(0, 1));
  return `<span class="av face ${m.kind === 'temp' ? 'temp' : ''} ${G.isTired(m) ? 'tired' : ''}" style="--c:${c}" data-face="${esc(k)}">${inner}</span>`;
}
// 顔の絵は見た目（髪・肌・メガネ・職種の小物・CEO か）ごとに1回だけ作って覚えておく
const faces = new Map();
const faceQueue = [];
const faceKey = (m) => `${m.kind === 'hero' ? 'ceo:' : ''}${m.job}:${JSON.stringify(m.look)}`;
function faceFor(m) {
  const k = faceKey(m);
  const v = faces.get(k);
  if (typeof v === 'string') return v;
  if (!v) {
    faces.set(k, true);
    faceQueue.push([k, m]);
    if (faceQueue.length === 1) setTimeout(drawFaces);
  }
  return null;
}
// 画面を止めないよう、1つずつ間をあけて作る
function drawFaces() {
  const next = faceQueue[0];
  if (!next) return;
  const [k, m] = next;
  try {
    // レジェンドの絵（models/<id>.webp）と同じ写し方・同じ切り抜きにする
    faces.set(k, renderThumbnail(buildPerson(m.look, m.job, { ceo: m.kind === 'hero' })));
    document.querySelectorAll('.av.face').forEach((el) => {
      if (el.dataset.face === k) el.innerHTML = `<img src="${faces.get(k)}" alt="">`;
    });
  } catch (e) {
    console.warn('顔の絵を作れませんでした', e);
  }
  faceQueue.shift();
  if (faceQueue.length) (window.requestIdleCallback ?? setTimeout)(drawFaces);
}
// ---------- CEO の顔を選ぶ（はじめるときと、設定の「顔を変更」） ----------
// 肌の色・髪の色は色の丸、髪形とメガネは小さな顔の絵で選ぶ。上の大きな丸が今の顔
const faceShots = new Map();
function faceShot(look, job) {
  const k = `${job}:${JSON.stringify(look)}`;
  if (!faceShots.has(k)) faceShots.set(k, renderThumbnail(buildPerson(look, job, { ceo: true })));
  return faceShots.get(k);
}
function faceEditor(box, look, job) {
  const noGlasses = ['data', 'consul'].includes(job); // この2つの職種はもともとメガネ（分厚いメガネには変えられる）
  look.gender = genderOf(look);
  const pic = (l) => `<span class="fe-pic" style="background-image:url(${faceShot({ ...look, ...l }, job)})"></span>`;
  const sw = (key, list) =>
    `<div class="fe-row">${list.map((c) => `<button class="fe-sw ${look[key] === c ? 'on' : ''}" data-k="${key}" data-v="${c}" style="--c:${hex(c)}"></button>`).join('')}</div>`;
  box.innerHTML = `
    <div class="fe-main" style="background-image:url(${faceShot(look, job)})"></div>
    <div class="fe-row fe-gender">${[['m', '男性'], ['f', '女性']].map(([g, t]) => `<button class="fe-opt ${look.gender === g ? 'on' : ''}" data-k="gender" data-v="${g}">${pic({ gender: g, hairStyle: look.gender === g ? look.hairStyle : FACE_OPTIONS.hairStyle[g][0] })}<span>${t}</span></button>`).join('')}</div>
    ${sw('skin', FACE_OPTIONS.skin)}
    ${sw('hairColor', FACE_OPTIONS.hairColor)}
    <div class="fe-row">${FACE_OPTIONS.hairStyle[look.gender].map((h) => `<button class="fe-opt ${look.hairStyle === h ? 'on' : ''}" data-k="hairStyle" data-v="${h}">${pic({ hairStyle: h })}</button>`).join('')}</div>
    <div class="fe-row">${(noGlasses ? [true, 'thick'] : [false, true, 'thick'])
      .map((g) => `<button class="fe-opt ${(look.glasses || (noGlasses && true)) === g ? 'on' : ''}" data-k="glasses" data-v="${g}">${pic({ glasses: g })}</button>`)
      .join('')}</div>
    <div class="fe-row">${[false, true].map((h) => `<button class="fe-opt ${(look.headphones ?? job === 'pg') === h ? 'on' : ''}" data-k="headphones" data-v="${h}">${pic({ headphones: h })}</button>`).join('')}</div>`;
  box.onclick = (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const { k, v } = b.dataset;
    look[k] = k === 'hairStyle' || k === 'gender' ? v : k === 'glasses' ? (v === 'thick' ? 'thick' : v === 'true') : k === 'headphones' ? v === 'true' : +v;
    if (k === 'gender' && !FACE_OPTIONS.hairStyle[v].includes(look.hairStyle)) look.hairStyle = FACE_OPTIONS.hairStyle[v][0];
    faceEditor(box, look, job);
  };
}
// 男女を選ぶ前の記録の CEO は、髪形から決める
const genderOf = (look) => look.gender ?? (FACE_OPTIONS.hairStyle.f.includes(look.hairStyle) ? 'f' : 'm');
const defaultLook = () => ({ gender: 'm', hairStyle: 'short', skin: FACE_OPTIONS.skin[1], hairColor: FACE_OPTIONS.hairColor[0], glasses: false });

// 4つの能力を小さな棒で（ラベルは1文字）
function statBars(st) {
  // 小さい差も見えるように平方根で（25 → 半分、100 → いっぱい）
  const h = (v) => Math.min(100, Math.sqrt(Math.max(0, v) / 100) * 100);
  return `<span class="mini">${R.STAT_KEYS.map((k) => `<i title="${R.STATS[k]} ${st[k]}"><span><b style="height:${h(st[k])}%"></b></span><em>${R.STATS[k][0]}</em></i>`).join('')}</span>`;
}
function rating(q) {
  const n = Math.max(1, Math.min(5, Math.round(q * 2)));
  return `<span class="rating">${'<i class="on"></i>'.repeat(n)}${'<i></i>'.repeat(5 - n)}</span>`;
}
// 製品の種類ごとの絵と色（アプリのアイコンのような四角）
const GENRE_LOOK = {
  web: ['g_web', '#36b6ff', '#4b6bff'],
  app: ['g_app', '#22d3a6', '#1f8fd6'],
  game: ['g_game', '#ff6f9f', '#a24bff'],
  biz: ['g_biz', '#5d7bff', '#2e3f9e'],
  ai: ['g_ai', '#b06bff', '#ff5fb7'],
  cloud: ['cloud', '#5fd3ff', '#3a7bff'],
  sns: ['g_sns', '#ff9a3d', '#ff4f7a'],
  car: ['g_car', '#2fd17a', '#14866b'],
  quantum: ['g_quantum', '#8f6bff', '#2b1d7a'],
  satnet: ['g_satnet', '#2f6bff', '#0b1d55'],
  agi: ['spark', '#ffd35a', '#ff7a2f'],
};
function prodIcon(genre, cls = '') {
  const [ic, a, b] = GENRE_LOOK[genre] ?? GENRE_LOOK.web;
  return `<span class="prod-ic ${cls}" style="--g1:${a};--g2:${b}">${icon(ic)}</span>`;
}
function progress(start, end) {
  return `<div class="prog"><div class="bar" data-start="${start}" data-ends="${end}"><i></i></div><span class="left" data-left="${end}">${dur(end - Date.now())}</span></div>`;
}
// 偉人の小さな絵をあとから差し込む
function fillThumbs(root) {
  root.querySelectorAll('img[data-thumb]').forEach((img) => thumbnailFor(byId[img.dataset.thumb]).then((src) => (img.src = src)));
}

// ---------- タイトルの背景：奥へ流れる光の格子（タイトルが見えている間だけ動かす） ----------
(function titleGrid() {
  const svg = $('#title-grid');
  if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg';
  const line = (x1, y1, x2, y2) => {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', x1);
    l.setAttribute('y1', y1);
    l.setAttribute('x2', x2);
    l.setAttribute('y2', y2);
    svg.append(l);
    return l;
  };
  // 地平線の真ん中から手前に広がる線
  for (let i = -10; i <= 10; i++) line(200, 0, 200 + i * 90, 400);
  // 横の線（奥ほどつまって見えるように2乗で並べる）。少しずつ手前に流す
  const rows = Array.from({ length: 12 }, () => line(0, 0, 400, 0));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw = (t) => {
    const phase = still ? 0 : (t / 2600) % 1;
    rows.forEach((l, i) => {
      const y = 400 * ((i + phase) / rows.length) ** 2;
      l.setAttribute('y1', y);
      l.setAttribute('y2', y);
    });
    if (!$('#start').classList.contains('hidden')) requestAnimationFrame(draw);
    else setTimeout(() => requestAnimationFrame(draw), 1000);
  };
  requestAnimationFrame(draw);
})();

let modelIds = new Set(); // 3Dのできているレジェンド（models/manifest.json）
// タイトルに、3Dのできているレジェンドを並べる。仲間にした人だけ姿を見せ、ほかは影（シークレット）
async function titleLegends() {
  const box = $('#title-legends');
  if (!box) return;
  let ids = [];
  try {
    ids = await (await fetch('models/manifest.json')).json();
  } catch {}
  modelIds = new Set(ids);
  const owned = new Set((S ?? loadLocal())?.members.filter((m) => m.kind === 'legend').map((m) => m.legend) ?? []);
  const mid = (ids.length - 1) / 2;
  box.innerHTML = ids
    .map((id, i) => `<img src="models/${id}.webp" alt="" class="${owned.has(id) ? 'own' : ''} ${Math.abs(i - mid) < 1 ? 'mid' : ''}" style="animation-delay:${(i * 0.37).toFixed(2)}s">`)
    .join('');
}

// ---------- タイトル → 名前 → 会社 → 職種 ----------
const steps = [...document.querySelectorAll('#start .step')];
let at = 0;
let wantContinue = false; // 「つづきから」でログインを待っているか
let pendingWelcome = null; // 留守の間のまとめ（ゲーム画面に入ったときに出す）
function goStep(i) {
  at = Math.max(0, Math.min(steps.length - 1, i));
  steps.forEach((st, k) => st.classList.toggle('active', k === at));
  steps[at].querySelector('input')?.focus();
}

// クラウドの記録が届いたときにタイトルを描き直す。記録を選ぶ画面を開いていたら閉じずに中身だけ新しくする
// （「つづきから」を押した直後に記録が届くと、選ぶ画面が閉じて元に戻ってしまっていた。2026-10-04）
function refreshTitle() {
  if (slotsMode) return openSlots(slotsMode);
  showTitle();
}
// タイトル画面。記録があれば「つづきから」を大きく
function showTitle() {
  $('#start').classList.remove('hidden');
  $('#game').classList.add('hidden');
  $('#title-msg').textContent = '';
  closeSlots();
  titleLegends();
  const any = filledSlots().length > 0;
  $('#btn-continue').classList.toggle('sub', !any);
  $('#btn-new').classList.toggle('sub', any);
  if (any) $('#btn-continue').after($('#btn-new')); // 大きい方を上に
  else $('#btn-new').after($('#btn-continue'));
  goStep(0);
}

// ----- 記録1・記録2 -----
const slotData = (n) => (n === slot ? S : loadLocal(n));
const filledSlots = () => cloud.SLOTS.filter((n) => slotData(n));
// 遊ぶ記録を切り替える（いまの記録は保存してから）
async function useSlot(n) {
  if (n === slot) return;
  save();
  await cloud.flush().catch(() => {});
  slot = n;
  try {
    localStorage.setItem(SLOT_KEY, String(n));
  } catch {}
  S = loadLocal(n);
  pendingWelcome = null;
  if (S) {
    const away = Date.now() - S.time;
    pendingWelcome = [G.advance(S, Date.now()), away];
    save();
  }
  office?.reset();
}
// タイトルで記録を選ぶ（mode: 'continue' つづきから / 'new' はじめから）
let newSlot = null; // はじめからで選んだ記録の番号
let slotsMode = null; // 記録を選ぶ画面を開いているとき 'continue' / 'new'
function openSlots(mode) {
  slotsMode = mode;
  const card = (n) => {
    const s = slotData(n);
    const info = s
      ? `<b>${esc(s.company)}</b><span class="vals">${val('coin', yen(s.money))}${val('star', s.rep)}${val('crown', legendCount(s))}</span>`
      : `<span class="muted">${icon('plus')}</span>`;
    // ロックした記録には、はじめからで上書きできない
    const off = (mode === 'continue' && !s) || (mode === 'new' && s?.locked);
    return `<button class="slot ${s ? '' : 'empty'}" data-slot="${n}" ${off ? 'disabled' : ''}><span class="slot-no">${n}</span><span class="slot-info">${info}</span>${s?.locked ? icon('lock', 'slot-lock') : ''}</button>`;
  };
  $('#title-slots').innerHTML = `${cloud.SLOTS.map(card).join('')}<button class="slot-back" id="slot-back">${icon('back')}</button>`;
  $('#title-slots').classList.remove('hidden');
  $('#title-buttons').classList.add('hidden');
  $('#slot-back').onclick = closeSlots;
  $('#title-slots').querySelectorAll('[data-slot]').forEach(
    (b) =>
      (b.onclick = async () => {
        const n = +b.dataset.slot;
        if (mode === 'continue') {
          await useSlot(n);
          if (S) enterGame();
          return;
        }
        const old = slotData(n);
        if (old && !(await ask({ head: askSlot(n, old), text: 'この記録は消えます。はじめからにしますか？', ok: 'はじめから' }))) return;
        newSlot = n;
        closeSlots();
        goStep(1);
      }),
  );
}
function closeSlots() {
  slotsMode = null;
  $('#title-slots').classList.add('hidden');
  $('#title-buttons').classList.remove('hidden');
}

$('#btn-continue').onclick = async () => {
  const filled = filledSlots();
  if (filled.length > 1) return openSlots('continue'); // 記録が2つ以上あるときは選ぶ
  if (S) return enterGame();
  if (filled.length) {
    await useSlot(filled[0]);
    return enterGame();
  }
  // この端末に記録がなければ、Google でログインしてクラウドの記録を読む
  wantContinue = true;
  $('#title-msg').textContent = '';
  if (cloud.currentUser()) onSynced();
  else cloud.login();
};
$('#btn-continue').addEventListener('pointerdown', cloud.warmUp, { once: true });
$('#btn-new').onclick = () => {
  // 記録があるときは、どこに作るかを選ぶ（ほかの記録は消えない）
  if (filledSlots().length) return openSlots('new');
  newSlot = slot;
  goStep(1);
};

// ログインしてクラウドと合わせ終わったとき
function onSynced() {
  if (!wantContinue) return;
  wantContinue = false;
  if (S) enterGame();
  else if (filledSlots().length) useSlot(filledSlots()[0]).then(enterGame);
  else $('#title-msg').textContent = '記録がありません';
}

function initStart() {
  document.querySelectorAll('#start .back').forEach((b) => {
    b.innerHTML = icon('back');
    b.onclick = () => goStep(at - 1);
  });
  // 名前・会社は空なら次へ進めない
  const need = { 1: '#start-name', 2: '#start-company' };
  const check = () => Object.entries(need).forEach(([i, sel]) => (steps[i].querySelector('[data-next]').disabled = !$(sel).value.trim()));
  Object.values(need).forEach((sel) => {
    $(sel).oninput = check;
    // 戻り値を返さない（false を返すと削除キーなどが効かなくなる。予測変換で入れたあと消せなかった）
    $(sel).onkeydown = (e) => {
      if (e.key === 'Enter' && !e.isComposing && $(sel).value.trim()) goStep(at + 1);
    };
  });
  check();
  document.querySelectorAll('#start [data-next]').forEach((b) => (b.onclick = () => goStep(at + 1)));

  let chosen = null;
  const box = $('#start-jobs');
  box.innerHTML = Object.entries(R.JOBS)
    .map(
      ([id, j]) => `<button class="job art-3d" data-job="${id}" style="--c:${hex(j.shirt)}">
        <img src="assets/jobs/${id}.webp" alt="">
        <b>${j.full}</b><small>${j.perkText}</small>
      </button>`,
    )
    .join('');
  box.onclick = (e) => {
    const b = e.target.closest('.job');
    if (!b) return;
    chosen = b.dataset.job;
    box.querySelectorAll('.job').forEach((x) => x.classList.toggle('active', x === b));
    $('#start-job-next').disabled = false;
  };
  // 職種を選んだら顔を選ぶ（職種の小物を付けた姿で見せる）
  const look = defaultLook();
  $('#start-job-next').onclick = () => {
    if (!chosen) return;
    faceEditor($('#start-face'), look, chosen);
    goStep(4);
  };
  $('#start-go').onclick = async () => {
    if (!chosen) return;
    if (newSlot && newSlot !== slot) await useSlot(newSlot);
    newSlot = null;
    S = G.newGame({ job: chosen, name: $('#start-name').value.trim(), company: $('#start-company').value.trim(), look: { ...look } });
    S.story = 0; // はじめる前にストーリーを見せる（showStory）
    pendingWelcome = null;
    office?.reset();
    save();
    enterGame();
  };
}
initStart();

// ---------- ゲーム画面 ----------
// 会社の画面はスクロールせずに1画面に収める（上の見出しと下のタブの高さを CSS に渡し、3Dの部分が残りを使う）
function fitScreen() {
  const root = document.documentElement.style;
  root.setProperty('--head-h', `${$('header.top').offsetHeight}px`);
  root.setProperty('--tab-h', `${$('.tabbar').offsetHeight}px`);
}
addEventListener('resize', fitScreen);
function enterGame() {
  $('#start').classList.add('hidden');
  $('#game').classList.remove('hidden');
  fitScreen();
  if (!office) {
    office = new Office($('#office-canvas'));
    office.onArt = openArtPad; // 自宅の壁の空いているところをタップすると、落書きを描く
    // 3Dの人の札：名前を押すとプロフィール、仕事の名前を押すと仕事の詳しいシート
    office.onPerson = (m, candidate) => (m.kind === 'legend' ? openLegend(m.legend) : openMember(m, candidate));
    office.onWork = (id) => (S.tasks.some((t) => t.id === id) ? openRunning(id) : S.devs.some((d) => d.id === id) && openDevRunning(id));
  }
  preloadCharacters([...G.ownedLegends(S)]);
  renderAll();
  if (pendingWelcome) {
    welcomeBack(...pendingWelcome);
    pendingWelcome = null;
  }
  if (S.story === 0) showStory();
  else startGuide();
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.onclick = () => {
    // 仕事・仲間のタブを開いたとき、前に見た時刻を覚えておく（それより後に来た依頼・面接に「新着」を付ける）
    if (view !== tab.dataset.view && seenSnap[tab.dataset.view] !== undefined) seenSnap[tab.dataset.view] = S[`${tab.dataset.view}SeenAt`] ?? 0;
    view = tab.dataset.view;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
    document.querySelector('main').scrollTop = 0;
    renderAll();
  };
});

// タブを開く前に最後に見た時刻（新着の印に使う）
const seenSnap = { work: Infinity, team: Infinity };
const newTag = '<span class="new-tag">新着</span>';
function renderHeader() {
  $('#company-name').textContent = S.company;
  $('#money').innerHTML = val('coin', yen(S.money), S.money < 0 ? 'minus' : '');
  $('#rep').innerHTML = val('star', S.rep);
  $('#dot-office').classList.toggle('on', Boolean(S.encounter));
  // 勉強会で訪ねてきた人がいるか、仲間タブを最後に開いたあとに面接に来た人がいるとき
  $('#dot-team').classList.toggle('on', S.candidates.some((c) => c.walkin || (c.at ?? 0) > (S.teamSeenAt ?? 0)));
  // 仕事タブを最後に開いたあとに新しい依頼が届いていて、手の空いている人がいるときだけ（開くと消える）
  const arrived = (o) => o.expiresAt - R.OFFER_LIFE;
  $('#dot-work').classList.toggle('on', G.freeMembers(S).length > 0 && S.offers.some((o) => arrived(o) > (S.workSeenAt ?? 0)));
}
function renderAll() {
  if (!S || $('#game').classList.contains('hidden')) return; // タイトル画面にいる間は描かない
  renderHeader();
  ({ office: renderOffice, work: renderWork, team: renderTeam, product: renderProduct, legends: renderLegends })[view]();
  updateTimers();
}

// 1秒ごとに残り時間だけ書き換える
function updateTimers() {
  const now = Date.now();
  document.querySelectorAll('[data-ends]').forEach((el) => {
    el.firstElementChild.style.width = pct(Math.min(1, (now - el.dataset.start) / (el.dataset.ends - el.dataset.start)));
  });
  document.querySelectorAll('[data-left]').forEach((el) => (el.textContent = dur(el.dataset.left - now)));
  // 依頼の受付期限：近づくと赤く点滅する
  document.querySelectorAll('[data-expire]').forEach((el) => el.classList.toggle('soon', el.dataset.expire - now < R.OFFER_SOON));
}

// ----- 会社 -----
function hourlyIncome() {
  const ce = G.companyEffects(S);
  return S.products.reduce((a, p) => a + G.productNet(S, p, Date.now(), ce), 0);
}
// 次に会えそうなレジェンド（影）と、いちばん足りない条件を会社の画面の左下に出す。押すとレジェンドタブでその人を光らせる
// 進み具合が同じなら、3Dのできている人・会いやすい人（rarity）を先に。ほかのレジェンドが条件の人は後回し
function nextLegend() {
  const owned = G.ownedLegends(S);
  const order = { R: 0, SR: 1, SSR: 2 };
  const list = [];
  for (const l of LEGENDS) {
    if (owned.has(l.id) || G.leftLegend(S, l.id)) continue;
    const conds = G.meetProgress(S, l.id);
    if (!conds.length) continue;
    const avg = conds.reduce((a, c) => a + c.ratio, 0) / conds.length;
    const cool = (S.met[l.id]?.cooldown ?? 0) > Date.now() ? 1 : 0; // 断られて会えない間の人は後回し
    list.push({ l, conds, avg, key: [-avg, cool, R.LEGEND_RULES[l.id].meet.legends ? 1 : 0, modelIds.has(l.id) ? 0 : 1, order[l.rarity]] });
  }
  list.sort((a, b) => a.key.findIndex((v, i) => v !== b.key[i]) < 0 ? 0 : (([x, y]) => x - y)(a.key.map((v, i) => [v, b.key[i]]).find(([x, y]) => x !== y)));
  return list[0] ?? null;
}
// 条件を満たしたレジェンドは、あとは待つだけ。説明の文は置かず「気配」と砂時計で見せる（2026-10-04 ユーザー指示）
// 断られて会えない間は、会えるまでの残り時間
function legendWait(id) {
  if (!G.meetProgress(S, id).every((c) => c.ok)) return '';
  const cool = S.met[id]?.cooldown ?? 0;
  if (cool > Date.now()) return `<span class="aura cool">${icon('clock')}<span data-left="${cool}">${dur(cool - Date.now())}</span></span>`;
  return `<span class="aura">${icon('hourglass')}気配</span>`;
}
function renderNextLegend(show) {
  const n = show && nextLegend();
  const box = $('#next-legend');
  if (!n) return (box.innerHTML = '');
  // まだのうちで、いちばん進んでいない条件（次にやること）
  const todo = n.conds.filter((c) => !c.ok).sort((a, b) => a.ratio - b.ratio)[0];
  box.innerHTML = `<button class="next-legend ${todo ? '' : 'near'}" id="go-next-legend">
    <span class="nl-thumb"><img data-thumb="${n.l.id}" alt=""></span>
    <span class="nl-main">${todo ? `<small>${esc(todo.label)}</small><i><b style="width:${pct(todo.ratio)}"></b></i>` : legendWait(n.l.id)}</span>
  </button>`;
  fillThumbs(box);
  $('#go-next-legend').onclick = () => {
    $('.tab[data-view="legends"]').click();
    const card = $(`#zukan-grid .card[data-id="${n.l.id}"]`);
    card?.scrollIntoView({ block: 'center' });
    card?.classList.add('pulse');
    setTimeout(() => card?.classList.remove('pulse'), 2400);
  };
}

function renderOffice() {
  office.sync(S);
  const o = R.OFFICES[S.office];
  const floors = S.floors ? `<small>+${S.floors}</small>` : ''; // 増築した回数
  // オフィスの名前と席の数は1つのボタンにまとめ、押すと今のオフィスの詳しいシート。色や形はオフィスの格ごとに変わる（.o0〜.o9）
  $('#office-chips').innerHTML = `<button class="chip chip-office o${Math.min(S.office, 9)}" id="chip-office">${icon(S.office ? 'building' : 'home')}<span class="o-name">${o.name}${floors}</span><span class="o-seats">${icon('people')}${G.seatsUsed(S)}/${G.capacity(S)}</span>${icon('back', 'flip')}</button>`; // 製品の数と稼ぎは会社の画面には出さない（2026-10-04 ユーザー指示。製品タブで見る）
  $('#chip-office').onclick = openOffice;
  const enc = S.encounter;
  $('#encounter').innerHTML = enc
    ? `<button class="encounter" id="go-encounter">${icon('spark', 'spin')}<span>誰かが現れた</span><span class="left" data-left="${enc.until}">${dur(enc.until - Date.now())}</span></button>`
    : '';
  if (enc) $('#go-encounter').onclick = openEncounter;
  renderNextLegend(!enc);
  // CEO の過ごし方（いつもどれか1つ）。右下の小さなアイコンは、それで起きる出来事
  const EVENT_ICON = { legend: 'spark', luck: 'coin', walkin: 'people' };
  // CEO が仕事中は選べない（仕事が終わるまでの時間を上に出す）
  const work = G.ceoWork(S);
  const busyUntil = work?.endsAt ?? 0;
  $('#activity').classList.toggle('locked', Boolean(busyUntil));
  $('#activity').innerHTML = Object.entries(R.ACTIVITIES)
    .map(
      ([id, a]) => `<button class="act ${S.activity === id ? 'active' : ''}" data-act="${id}" ${busyUntil ? 'disabled' : ''}>
        ${icon(a.icon, 'act-ic')}<span>${a.name}</span>${icon(EVENT_ICON[a.event], `act-ev ev-${a.event}`)}${a.offerPerHour ? icon('task', 'act-ev act-ev2 ev-offer') : ''}
      </button>`,
    )
    .join('') + (busyUntil ? `<div class="act-lock"><span class="pill">${icon('task')}<span class="what">仕事中</span><span class="left" data-left="${busyUntil}">${dur(busyUntil - Date.now())}</span></span></div>` : '');
  $('#activity').querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => G.setActivity(S, b.dataset.act) && commit()));
  const next = R.OFFICES[S.office + 1];
  if (next) {
    const okMoney = S.money >= next.cost;
    const okRep = S.rep >= next.rep;
    // 押すと次のオフィスの影（シークレット）と概要が出る。引っ越しはそこから（openNextOffice）
    $('#office-info').innerHTML = `<button class="panel upgrade ${okMoney && okRep ? 'ready' : ''}" id="upgrade">
        ${icon('move')}<span class="grow"><b>${next.name}</b> ${val('people', next.cap)}</span>
        ${val('coin', yen(next.cost), okMoney ? 'ok' : '')}${val('star', next.rep, okRep ? 'ok' : '')}
      </button>`;
    $('#upgrade').onclick = openNextOffice;
  } else {
    // いちばん上の会社のあとは、いくらでも増築（席が増える）
    const cost = G.expandCost(S);
    $('#office-info').innerHTML = `<button class="panel upgrade" id="upgrade" ${S.money >= cost ? '' : 'disabled'}>
        ${icon('plus')}<span class="grow"><b>増築</b> ${val('people', `+${R.FLOOR_CAP}`)}</span>${val('coin', yen(cost), S.money >= cost ? 'ok' : '')}
      </button>`;
    $('#upgrade').onclick = () => G.expand(S, Date.now()) && commit();
  }
}

// 今のオフィスの詳しいシート（2026-10-04 ユーザー指示）。席の埋まり具合・仕事の平均・面接・作れる製品・増築、次のオフィスへ
function openOffice() {
  const o = R.OFFICES[S.office];
  const next = R.OFFICES[S.office + 1];
  const made = Object.entries(R.GENRES).filter(([, g]) => g.office <= S.office);
  const row = (ic, name, v) => `<div class="cmp">${icon(ic)}<small>${name}</small><span class="grow"></span><b>${v}</b></div>`;
  const dlg = $('#assign');
  $('#assign-body').innerHTML = `
    <div class="sheet-head"><b>${o.name}${S.floors ? ` <small class="muted">+${S.floors}</small>` : ''}</b></div>
    <p class="office-about">${o.about}</p>
    ${row('people', '席', `${G.seatsUsed(S)}/${G.capacity(S)}`)}
    ${row('task', '仕事の平均', `${yen(Math.round(G.avgRate(S.office) / 1000) * 1000)}<small>/時</small>`)}
    ${row('people', '面接', `${R.CANDIDATES_PER_DAY[S.office]}<small>人/日</small> Lv${o.lv[0]}〜${o.lv[1]}`)}
    <div class="cmp prods">${icon('box')}<small>製品</small><span class="grow"></span><span class="new-prods">${made.map(([k]) => prodIcon(k)).join('')}</span></div>
    ${next ? `<button class="panel upgrade ${S.money >= next.cost && S.rep >= next.rep ? 'ready' : ''}" id="to-next">${icon('move')}<span class="grow"><b>${next.name}</b></span>${icon('lock')}${icon('back', 'flip')}</button>` : ''}
    <button class="big ghost" id="run-close">OK</button>`;
  if (!dlg.open) dlg.showModal();
  $('#run-close').onclick = () => dlg.close();
  $('#to-next') && ($('#to-next').onclick = openNextOffice);
}
// 次のオフィス：3Dの部屋を黒い影（シークレット）で見せ、広さ・仕事・面接に来る人・作れる製品を今と並べる（2026-10-04 ユーザー指示）
let peek = null; // のぞき見用の3D（1つだけ作って使い回す）
function openNextOffice() {
  const lv = S.office + 1;
  const o = R.OFFICES[lv];
  if (!o) return;
  const now = R.OFFICES[S.office];
  const round = (n) => Math.round(n / 1000) * 1000;
  const okMoney = S.money >= o.cost;
  const okRep = S.rep >= o.rep;
  const fresh = Object.entries(R.GENRES).filter(([, g]) => g.office === lv);
  const row = (ic, name, a, b) => `<div class="cmp">${icon(ic)}<small>${name}</small><span class="grow"></span><span class="was">${a}</span><span class="arrow">→</span><b>${b}</b></div>`;
  const dlg = $('#assign');
  $('#assign-body').innerHTML = `
    <div class="sheet-head"><b>${o.name}</b><span class="muted">${icon('lock')}</span></div>
    <div id="peek-slot"></div>
    <p class="office-about">${o.about}</p>
    ${row('people', '席', G.capacity(S), o.cap)}
    ${row('task', '仕事の平均', `${yen(round(G.avgRate(S.office)))}`, `${yen(round(G.avgRate(lv)))}<small>/時</small>`)}
    ${row('people', '面接', `${R.CANDIDATES_PER_DAY[S.office]}<small>人/日</small> Lv${now.lv[0]}〜${now.lv[1]}`, `${R.CANDIDATES_PER_DAY[lv]}<small>人/日</small> Lv${o.lv[0]}〜${o.lv[1]}`)}
    ${fresh.length ? `<div class="cmp">${icon('box')}<small>製品</small><span class="grow"></span>${fresh.map(([k, g]) => `<span class="new-prod">${prodIcon(k)}${g.name}</span>`).join('')}</div>` : ''}
    <div class="vals center need-move">${val('coin', yen(o.cost), okMoney ? 'ok' : 'bad')}${val('star', `${Math.floor(S.rep)}/${o.rep}`, okRep ? 'ok' : 'bad')}</div>
    <button class="big" id="move-go" ${okMoney && okRep ? '' : 'disabled'}>${icon('move')}引っ越し</button>`;
  if (!peek) {
    const wrap = document.createElement('div');
    wrap.className = 'office-peek';
    const canvas = document.createElement('canvas');
    wrap.append(canvas);
    $('#assign-body').append(wrap); // 大きさが決まってから作る
    peek = { wrap, office: new Office(canvas), level: -1 };
  }
  $('#peek-slot').replaceWith(peek.wrap);
  if (peek.level !== lv) {
    peek.office.buildRoom(lv);
    peek.level = lv;
  }
  // 暗い部屋は明るめに、明るい部屋は暗めに影を作る（どちらも同じくらいの青い影に見えるように）
  const mood = themeOf(lv).mood;
  peek.wrap.dataset.mood = mood === 'night' || mood === 'neon' ? 'dark' : 'light';
  if (!dlg.open) dlg.showModal();
  $('#move-go').onclick = () => {
    if (G.upgradeOffice(S, Date.now())) {
      dlg.close();
      commit();
    }
  };
}

// ----- 仕事 -----
// 宣伝・求人広告の行。出していないときは押すと種類と条件を選ぶシート（openPromo）、出している間は種類・条件と残り時間
function promoRow(kind) {
  const ad = kind === 'ad';
  const until = ad ? S.adUntil : S.prUntil;
  const cls = `panel ad-row ${ad ? '' : 'pr-row'}`;
  if ((until ?? 0) > Date.now()) {
    const g = ad ? G.adGrade(S) : G.prGrade(S);
    // 条件の札（多いときは2つまで出して残りは数）
    const tags = [...(ad ? G.adJobs(S) : []).map((j) => `<span class="cat-tag job-tag">${R.JOBS[j].name}</span>`), ...(ad ? G.adCats(S) : G.prCats(S)).map(catTag)];
    const tag = tags.slice(0, 2).join('') + (tags.length > 2 ? `<span class="cat-tag job-tag">+${tags.length - 2}</span>` : '');
    return `<button class="${cls} on" id="${kind}-on">${icon(g.icon)}<b>${ad ? '求人広告中' : '宣伝中'}</b><small class="promo-name">${g.name}</small>${tag}<span class="grow"></span>${val('hourglass', `<span data-left="${until}">${dur(until - Date.now())}</span>`)}</button>`;
  }
  const min = ad ? G.adCost(S, 0) : G.prCost(S, 0);
  return `<button class="${cls}" id="${kind}" ${S.money < min ? 'disabled' : ''}>${icon('ad')}<b>${ad ? '求人広告' : '宣伝'}</b><span class="grow"></span>${val('coin', `${yen(min)}〜`, S.money >= min ? 'ok' : '')}</button>`;
}
const prRow = () => promoRow('pr');
// 出している宣伝・求人広告のくわしいシート（2026-10-04 ユーザー指示）。種類・効果・条件・残り時間と終わる日時
function openPromoInfo(kind) {
  const ad = kind === 'ad';
  const g = ad ? G.adGrade(S) : G.prGrade(S);
  const until = ad ? S.adUntil : S.prUntil;
  const start = until - g.days * R.DAY;
  const jobs = ad ? G.adJobs(S) : [];
  const cats = ad ? G.adCats(S) : G.prCats(S);
  const comeJobs = jobs.length ? jobs : [...new Set(cats.flatMap(G.catJobs))];
  const end = new Date(until);
  const row = (ic, name, v) => `<div class="cmp">${icon(ic)}<small>${name}</small><span class="grow"></span><b>${v}</b></div>`;
  const bars = `<span class="power">${[1, 2, 3, 4].map((i) => `<i class="${i <= g.power ? 'on' : ''}"></i>`).join('')}</span>`;
  const dlg = $('#assign');
  $('#assign-body').innerHTML = `
    <div class="promo-hero">${icon(g.icon)}<b>${g.name}</b><small>${ad ? '求人広告中' : '宣伝中'}</small></div>
    ${row(ad ? 'people' : 'task', '効果', `${bars} ${ad ? `${Math.round(G.adPerDay(S) * 10) / 10}<small>人/日</small>` : `×${g.boost}`}`)}
    ${cats.length || jobs.length ? `<div class="cmp">${icon('target')}<small>条件</small><span class="grow"></span><span class="promo-tags">${jobs.map((j) => `<span class="cat-tag job-tag">${R.JOBS[j].name}</span>`).join('')}${cats.map(catTag).join('')}</span></div>` : row('target', '条件', '<small>なし</small>')}
    ${ad && cats.length ? `<div class="come-jobs">${comeJobs.map((j) => `<span><img src="assets/jobs/${j}.webp" alt="">${R.JOBS[j].name}</span>`).join('')}</div>` : ''}
    ${row('clock', '終わり', `${end.getMonth() + 1}/${end.getDate()} ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`)}
    ${progress(start, until)}
    <button class="big ghost" id="run-close">OK</button>`;
  updateTimers();
  if (!dlg.open) dlg.showModal();
  $('#run-close').onclick = () => dlg.close();
}
// 宣伝・求人広告の種類（グレード）と条件を選んで出す（2026-10-04 ユーザー指示）
// 種類ごとに費用・効果（棒の数）・長さが違う。条件（種類・職種）をつけると高くなる
function openPromo(kind) {
  const ad = kind === 'ad';
  const list = ad ? R.ADS : R.PRS;
  const costOf = (i, c) => (ad ? G.adCost(S, i, c) : G.prCost(S, i, c));
  const cats = G.catsNow(S);
  let grade = R.DEFAULT_AD;
  let mode = 'none';
  // 条件はいくつでも選べる（いくつ選んでも費用は同じ）
  const pickCats = new Set([cats[0]]);
  const pickJobs = new Set();
  const toggle = (set, k) => (set.has(k) ? set.delete(k) : set.add(k));
  const dlg = $('#assign');
  const bars = (n) => `<span class="power">${icon(ad ? 'people' : 'task')}${[1, 2, 3, 4].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  const draw = () => {
    const cond = mode === 'cat' ? { cats: [...pickCats] } : mode === 'job' ? { jobs: [...pickJobs] } : null;
    const empty = cond && !(cond.cats ?? cond.jobs).length; // 何も選んでいないときは出せない
    const cost = costOf(grade, cond);
    const extra = cost - costOf(grade, null);
    const modes = [['none', 'なし'], ['cat', '種類'], ...(ad ? [['job', '職種']] : [])];
    // 求人の「種類」では、その種類が得意で来る職種を下に出す
    const comeJobs = [...new Set([...pickCats].flatMap(G.catJobs))];
    $('#assign-body').innerHTML = `
      <div class="sheet-head"><b>${ad ? '求人広告' : '宣伝'}</b></div>
      <div class="grades">${list
        .map(
          (g, i) => `<button class="grade ${i === grade ? 'active' : ''}" data-grade="${i}">${icon(g.icon, 'g-ic')}<span class="gname">${g.name}</span>${bars(g.power)}${val('clock', dur(g.days * R.DAY))}${val('coin', yen(costOf(i, null)))}</button>`,
        )
        .join('')}</div>
      <div class="sec">${icon('target')}<b>条件</b></div>
      <div class="seg">${modes
        .map(([k, n]) => `<button class="${mode === k ? 'active' : ''}" data-mode="${k}">${n}${k !== 'none' ? `<small>${icon('coin')}+${Math.round((R.COND_COST[k] - 1) * 100)}%</small>` : ''}</button>`)
        .join('')}</div>
      ${
        mode === 'cat'
          ? `<div class="pchips">${cats.map((c) => `<button class="pchip cat-${c} ${pickCats.has(c) ? 'active' : ''}" data-cat="${c}">${R.CAT_NAMES[c]}</button>`).join('')}</div>${
              ad && comeJobs.length ? `<div class="come-jobs">${comeJobs.map((j) => `<span><img src="assets/jobs/${j}.webp" alt="">${R.JOBS[j].name}</span>`).join('')}</div>` : ''
            }`
          : ''
      }
      ${
        mode === 'job'
          ? `<div class="pjobs">${Object.entries(R.JOBS)
              .map(([k, j]) => `<button class="pjob ${pickJobs.has(k) ? 'active' : ''}" data-job="${k}"><img src="assets/jobs/${k}.webp" alt=""><span>${j.name}</span></button>`)
              .join('')}</div>`
          : ''
      }
      <button class="big" id="promo-go" ${S.money < cost || empty ? 'disabled' : ''}>${icon('coin')}${yen(cost)}${extra > 0 ? `<small>条件 +${yen(extra)}</small>` : ''}</button>`;
    const b = $('#assign-body');
    b.querySelectorAll('[data-grade]').forEach((x) => (x.onclick = () => ((grade = +x.dataset.grade), draw())));
    b.querySelectorAll('[data-mode]').forEach((x) => (x.onclick = () => ((mode = x.dataset.mode), draw())));
    b.querySelectorAll('[data-cat]').forEach((x) => (x.onclick = () => (toggle(pickCats, x.dataset.cat), draw())));
    b.querySelectorAll('[data-job]').forEach((x) => (x.onclick = () => (toggle(pickJobs, x.dataset.job), draw())));
    $('#promo-go').onclick = () => {
      if (!empty && (ad ? G.startAd : G.startPR)(S, Date.now(), grade, cond)) {
        dlg.close();
        commit();
      }
    };
  };
  draw();
  dlg.showModal();
}
function renderWork() {
  S.workSeenAt = Date.now(); // 仕事タブを見た（通知の点を消す）
  renderHeader();
  const byIdM = (id) => S.members.find((m) => m.id === id);
  const running = S.tasks
    .map(
      // タップすると、選ぶ前の仕事と同じように下から詳しいシートが出る（openRunning）
      (t) => `<button class="panel run cat-${t.cat}" data-run="${t.id}"><div class="row1"><b>${catTag(t.cat)}${esc(t.title)}</b><span class="avs">${[...t.members.map(byIdM).filter(Boolean), ...(t.temps ?? [])].map((m) => avatar(m)).join('')}</span></div>
        ${progress(t.startAt, t.endsAt)}</button>`,
    )
    .join('');
  const canWork = G.freeMembers(S).length > 0;
  const offers = S.offers
    .map(
      (o) => `<button class="panel offer cat-${o.cat} ${canWork ? '' : 'off'}" data-offer="${o.id}">
        <span class="offer-top"><b>${o.expiresAt - R.OFFER_LIFE > seenSnap.work ? newTag : ''}${catTag(o.cat)}${esc(o.title)}</b><span class="expire ${o.expiresAt - Date.now() < R.OFFER_SOON ? 'soon' : ''}" data-expire="${o.expiresAt}">${icon('hourglass')}あと<span data-left="${o.expiresAt}">${dur(o.expiresAt - Date.now())}</span></span></span>
        <span class="vals">${val('clock', dur(o.hours * R.HOUR))}${val('people', o.team)}${val('coin', yen(o.reward), 'strong')}${val('star', `+${o.rep}`)}</span>
      </button>`,
    )
    .join('');
  // これまでの仕事：成功した数だけ出し、押すと下からくわしく出る（openHistory）
  // 仕事中と、受けているだけの依頼は分けて出す（2026-10-04 ユーザー指示「分けてわかりやすく」）
  $('#view-work').innerHTML = `
    <div class="work-top"><button class="hist-btn" id="open-history">${icon('check')}${S.counts.tasks}</button></div>
    ${S.tasks.length ? `<div class="work-box running"><div class="sec work-sec">${icon('task')}<b>仕事中</b><span class="count">${S.tasks.length}</span></div>${running}</div>` : ''}
    <div class="sec work-sec">${icon('paper')}<b>依頼</b><span class="count">${S.offers.length}</span></div>
    ${prRow()}
    ${offers || `<p class="empty">${icon('task')}</p>`}`;
  fillThumbs($('#view-work'));
  $('#view-work').querySelectorAll('[data-offer]').forEach((b) => (b.onclick = () => assignTask(+b.dataset.offer)));
  $('#view-work').querySelectorAll('[data-run]').forEach((el) => (el.onclick = () => openRunning(+el.dataset.run)));
  $('#open-history').onclick = () => openHistory();
  $('#pr') && ($('#pr').onclick = () => openPromo('pr'));
  $('#pr-on') && ($('#pr-on').onclick = () => openPromoInfo('pr'));
}

// これまでの仕事。上に種類ごとの成功した回数（レジェンドの出会いの条件と同じ数）、押すとその種類だけにしぼる。下に最近の仕事
function openHistory(cat = null) {
  const dlg = $('#assign');
  const list = (S.history ?? []).filter((h) => !cat || h.cat === cat);
  const ago = (t) => dur(Date.now() - t);
  $('#assign-body').innerHTML = `
    <div class="sheet-head"><b>${icon('check')}${S.counts.tasks}</b><span class="muted">${icon('star')}${S.rep}</span></div>
    <div class="hist-cats">${Object.entries(R.CAT_NAMES)
      .map(([c, name]) => `<button class="hist-cat cat-${c} ${cat === c ? 'on' : ''}" data-cat="${c}"><i></i>${name}<b>${S.counts.cat[c] ?? 0}</b></button>`)
      .join('')}</div>
    <div class="hist-list">${
      list.length
        ? list
            .slice(0, 50)
            .map(
              (h, i) => `<button class="hist-row cat-${h.cat} ${h.ok ? '' : 'ng'}" data-h="${i}"><i></i>
                <span class="hist-main"><b>${esc(h.title)}</b><small>${[...h.who, `${ago(h.t)}前`].map(esc).join('・')}</small></span>
                <span class="hist-vals">${h.ok ? icon('check', 'ok') : icon('error', 'bad')}${h.great ? icon('bolt', 'res-great') : ''}${h.early ? icon('clock', 'res-early') : ''}<b>${h.money == null ? '—' : yen(h.money)}</b>${
                  h.rep == null ? '' : `<small class="${h.rep < 0 ? 'bad' : ''}">${icon('star')}${h.rep > 0 ? '+' : ''}${h.rep}</small>`
                }</span>
              </button>`,
            )
            .join('')
        : `<p class="empty">${icon('task')}</p>`
    }</div>
    <button class="big ghost" id="hist-close">OK</button>`;
  if (!dlg.open) dlg.showModal();
  $('#assign-body').querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => openHistory(cat === b.dataset.cat ? null : b.dataset.cat)));
  $('#hist-close').onclick = () => dlg.close();
  $('#assign-body').querySelectorAll('[data-h]').forEach((b) => (b.onclick = () => openDone(list[+b.dataset.h], () => openHistory(cat))));
}
// 終わった依頼のくわしいシート（2026-10-04 ユーザー指示）。back があれば「戻る」で一覧へ
// 担当・力・成功率・かかった時間はこの機能のあとに終わった依頼だけ（前のものは出せる分だけ）
function openDone(h, back = null) {
  if (!h) return;
  const dlg = $('#assign');
  const row = (ic, name, v) => `<div class="cmp">${icon(ic)}<small>${name}</small><span class="grow"></span><b>${v}</b></div>`;
  const when = new Date(h.t);
  const team = (h.ids ?? []).map((id) => S.members.find((m) => m.id === id)).filter(Boolean);
  $('#assign-body').innerHTML = `
    <div class="done-head ${h.ok ? 'ok' : 'bad'}">${catTag(h.cat)}<b>${esc(h.title)}</b><span class="res-tag">${h.ok ? '成功' : '失敗'}</span></div>
    ${h.money == null ? '' : `<div class="preview">${val('coin', `+${yen(h.money)}`, h.ok ? 'ok' : '')}${h.rep == null ? '' : val('star', `${h.rep > 0 ? '+' : ''}${h.rep}`, h.rep < 0 ? 'bad' : '')}${h.great ? icon('bolt', 'res-great') : ''}${h.early ? icon('clock', 'res-early') : ''}</div>`}
    ${h.power != null ? `<div class="need ${h.power >= h.diff ? 'full' : ''}">${icon('bolt')}<span class="need-bar"><i style="width:${pct(Math.min(1, h.power / h.diff))}"></i></span><span class="need-num"><b>${h.power}</b>/${h.diff}</span></div>` : ''}
    ${h.chance != null ? row('target', '成功率', pct(h.chance)) : ''}
    ${h.took != null ? row('clock', '時間', `${dur(Math.max(0, h.took))}<small> / ${dur(h.hours * R.HOUR)}</small>`) : ''}
    ${h.who?.length ? `<div class="cmp">${icon('people')}<small>${h.who.length + (h.temps ?? 0)}</small><span class="grow"></span>${
      team.length ? `<span class="avs">${team.map((m) => avatar(m)).join('')}</span>` : `<span class="muted">${h.who.map(esc).join('・')}</span>`
    }${h.temps ? `<span class="muted">+${h.temps}</span>` : ''}</div>` : ''}
    ${row('check', '完了', `${when.getMonth() + 1}/${when.getDate()} ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`)}
    <div class="sheet-btns">${back ? `<button class="big ghost" id="done-back">${icon('back')}</button>` : ''}<button class="big ghost" id="run-close">OK</button></div>`;
  fillThumbs($('#assign-body'));
  if (!dlg.open) dlg.showModal();
  $('#run-close').onclick = () => dlg.close();
  $('#done-back') && ($('#done-back').onclick = back);
}

// 仕事中の仕事の詳しいシート：担当している人と力、見込み（成功率・かかる時間・報酬・評判）、進み具合。空きがあれば人を足せる
function openRunning(taskId) {
  const t = S.tasks.find((x) => x.id === taskId);
  if (!t) return;
  const dlg = $('#assign');
  const team = [...t.members.map((id) => S.members.find((m) => m.id === id)).filter(Boolean), ...(t.temps ?? [])];
  const power = (m) => Math.round(G.teamPower(S, [m], t.w, G.goodJobs(t)));
  const sum = team.reduce((a, m) => a + power(m), 0);
  const p = G.taskPreview(S, t, t.members.filter((id) => S.members.some((m) => m.id === id)));
  const room = team.length < t.team;
  $('#assign-body').innerHTML = `
    <div class="sheet-head"><b>${esc(t.title)}</b><span class="muted">${icon('people')}${team.length}/${t.team}</span></div>
    <div class="need ${sum >= t.diff ? 'full' : ''}">${icon('bolt')}<span class="need-bar"><i style="width:${pct(Math.min(1, sum / t.diff))}"></i></span><span class="need-num"><b>${sum}</b>/${t.diff}</span></div>
    <div class="pick">${team
      .map(
        (m, i) => `<div class="person ${m.kind === 'temp' ? 'temp' : ''} active" data-prof="${i}">
          ${avatar(m)}<span class="pname">${esc(G.displayName(m))}<small>${jobShort(m)} Lv${m.level}${m.kind === 'temp' ? '・SES' : ''}${hakenTag(m)}</small></span><span class="pw ${G.isGood(m, G.goodJobs(t)) ? 'good' : ''}">${G.isGood(m, G.goodJobs(t)) ? goodTag : ''}${icon('bolt')}${power(m)}</span>
        </div>`,
      )
      .join('')}</div>
    <div class="preview">${val('target', pct(p.chance), p.chance < 0.5 ? 'bad' : p.chance >= 0.8 ? 'ok' : '')}${val('clock', dur(t.endsAt - t.startAt))}${val('coin', yen(p.reward))}${val('star', `+${p.rep}`, p.great || p.early ? 'ok' : '')}</div>
    ${progress(t.startAt, t.endsAt)}
    ${room ? `<button class="big" id="run-add">${icon('plus')}${icon('people')}</button>` : `<button class="big ghost" id="run-close">OK</button>`}`;
  fillThumbs($('#assign-body'));
  updateTimers();
  $('#assign-body').querySelectorAll('[data-prof]').forEach((el) => (el.onclick = () => openProfile(team[+el.dataset.prof])));
  if (!dlg.open) dlg.showModal();
  if (room)
    $('#run-add').onclick = () => {
      dlg.close();
      addMembers(taskId);
    };
  else $('#run-close').onclick = () => dlg.close();
}

// 仕事中の仕事に人を足す（派遣も。足した分だけ残りが早く進む）
function addMembers(taskId) {
  const t = S.tasks.find((x) => x.id === taskId);
  const base = [...t.members.map((id) => S.members.find((m) => m.id === id)).filter(Boolean), ...(t.temps ?? [])];
  const have = t.temps?.length ?? 0;
  const left = (ids, temps) => {
    const done = Math.min(1, Math.max(0, (Date.now() - t.startAt) / (t.endsAt - t.startAt)));
    return (1 - done) * G.taskPreview(S, t, [...t.members, ...ids], [...(t.temps ?? []), ...temps]).duration;
  };
  openAssign({
    title: t.title,
    max: t.team - base.length,
    w: t.w,
    good: G.goodJobs(t),
    need: t.diff,
    base,
    minOwn: 0,
    go: '追加',
    temp: { make: (i) => G.makeTemp(S, t, have + i), fee: G.tempFee(t) },
    preview: (ids, temps) => {
      const p = G.taskPreview(S, t, [...t.members, ...ids], [...(t.temps ?? []), ...temps]);
      return `${val('target', pct(p.chance), p.chance < 0.5 ? 'bad' : p.chance >= 0.8 ? 'ok' : '')}${val('clock', dur(left(ids, temps)), 'ok')}${val('coin', yen(p.reward))}${val('star', `+${p.rep}`)}`;
    },
    confirm: (ids, temps) => G.addToTask(S, taskId, ids, Date.now(), temps.length),
  });
}

function assignTask(offerId) {
  const o = S.offers.find((x) => x.id === offerId);
  if (!o) return;
  // 手の空いた人がいないときも、依頼の中身は見られる（2026-10-04 ユーザー指示）
  const free = G.freeMembers(S).length > 0;
  const good = G.goodJobs(o)
    .map((j) => `<span><img src="assets/jobs/${j}.webp" alt="">${R.JOBS[j].name}</span>`)
    .join('');
  openAssign({
    title: o.title,
    extra: `<div class="offer-facts">${catTag(o.cat)}${val('clock', dur(o.hours * R.HOUR))}${val('people', o.team)}${val('coin', yen(o.reward), 'strong')}${val('star', `+${o.rep}`)}<span class="expire ${o.expiresAt - Date.now() < R.OFFER_SOON ? 'soon' : ''}" data-expire="${o.expiresAt}">${icon('hourglass')}<span data-left="${o.expiresAt}">${dur(o.expiresAt - Date.now())}</span></span></div>
      ${good ? `<div class="offer-good">${icon('bolt')}${good}</div>` : ''}
      ${free ? '' : `<div class="all-busy">${icon('people')}全員仕事中</div>`}`,
    max: o.team,
    w: o.w,
    good: G.goodJobs(o),
    need: o.diff,
    // 要員派遣（お金を払って、席の数を超えて仕事の間だけ人を借りる）
    temp: free ? { make: (i) => G.makeTemp(S, o, i), fee: G.tempFee(o) } : null,
    preview: (ids, temps) => {
      const p = G.taskPreview(S, o, ids, temps);
      return `${val('target', pct(p.chance), p.chance < 0.5 ? 'bad' : p.chance >= 0.8 ? 'ok' : '')}${val('clock', dur(p.duration), p.early ? 'ok' : '')}${val('coin', yen(p.reward))}${val('star', `+${p.rep}`, p.great || p.early ? 'ok' : '')}`;
    },
    confirm: (ids, temps) => G.startTask(S, offerId, ids, Date.now(), temps.length),
    // 受けない依頼はお断りして一覧から消せる
    decline: {
      label: 'お断り',
      run: async () => (await ask({ head: `${catTag(o.cat)}<b>${esc(o.title)}</b>`, text: 'この依頼をお断りしますか？', ok: 'お断り' })) && G.declineOffer(S, offerId, Date.now()),
    },
  });
}

// ゲームの見た目の確認（ブラウザの確認の窓の代わり）。はい→true / やめる→false
// head: 上に出す絵や札（HTML）、text: 一言、ok: はいのボタンの文字
const askEl = document.createElement('dialog');
askEl.id = 'ask';
document.body.append(askEl);
// ゲームの見た目の確認（ブラウザの窓の代わり）。cancel が null ならボタン1つ、safe なら赤くしない
let askEnd = null;
function ask({ head = '', text, ok, cancel = 'やめる', safe = false }) {
  askEl.innerHTML = `${head ? `<div class="ask-head">${head}</div>` : ''}<p class="ask-text">${esc(text)}</p>
    <div class="ask-btns">${cancel == null ? '' : `<button class="big ghost" data-a="0">${esc(cancel)}</button>`}<button class="big ${safe ? '' : 'danger'}" data-a="1">${esc(ok)}</button></div>`;
  askEnd?.(false); // 前の確認が開いていたら「やめる」扱いで閉じる
  if (!askEl.open) askEl.showModal();
  return new Promise((done) => {
    const end = (v) => {
      askEnd = null;
      askEl.close();
      done(v);
    };
    askEnd = end;
    askEl.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => end(b.dataset.a === '1')));
    askEl.oncancel = (e) => {
      e.preventDefault();
      end(false);
    };
  });
}
const personHead = (m) => `${avatar(m)}<b>${esc(m.name)}</b><small>${jobShort(m)} Lv${m.level}</small>`;
const askSlot = (n, st) => `<span class="slot-no">${n}</span><b>${esc(st.company)}</b>`;
const askReject = (m) => ask({ head: personHead(m), text: '不採用にしますか？', ok: '不採用' });

// 人を選ぶ（仕事・開発で共通）。下から出るシート
// temp があれば要員派遣の人も選べる（自分の会社から minOwn 人は出す）
// base は仕事中に人を足すときの、もう働いている人（max は足せる人数）
function openAssign({ title, max, w, good = [], need, preview, confirm, temp = null, base = [], minOwn = 1, go = '任せる', extra = '', decline = null }) {
  const dlg = $('#assign');
  const chosen = new Set();
  let nTemps = 0;
  const power = (m) => Math.round(G.teamPower(S, [m], w, good));
  const free = G.freeMembers(S).sort((a, b) => power(b) - power(a));
  // 力。その依頼が得意な職種の人は「得意」の札を添えて緑に
  const pw = (m) => `<span class="pw ${G.isGood(m, good) ? 'good' : ''}">${G.isGood(m, good) ? goodTag : ''}${icon('bolt')}${power(m)}</span>`;
  const draw = () => {
    // 席に空きがあるうちは派遣の人を減らし、自分の会社の人を優先する
    nTemps = Math.max(0, Math.min(nTemps, max - Math.max(minOwn, chosen.size)));
    const ids = [...chosen];
    const temps = temp ? Array.from({ length: nTemps }, (_, i) => temp.make(i)) : [];
    // 選んだ人の力の合計と、この仕事に必要な力（ゲージがいっぱいになれば十分）
    const sum = ids.reduce((a, id) => a + power(free.find((m) => m.id === id)), 0) + [...temps, ...base].reduce((a, m) => a + power(m), 0);
    const size = base.length + chosen.size + nTemps;
    const ready = ids.length >= Math.max(minOwn, 1) || (minOwn === 0 && nTemps > 0);
    // 派遣：借りている人（押すと帰す）と、もう1人借りるボタン
    const room = temp && Math.max(minOwn, chosen.size) + nTemps < max;
    const canMore = room && S.money >= temp.fee * (nTemps + 1);
    const profs = []; // 顔を押すとその人の詳しい画面
    const face = (m) => `<span class="av-tap" data-prof="${profs.push(m) - 1}">${avatar(m)}</span>`;
    const tempRow = (m, on) => `<button class="person temp ${on ? 'active' : ''}" data-temp="${on ? 'drop' : 'add'}" ${on || canMore ? '' : 'disabled'}>
        ${face(m)}<span class="pname">${esc(m.name)}<small>${R.JOBS[m.job].name} Lv${m.level}</small></span><span class="fee">${icon('coin')}${yen(temp.fee)}</span>${pw(m)}
      </button>`;
    const tempHtml = temp ? `<div class="sec temp-head">${icon('plus')}<b>SES</b></div>${temps.map((m) => tempRow(m, true)).join('')}${room ? tempRow(temp.make(nTemps), false) : ''}` : '';
    $('#assign-body').innerHTML = `
      <div class="sheet-head"><b>${esc(title)}</b><span class="muted">${icon('people')}${size}/${max > 20 ? free.length : base.length + max}</span></div>
      ${extra}
      <div class="need ${sum >= need ? 'full' : ''}">${icon('bolt')}<span class="need-bar"><i style="width:${pct(Math.min(1, sum / need))}"></i></span><span class="need-num"><b>${sum}</b>/${need}</span></div>
      <div class="pick">${free
        .map(
          (m) => `<button class="person ${chosen.has(m.id) ? 'active' : ''}" data-id="${m.id}">
            ${face(m)}<span class="pname">${esc(G.displayName(m))}<small>${jobShort(m)} Lv${m.level}${hakenTag(m)}</small></span>${pw(m)}
          </button>`,
        )
        .join('')}${tempHtml}</div>
      <div class="preview">${ready ? preview(ids, temps) : '&nbsp;'}</div>
      <button class="big" id="assign-go" ${ready ? '' : 'disabled'}>${go}${nTemps ? ` <small>${icon('coin')}-${yen(temp.fee * nTemps)}</small>` : ''}</button>
      ${decline ? `<button class="decline" id="assign-decline">${decline.label}</button>` : ''}`;
    fillThumbs($('#assign-body'));
    $('#assign-body').querySelectorAll('[data-prof]').forEach(
      (el) =>
        (el.onclick = (e) => {
          e.stopPropagation(); // 選ぶ・外すにはしない
          openProfile(profs[+el.dataset.prof]);
        }),
    );
    $('#assign-body').querySelectorAll('.person[data-id]').forEach(
      (b) =>
        (b.onclick = () => {
          const id = +b.dataset.id;
          if (chosen.has(id)) chosen.delete(id);
          else if (chosen.size < max) chosen.add(id); // 派遣の人があふれたら draw で減らす
          draw();
        }),
    );
    $('#assign-body').querySelectorAll('[data-temp]').forEach(
      (b) =>
        (b.onclick = () => {
          nTemps += b.dataset.temp === 'add' ? 1 : -1;
          draw();
        }),
    );
    $('#assign-decline') &&
      ($('#assign-decline').onclick = async () => {
        if (await decline.run()) {
          dlg.close();
          commit();
        }
      });
    $('#assign-go').onclick = () => {
      if (confirm([...chosen], temps)) {
        dlg.close();
        commit();
      }
    };
  };
  draw();
  dlg.showModal();
}

// ----- 仲間 -----
function memberRow(m, { candidate = false } = {}) {
  const st = candidate ? m.stats : G.statsOf(S, m);
  const status = candidate ? '' : `<i class="st-dot ${m.busy ? 'busy' : 'free'}"></i>`;
  const hireBtn = () => {
    const cost = G.hireCost(S, m);
    const can = G.seatsUsed(S) < G.capacity(S) && S.money >= cost;
    const wait = `<span class="muted">${val('clock', `<span data-left="${m.until}">${dur(m.until - Date.now())}</span>`)}</span>`; // 辞退するまでの時間
    return `${wait}<span class="cand-btns"><button class="btn ghost reject" data-reject="${m.id}">不採用</button><button class="btn hire" data-hire="${m.id}" ${can ? '' : 'disabled'}>採用 ${yen(cost)}</button></span>`;
  };
  return `<div class="member ${m.kind} ${m.walkin ? 'walkin' : ''}">
    <button class="mrow" data-open="${m.id}">${avatar(m)}${status}
      <span class="pname">${candidate && (m.at ?? 0) > seenSnap.team ? newTag : ''}${esc(G.displayName(m))}<small>${jobShort(m)} Lv${m.level}${hakenTag(m)}${G.isTired(m) ? icon('drop', 'tired-ic') : ''}${
        m.haken ? `<span class="haken-left">${icon('hourglass')}<span data-left="${m.haken.until}">${dur(m.haken.until - Date.now())}</span></span>` : ''
      }</small></span>
      ${statBars(st)}
    </button>
    ${
      candidate
        ? `<div class="more"><span class="perk">${esc(perkText(m))}</span>${
            m.salary ? `<span class="muted">${val('wallet', `${yen(m.salary)}/日`)}</span>` : ''
          }${!candidate && m.kind === 'staff' ? `<button class="btn fire" data-dismiss="${m.id}" ${m.busy ? 'disabled' : ''}>FIRE</button>` : ''}${
            m.kind === 'legend' ? `<button class="link small" data-legend="${m.legend}">見る</button>` : ''
          }${candidate ? hireBtn() : ''}</div>`
        : ''
    }
  </div>`;
}
// 仲間（CEO・社員）や面接に来た人のくわしい画面。目的は、その職種がどんな仕事かがわかること
// 人の詳しい画面（レジェンドはレジェンドの画面）。人選びのシートの上からも開ける
const openProfile = (m) => (m.kind === 'legend' ? openLegend(m.legend) : openMember(m));
// 派遣の人の契約（残り・1日の料金・更新・紹介予定派遣なら社員にする）
function hakenInfo(m) {
  const h = m.haken;
  const cost = G.hireCost(S, { ...m, salary: m.wage, intro: true });
  return `<div class="haken-info">
    <div class="vals">${hakenTag(m)}${val('hourglass', `<span data-left="${h.until}">${dur(h.until - Date.now())}</span>`)}${val('wallet', `${yen(h.daily)}/日`)}</div>
    <div class="sec">${icon('back', 'flip')}<b>更新</b></div>
    <div class="seg">${R.HAKEN_DAYS.map((d) => `<button data-renew="${d}" ${S.money >= h.daily * d ? '' : 'disabled'}>${d}日<small>${yen(h.daily * d)}</small></button>`).join('')}</div>
    ${h.intro ? `<button class="big" id="m-intro" ${S.money >= cost ? '' : 'disabled'}>${icon('people')}社員にする ${yen(cost)}</button>` : ''}
  </div>`;
}
// 疲れの棒（たまると赤く。印が出る所に線）
const tiredBar = (m) =>
  `<div class="tired-bar ${G.isTired(m) ? 'on' : ''}">${icon('drop')}<i><b style="width:${pct((m.tired ?? 0) / 100)}"></b><u style="left:${R.TIRED_WARN}%"></u></i></div>`;
function openMember(m, candidate = false) {
  if (!m) return;
  const j = R.JOBS[m.job];
  const st = candidate ? m.stats : G.statsOf(S, m);
  const cost = candidate ? G.hireCost(S, m) : 0;
  const canHire = candidate && G.seatsUsed(S) < G.capacity(S) && S.money >= cost;
  $('#detail-info').innerHTML = `<h2>${esc(G.displayName(m))}</h2><div class="sub">${j.full}</div>
    <p class="job-desc">${esc(j.desc)}</p>
    <div class="ability">${esc(j.perkText)}</div>
    <div class="good-line">${icon('bolt')}${esc(j.goodText)}の依頼が得意</div>
    <div class="lvrow">Lv${m.level} ${statBars(st)}</div>
    ${m.salary ? `<div class="vals">${val('wallet', `${yen(m.salary)}/日`)}</div>` : ''}
    ${!candidate && G.canTire(m) ? tiredBar(m) : ''}
    ${m.haken ? hakenInfo(m) : ''}
    ${candidate ? `${hakenTag(m) ? `<div class="vals">${hakenTag(m)}</div>` : ''}<button class="big" id="m-hire" ${canHire ? '' : 'disabled'}>採用 ${yen(cost)}</button><button class="decline" id="m-reject">不採用</button>` : ''}
    ${!candidate && m.kind === 'staff' && !m.haken ? `<button class="btn fire" id="m-fire" ${m.busy ? 'disabled' : ''}>FIRE</button>` : ''}`;
  $('#m-reject') &&
    ($('#m-reject').onclick = async () => {
      if ((await askReject(m)) && G.rejectCandidate(S, m.id, Date.now())) {
        $('#detail').close();
        commit();
      }
    });
  $('#m-hire') &&
    ($('#m-hire').onclick = () => {
      if (G.hire(S, m.id, Date.now())) {
        $('#detail').close();
        commit();
      }
    });
  $('#detail-info')
    .querySelectorAll('[data-renew]')
    .forEach(
      (b) =>
        (b.onclick = () => {
          if (G.renewHaken(S, m.id, +b.dataset.renew, Date.now())) {
            commit();
            openMember(m);
          }
        }),
    );
  $('#m-intro') &&
    ($('#m-intro').onclick = () => {
      if (G.hireHaken(S, m.id, Date.now())) {
        commit();
        openMember(m);
      }
    });
  $('#m-fire') &&
    ($('#m-fire').onclick = async () => {
      if ((await ask({ head: personHead(m), text: 'FIRE しますか？', ok: 'FIRE' })) && G.dismiss(S, m.id, Date.now())) {
        $('#detail').close();
        commit();
      }
    });
  detailStage ??= new Stage($('#detail-canvas'));
  detailToken = {};
  $('#detail-canvas').parentElement.querySelector('.silhouette')?.remove();
  $('#detail').showModal();
  const body = buildPerson(m.look, m.job, { ceo: m.kind === 'hero' });
  detailStage.setCharacter(body);
  body.scale.setScalar(0.88); // CEO の頭の上の印が切れないよう少し小さく
}
// 派遣: 期間を決めて人を借りる（2026-10-06 ユーザー指示）。席を使い、どの仕事にも回せる。紹介予定派遣なら安く社員にできる
function hakenRow() {
  const min = Math.min(...Object.keys(R.JOBS).map((j) => G.hakenDaily(G.hakenPerson(S, j), false) * R.HAKEN_DAYS[0]));
  const can = G.seatsUsed(S) < G.capacity(S) && S.money >= min;
  return `<button class="panel ad-row haken-row" id="haken" ${can ? '' : 'disabled'}>${icon('people')}<b>派遣</b><span class="grow"></span>${val('coin', `${yen(min)}〜`, can ? 'ok' : '')}</button>`;
}
function openHaken() {
  let job = Object.keys(R.JOBS)[0];
  let days = R.HAKEN_DAYS[1];
  let intro = false;
  const dlg = $('#assign');
  const draw = () => {
    const m = G.hakenPerson(S, job);
    const daily = G.hakenDaily(m, intro);
    const cost = daily * days;
    const seat = G.seatsUsed(S) < G.capacity(S);
    $('#assign-body').innerHTML = `
      <div class="sheet-head"><b>派遣</b><span class="muted">${val('home', `${G.seatsUsed(S)}/${G.capacity(S)}`)}</span></div>
      <div class="pjobs">${Object.entries(R.JOBS)
        .map(([k, j]) => `<button class="pjob ${k === job ? 'active' : ''}" data-job="${k}"><img src="assets/jobs/${k}.webp" alt=""><span>${j.name}</span></button>`)
        .join('')}</div>
      <div class="haken-who">${avatar(m)}<span class="pname">${esc(m.name)}<small>${jobShort(m)} Lv${m.level}</small></span>${statBars(m.stats)}</div>
      <div class="sec">${icon('clock')}<b>期間</b></div>
      <div class="seg">${R.HAKEN_DAYS.map((d) => `<button class="${d === days ? 'active' : ''}" data-days="${d}">${d}日</button>`).join('')}</div>
      <div class="seg haken-kind">
        <button class="${intro ? '' : 'active'}" data-intro="0">派遣</button>
        <button class="${intro ? 'active' : ''}" data-intro="1">紹介予定派遣<small>${icon('coin')}+${Math.round((R.HAKEN_INTRO - 1) * 100)}%</small></button>
      </div>
      ${intro ? `<div class="intro-line">${icon('people')}社員に<b>${yen(G.hireCost(S, { ...m, salary: m.wage, intro: true }))}</b><s>${yen(G.hireCost(S, { ...m, salary: m.wage }))}</s></div>` : ''}
      <div class="vals center">${val('wallet', `${yen(daily)}/日`)}</div>
      <button class="big" id="haken-go" ${seat && S.money >= cost ? '' : 'disabled'}>${icon('coin')}${yen(cost)}</button>`;
    fillThumbs($('#assign-body'));
    const b = $('#assign-body');
    b.querySelectorAll('[data-job]').forEach((x) => (x.onclick = () => ((job = x.dataset.job), draw())));
    b.querySelectorAll('[data-days]').forEach((x) => (x.onclick = () => ((days = +x.dataset.days), draw())));
    b.querySelectorAll('[data-intro]').forEach((x) => (x.onclick = () => ((intro = x.dataset.intro === '1'), draw())));
    $('#haken-go').onclick = () => {
      if (G.startHaken(S, job, days, intro, Date.now())) {
        dlg.close();
        commit();
      }
    };
  };
  draw();
  dlg.showModal();
}
// 求人広告: お金を出すと、期限つきで面接に来る人が増える（種類と条件は openPromo で選ぶ）
const adRow = () => promoRow('ad');
function renderTeam() {
  S.teamSeenAt = Date.now(); // 仲間タブを見た（通知の点を消す）
  renderHeader();
  const v = $('#view-team');
  v.innerHTML = `
    <div class="list">${S.members.map((m) => memberRow(m)).join('')}</div>
    <div class="sec interview">${icon('people')}<b>面接</b><span class="grow"></span>${val('home', `${G.seatsUsed(S)}/${G.capacity(S)}`)}${val('clock', `<span data-left="${S.candAt + R.CANDIDATE_EVERY}">${dur(S.candAt + R.CANDIDATE_EVERY - Date.now())}</span>`)}</div>
    ${adRow()}
    ${hakenRow()}
    <div class="list">${
      S.candidates.length
        ? S.candidates.map((c) => memberRow(c, { candidate: true })).join('')
        : `<button class="panel hint-meetup" id="go-meetup">${icon('seminar')}<span>${R.ACTIVITIES.meetup.name}</span></button>`
    }</div>`;
  fillThumbs(v);
  v.querySelectorAll('[data-open]').forEach(
    (b) =>
      (b.onclick = (e) => {
        if (e.target.closest('[data-hire], [data-reject]')) return;
        const id = +b.dataset.open;
        const m = S.members.find((x) => x.id === id);
        if (m?.kind === 'legend') return openLegend(m.legend);
        // 仲間・面接に来た人は、レジェンドのように詳しい画面で（3Dの姿・職種の仕事・力）
        openMember(m ?? S.candidates.find((x) => x.id === id), !m);
      }),
  );
  // 面接に来る人がいないときは、勉強会へ（会社タブに移って勉強会を選ぶ）
  $('#go-meetup') &&
    ($('#go-meetup').onclick = () => {
      if (!G.ceoBusyUntil(S)) G.setActivity(S, 'meetup');
      save();
      document.querySelector('.tab[data-view="office"]').click();
    });
  $('#ad') && ($('#ad').onclick = () => openPromo('ad'));
  $('#haken') && ($('#haken').onclick = () => openHaken());
  $('#ad-on') && ($('#ad-on').onclick = () => openPromoInfo('ad'));
  v.querySelectorAll('[data-hire]').forEach((b) => (b.onclick = () => G.hire(S, +b.dataset.hire, Date.now()) && commit()));
  v.querySelectorAll('[data-reject]').forEach(
    (b) =>
      (b.onclick = async () => {
        const m = S.candidates.find((c) => c.id === +b.dataset.reject);
        if (m && (await askReject(m)) && G.rejectCandidate(S, m.id, Date.now())) commit();
      }),
  );
  v.querySelectorAll('[data-dismiss]').forEach(
    (b) =>
      (b.onclick = async () => {
        const m = S.members.find((x) => x.id === +b.dataset.dismiss);
        if (m && (await ask({ head: personHead(m), text: 'FIRE しますか？', ok: 'FIRE' })) && G.dismiss(S, m.id, Date.now())) commit();
      }),
  );
  v.querySelectorAll('[data-legend]').forEach((b) => (b.onclick = () => openLegend(b.dataset.legend)));
}

// ----- 製品 -----
function trendIcon(x) {
  if (x >= 1.45) return icon('up2', 't up2');
  if (x >= 1.1) return icon('up', 't up');
  if (x >= 0.85) return icon('flat', 't');
  return icon('down', 't down');
}
// ブランド力の倍率（×1.8 / ×10 / ×198）
const brandNum = (x) => (x < 10 ? x.toFixed(1).replace(/\.0$/, '') : Math.round(x).toLocaleString('ja-JP'));
// 種類のボタンに、ブランド力で売上が増える製品だけ倍率を出す
function brandVal(genre) {
  const x = G.brand(S, genre);
  return x > 1 ? val('building', `×${brandNum(x)}`, 'ok') : '';
}
function renderProduct() {
  const now = Date.now();
  const ce = G.companyEffects(S);
  const next = G.trendEndsAt(S, now);
  const seeNext = ce.nextTrend > 0;
  const canStart = G.freeMembers(S).length > 0;
  // 先の製品は、次の会社の分まで（鍵つき）だけ見せる
  const genres = Object.entries(R.GENRES)
    .filter(([, g]) => g.office <= S.office + 1)
    .map(([k, g]) => {
      const locked = S.office < g.office;
      // 同じ種類は PRODUCT_MAX まで（開発中も数える）。持っていれば「2/3」のように出す
      const n = G.genreCount(S, k);
      const full = n >= R.PRODUCT_MAX;
      return `<button class="panel genre${full ? ' full' : ''}" data-genre="${k}" ${locked || full || !canStart || S.money < g.cost ? 'disabled' : ''}>
        <span class="gname">${prodIcon(k, 'small')}<span>${locked ? icon('lock') : ''}${g.name}</span></span>
        <span class="trend">${trendIcon(G.trendAt(S, k, now))}${seeNext ? `<span class="arrow">→</span>${trendIcon(G.trendAt(S, k, next + 1))}` : ''}</span>
        <span class="vals">${val('coin', yen(g.cost))}${val('clock', dur(g.hours * R.HOUR))}${n ? val('box', `${n}/${R.PRODUCT_MAX}`, full ? 'bad' : '') : ''}${brandVal(k)}</span>
      </button>`;
    })
    .join('');
  // 開発中の製品：タップすると担当者・出来の見込み・稼ぎの見込みが下から出る（openDevRunning）
  const devs = S.devs
    .map(
      (d) => `<button class="panel run" data-dev="${d.id}"><div class="row1"><b>${R.GENRES[d.genre].name}</b><span class="avs">${d.members
        .map((id) => S.members.find((m) => m.id === id))
        .filter(Boolean)
        .map((m) => avatar(m))
        .join('')}</span></div>${progress(d.startAt, d.endsAt)}</button>`,
    )
    .join('');
  // 発売した製品：アプリのアイコンのような絵・名前・出来・1時間のもうけ（維持費を引いたもの）・これまでの稼ぎ（新しい順）
  // 稼ぎが維持費を下回ったら赤字の札（売却・販売終了のしどき）
  const products = [...S.products]
    .reverse()
    .map((p) => {
      const net = G.productNet(S, p, now, ce);
      return `<button class="panel prod${net < 0 ? ' red' : ''}" data-prod="${p.id}">
        ${prodIcon(p.genre)}
        <span class="prod-main"><b>${esc(p.name)}</b><small>${R.GENRES[p.genre].name}</small>${rating(p.q)}</span>
        <span class="prod-earn">${net < 0 ? '<span class="red-tag">赤字</span>' : ''}<b>${signYen(net)}<small>/時</small></b><small>${icon('wallet')}${yen(p.earned ?? 0)}</small></span>
      </button>`;
    })
    .join('');
  $('#view-product').innerHTML = `
    <div class="sec">${icon('clock')}<span data-left="${next}">${dur(next - Date.now())}</span></div>
    <div class="genres">${genres}</div>
    ${devs}
    ${S.products.length ? `<div class="sec prod-head">${icon('box')}<b>自社製品</b><span class="grow"></span>${val('coin', `${signYen(hourlyIncome())}/時`, hourlyIncome() >= 0 ? 'ok' : 'bad')}</div>${products}` : ''}`;
  const v = $('#view-product');
  v.querySelectorAll('[data-genre]').forEach((b) => (b.onclick = () => assignDev(b.dataset.genre)));
  fillThumbs(v);
  v.querySelectorAll('[data-dev]').forEach((el) => (el.onclick = () => openDevRunning(+el.dataset.dev)));
  v.querySelectorAll('[data-prod]').forEach((b) => (b.onclick = () => openProduct(+b.dataset.prod)));
}

function assignDev(genre) {
  const g = R.GENRES[genre];
  openAssign({
    title: g.name,
    max: 99,
    w: g.w,
    need: g.need,
    extra: `<div class="vals center">${val('coin', yen(g.cost))}${trendIcon(G.trendAt(S, genre, Date.now()))}</div>`,
    preview: (ids) => {
      const p = G.devPreview(S, genre, ids);
      return `${rating(p.quality * 0.6)}<span class="muted">〜</span>${rating(p.quality * 1.4)}${val('clock', dur(p.duration))}`;
    },
    confirm: (ids) => G.startDev(S, genre, ids, Date.now()),
  });
}

// 発売した製品のくわしい画面（2026-10-04 ユーザー指示）。稼ぎ・開発費をどれだけ取り戻したか・発売からの稼ぎの移り変わり・作った人
// 販売終了もここから（一覧の × は押し間違えやすいのでやめた）。もうけがあるうちにやめると売却でお金が入る（2026-10-07）
function openProduct(id) {
  const p = S.products.find((x) => x.id === id);
  if (!p) return;
  const g = R.GENRES[p.genre];
  const now = Date.now();
  const ce = G.companyEffects(S);
  const by = (p.by ?? []).map((i) => S.members.find((m) => m.id === i)).filter(Boolean);
  // 発売から今までの1時間の稼ぎ（流行の変わり目で上下し、だんだん減っていく）
  const N = 60;
  const age = Math.max(1, now - p.launchedAt);
  const pts = Array.from({ length: N + 1 }, (_, i) => G.productIncome(S, p, p.launchedAt + (age * i) / N, ce));
  const upkeep = G.productUpkeep(p);
  const top = Math.max(upkeep, ...pts) || 1;
  const xy = pts.map((v, i) => `${((i / N) * 300).toFixed(1)},${(76 - (v / top) * 70).toFixed(1)}`).join(' ');
  const upY = (76 - (upkeep / top) * 70).toFixed(1); // 維持費の線（下回ると赤字）
  const net = G.productNet(S, p, now, ce);
  const price = G.sellPrice(S, p, now, ce);
  const back = (p.earned ?? 0) / g.cost; // 開発費を取り戻した割合
  const dlg = $('#assign');
  $('#assign-body').innerHTML = `
    <div class="prod-hero">${prodIcon(p.genre, 'big')}<b>${esc(p.name)}</b><small>${g.name}</small>${rating(p.q)}</div>
    <div class="facts">
      <div><small>売上</small><b class="ok">+${yen(net + upkeep)}</b></div>
      <div><small>維持費</small><b class="bad">-${yen(upkeep)}</b></div>
      <div class="net"><small>もうけ</small><b class="${net >= 0 ? 'ok' : 'bad'}">${signYen(net)}</b></div>
      <div><small>これまで</small><b>${yen(p.earned ?? 0)}</b></div>
      <div><small>開発費</small><b>${yen(g.cost)}</b></div>
      <div><small>回収</small><b class="${back >= 1 ? 'ok' : ''}">${pct(back)}</b></div>
      <div><small>発売から</small><b>${dur(age)}</b></div>
      <div><small>流行</small><b>${trendIcon(G.trendAt(S, p.genre, now))}</b></div>
      <div><small>ブランド</small><b>×${brandNum(G.brand(S, p.genre))}</b></div>
    </div>
    <div class="spark"><svg viewBox="0 0 300 80" preserveAspectRatio="none"><polygon points="0,80 ${xy} 300,80"/><polyline points="${xy}"/><line class="upkeep" x1="0" x2="300" y1="${upY}" y2="${upY}"/></svg></div>
    ${by.length ? `<div class="by">${icon('people')}<span class="avs">${by.map((m, i) => `<button class="by-face" data-by="${i}">${avatar(m)}</button>`).join('')}</span></div>` : ''}
    <div class="sheet-btns"><button class="btn ${price ? 'sell' : 'fire'}" id="prod-stop">${price ? `売却 +${yen(price)}` : '販売終了'}</button><button class="big ghost" id="run-close">OK</button></div>`;
  fillThumbs($('#assign-body'));
  if (!dlg.open) dlg.showModal();
  $('#run-close').onclick = () => dlg.close();
  // 作った人の顔を押すと、その人の詳しい画面（2026-10-06 ユーザー指示）
  $('#assign-body').querySelectorAll('[data-by]').forEach((el) => (el.onclick = () => openProfile(by[+el.dataset.by])));
  $('#prod-stop').onclick = async () => {
    // 押した時点の値段で売る（確認の間に流行が変わっても、見せた値段と違わないように）
    const ok = price
      ? await ask({ head: `${prodIcon(p.genre)}<b>${esc(p.name)}</b>`, text: `${yen(price)}で売却しますか？`, ok: '売却', safe: true })
      : await ask({ head: `${prodIcon(p.genre)}<b>${esc(p.name)}</b>`, text: '販売をやめますか？', ok: '販売終了' });
    if (!ok) return;
    G.stopProduct(S, id, now);
    dlg.close();
    commit();
  };
}

// 開発中の製品のくわしい様子（担当者と力・ゲージ・出来の見込み・1時間の稼ぎの見込み・残り時間）
function openDevRunning(devId) {
  const d = S.devs.find((x) => x.id === devId);
  if (!d) return;
  const g = R.GENRES[d.genre];
  const dlg = $('#assign');
  const team = d.members.map((id) => S.members.find((m) => m.id === id)).filter(Boolean);
  const power = (m) => Math.round(G.teamPower(S, [m], g.w));
  const sum = team.reduce((a, m) => a + power(m), 0);
  const p = G.devPreview(S, d.genre, team.map((m) => m.id));
  const now = Date.now();
  // 今の流行で発売したときの、はじめの1時間の稼ぎ（出来は運で 0.6〜1.4 倍に振れる）
  const income = (q) => G.productNet(S, { genre: d.genre, q: Math.min(3, q), launchedAt: now }, now);
  $('#assign-body').innerHTML = `
    <div class="sheet-head"><b>${g.name}</b><span class="muted">${icon('people')}${team.length}</span></div>
    <div class="need ${sum >= g.need ? 'full' : ''}">${icon('bolt')}<span class="need-bar"><i style="width:${pct(Math.min(1, sum / g.need))}"></i></span><span class="need-num"><b>${sum}</b>/${g.need}</span></div>
    <div class="pick">${team
      .map(
        (m, i) => `<div class="person active" data-prof="${i}">
          ${avatar(m)}<span class="pname">${esc(G.displayName(m))}<small>${jobShort(m)} Lv${m.level}${hakenTag(m)}</small></span><span class="pw">${icon('bolt')}${power(m)}</span>
        </div>`,
      )
      .join('')}</div>
    <div class="preview">${rating(p.quality * 0.6)}<span class="muted">〜</span>${rating(p.quality * 1.4)}${trendIcon(G.trendAt(S, d.genre, now))}</div>
    <div class="preview">${val('coin', `${signYen(income(p.quality * 0.6))}〜${signYen(income(p.quality * 1.4))}/時`)}${val('box', yen(g.cost))}</div>
    ${progress(d.startAt, d.endsAt)}
    <button class="big ghost" id="run-close">OK</button>`;
  fillThumbs($('#assign-body'));
  updateTimers();
  // 担当者を押すと、その人の詳しい画面（2026-10-06 ユーザー指示）
  $('#assign-body').querySelectorAll('[data-prof]').forEach((el) => (el.onclick = () => openProfile(team[+el.dataset.prof])));
  if (!dlg.open) dlg.showModal();
  $('#run-close').onclick = () => dlg.close();
}

// ----- 偉人 -----
const thumbs = {};
function thumbnailFor(legend) {
  thumbs[legend.id] ??= thumbnailUrl(legend).then((url) => url ?? createCharacter(legend).then((obj) => renderThumbnail(obj)));
  return thumbs[legend.id];
}
function renderLegends() {
  const owned = G.ownedLegends(S);
  const order = { R: 0, SR: 1, SSR: 2 }; // 並び順だけに使う（会いやすい人から）。画面にランクは出さない
  $('#zukan-grid').innerHTML = [...LEGENDS]
    .sort((a, b) => order[a.rarity] - order[b.rarity])
    .map((l) => {
      const has = owned.has(l.id);
      const left = G.leftLegend(S, l.id); // 自分から辞めた（呼び戻せる）
      // 出会いの条件を、短い言葉と進み具合の棒で
      const conds = has
        ? ''
        : `<div class="conds">${G.meetProgress(S, l.id)
            .map((c) => `<div class="cond ${c.ok ? 'ok' : ''}"><span>${esc(c.label)}</span><i><b style="width:${pct(c.ratio)}"></b></i></div>`)
            .join('')}</div>`;
      const wait = has || left ? '' : legendWait(l.id);
      return `<button class="card ${has ? '' : left ? 'left' : 'locked'} ${wait ? 'near' : ''}" data-id="${l.id}">
        <div class="thumb"><img data-thumb="${l.id}" alt=""></div>
        ${has ? `<div class="name">${l.name}</div>` : left ? `<div class="name">${l.name}</div><div class="left-tag">${icon('back')}辞任</div>` : conds + wait}
      </button>`;
    })
    .join('');
  fillThumbs($('#zukan-grid'));
  $('#zukan-grid').querySelectorAll('.card').forEach((c) => (c.onclick = () => openLegend(c.dataset.id)));
}

// ---------- 偉人の詳細・出会い ----------
let detailStage;
let detailToken;
async function showOnDetail(legend, { reveal = false } = {}) {
  detailStage ??= new Stage($('#detail-canvas'));
  detailStage.setCharacter(null);
  const token = (detailToken = {});
  const p = createCharacter(legend);
  if (reveal) return detailStage.reveal(p, LEGEND_COLOR);
  const obj = await p;
  if (token === detailToken) detailStage.setCharacter(obj);
}
// まだ仲間でないとき（secret）は名前を出さず、肩書きだけ
function legendHead(legend, { secret = false } = {}) {
  return secret ? `<h2>${legend.title}</h2>` : `<h2>${legend.name}</h2><div class="sub">${legend.title}</div>`;
}
// まだ仲間でないレジェンドは、姿はシルエットのまま（出会ったときと同じ）
function showSilhouette(legend) {
  const wrap = $('#detail-canvas').parentElement;
  wrap.querySelector('.silhouette')?.remove();
  thumbnailFor(legend).then((src) => {
    if (!$('#detail').open) return;
    const img = new Image();
    img.src = src;
    img.className = 'silhouette';
    wrap.append(img);
  });
}
// まだ仲間でないレジェンド：肩書き・力・出会いの条件だけ見られる（名前と姿はシークレット）
function openLockedLegend(legend) {
  detailStage ??= new Stage($('#detail-canvas'));
  detailStage.setCharacter(null);
  detailToken = {};
  const conds = G.meetProgress(S, legend.id)
    .map((c) => `<div class="cond ${c.ok ? 'ok' : ''}"><span>${esc(c.label)}</span><i><b style="width:${pct(c.ratio)}"></b></i></div>`)
    .join('');
  $('#detail-info').innerHTML = `${legendHead(legend, { secret: true })}
    <div class="ability">${esc(R.LEGEND_RULES[legend.id].abilityText)}</div>
    <div class="conds">${conds}</div>
    ${legendWait(legend.id)}`;
  updateTimers();
  $('#detail').showModal();
  showSilhouette(legend);
}
function openLegend(id) {
  const legend = byId[id];
  const left = G.leftLegend(S, id);
  const m = S.members.find((x) => x.legend === id) ?? left;
  if (!m) return openLockedLegend(legend);
  // 辞めたレジェンドは、高いお金で呼び戻せる（また出会うのを待ってもよい）
  const cost = G.rehireCost(S);
  $('#detail-info').innerHTML = `${legendHead(legend)}
    <div class="ability">${esc(R.LEGEND_RULES[id].abilityText)}</div>
    ${m ? `<div class="lvrow">Lv${m.level} ${statBars(G.statsOf(S, m))}</div>` : ''}
    ${left ? `<p class="scene">${esc(R.LEGEND_RULES[id].quitText)}</p><button class="big" id="rehire" ${S.money >= cost && (G.hasSeat(S) || canSwap()) ? '' : 'disabled'}>呼び戻す <small>${icon('coin')}${yen(cost)}</small></button>${G.hasSeat(S) || canSwap() ? '' : seatFull()}` : ''}
    <details><summary>くわしく</summary><p>${legend.summary}</p></details>`;
  $('#seat-full') && ($('#seat-full').onclick = () => {
    $('#detail').close();
    document.querySelector('.tab[data-view="team"]').click();
  });
  $('#rehire') &&
    ($('#rehire').onclick = async () => {
      let fireId = null;
      if (!G.hasSeat(S)) {
        fireId = await pickFire();
        if (fireId == null) return;
      }
      const fired = S.members.find((x) => x.id === fireId);
      if (!G.rehire(S, id, Date.now(), fireId)) return;
      commit();
      $('#detail-info').innerHTML = `${legendHead(legend)}<div class="joined">戻ってきた</div><div class="ability">${esc(R.LEGEND_RULES[id].abilityText)}</div>${firedLine(fired)}`;
    });
  $('#detail').showModal();
  showOnDetail(legend);
}

// ちょうど満席で、FIRE できる社員がいれば入れ替えられる
const canSwap = () => G.seatsUsed(S) === G.capacity(S) && G.fireable(S).length > 0;
const firedLine = (m) => (m ? `<div class="fired-line">${avatar(m)}<b>${esc(m.name)}</b><span>FIRE</span></div>` : '');
// FIRE する人を選ぶ（下からのシート）。選んだ人の id、やめたら null
function pickFire() {
  const staff = S.members.filter((m) => m.kind === 'staff');
  const ok = new Set(G.fireable(S));
  askEl.innerHTML = `<div class="fire-head"><b>FIRE</b>${val('people', `${G.seatsUsed(S)}/${G.capacity(S)}`, 'bad')}</div>
    <div class="fire-list">${staff
      .map(
        (m) => `<button class="fire-row" data-id="${m.id}" ${ok.has(m) ? '' : 'disabled'}>${avatar(m)}<span class="rival-what"><b>${esc(m.name)}</b><small>${jobShort(m)} Lv${m.level}${
          G.isTired(m) ? icon('drop', 'tired-ic') : ''
        }</small></span>${m.busy ? `<span class="muted">${icon('task')}</span>` : m.haken ? hakenTag(m) : ''}</button>`,
      )
      .join('')}</div>
    <div class="ask-btns"><button class="big ghost" data-a="0">やめる</button></div>`;
  askEnd?.(false);
  if (!askEl.open) askEl.showModal();
  return new Promise((done) => {
    const end = (v) => {
      askEnd = null;
      askEl.close();
      done(v);
    };
    askEnd = () => end(null);
    askEl.querySelectorAll('.fire-row').forEach((b) => (b.onclick = () => end(+b.dataset.id)));
    askEl.querySelector('[data-a]').onclick = () => end(null);
    askEl.oncancel = (e) => {
      e.preventDefault();
      end(null);
    };
  });
}
// 席がいっぱいのとき（レジェンドも席を使う）。押すと仲間タブへ
const seatFull = () => (G.hasSeat(S) ? '' : `<button class="seat-full" id="seat-full">${icon('people')}席がいっぱい <b>${G.seatsUsed(S)}/${G.capacity(S)}</b>${icon('back', 'flip')}</button>`);

function openEncounter() {
  const e = S.encounter;
  if (!e) return;
  const legend = byId[e.id];
  const rule = R.LEGEND_RULES[e.id];
  detailStage ??= new Stage($('#detail-canvas'));
  detailStage.setCharacter(null);
  $('#detail-info').innerHTML = `${legendHead(legend, { secret: true })}
    <p class="scene">${esc(rule.scene)}</p>
    <div class="ability">${esc(rule.abilityText)}</div>
    <div class="vals">${val('target', pct(G.scoutChance(S, e.id)))}${val('clock', `<span data-left="${e.until}">${dur(e.until - Date.now())}</span>`)}</div>
    <button class="big" id="scout" ${G.hasSeat(S) || canSwap() ? '' : 'disabled'}>仲間に誘う</button>${G.hasSeat(S) || canSwap() ? '' : seatFull()}`;
  updateTimers();
  $('#seat-full') && ($('#seat-full').onclick = () => {
    $('#detail').close();
    document.querySelector('.tab[data-view="team"]').click();
  });
  $('#detail').showModal();
  // まだ姿はシルエットだけ
  const wrap = $('#detail-canvas').parentElement;
  showSilhouette(legend);
  $('#scout').onclick = async () => {
    // 席がいっぱいなら、仲間になったときに FIRE する人を先に選ぶ（断られたら誰も辞めない）
    let fireId = null;
    if (!G.hasSeat(S)) {
      fireId = await pickFire();
      if (fireId == null) return;
    }
    const fired = S.members.find((x) => x.id === fireId);
    const r = G.scout(S, Date.now(), fireId);
    if (!r) return;
    commit();
    wrap.querySelector('.silhouette')?.remove();
    if (r === 'joined') {
      $('#detail-info').innerHTML = `${legendHead(legend)}<div class="joined">仲間になった</div><div class="ability">${esc(rule.abilityText)}</div>${firedLine(fired)}`;
      await showOnDetail(legend, { reveal: true });
    } else {
      // 断られた: 3日会えない時計と、次に誘うときの確率（断られるたびに上がる）
      const cd = S.met[e.id]?.cooldown ?? 0;
      $('#detail-info').innerHTML = `${legendHead(legend, { secret: true })}<div class="refused">断られた</div><p class="scene">「まだ早いようだ」</p>
        <div class="vals">${val('clock', `<span data-left="${cd}">${dur(cd - Date.now())}</span>`)}${val('target', `次 ${pct(G.scoutChance(S, e.id))}`, 'ok')}</div>`;
      updateTimers();
    }
  };
}
$('#detail').addEventListener('close', () => {
  $('#detail-canvas').parentElement.querySelector('.silhouette')?.remove();
  detailStage?.setCharacter(null);
});

// ---------- ダイアログ共通 ----------
document.querySelectorAll('dialog .close').forEach((b) => (b.onclick = () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => e.target === d && d.close()));
$('#notice-ok').onclick = () => $('#notice').close();
function notice(html) {
  $('#notice-body').innerHTML = html;
  fillThumbs($('#notice-body'));
  // 辞めたレジェンドを押すと、呼び戻す画面へ
  $('#notice-body').querySelectorAll('[data-legend]').forEach(
    (b) =>
      (b.onclick = () => {
        $('#notice').close();
        openLegend(b.dataset.legend);
      }),
  );
  // 契約が終わった紹介予定派遣の人を押すと、仲間タブ（面接の一覧で社員にできる）
  $('#notice-body').querySelectorAll('[data-go-team]').forEach(
    (b) =>
      (b.onclick = () => {
        $('#notice').close();
        document.querySelector('.tab[data-view="team"]').click();
      }),
  );
  // 完了した依頼の行を押すと、その依頼のくわしいシート
  $('#notice-body').querySelectorAll('[data-done]').forEach(
    (r) => (r.onclick = () => openDone((S.history ?? []).find((h) => h.t === +r.dataset.done))),
  );
  if (!$('#notice').open) $('#notice').showModal();
}

// ---------- はじめる前のストーリー（スライド。新しく始めたときだけ。終わったら案内へ） ----------
// S.story: 0 = まだ見ていない、-1 = 見た（前の記録には無いので出ない）
function showStory() {
  const hero = S.members.find((m) => m.kind === 'hero');
  const glow = (names) => `<div class="st-icons">${names.map((n) => icon(n)).join('<span class="st-arrow"></span>')}</div>`;
  const slides = [
    { art: `<div class="st-face" style="background-image:url(${faceShot(hero.look, hero.job)})"></div>`, text: '小さな部屋で、<br>IT会社をはじめた' },
    { art: glow(['task', 'coin', 'star']), text: '仕事を受けて、<br>会社を大きくする' },
    { art: `<div class="st-legends">${[...modelIds].map((id) => `<img src="models/${id}.webp" alt="">`).join('')}</div>`, text: 'IT業界のレジェンドが集結<br>雇うことができるかも' },
    { art: $('.title-emblem').outerHTML.replace(/tneon/g, 'sneon'), text: '伝説のIT会社をつくれ' },
  ];
  const el = document.createElement('div');
  el.id = 'story';
  document.body.append(el);
  let i = 0;
  const end = () => {
    S.story = -1;
    save();
    el.remove();
    startGuide();
  };
  const draw = () => {
    const sl = slides[i];
    el.innerHTML = `
      <button class="st-skip" aria-label="とばす">×</button>
      <div class="st-slide" key="${i}">${sl.art}<p>${sl.text}</p></div>
      <div class="st-foot"><div class="dots">${slides.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div></div>`;
    el.querySelector('.st-skip').onclick = (e) => {
      e.stopPropagation();
      end();
    };
  };
  // 画面のどこを押しても次へ（最後の1枚で押すとはじまる）
  el.onclick = () => (i === slides.length - 1 ? end() : (i++, draw()));
  draw();
}

// ---------- 最初の1回だけの案内（光る枠と短い言葉） ----------
// S.guide: 何番目の案内か（新しく始めたときだけ 0 から。終わったら -1。前の記録には無いので出ない）
// tap: その場所を押すと次へ / ok: 「OK」で次へ。back: 枠の場所が見つからないときに戻る番号
const GUIDE = [
  { sel: '.tab[data-view="work"]', text: '仕事を受ける', tap: true },
  { sel: '#view-work.active [data-offer]', text: '依頼を選ぶ', tap: true, back: 0 },
  { sel: '#assign[open] .person[data-id]', text: 'CEO に任せる', tap: true, back: 1 },
  { sel: '#assign[open] .temp-head', text: 'SES<br>お金を払うと、この仕事の間だけ<br>外の技術者が来てくれる', ok: true, sheet: true, back: 1 },
  { sel: '#assign[open] #assign-go:not([disabled])', text: 'スタート', tap: true, back: 2 },
  { sel: '#view-work.active .pr-row', text: '宣伝<br>お金を払うと<br>依頼が来やすくなる', ok: true },
  { sel: '.tab[data-view="office"]', text: '会社へ', tap: true },
  // 仕事をしている間に、ほかの所を説明する
  { sel: '#rep', text: '評判<br>仕事が成功すると上がる<br>依頼が増え、引っ越しにも必要', ok: true },
  { sel: '#upgrade', text: 'お金と評判がたまったら<br>広いオフィスへ。席が増える', ok: true },
  { sel: '#next-legend .next-legend', text: '次に会えるレジェンド', ok: true },
  { sel: '.tab[data-view="team"]', text: '仲間', tap: true },
  { sel: '#view-team.active .ad-row', text: '面接に来た人を雇う<br>求人広告で来やすくなる', ok: true },
  { sel: '.tab[data-view="product"]', text: '製品', tap: true },
  { sel: '#view-product.active .genre', text: '自社製品を作る<br>発売すると収入が入る', ok: true },
  { sel: '.tab[data-view="legends"]', text: 'レジェンド', tap: true },
  { sel: '#zukan-grid .card', text: '条件を満たすと出会える<br>誘って仲間に', ok: true },
  { sel: '.tab[data-view="office"]', text: '会社へ', tap: true },
  // 手が空いたときの過ごし方は、仕事が終わってから（仕事中はボタンが押せないため）。もう終わっていれば飛ばす
  { sel: '#activity .act-lock .pill', text: '仕事が終わるまで待つ', auto: true },
  { sel: '#activity [data-act="walk"]', text: '散歩<br>レジェンドに偶然会える<br>仕事の相談も来る', ok: true },
  { sel: '#activity [data-act="net"]', text: 'ネット<br>臨時収入が入る', ok: true },
  { sel: '#activity [data-act="meetup"]', text: '勉強会<br>面接に来る人がいる', ok: true },
];
const guideEl = document.createElement('div');
guideEl.id = 'guide';
guideEl.innerHTML = `<div class="g-ring"></div><div class="g-bubble"><span class="g-text"></span><button class="g-ok">OK</button><button class="g-skip" aria-label="閉じる">×</button></div>`;
let guideLoop = 0;
function guideStep() {
  return S && S.guide >= 0 && S.guide < GUIDE.length ? GUIDE[S.guide] : null;
}
function guideNext() {
  S.guide = S.guide + 1 >= GUIDE.length ? -1 : S.guide + 1;
  save();
}
function guideEnd() {
  S.guide = -1;
  save();
  guideEl.remove();
}
guideEl.querySelector('.g-ok').onclick = () => guideNext();
guideEl.querySelector('.g-skip').onclick = () => guideEnd();
// 枠の場所を押したら次へ（押した処理はそのまま動く）
document.addEventListener(
  'click',
  (e) => {
    const g = guideStep();
    if (g?.tap && e.target.closest(g.sel)) guideNext();
    // 見せるだけの案内（OK）の途中で、次の場所を先に押したとき（派遣の説明中にそのまま「任せる」など）は2つ進める
    else if (g?.ok && GUIDE[S.guide + 1]?.tap && e.target.closest(GUIDE[S.guide + 1].sel)) {
      guideNext();
      guideNext();
    }
  },
  true,
);
function startGuide() {
  if (guideLoop || !guideStep()) return;
  const tick = () => {
    const g = guideStep();
    if (!g || $('#game').classList.contains('hidden')) {
      guideEl.remove();
      guideLoop = 0;
      return;
    }
    guideLoop = requestAnimationFrame(tick);
    const all = [...document.querySelectorAll(g.sel)];
    const el = all.find((x) => x.offsetParent);
    if (!el) {
      if (g.sheet && $('#assign[open]') && !all.length) guideNext(); // シートは開いているのに場所がない（派遣が無い仕事など）は飛ばす
      else if (g.back != null && !$('#notice').open) S.guide = g.back; // シートを閉じたなどで場所がなくなったら1つ前へ
      else if ((g.ok || g.auto) && !all.length) guideNext(); // 見せるだけの案内は、場所が無くなれば飛ばす（ほかのタブで隠れているだけなら待つ）
      guideEl.style.display = 'none';
      return;
    }
    // 「仕事が終わるまで待つ」まで来たら、最初の仕事だけはすぐ（3秒で）終わらせる（ユーザー指示: 待たせない）
    if (g.auto) {
      const busy = S.members.find((m) => m.kind === 'hero')?.busy;
      const w = busy && [...S.tasks, ...S.devs].find((x) => x.id === busy);
      const soon = Date.now() + 3000;
      if (w && w.endsAt > soon) {
        w.endsAt = soon;
        commit();
      }
    }
    // ポップアップ（ダイアログ）の中の場所は、案内もその中に入れないと見えない
    const host = el.closest('dialog') ?? document.body;
    if (guideEl.parentElement !== host) host.append(guideEl);
    guideEl.style.display = '';
    const r = el.getBoundingClientRect();
    const ring = guideEl.querySelector('.g-ring');
    Object.assign(ring.style, { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
    const b = guideEl.querySelector('.g-bubble');
    guideEl.querySelector('.g-text').innerHTML = g.text; // 決まった言葉だけ（改行に <br> を使う）
    guideEl.querySelector('.g-ok').style.display = g.ok ? '' : 'none';
    const below = r.top + r.height / 2 < innerHeight / 2;
    const bw = b.offsetWidth;
    b.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - bw / 2), innerWidth - bw - 8)}px`;
    b.style.top = below ? `${r.bottom + 14}px` : `${r.top - b.offsetHeight - 14}px`;
    b.classList.toggle('up', !below);
  };
  guideLoop = requestAnimationFrame(tick);
}

// ---------- 壁の落書き（自分で描く） ----------
// 描いた絵は透明な背景の PNG（600×450）にして S.wallArt に入れる（記録・クラウドに一緒に保存される）
const ART_COLORS = ['#f2f2f2', '#7cff6b', '#ff5bd8', '#5fe6ff', '#ffd84a', '#ff9a2e'];
const ART_WALL = '#4e4a52'; // 描くときの下地（部屋の壁の色に近く）
const art = { color: ART_COLORS[0], size: 10, strokes: [], base: null, cur: null };
function openArtPad() {
  const dlg = $('#artpad');
  const cv = $('#art-canvas');
  art.strokes = [];
  art.base = null;
  const draw = () => drawArt(cv.getContext('2d'), true);
  if (S.wallArt) {
    const img = new Image();
    img.onload = () => {
      art.base = img;
      draw();
    };
    img.src = S.wallArt;
  }
  $('#artpad .art-colors').innerHTML = ART_COLORS.map((c) => `<button class="art-color" style="--c:${c}" data-c="${c}" aria-label="色"></button>`).join('');
  const markColor = () => $('#artpad .art-colors').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.c === art.color));
  $('#artpad .art-colors').querySelectorAll('button').forEach((b) => (b.onclick = () => ((art.color = b.dataset.c), markColor())));
  markColor();
  const sizeBtn = $('#art-size');
  const markSize = () => (sizeBtn.innerHTML = `<i style="width:${art.size}px;height:${art.size}px"></i>`);
  sizeBtn.onclick = () => ((art.size = art.size === 10 ? 20 : art.size === 20 ? 5 : 10), markSize());
  markSize();
  $('#art-undo').innerHTML = icon('undo');
  $('#art-undo').onclick = () => {
    if (art.strokes.length) art.strokes.pop();
    else art.base = null; // 前に描いた絵も消せる
    draw();
  };
  $('#art-clear').innerHTML = icon('trash');
  $('#art-clear').onclick = () => {
    art.strokes = [];
    art.base = null;
    draw();
  };
  $('#art-save').innerHTML = icon('check');
  $('#art-save').onclick = () => {
    const out = document.createElement('canvas');
    out.width = cv.width;
    out.height = cv.height;
    drawArt(out.getContext('2d'), false);
    S.wallArt = art.base || art.strokes.length ? out.toDataURL('image/png') : null;
    dlg.close();
    commit();
  };
  // 指やマウスで描く
  const at = (e) => {
    const r = cv.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * cv.width, ((e.clientY - r.top) / r.height) * cv.height];
  };
  cv.onpointerdown = (e) => {
    e.preventDefault(); // 長押しで文字の選択が出ないように
    cv.setPointerCapture(e.pointerId);
    art.cur = { color: art.color, size: art.size, pts: [at(e)] };
    art.strokes.push(art.cur);
    draw();
  };
  cv.onpointermove = (e) => {
    if (!art.cur) return;
    art.cur.pts.push(at(e));
    draw();
  };
  cv.onpointerup = cv.onpointercancel = () => (art.cur = null);
  draw();
  dlg.showModal();
}
function drawArt(c, wall) {
  const { width: W, height: H } = c.canvas;
  c.clearRect(0, 0, W, H);
  if (wall) {
    c.fillStyle = ART_WALL;
    c.fillRect(0, 0, W, H);
  }
  if (art.base) {
    // 前の横長（2:1）の絵は、形を変えずに真ん中に置く
    const k = Math.min(W / art.base.width, H / art.base.height);
    const bw = art.base.width * k;
    const bh = art.base.height * k;
    c.drawImage(art.base, (W - bw) / 2, (H - bh) / 2, bw, bh);
  }
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const st of art.strokes) {
    c.strokeStyle = st.color;
    c.fillStyle = st.color;
    c.lineWidth = st.size;
    if (st.pts.length === 1) {
      c.beginPath();
      c.arc(st.pts[0][0], st.pts[0][1], st.size / 2, 0, Math.PI * 2);
      c.fill();
      continue;
    }
    c.beginPath();
    c.moveTo(...st.pts[0]);
    for (const p of st.pts.slice(1)) c.lineTo(...p);
    c.stroke();
  }
}

// ---------- 時間を進める ----------
function commit() {
  save();
  renderAll();
}
// 起きたことを1つのポップアップにまとめて出す
function eventsNotice(ev) {
  const parts = [];
  if (ev.some((e) => e.type === 'encounter')) parts.push(`${icon('spark', 'big-ic spin')}<h2>誰かが現れた</h2>`);
  const w = ev.find((e) => e.type === 'walkin');
  if (w) parts.push(`${icon('people', 'big-ic')}<h2>面接に来た</h2><p class="muted">${esc(w.name)}</p>`);
  const l = ev.find((e) => e.type === 'luck');
  if (l) parts.push(`${icon('coin', 'big-ic')}<h2>${esc(l.title)}</h2><div class="welcome">${val('coin', `+${yen(l.money)}`, 'ok')}</div>`);
  const rivals = rivalsHtml(ev);
  if (rivals) parts.push(rivals);
  const quits = quitsHtml(ev);
  if (quits) parts.push(quits);
  const ends = hakenEndHtml(ev);
  if (ends) parts.push(ends);
  const leaves = staffQuitHtml(ev);
  if (leaves) parts.push(leaves);
  const hits = repHitHtml(ev);
  if (hits) parts.push(hits);
  const done = resultsHtml(ev);
  if (done) parts.push(done);
  if (parts.length) notice(parts.join('<hr class="nsep">'));
}

function tick() {
  if (!S) return;
  const rival = S.rival;
  const ev = G.advance(S, Date.now());
  if (ev.length || S.rival !== rival) {
    eventsNotice(ev);
    commit();
  } else {
    renderHeader();
    updateTimers();
  }
}

// 終わった仕事・発売した製品・レベルアップ（開いている間に起きたとき、ポップアップで見せる）
function resultsHtml(ev, { head = true } = {}) {
  const tasks = ev.filter((e) => e.type === 'task');
  const prods = ev.filter((e) => e.type === 'product');
  const levels = ev.filter((e) => e.type === 'level');
  if (!tasks.length && !prods.length && !levels.length) return '';
  const rows = [
    ...tasks.slice(0, 5).map(
      (t) => `<div class="result ${t.ok ? 'ok' : 'bad'}" ${t.t ? `data-done="${t.t}"` : ''}>${icon(t.ok ? 'check' : 'error')}<b>${esc(t.title)}<span class="res-tag">${t.ok ? '成功' : '失敗'}</span></b>
        <span class="vals">${t.great ? icon('bolt', 'res-great') : ''}${t.early ? icon('clock', 'res-early') : ''}${val('coin', `+${yen(t.money)}`, t.ok ? 'ok' : '')}${t.rep ? val('star', `${t.rep > 0 ? '+' : ''}${t.rep}`, t.rep < 0 ? 'bad' : '') : ''}</span></div>`,
    ),
    tasks.length > 5 ? `<div class="muted">+${tasks.length - 5}</div>` : '',
    ...prods.map((p) => launchCard(p, !tasks.length)),
    ...levelRows(levels),
  ];
  const list = `<div class="results">${rows.join('')}</div>`;
  // 見出しはいつも「完了」（成功・失敗は1行ずつの札で見せる。見出しまで「失敗」にすると二重になる）
  // 製品だけのときは見出しも「発売」
  if (head && prods.length && !tasks.length) return `<h2 class="launch-h">発売</h2>${list}`;
  return head ? `${icon(tasks.some((t) => t.ok) || prods.length ? 'check' : 'task', 'big-ic done-ic')}<h2>完了</h2>${list}` : list;
}
// 発売した製品は大きなカードで（光る絵・名前・出来・はじめの1時間の稼ぎ）。見出しが「発売」のときは札を出さない（二重になるため）
function launchCard(e, alone = false) {
  const p = S.products.find((x) => x.id === e.id);
  const genre = e.genre ?? p?.genre ?? 'web';
  const income = p ? G.productNet(S, p, p.launchedAt) : 0;
  return `<div class="launch">
    <div class="launch-art">${prodIcon(genre, 'big')}</div>
    ${alone ? '' : `<span class="launch-tag">${icon('box')}発売</span>`}
    <b class="launch-name">${esc(e.name)}</b>
    <small>${R.GENRES[genre]?.name ?? ''}</small>
    ${rating(e.q)}
    ${income ? `<span class="launch-earn">${signYen(income)}<small>/時</small></span>` : ''}
  </div>`;
}

// レベルが上がった人（同じ人が何度も上がったら1行にまとめて「Lv2 → Lv4」）
function levelRows(levels) {
  const byMember = new Map();
  for (const x of levels) {
    const k = x.id ?? x.name;
    const o = byMember.get(k) ?? { ...x, from: x.level - 1 };
    o.level = Math.max(o.level, x.level);
    byMember.set(k, o);
  }
  return [...byMember.values()].map((x) => {
    const m = S.members.find((y) => y.id === x.id);
    const sub = m ? (m.kind === 'legend' ? 'レジェンド' : R.JOBS[m.job].name) : '';
    return `<div class="rival lvup">${m ? avatar(m) : `<span class="av" style="--c:var(--accent)">${esc(x.name.slice(0, 1))}</span>`}
      <span class="rival-what"><b>${esc(x.name)}</b><small>${sub}</small></span>
      <span class="lv-to">${icon('up')}<span>Lv${x.from}</span><span class="arrow">→</span><b>Lv${x.level}</b></span>
    </div>`;
  });
}

// 冷やかしに来たレジェンドと、されたこと（お金を減らされた・社員を引き抜かれた）
function rivalsHtml(ev, { head = true } = {}) {
  const rs = ev.filter((e) => e.type === 'rival');
  if (!rs.length) return '';
  const rows = rs.slice(0, 3).map(
    (r) => `<div class="rival">
      <span class="av legend" style="--c:var(--bad)"><img data-thumb="${r.id}" alt=""></span>
      <span class="rival-what"><b>${esc(byId[r.id].name)}</b><small>${esc(r.poached ? `${r.poached} を引き抜かれた` : r.title)}</small></span>
      ${r.poached ? val('people', '-1', 'bad') : val('coin', `-${yen(r.money)}`, 'bad')}
    </div>`,
  );
  return `${head ? `${icon('error', 'big-ic rival-ic')}<h2>冷やかし</h2><p class="muted small">${icon('task')}仕事中に来る</p>` : ''}<div class="results">${rows.join('')}</div>`;
}

// 契約が終わった派遣の人。紹介予定派遣の人は面接の一覧で社員にするか決められる（押すと仲間タブへ）
function hakenEndHtml(ev, { head = true } = {}) {
  const es = ev.filter((e) => e.type === 'hakenEnd');
  if (!es.length) return '';
  const rows = es.map(
    (e) => `<button class="rival quit-row" ${e.intro ? 'data-go-team' : 'disabled'}>${avatar(e.m)}
      <span class="rival-what"><b>${esc(e.m.name)}</b><small>${jobShort(e.m)} Lv${e.m.level}</small></span>
      ${e.intro ? `<span class="quit-back">${icon('people')}社員に</span>` : '<span class="muted small">契約終了</span>'}
    </button>`,
  );
  return `${head ? `${icon('people', 'big-ic')}<h2>契約終了</h2>` : ''}<div class="results">${rows.join('')}</div>`;
}
// 評判が下がった出来事（不具合・個人情報流出・デマなど）
function repHitHtml(ev, { head = true } = {}) {
  const es = ev.filter((e) => e.type === 'repHit');
  if (!es.length) return '';
  const rows = es.map((e) => `<div class="result bad">${icon('error')}<b>${esc(e.title)}</b><span class="vals">${val('star', `-${e.rep}`, 'bad')}</span></div>`);
  return `${head ? `${icon('star', 'big-ic rival-ic')}<h2>評判ダウン</h2>` : ''}<div class="results">${rows.join('')}</div>`;
}
// 疲れて辞めた・ほかの会社に引き抜かれた社員
function staffQuitHtml(ev, { head = true } = {}) {
  const es = ev.filter((e) => e.type === 'staffQuit');
  if (!es.length) return '';
  const rows = es.map(
    (e) => `<div class="rival">${avatar(e.m)}
      <span class="rival-what"><b>${esc(e.m.name)}</b><small>${jobShort(e.m)} Lv${e.m.level}</small></span>
      <span class="quit-why">${e.why === 'tired' ? `${icon('drop')}退職` : `${icon('move')}引き抜き`}</span>
    </div>`,
  );
  const h = es.every((e) => e.why === 'tired') ? `${icon('drop', 'big-ic rival-ic')}<h2>退職</h2>` : es.every((e) => e.why === 'poach') ? `${icon('move', 'big-ic rival-ic')}<h2>引き抜き</h2>` : `${icon('people', 'big-ic rival-ic')}<h2>退職</h2>`;
  return `${head ? h : ''}<div class="results">${rows.join('')}</div>`;
}
// 自分から辞めたレジェンド（呼び戻すお金も出す）
function quitsHtml(ev, { head = true } = {}) {
  const qs = ev.filter((e) => e.type === 'quit');
  if (!qs.length) return '';
  const rows = qs.map(
    (q) => `<button class="rival quit-row" data-legend="${q.id}">
      <span class="av legend" style="--c:var(--muted)"><img data-thumb="${q.id}" alt=""></span>
      <span class="rival-what"><b>${esc(byId[q.id].name)}</b><small>${esc(R.LEGEND_RULES[q.id].quitText)}</small></span>
      <span class="quit-back">${icon('back')}呼び戻す</span>
    </button>`,
  );
  return `${head ? `${icon('back', 'big-ic rival-ic')}<h2>辞任</h2>` : ''}<div class="results">${rows.join('')}</div>`;
}

// 留守の間に起きたこと
function welcomeBack(ev, away) {
  // 少しだけ留守にしていた間に終わった仕事などは、ふだんと同じポップアップで出す
  if (away < 10 * 60000) return eventsNotice(ev);
  const rows = [];
  // お金の増減の合計（製品の収入・給料・臨時収入・仕事の報酬）
  const gained = ev.filter((e) => e.type === 'luck' || e.type === 'task').reduce((a, e) => a + e.money, 0) - ev.filter((e) => e.type === 'rival').reduce((a, e) => a + (e.money ?? 0), 0);
  const net = (ev.income ?? 0) - (ev.salary ?? 0) + gained;
  if (Math.abs(net) >= 1) rows.push(val('coin', `${net >= 0 ? '+' : ''}${yen(net)}`, net >= 0 ? 'ok' : 'bad'));
  // 増減のわけ（仕事の報酬・製品の収入・臨時収入・給料・冷やかし）。0 のものは出さない
  const sum = (type) => ev.filter((e) => e.type === type).reduce((a, e) => a + (e.money ?? 0), 0);
  const parts = [
    ['task', '仕事', sum('task')],
    ['box', '製品', ev.income ?? 0],
    ['globe', '臨時収入', sum('luck')],
    ['wallet', '給料', -(ev.salary ?? 0)],
    ['error', '冷やかし', -sum('rival')],
  ].filter(([, , v]) => Math.abs(v) >= 1);
  const breakdown = parts.length
    ? `<div class="money-why">${parts
        .map(([ic, label, v]) => `<div class="mw-row">${icon(ic)}<span>${label}</span><b class="${v >= 0 ? 'ok' : 'bad'}">${v >= 0 ? '+' : '-'}${yen(Math.abs(v))}</b></div>`)
        .join('')}</div>`
    : '';
  if (ev.some((e) => e.type === 'encounter')) rows.push(val('spark', '誰かが現れた', 'legend'));
  if (ev.some((e) => e.type === 'walkin') && S.candidates.some((c) => c.walkin)) rows.push(val('people', '面接に来た', 'legend'));
  // 終わった仕事は1つずつ（resultsHtml の一覧だけを使う）
  const done = resultsHtml(ev, { head: false });
  const rivals = rivalsHtml(ev, { head: false }) + quitsHtml(ev, { head: false }) + hakenEndHtml(ev, { head: false }) + staffQuitHtml(ev, { head: false }) + repHitHtml(ev, { head: false });
  if (!rows.length && !done && !rivals) return;
  notice(`<h2>おかえりなさい</h2><p class="muted">${dur(away)}</p><div class="welcome">${rows.join('')}</div>${breakdown}${rivals}${done}`);
}

// ---------- ログイン（Google で保存・同期。src/cloud.js） ----------
const SYNC_ICON = { login: 'login', ok: 'cloudOk', busy: 'busy', error: 'error' };
let syncState = { text: 'ログイン', cls: 'login' };
function showSync(text, cls) {
  syncState = { text, cls };
  for (const el of document.querySelectorAll('.sync')) {
    el.innerHTML = icon(SYNC_ICON[cls], cls === 'busy' ? 'spin' : '') + `<span>${esc(text)}</span>`;
    el.className = `sync ${cls}`;
    el.title = text;
  }
  if ($('#settings').open && !renaming()) renderSettings(); // 名前を入力している途中は描き直さない
}
async function toggleLogin() {
  const u = cloud.currentUser();
  if (!u) return cloud.login();
  settingsPage = 'more'; // 上の「保存済み」を押したときは、Google のある「アカウントと記録」を開く
  renderSettings();
  $('#settings').showModal();
}
document.querySelectorAll('.sync').forEach((b) => {
  b.onclick = toggleLogin;
  b.addEventListener('pointerdown', cloud.warmUp, { once: true });
});

// 設定の画面は4つ：main（タイトルへ・名前を変更・顔を変更）/ rename（名前を変更）/ face（顔を変更）/ more（Google のログイン・ログアウト・最初から）
// ログアウトと「最初から」は押し間違えないよう「アカウントと記録」の奥に置き、確かめてから行う
let settingsPage = 'main';
const renaming = () => settingsPage === 'rename' || settingsPage === 'face'; // 入力・選んでいる途中は描き直さない
function renderRename() {
  const hero = S.members.find((m) => m.kind === 'hero');
  $('#settings-body').innerHTML = `
    <button class="set-row link-row" id="set-back">${icon('back')}<span class="grow">名前を変更</span></button>
    <label class="set-row rename"><b>CEO</b><input id="set-name" maxlength="12" autocomplete="off" value="${esc(hero.name)}" /></label>
    <label class="set-row rename"><b>株式会社</b><input id="set-company" maxlength="16" autocomplete="off" value="${esc(S.company.replace('株式会社', ''))}" /></label>
    <button class="big" id="rename-save">保存</button>`;
  $('#set-back').onclick = () => setPage('main');
  $('#rename-save').onclick = () => {
    const name = $('#set-name').value.trim();
    const company = $('#set-company').value.trim();
    if (name) hero.name = name; // 空のときは元のまま
    if (company) S.company = G.companyTitle(company);
    commit();
    setPage('main');
  };
}
function renderFace() {
  const hero = S.members.find((m) => m.kind === 'hero');
  const look = { ...defaultLook(), ...hero.look, gender: genderOf(hero.look) };
  $('#settings-body').innerHTML = `
    <button class="set-row link-row" id="set-back">${icon('back')}<span class="grow">顔を変更</span></button>
    <div id="set-face" class="face-editor"></div>
    <button class="big" id="face-save">保存</button>`;
  faceEditor($('#set-face'), look, hero.job);
  $('#set-back').onclick = () => setPage('main');
  $('#face-save').onclick = () => {
    hero.look = { ...look, shirt: R.JOBS[hero.job].shirt };
    commit();
    setPage('main');
  };
}
function renderMore() {
  const u = cloud.currentUser();
  $('#settings-body').innerHTML = `
    <button class="set-row link-row" id="set-back">${icon('back')}<span class="grow">アカウントと記録</span></button>
    ${u
      ? `<div class="set-row">${icon(SYNC_ICON[syncState.cls])}<span class="grow muted">${esc(u.email ?? '')}</span><button class="btn ghost small" id="logout">ログアウト</button></div>`
      : `<div class="set-row">${icon('cloud')}<span class="grow">Google</span><button class="btn" id="login">ログイン</button></div>`}
    <button class="set-row link-row" id="more-slots">${icon('box')}<span class="grow">記録</span>${icon('back', 'flip')}</button>`;
  $('#more-slots').onclick = () => setPage('slots');
  $('#set-back').onclick = () => setPage('main');
  if ($('#login')) {
    $('#login').onclick = () => cloud.login();
    cloud.warmUp();
  }
  $('#logout') && ($('#logout').onclick = async () => (await ask({ text: 'ログアウトしますか？', ok: 'ログアウト' })) && cloud.logout().then(() => setPage('main')));
}
// 記録（3つまで）: 切り替え・ロック・消す（2026-10-04 ユーザー指示「タイトルに戻らずに切り替え」「消したくない記録にロック」）
// ロックした記録は消せず、はじめからで上書きもできない。消すときは会社名を出して2回たしかめる
function renderSlots() {
  const card = (n) => {
    const s = slotData(n);
    const now = n === slot;
    if (!s)
      return `<div class="sv-card empty" data-sv-new="${n}"><span class="slot-no">${n}</span><span class="grow muted sv-new">${icon('plus')}はじめから</span></div>`;
    // 押すとその記録に切り替わる（ロック・消すのボタンは別。2026-10-04 ユーザー指示）
    return `<div class="sv-card ${now ? 'now' : 'tap'}" ${now ? '' : `data-sv-use="${n}"`}>
      <span class="slot-no">${n}</span>
      <span class="sv-info"><b>${esc(s.company)}</b><span class="vals">${val('coin', yen(s.money))}${val('star', s.rep)}${val('crown', legendCount(s))}</span></span>
      <span class="sv-btns">
        ${now ? '<span class="sv-now">プレイ中</span>' : ''}
        <span class="sv-row2">
          <button class="sv-lock ${s.locked ? 'on' : ''}" data-sv-lock="${n}" aria-label="ロック">${icon('lock')}</button>
          <button class="sv-del" data-sv-del="${n}" ${s.locked ? 'disabled' : ''} aria-label="消す">${icon('trash')}</button>
        </span>
      </span>
    </div>`;
  };
  $('#settings-body').innerHTML = `
    <button class="set-row link-row" id="set-back">${icon('back')}<span class="grow">記録</span></button>
    <div class="sv-list">${cloud.SLOTS.map(card).join('')}</div>`;
  $('#set-back').onclick = () => setPage('main');
  const b = $('#settings-body');
  b.querySelectorAll('[data-sv-use]').forEach(
    (x) =>
      (x.onclick = async (e) => {
        if (e.target.closest('.sv-row2')) return; // ロック・消すを押したときは切り替えない
        $('#settings').close();
        await useSlot(+x.dataset.svUse);
        if (S) enterGame();
      }),
  );
  b.querySelectorAll('[data-sv-new]').forEach(
    (x) =>
      (x.onclick = () => {
        save();
        $('#settings').close();
        showTitle();
        newSlot = +x.dataset.svNew;
        goStep(1);
      }),
  );
  b.querySelectorAll('[data-sv-lock]').forEach(
    (x) =>
      (x.onclick = () => {
        const n = +x.dataset.svLock;
        if (n === slot) {
          S.locked = !S.locked;
          commit();
        } else {
          const st = loadLocal(n);
          st.locked = !st.locked;
          st.savedAt = Date.now();
          try {
            localStorage.setItem(saveKey(n), JSON.stringify(st));
          } catch {}
          cloud.putOther(n, st).catch(() => {});
        }
        renderSlots();
      }),
  );
  b.querySelectorAll('[data-sv-del]').forEach(
    (x) =>
      (x.onclick = async () => {
        const n = +x.dataset.svDel;
        const st = slotData(n);
        if (!st || st.locked) return;
        const u = cloud.currentUser();
        if (!(await ask({ head: askSlot(n, st), text: `この記録を消しますか？${u ? '\nクラウドの記録も消えます' : ''}`, ok: '消す' }))) return;
        if (!(await ask({ head: askSlot(n, st), text: '本当に消しますか？\nもとに戻せません', ok: '消す' }))) return;
        try {
          localStorage.removeItem(saveKey(n));
        } catch {}
        await cloud.clear(n).catch(() => {});
        if (n === slot) {
          S = null;
          location.reload(); // 遊んでいた記録を消したときはタイトルから
        } else renderSlots();
      }),
  );
}
function setPage(p) {
  settingsPage = p;
  renderSettings();
}

function renderSettings() {
  if (settingsPage === 'rename' && S) return renderRename();
  if (settingsPage === 'more') return renderMore();
  if (settingsPage === 'slots') return renderSlots();
  if (settingsPage === 'face' && S) return renderFace();
  const inGame = S && !$('#game').classList.contains('hidden');
  $('#settings-body').innerHTML = `
    ${inGame ? `<button class="big set-title" id="to-title">${icon('home')}タイトルへ</button>` : ''}
    ${inGame ? `<button class="set-row link-row" id="to-rename">${icon('pen')}<span class="grow">名前を変更</span>${icon('back', 'flip')}</button>` : ''}
    ${inGame ? `<button class="set-row link-row" id="to-face">${icon('face')}<span class="grow">顔を変更</span>${icon('back', 'flip')}</button>` : ''}
    ${inGame ? `<button class="set-row link-row" id="to-slots">${icon('box')}<span class="grow">記録</span><span class="muted">${slot}</span>${S.locked ? icon('lock') : ''}${icon('back', 'flip')}</button>` : ''}
    <button class="set-row link-row set-more" id="to-more"><span class="grow">アカウントと記録</span>${icon('back', 'flip')}</button>`;
  $('#to-rename') && ($('#to-rename').onclick = () => setPage('rename'));
  $('#to-face') && ($('#to-face').onclick = () => setPage('face'));
  $('#to-slots') && ($('#to-slots').onclick = () => setPage('slots'));
  $('#to-more') && ($('#to-more').onclick = () => setPage('more'));
  $('#to-title') &&
    ($('#to-title').onclick = () => {
      save();
      $('#settings').close();
      showTitle();
    });
}
$('#open-settings').onclick = () => {
  settingsPage = 'main';
  renderSettings();
  $('#settings').showModal();
};

const legendCount = (s) => s.members.filter((m) => m.kind === 'legend').length;

// ログインしたとき：クラウドとこの端末の記録のどちらを使うか
async function decide(remote) {
  G.migrate(remote);
  if (!S) return 'remote';
  if (remote.seed === S.seed) return (remote.savedAt ?? 0) >= (S.savedAt ?? 0) ? 'remote' : 'local';
  const desc = (s) => `${s.company}  ${yen(s.money)}  レジェンド${legendCount(s)}`;
  return (await ask({ text: `どちらの記録を使いますか？\n\nクラウド：${desc(remote)}\nこの端末：${desc(S)}`, ok: 'クラウド', cancel: 'この端末', safe: true })) ? 'remote' : 'local';
}

// クラウドの記録（ログイン時・ほかの端末で保存されたとき）を反映する
function applyState(remote) {
  G.migrate(remote);
  const first = !S;
  S = remote;
  G.advance(S, Date.now());
  try {
    localStorage.setItem(saveKey(slot), JSON.stringify(S));
  } catch {}
  $('#assign').close();
  if ($('#game').classList.contains('hidden')) {
    // タイトル画面にいるときは入らない（「つづきから」を押していれば onSynced で入る）
    if (!$('#start').classList.contains('hidden') && at === 0) refreshTitle();
  } else renderAll();
  void first;
}

// ---------- 起動 ----------
S = loadLocal();
if (S) {
  const away = Date.now() - S.time;
  pendingWelcome = [G.advance(S, Date.now()), away];
  save();
}
showTitle();
setInterval(tick, 1000);
// クラウドにある、いま遊んでいない方の記録を、この端末の記録と合わせる（新しい方を残す）
// この端末の方が新しければ、それを返してクラウドに保存してもらう
function syncOther(n, remote, fromListen = false) {
  const local = loadLocal(n);
  if (remote && (!local || (remote.savedAt ?? 0) >= (local.savedAt ?? 0))) {
    try {
      localStorage.setItem(saveKey(n), JSON.stringify(remote));
    } catch {}
    if ($('#game').classList.contains('hidden') && at === 0) refreshTitle();
    return null;
  }
  return fromListen ? null : local;
}

cloud.init({ getState: () => S, applyState, decide, onStatus: showSync, onSynced, syncOther, slot: () => slot, alert: (text) => ask({ text, ok: 'OK', cancel: null, safe: true }) });
