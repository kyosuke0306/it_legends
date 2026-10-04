// 画面まわり。ゲームの中身は game/state.js、数字は game/rules.js
// 文字は少なく、アイコンと数字で見せる（絵文字は使わない。アイコンは icons.js）
import { LEGENDS, byId } from './data.js';
const LEGEND_COLOR = 0xf0b93a; // レジェンドはランクを付けず、みんな同じ金色（ユーザー指示 2026-10-01）
import { createCharacter, preloadCharacters, thumbnailUrl } from './character.js';
import { Stage, renderThumbnail } from './stage.js';
import { buildPerson } from './outfits.js';
import { Office } from './office.js';
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

// 記録は2つまで。1 はもとからの場所（今までの記録はそのまま 1 になる）、2 は別の場所
const SAVE_KEY = 'it_legends.save.v1';
const SLOT_KEY = 'it_legends.slot'; // いま遊んでいる記録の番号
const saveKey = (slot) => (slot === 2 ? `${SAVE_KEY}.2` : SAVE_KEY);
let slot = 1;
try {
  slot = localStorage.getItem(SLOT_KEY) === '2' ? 2 : 1;
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
function dur(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 && h < 10 ? `${h}時間${m % 60}分` : `${h}時間`;
  return h % 24 ? `${Math.floor(h / 24)}日${h % 24}時間` : `${Math.floor(h / 24)}日`;
}
// 依頼の種類の札（Web・アプリ・インフラ…）。色は種類ごと（.cat-web など）。レジェンドの出会いの条件と見比べられるように
// 得意な依頼が多い時期（序盤・中盤・後半）
const peakTag = (j) => `<span class="peak-tag peak-${j.peak}">${R.PEAK_NAMES[j.peak]}</span>`;
const goodTag = '<span class="good-tag">得意</span>';
const catTag = (cat) => `<span class="cat-tag cat-${cat}">${R.CAT_NAMES[cat]}</span>`;
const val = (name, text, cls = '') => `<span class="val ${cls}">${icon(name)}${text}</span>`;
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
  return `<span class="av face ${m.kind === 'temp' ? 'temp' : ''}" style="--c:${c}" data-face="${esc(k)}">${inner}</span>`;
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
  return `<div class="prog"><div class="bar" data-start="${start}" data-ends="${end}"><i></i></div><span class="left" data-left="${end}"></span></div>`;
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

// タイトル画面。記録があれば「つづきから」を大きく
function showTitle() {
  $('#start').classList.remove('hidden');
  $('#game').classList.add('hidden');
  $('#title-msg').textContent = '';
  closeSlots();
  titleLegends();
  const any = Boolean(S || loadLocal(otherSlot()));
  $('#btn-continue').classList.toggle('sub', !any);
  $('#btn-new').classList.toggle('sub', any);
  if (any) $('#btn-continue').after($('#btn-new')); // 大きい方を上に
  else $('#btn-new').after($('#btn-continue'));
  goStep(0);
}

// ----- 記録1・記録2 -----
const otherSlot = () => (slot === 2 ? 1 : 2);
const slotData = (n) => (n === slot ? S : loadLocal(n));
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
function openSlots(mode) {
  const card = (n) => {
    const s = slotData(n);
    const info = s
      ? `<b>${esc(s.company)}</b><span class="vals">${val('coin', yen(s.money))}${val('star', s.rep)}${val('crown', legendCount(s))}</span>`
      : `<span class="muted">${icon('plus')}</span>`;
    return `<button class="slot ${s ? '' : 'empty'}" data-slot="${n}" ${mode === 'continue' && !s ? 'disabled' : ''}><span class="slot-no">${n}</span><span class="slot-info">${info}</span></button>`;
  };
  $('#title-slots').innerHTML = `${card(1)}${card(2)}<button class="slot-back" id="slot-back">${icon('back')}</button>`;
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
        if (slotData(n) && !confirm(`記録${n} は消えます。はじめからにしますか？`)) return;
        newSlot = n;
        closeSlots();
        goStep(1);
      }),
  );
}
function closeSlots() {
  $('#title-slots').classList.add('hidden');
  $('#title-buttons').classList.remove('hidden');
}

$('#btn-continue').onclick = async () => {
  const other = loadLocal(otherSlot());
  if (S && other) return openSlots('continue'); // 記録が2つあるときは選ぶ
  if (S) return enterGame();
  if (other) {
    await useSlot(otherSlot());
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
  // 記録があるときは、どちらに作るかを選ぶ（もう片方は消えない）
  if (S || loadLocal(otherSlot())) return openSlots('new');
  newSlot = slot;
  goStep(1);
};

// ログインしてクラウドと合わせ終わったとき
function onSynced() {
  if (!wantContinue) return;
  wantContinue = false;
  if (S) enterGame();
  else if (loadLocal(otherSlot())) useSlot(otherSlot()).then(enterGame);
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
    $(sel).onkeydown = (e) => e.key === 'Enter' && !e.isComposing && $(sel).value.trim() && goStep(at + 1);
  });
  check();
  document.querySelectorAll('#start [data-next]').forEach((b) => (b.onclick = () => goStep(at + 1)));

  let chosen = null;
  const box = $('#start-jobs');
  box.innerHTML = Object.entries(R.JOBS)
    .map(
      ([id, j]) => `<button class="job art-3d" data-job="${id}" style="--c:${hex(j.shirt)}">
        <img src="assets/jobs/${id}.webp" alt="">
        <b>${j.full}</b><small>${peakTag(j)}${j.perkText}</small>
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
    scrollTo(0, 0);
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
  return S.products.reduce((a, p) => a + G.productIncome(S, p, Date.now(), ce), 0);
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
    list.push({ l, conds, avg, key: [-avg, R.LEGEND_RULES[l.id].meet.legends ? 1 : 0, modelIds.has(l.id) ? 0 : 1, order[l.rarity]] });
  }
  list.sort((a, b) => a.key.findIndex((v, i) => v !== b.key[i]) < 0 ? 0 : (([x, y]) => x - y)(a.key.map((v, i) => [v, b.key[i]]).find(([x, y]) => x !== y)));
  return list[0] ?? null;
}
function renderNextLegend(show) {
  const n = show && nextLegend();
  const box = $('#next-legend');
  if (!n) return (box.innerHTML = '');
  // まだのうちで、いちばん進んでいない条件（次にやること）
  const todo = n.conds.filter((c) => !c.ok).sort((a, b) => a.ratio - b.ratio)[0];
  box.innerHTML = `<button class="next-legend" id="go-next-legend">
    <span class="nl-thumb"><img data-thumb="${n.l.id}" alt=""></span>
    <span class="nl-main">${todo ? `<small>${esc(todo.label)}</small><i><b style="width:${pct(todo.ratio)}"></b></i>` : `<small>${icon('spark')}</small>`}</span>
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
  $('#office-chips').innerHTML = `<span class="chip">${o.name}${floors}</span><span class="chip">${icon('people')}${G.seatsUsed(S)}/${G.capacity(S)}</span>${
    S.products.length ? `<span class="chip">${icon('box')}+${yen(hourlyIncome())}/時</span>` : ''
  }`;
  const enc = S.encounter;
  $('#encounter').innerHTML = enc
    ? `<button class="encounter" id="go-encounter">${icon('spark', 'spin')}<span>誰かが現れた</span><span class="left" data-left="${enc.until}"></span></button>`
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
    .join('') + (busyUntil ? `<div class="act-lock"><span class="pill">${icon('task')}<span class="what">仕事中</span><span class="left" data-left="${busyUntil}"></span></span></div>` : '');
  $('#activity').querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => G.setActivity(S, b.dataset.act) && commit()));
  const next = R.OFFICES[S.office + 1];
  if (next) {
    const okMoney = S.money >= next.cost;
    const okRep = S.rep >= next.rep;
    $('#office-info').innerHTML = `<button class="panel upgrade" id="upgrade" ${okMoney && okRep ? '' : 'disabled'}>
        ${icon('move')}<span class="grow"><b>${next.name}</b> ${val('people', next.cap)}</span>
        ${val('coin', yen(next.cost), okMoney ? 'ok' : '')}${val('star', next.rep, okRep ? 'ok' : '')}
      </button>`;
    $('#upgrade').onclick = () => G.upgradeOffice(S, Date.now()) && commit();
  } else {
    // いちばん上の会社のあとは、いくらでも増築（席が増える）
    const cost = G.expandCost(S);
    $('#office-info').innerHTML = `<button class="panel upgrade" id="upgrade" ${S.money >= cost ? '' : 'disabled'}>
        ${icon('plus')}<span class="grow"><b>増築</b> ${val('people', `+${R.FLOOR_CAP}`)}</span>${val('coin', yen(cost), S.money >= cost ? 'ok' : '')}
      </button>`;
    $('#upgrade').onclick = () => G.expand(S, Date.now()) && commit();
  }
}

// ----- 仕事 -----
// 宣伝: お金を出すと、期限つきで依頼が届きやすくなる（求人広告と同じ形）
function prRow() {
  if (G.prActive(S, Date.now()))
    return `<div class="panel ad-row pr-row on">${icon('ad')}<b>宣伝中</b><span class="grow"></span>${val('hourglass', `<span data-left="${S.prUntil}"></span>`)}</div>`;
  const cost = G.prCost(S);
  return `<button class="panel ad-row pr-row" id="pr" ${S.money < cost ? 'disabled' : ''}>${icon('ad')}<b>宣伝</b><span class="grow"></span>${val('clock', dur(R.PR_DAYS * R.DAY))}${val('coin', yen(cost), S.money >= cost ? 'ok' : '')}</button>`;
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
      // 手の空いた人の中に、この依頼が得意な職種の人がいれば右の端を光らせる
      (o) => `<button class="panel offer cat-${o.cat} ${G.freeMembers(S).some((m) => G.isGood(m, G.goodJobs(o))) ? 'fit' : ''}" data-offer="${o.id}" ${canWork ? '' : 'disabled'}>
        <span class="offer-top"><b>${o.expiresAt - R.OFFER_LIFE > seenSnap.work ? newTag : ''}${catTag(o.cat)}${esc(o.title)}</b><span class="expire" data-expire="${o.expiresAt}">${icon('hourglass')}あと<span data-left="${o.expiresAt}"></span></span></span>
        <span class="vals">${val('clock', dur(o.hours * R.HOUR))}${val('people', o.team)}${val('coin', yen(o.reward), 'strong')}${val('star', `+${o.rep}`)}</span>
      </button>`,
    )
    .join('');
  // これまでの仕事：成功した数だけ出し、押すと下からくわしく出る（openHistory）
  $('#view-work').innerHTML = `
    <div class="work-top"><button class="hist-btn" id="open-history">${icon('check')}${S.counts.tasks}</button></div>
    ${running}
    ${prRow()}
    ${offers || `<p class="empty">${icon('task')}</p>`}`;
  fillThumbs($('#view-work'));
  $('#view-work').querySelectorAll('[data-offer]').forEach((b) => (b.onclick = () => assignTask(+b.dataset.offer)));
  $('#view-work').querySelectorAll('[data-run]').forEach((el) => (el.onclick = () => openRunning(+el.dataset.run)));
  $('#open-history').onclick = () => openHistory();
  $('#pr') && ($('#pr').onclick = () => G.startPR(S, Date.now()) && commit());
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
              (h) => `<div class="hist-row cat-${h.cat} ${h.ok ? '' : 'ng'}"><i></i>
                <span class="hist-main"><b>${esc(h.title)}</b><small>${[...h.who, `${ago(h.t)}前`].map(esc).join('・')}</small></span>
                <span class="hist-vals">${h.ok ? icon('check', 'ok') : icon('error', 'bad')}${h.great ? icon('bolt', 'res-great') : ''}${h.early ? icon('clock', 'res-early') : ''}<b>${h.money == null ? '—' : yen(h.money)}</b>${
                  h.rep == null ? '' : `<small class="${h.rep < 0 ? 'bad' : ''}">${icon('star')}${h.rep > 0 ? '+' : ''}${h.rep}</small>`
                }</span>
              </div>`,
            )
            .join('')
        : `<p class="empty">${icon('task')}</p>`
    }</div>
    <button class="big ghost" id="hist-close">OK</button>`;
  if (!dlg.open) dlg.showModal();
  $('#assign-body').querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => openHistory(cat === b.dataset.cat ? null : b.dataset.cat)));
  $('#hist-close').onclick = () => dlg.close();
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
        (m) => `<div class="person ${m.kind === 'temp' ? 'temp' : ''} active">
          ${avatar(m)}<span class="pname">${esc(G.displayName(m))}<small>${jobShort(m)} Lv${m.level}${m.kind === 'temp' ? '・派遣' : ''}</small></span><span class="pw ${G.isGood(m, G.goodJobs(t)) ? 'good' : ''}">${G.isGood(m, G.goodJobs(t)) ? goodTag : ''}${icon('bolt')}${power(m)}</span>
        </div>`,
      )
      .join('')}</div>
    <div class="preview">${val('target', pct(p.chance), p.chance < 0.5 ? 'bad' : p.chance >= 0.8 ? 'ok' : '')}${val('clock', dur(t.endsAt - t.startAt))}${val('coin', yen(p.reward))}${val('star', `+${p.rep}`, p.great || p.early ? 'ok' : '')}</div>
    ${progress(t.startAt, t.endsAt)}
    ${room ? `<button class="big" id="run-add">${icon('plus')}${icon('people')}</button>` : `<button class="big ghost" id="run-close">OK</button>`}`;
  fillThumbs($('#assign-body'));
  updateTimers();
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
  openAssign({
    title: o.title,
    max: o.team,
    w: o.w,
    good: G.goodJobs(o),
    need: o.diff,
    // 要員派遣（お金を払って、席の数を超えて仕事の間だけ人を借りる）
    temp: { make: (i) => G.makeTemp(S, o, i), fee: G.tempFee(o) },
    preview: (ids, temps) => {
      const p = G.taskPreview(S, o, ids, temps);
      return `${val('target', pct(p.chance), p.chance < 0.5 ? 'bad' : p.chance >= 0.8 ? 'ok' : '')}${val('clock', dur(p.duration), p.early ? 'ok' : '')}${val('coin', yen(p.reward))}${val('star', `+${p.rep}`, p.great || p.early ? 'ok' : '')}`;
    },
    confirm: (ids, temps) => G.startTask(S, offerId, ids, Date.now(), temps.length),
  });
}

// 人を選ぶ（仕事・開発で共通）。下から出るシート
// temp があれば要員派遣の人も選べる（自分の会社から minOwn 人は出す）
// base は仕事中に人を足すときの、もう働いている人（max は足せる人数）
function openAssign({ title, max, w, good = [], need, preview, confirm, temp = null, base = [], minOwn = 1, go = '任せる', extra = '' }) {
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
    const tempRow = (m, on) => `<button class="person temp ${on ? 'active' : ''}" data-temp="${on ? 'drop' : 'add'}" ${on || canMore ? '' : 'disabled'}>
        ${avatar(m)}<span class="pname">${esc(m.name)}<small>${R.JOBS[m.job].name} Lv${m.level}</small></span><span class="fee">${icon('coin')}${yen(temp.fee)}</span>${pw(m)}
      </button>`;
    const tempHtml = temp ? `<div class="sec temp-head">${icon('plus')}<b>派遣</b></div>${temps.map((m) => tempRow(m, true)).join('')}${room ? tempRow(temp.make(nTemps), false) : ''}` : '';
    $('#assign-body').innerHTML = `
      <div class="sheet-head"><b>${esc(title)}</b><span class="muted">${icon('people')}${size}/${max > 20 ? free.length : base.length + max}</span></div>
      ${extra}
      <div class="need ${sum >= need ? 'full' : ''}">${icon('bolt')}<span class="need-bar"><i style="width:${pct(Math.min(1, sum / need))}"></i></span><span class="need-num"><b>${sum}</b>/${need}</span></div>
      <div class="pick">${free
        .map(
          (m) => `<button class="person ${chosen.has(m.id) ? 'active' : ''}" data-id="${m.id}">
            ${avatar(m)}<span class="pname">${esc(G.displayName(m))}<small>${jobShort(m)} Lv${m.level}</small></span>${pw(m)}
          </button>`,
        )
        .join('')}${tempHtml}</div>
      <div class="preview">${ready ? preview(ids, temps) : '&nbsp;'}</div>
      <button class="big" id="assign-go" ${ready ? '' : 'disabled'}>${go}${nTemps ? ` <small>${icon('coin')}-${yen(temp.fee * nTemps)}</small>` : ''}</button>`;
    fillThumbs($('#assign-body'));
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
    const wait = `<span class="muted">${val('clock', `<span data-left="${m.until}"></span>`)}</span>`; // 辞退するまでの時間
    return `${wait}<button class="btn hire" data-hire="${m.id}" ${can ? '' : 'disabled'}>採用 ${yen(cost)}</button>`;
  };
  return `<div class="member ${m.kind} ${m.walkin ? 'walkin' : ''}">
    <button class="mrow" data-open="${m.id}">${avatar(m)}${status}
      <span class="pname">${candidate && (m.at ?? 0) > seenSnap.team ? newTag : ''}${esc(G.displayName(m))}<small>${jobShort(m)} Lv${m.level}</small></span>
      ${statBars(st)}
    </button>
    ${
      candidate
        ? `<div class="more"><span class="perk">${esc(perkText(m))}</span>${
            m.salary ? `<span class="muted">${val('wallet', `${yen(m.salary)}/日`)}</span>` : ''
          }${!candidate && m.kind === 'staff' ? `<button class="btn fire" data-dismiss="${m.id}" ${m.busy ? 'disabled' : ''}>解雇</button>` : ''}${
            m.kind === 'legend' ? `<button class="link small" data-legend="${m.legend}">見る</button>` : ''
          }${candidate ? hireBtn() : ''}</div>`
        : ''
    }
  </div>`;
}
// 仲間（CEO・社員）や面接に来た人のくわしい画面。目的は、その職種がどんな仕事かがわかること
function openMember(m, candidate = false) {
  if (!m) return;
  const j = R.JOBS[m.job];
  const st = candidate ? m.stats : G.statsOf(S, m);
  const cost = candidate ? G.hireCost(S, m) : 0;
  const canHire = candidate && G.seatsUsed(S) < G.capacity(S) && S.money >= cost;
  $('#detail-info').innerHTML = `<h2>${esc(G.displayName(m))}</h2><div class="sub">${j.full}</div>
    <p class="job-desc">${esc(j.desc)}</p>
    <div class="ability">${esc(j.perkText)}</div>
    <div class="good-row">${peakTag(j)}${goodTag}${icon('bolt')}×${R.JOB_GOOD}</div>
    <div class="lvrow">Lv${m.level} ${statBars(st)}</div>
    ${m.salary ? `<div class="vals">${val('wallet', `${yen(m.salary)}/日`)}</div>` : ''}
    ${candidate ? `<button class="big" id="m-hire" ${canHire ? '' : 'disabled'}>採用 ${yen(cost)}</button>` : ''}
    ${!candidate && m.kind === 'staff' ? `<button class="btn fire" id="m-fire" ${m.busy ? 'disabled' : ''}>解雇</button>` : ''}`;
  $('#m-hire') &&
    ($('#m-hire').onclick = () => {
      if (G.hire(S, m.id, Date.now())) {
        $('#detail').close();
        commit();
      }
    });
  $('#m-fire') &&
    ($('#m-fire').onclick = () => {
      if (confirm('解雇しますか？') && G.dismiss(S, m.id, Date.now())) {
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
// 求人広告: お金を出すと、期限つきで面接に来る人が増える。出している間は残り時間を出す
function adRow() {
  if (G.adActive(S, Date.now()))
    return `<div class="panel ad-row on">${icon('ad')}<b>求人広告中</b><span class="grow"></span>${val('hourglass', `<span data-left="${S.adUntil}"></span>`)}</div>`;
  const cost = G.adCost(S);
  return `<button class="panel ad-row" id="ad" ${S.money < cost ? 'disabled' : ''}>${icon('ad')}<b>求人広告</b><span class="grow"></span>${val('clock', dur(R.AD_DAYS * R.DAY))}${val('coin', yen(cost), S.money >= cost ? 'ok' : '')}</button>`;
}
function renderTeam() {
  S.teamSeenAt = Date.now(); // 仲間タブを見た（通知の点を消す）
  renderHeader();
  const v = $('#view-team');
  v.innerHTML = `
    <div class="list">${S.members.map((m) => memberRow(m)).join('')}</div>
    <div class="sec interview">${icon('people')}<b>面接</b><span class="grow"></span>${val('home', `${G.seatsUsed(S)}/${G.capacity(S)}`)}${val('clock', `<span data-left="${S.candAt + R.CANDIDATE_EVERY}"></span>`)}</div>
    ${adRow()}
    <div class="list">${
      S.candidates.length
        ? S.candidates.map((c) => memberRow(c, { candidate: true })).join('')
        : `<button class="panel hint-meetup" id="go-meetup">${icon('seminar')}<span>${R.ACTIVITIES.meetup.name}</span></button>`
    }</div>`;
  fillThumbs(v);
  v.querySelectorAll('[data-open]').forEach(
    (b) =>
      (b.onclick = (e) => {
        if (e.target.closest('[data-hire]')) return;
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
  $('#ad') && ($('#ad').onclick = () => G.startAd(S, Date.now()) && commit());
  v.querySelectorAll('[data-hire]').forEach((b) => (b.onclick = () => G.hire(S, +b.dataset.hire, Date.now()) && commit()));
  v.querySelectorAll('[data-dismiss]').forEach((b) => (b.onclick = () => confirm('解雇しますか？') && G.dismiss(S, +b.dataset.dismiss, Date.now()) && commit()));
  v.querySelectorAll('[data-legend]').forEach((b) => (b.onclick = () => openLegend(b.dataset.legend)));
}

// ----- 製品 -----
function trendIcon(x) {
  if (x >= 1.45) return icon('up2', 't up2');
  if (x >= 1.1) return icon('up', 't up');
  if (x >= 0.85) return icon('flat', 't');
  return icon('down', 't down');
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
      return `<button class="panel genre" data-genre="${k}" ${locked || !canStart || S.money < g.cost ? 'disabled' : ''}>
        <span class="gname">${locked ? icon('lock') : ''}${g.name}</span>
        <span class="trend">${trendIcon(G.trendAt(S, k, now))}${seeNext ? `<span class="arrow">→</span>${trendIcon(G.trendAt(S, k, next + 1))}` : ''}</span>
        <span class="vals">${val('coin', yen(g.cost))}${val('clock', dur(g.hours * R.HOUR))}</span>
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
  // 発売した製品：アプリのアイコンのような絵・名前・出来・1時間の稼ぎ・これまでの稼ぎ（新しい順）
  const products = [...S.products]
    .reverse()
    .map(
      (p) => `<div class="panel prod">
        ${prodIcon(p.genre)}
        <span class="prod-main"><b>${esc(p.name)}</b><small>${R.GENRES[p.genre].name}</small>${rating(p.q)}</span>
        <span class="prod-earn"><b>+${yen(G.productIncome(S, p, now, ce))}<small>/時</small></b><small>${icon('wallet')}${yen(p.earned ?? 0)}</small></span>
        <button class="x" data-stop="${p.id}" aria-label="販売終了">×</button>
      </div>`,
    )
    .join('');
  $('#view-product').innerHTML = `
    <div class="sec">${icon('clock')}<span data-left="${next}"></span></div>
    <div class="genres">${genres}</div>
    ${devs}
    ${S.products.length ? `<div class="sec prod-head">${icon('box')}<b>自社製品</b><span class="grow"></span>${val('coin', `+${yen(hourlyIncome())}/時`, 'ok')}</div>${products}` : ''}`;
  const v = $('#view-product');
  v.querySelectorAll('[data-genre]').forEach((b) => (b.onclick = () => assignDev(b.dataset.genre)));
  fillThumbs(v);
  v.querySelectorAll('[data-dev]').forEach((el) => (el.onclick = () => openDevRunning(+el.dataset.dev)));
  v.querySelectorAll('[data-stop]').forEach((b) => (b.onclick = () => confirm('販売をやめますか？') && (G.stopProduct(S, +b.dataset.stop), commit())));
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
  const income = (q) => G.productIncome(S, { genre: d.genre, q: Math.min(3, q), launchedAt: now }, now);
  $('#assign-body').innerHTML = `
    <div class="sheet-head"><b>${g.name}</b><span class="muted">${icon('people')}${team.length}</span></div>
    <div class="need ${sum >= g.need ? 'full' : ''}">${icon('bolt')}<span class="need-bar"><i style="width:${pct(Math.min(1, sum / g.need))}"></i></span><span class="need-num"><b>${sum}</b>/${g.need}</span></div>
    <div class="pick">${team
      .map(
        (m) => `<div class="person active">
          ${avatar(m)}<span class="pname">${esc(G.displayName(m))}<small>${jobShort(m)} Lv${m.level}</small></span><span class="pw">${icon('bolt')}${power(m)}</span>
        </div>`,
      )
      .join('')}</div>
    <div class="preview">${rating(p.quality * 0.6)}<span class="muted">〜</span>${rating(p.quality * 1.4)}${trendIcon(G.trendAt(S, d.genre, now))}</div>
    <div class="preview">${val('coin', `+${yen(income(p.quality * 0.6))}〜${yen(income(p.quality * 1.4))}/時`)}${val('box', yen(g.cost))}</div>
    ${progress(d.startAt, d.endsAt)}
    <button class="big ghost" id="run-close">OK</button>`;
  fillThumbs($('#assign-body'));
  updateTimers();
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
      return `<button class="card ${has ? '' : left ? 'left' : 'locked'}" data-id="${l.id}">
        <div class="thumb"><img data-thumb="${l.id}" alt=""></div>
        ${has ? `<div class="name">${l.name}</div>` : left ? `<div class="name">${l.name}</div><div class="left-tag">${icon('back')}辞任</div>` : conds}
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
    <div class="conds">${conds}</div>`;
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
    ${left ? `<p class="scene">${esc(R.LEGEND_RULES[id].quitText)}</p><button class="big" id="rehire" ${S.money >= cost ? '' : 'disabled'}>呼び戻す <small>${icon('coin')}${yen(cost)}</small></button>` : ''}
    <details><summary>くわしく</summary><p>${legend.summary}</p></details>`;
  $('#rehire') &&
    ($('#rehire').onclick = () => {
      if (!G.rehire(S, id, Date.now())) return;
      commit();
      $('#detail-info').innerHTML = `${legendHead(legend)}<div class="joined">戻ってきた</div><div class="ability">${esc(R.LEGEND_RULES[id].abilityText)}</div>`;
    });
  $('#detail').showModal();
  showOnDetail(legend);
}

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
    <div class="vals">${val('target', pct(G.scoutChance(S, e.id)))}${val('clock', `<span data-left="${e.until}"></span>`)}</div>
    <button class="big" id="scout">仲間に誘う</button>`;
  updateTimers();
  $('#detail').showModal();
  // まだ姿はシルエットだけ
  const wrap = $('#detail-canvas').parentElement;
  showSilhouette(legend);
  $('#scout').onclick = async () => {
    const r = G.scout(S, Date.now());
    commit();
    wrap.querySelector('.silhouette')?.remove();
    if (r === 'joined') {
      $('#detail-info').innerHTML = `${legendHead(legend)}<div class="joined">仲間になった</div><div class="ability">${esc(rule.abilityText)}</div>`;
      await showOnDetail(legend, { reveal: true });
    } else {
      $('#detail-info').innerHTML = `${legendHead(legend, { secret: true })}<p class="scene">「まだ早いようだ」</p>`;
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
  { sel: '#assign[open] .temp-head', text: '派遣<br>お金を払うと、仕事の間だけ<br>人を借りられる', ok: true, sheet: true, back: 1 },
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
      (t) => `<div class="result ${t.ok ? 'ok' : 'bad'}">${icon(t.ok ? 'check' : 'error')}<b>${esc(t.title)}<span class="res-tag">${t.ok ? '成功' : '失敗'}</span></b>
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
  const income = p ? G.productIncome(S, p, p.launchedAt) : 0;
  return `<div class="launch">
    <div class="launch-art">${prodIcon(genre, 'big')}</div>
    ${alone ? '' : `<span class="launch-tag">${icon('box')}発売</span>`}
    <b class="launch-name">${esc(e.name)}</b>
    <small>${R.GENRES[genre]?.name ?? ''}</small>
    ${rating(e.q)}
    ${income ? `<span class="launch-earn">+${yen(income)}<small>/時</small></span>` : ''}
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
  const rivals = rivalsHtml(ev, { head: false }) + quitsHtml(ev, { head: false });
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
    ${S ? `<div class="set-row">${icon('error')}<span class="grow">最初から</span><button class="btn ghost danger small" id="reset">消す</button></div>` : ''}`;
  $('#set-back').onclick = () => setPage('main');
  if ($('#login')) {
    $('#login').onclick = () => cloud.login();
    cloud.warmUp();
  }
  $('#logout') && ($('#logout').onclick = () => confirm('ログアウトしますか？') && cloud.logout().then(() => setPage('main')));
  $('#reset') &&
    ($('#reset').onclick = async () => {
      if (!confirm(`記録${slot} を消しますか？${u ? '\n（クラウドの記録も消えます）' : ''}`)) return;
      if (!confirm('本当に消しますか？もとに戻せません')) return;
      S = null;
      try {
        localStorage.removeItem(saveKey(slot)); // 消すのはいま遊んでいる記録だけ
      } catch {}
      await cloud.clear().catch(() => {});
      location.reload();
    });
}
function setPage(p) {
  settingsPage = p;
  renderSettings();
}

function renderSettings() {
  if (settingsPage === 'rename' && S) return renderRename();
  if (settingsPage === 'more') return renderMore();
  if (settingsPage === 'face' && S) return renderFace();
  const inGame = S && !$('#game').classList.contains('hidden');
  $('#settings-body').innerHTML = `
    ${inGame ? `<button class="big set-title" id="to-title">${icon('home')}タイトルへ</button>` : ''}
    ${inGame ? `<button class="set-row link-row" id="to-rename">${icon('pen')}<span class="grow">名前を変更</span>${icon('back', 'flip')}</button>` : ''}
    ${inGame ? `<button class="set-row link-row" id="to-face">${icon('face')}<span class="grow">顔を変更</span>${icon('back', 'flip')}</button>` : ''}
    <button class="set-row link-row set-more" id="to-more"><span class="grow">アカウントと記録</span>${icon('back', 'flip')}</button>`;
  $('#to-rename') && ($('#to-rename').onclick = () => setPage('rename'));
  $('#to-face') && ($('#to-face').onclick = () => setPage('face'));
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
  return confirm(`クラウドの記録を使いますか？\n\nクラウド：${desc(remote)}\nこの端末：${desc(S)}`) ? 'remote' : 'local';
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
    if (!$('#start').classList.contains('hidden') && at === 0) showTitle();
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
    if ($('#game').classList.contains('hidden') && at === 0) showTitle();
    return null;
  }
  return fromListen ? null : local;
}

cloud.init({ getState: () => S, applyState, decide, onStatus: showSync, onSynced, syncOther, slot: () => slot });
