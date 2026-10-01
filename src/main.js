// 画面まわり。ゲームの中身は game/state.js、数字は game/rules.js
// 文字は少なく、アイコンと数字で見せる（絵文字は使わない。アイコンは icons.js）
import { LEGENDS, byId } from './data.js';
const LEGEND_COLOR = 0xf0b93a; // レジェンドはランクを付けず、みんな同じ金色（ユーザー指示 2026-10-01）
import { createCharacter, preloadCharacters, thumbnailUrl } from './character.js';
import { Stage, renderThumbnail } from './stage.js';
import { Office } from './office.js';
import { VERSION } from './version.js';
import { icon } from './icons.js';
import * as G from './game/state.js';
import * as R from './game/rules.js';
import * as cloud from './cloud.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
document.getElementById('version').textContent = VERSION;
document.getElementById('title-ver').textContent = VERSION;
$('#open-settings').innerHTML = icon('gear');
document.querySelectorAll('.tab').forEach((t) => t.insertAdjacentHTML('afterbegin', icon(t.dataset.icon)));

const SAVE_KEY = 'it_legends.save.v1';
let S = null; // ゲームの状態
let view = 'office';
let office;

// ---------- 保存 ----------
function loadLocal() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    return s?.v === 1 ? G.migrate(s) : null;
  } catch {
    return null;
  }
}
function save() {
  if (!S) return;
  S.savedAt = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
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
// お金は短く（12.3万 / 1.2億）
function money(n) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
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
const val = (name, text, cls = '') => `<span class="val ${cls}">${icon(name)}${text}</span>`;
const jobShort = (m) => (m.kind === 'legend' ? 'レジェンド' : R.JOBS[m.job].name);
const perkText = (m) => (m.kind === 'legend' ? R.LEGEND_RULES[m.legend].abilityText : R.JOBS[m.job].perkText);
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
function avatar(m) {
  if (m.kind === 'legend') return `<span class="av legend" style="--c:var(--gold)"><img data-thumb="${m.legend}" alt=""></span>`;
  const c = m.kind === 'hero' ? 'var(--accent)' : hex(R.JOBS[m.job].shirt);
  return `<span class="av ${m.kind === 'temp' ? 'temp' : ''}" style="--c:${c}">${esc(m.name.replace(/\s.*/, '').slice(0, 1))}</span>`;
}
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

// タイトルに、3Dのできているレジェンドを並べる。仲間にした人だけ姿を見せ、ほかは影（シークレット）
async function titleLegends() {
  const box = $('#title-legends');
  if (!box) return;
  let ids = [];
  try {
    ids = await (await fetch('models/manifest.json')).json();
  } catch {}
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
  titleLegends();
  $('#btn-continue').classList.toggle('sub', !S);
  $('#btn-new').classList.toggle('sub', Boolean(S));
  if (S) $('#btn-continue').after($('#btn-new')); // 大きい方を上に
  else $('#btn-new').after($('#btn-continue'));
  goStep(0);
}

$('#btn-continue').onclick = () => {
  if (S) return enterGame();
  // この端末に記録がなければ、Google でログインしてクラウドの記録を読む
  wantContinue = true;
  $('#title-msg').textContent = '';
  if (cloud.currentUser()) onSynced();
  else cloud.login();
};
$('#btn-continue').addEventListener('pointerdown', cloud.warmUp, { once: true });
$('#btn-new').onclick = () => {
  if (S && !confirm('いまの記録は消えます。はじめからにしますか？')) return;
  goStep(1);
};

// ログインしてクラウドと合わせ終わったとき
function onSynced() {
  if (!wantContinue) return;
  wantContinue = false;
  if (S) enterGame();
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
        <b>${j.full}</b><small>${j.perkText}</small>
      </button>`,
    )
    .join('');
  box.onclick = (e) => {
    const b = e.target.closest('.job');
    if (!b) return;
    chosen = b.dataset.job;
    box.querySelectorAll('.job').forEach((x) => x.classList.toggle('active', x === b));
    $('#start-go').disabled = false;
  };
  $('#start-go').onclick = () => {
    if (!chosen) return;
    S = G.newGame({ job: chosen, name: $('#start-name').value.trim(), company: $('#start-company').value.trim() });
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
  office ??= new Office($('#office-canvas'));
  preloadCharacters([...G.ownedLegends(S)]);
  renderAll();
  if (pendingWelcome) {
    welcomeBack(...pendingWelcome);
    pendingWelcome = null;
  }
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.onclick = () => {
    view = tab.dataset.view;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
    scrollTo(0, 0);
    renderAll();
  };
});

function renderHeader() {
  $('#company-name').textContent = S.company;
  $('#money').innerHTML = val('coin', yen(S.money), S.money < 0 ? 'minus' : '');
  $('#rep').innerHTML = val('star', S.rep);
  $('#dot-office').classList.toggle('on', Boolean(S.encounter));
  $('#dot-team').classList.toggle('on', S.candidates.some((c) => c.walkin));
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
}

// ----- 会社 -----
function hourlyIncome() {
  const ce = G.companyEffects(S);
  return S.products.reduce((a, p) => a + G.productIncome(S, p, Date.now(), ce), 0);
}
function renderOffice() {
  office.sync(S);
  const o = R.OFFICES[S.office];
  $('#office-chips').innerHTML = `<span class="chip">${o.name}</span><span class="chip">${icon('people')}${G.seatsUsed(S)}/${o.cap}</span>${
    S.products.length ? `<span class="chip">${icon('box')}+${yen(hourlyIncome())}/時</span>` : ''
  }`;
  const enc = S.encounter;
  $('#encounter').innerHTML = enc
    ? `<button class="encounter" id="go-encounter">${icon('spark', 'spin')}<span>誰かが現れた</span><span class="left" data-left="${enc.until}"></span></button>`
    : '';
  if (enc) $('#go-encounter').onclick = openEncounter;
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
  } else $('#office-info').innerHTML = '';
}

// ----- 仕事 -----
function renderWork() {
  S.workSeenAt = Date.now(); // 仕事タブを見た（通知の点を消す）
  renderHeader();
  const byIdM = (id) => S.members.find((m) => m.id === id);
  const running = S.tasks
    .map(
      // タップすると、選ぶ前の仕事と同じように下から詳しいシートが出る（openRunning）
      (t) => `<button class="panel run" data-run="${t.id}"><div class="row1"><b>${esc(t.title)}</b><span class="avs">${[...t.members.map(byIdM).filter(Boolean), ...(t.temps ?? [])].map((m) => avatar(m)).join('')}</span></div>
        ${progress(t.startAt, t.endsAt)}</button>`,
    )
    .join('');
  const canWork = G.freeMembers(S).length > 0;
  const offers = S.offers
    .map(
      (o) => `<button class="panel offer cat-${o.cat}" data-offer="${o.id}" ${canWork ? '' : 'disabled'}>
        <b>${esc(o.title)}</b>
        <span class="vals">${val('clock', dur(o.hours * R.HOUR))}${val('people', o.team)}${val('coin', yen(o.reward), 'strong')}${val('star', `+${o.rep}`)}</span>
      </button>`,
    )
    .join('');
  // これまでの仕事：成功した数だけ出し、押すと下からくわしく出る（openHistory）
  $('#view-work').innerHTML = `
    <div class="work-top"><button class="hist-btn" id="open-history">${icon('check')}${S.counts.tasks}</button></div>
    ${running}
    ${offers || `<p class="empty">${icon('clock')}<span data-left="${S.offerAt + R.OFFER_EVERY}"></span></p>`}`;
  fillThumbs($('#view-work'));
  $('#view-work').querySelectorAll('[data-offer]').forEach((b) => (b.onclick = () => assignTask(+b.dataset.offer)));
  $('#view-work').querySelectorAll('[data-run]').forEach((el) => (el.onclick = () => openRunning(+el.dataset.run)));
  $('#open-history').onclick = () => openHistory();
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
                <span class="hist-main"><b>${esc(h.title)}</b><small>${esc(h.who.join('・'))}・${ago(h.t)}前</small></span>
                <span class="hist-vals">${h.ok ? icon('check', 'ok') : icon('error', 'bad')}${h.great ? icon('bolt', 'res-great') : ''}${h.early ? icon('clock', 'res-early') : ''}<b>${yen(h.money)}</b><small class="${h.rep < 0 ? 'bad' : ''}">${icon('star')}${h.rep > 0 ? '+' : ''}${h.rep}</small></span>
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
  const power = (m) => Math.round(G.teamPower(S, [m], t.w));
  const sum = team.reduce((a, m) => a + power(m), 0);
  const p = G.taskPreview(S, t, t.members.filter((id) => S.members.some((m) => m.id === id)));
  const room = team.length < t.team;
  $('#assign-body').innerHTML = `
    <div class="sheet-head"><b>${esc(t.title)}</b><span class="muted">${icon('people')}${team.length}/${t.team}</span></div>
    <div class="need ${sum >= t.diff ? 'full' : ''}">${icon('bolt')}<span class="need-bar"><i style="width:${pct(Math.min(1, sum / t.diff))}"></i></span><span class="need-num"><b>${sum}</b>/${t.diff}</span></div>
    <div class="pick">${team
      .map(
        (m) => `<div class="person ${m.kind === 'temp' ? 'temp' : ''} active">
          ${avatar(m)}<span class="pname">${esc(G.displayName(m))}<small>${jobShort(m)} Lv${m.level}${m.kind === 'temp' ? '・派遣' : ''}</small></span><span class="pw">${icon('bolt')}${power(m)}</span>
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
function openAssign({ title, max, w, need, preview, confirm, temp = null, base = [], minOwn = 1, go = '任せる', extra = '' }) {
  const dlg = $('#assign');
  const chosen = new Set();
  let nTemps = 0;
  const power = (m) => Math.round(G.teamPower(S, [m], w));
  const free = G.freeMembers(S).sort((a, b) => power(b) - power(a));
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
        ${avatar(m)}<span class="pname">${esc(m.name)}<small>${R.JOBS[m.job].name} Lv${m.level}</small></span><span class="fee">${icon('coin')}${yen(temp.fee)}</span><span class="pw">${icon('bolt')}${power(m)}</span>
      </button>`;
    const tempHtml = temp ? `<div class="sec temp-head">${icon('plus')}<b>派遣</b></div>${temps.map((m) => tempRow(m, true)).join('')}${room ? tempRow(temp.make(nTemps), false) : ''}` : '';
    $('#assign-body').innerHTML = `
      <div class="sheet-head"><b>${esc(title)}</b><span class="muted">${icon('people')}${size}/${max > 20 ? free.length : base.length + max}</span></div>
      ${extra}
      <div class="need ${sum >= need ? 'full' : ''}">${icon('bolt')}<span class="need-bar"><i style="width:${pct(Math.min(1, sum / need))}"></i></span><span class="need-num"><b>${sum}</b>/${need}</span></div>
      <div class="pick">${free
        .map(
          (m) => `<button class="person ${chosen.has(m.id) ? 'active' : ''}" data-id="${m.id}">
            ${avatar(m)}<span class="pname">${esc(G.displayName(m))}<small>${jobShort(m)} Lv${m.level}</small></span><span class="pw">${icon('bolt')}${power(m)}</span>
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
const opened = new Set();
function memberRow(m, { candidate = false } = {}) {
  const st = candidate ? m.stats : G.statsOf(S, m);
  const open = opened.has(m.id);
  const status = candidate ? '' : `<i class="st-dot ${m.busy ? 'busy' : 'free'}"></i>`;
  const hireBtn = () => {
    const cost = G.hireCost(S, m);
    const can = G.seatsUsed(S) < G.capacity(S) && S.money >= cost;
    const wait = `<span class="muted">${val('clock', `<span data-left="${m.until}"></span>`)}</span>`; // 辞退するまでの時間
    return `${wait}<button class="btn hire" data-hire="${m.id}" ${can ? '' : 'disabled'}>採用 ${yen(cost)}</button>`;
  };
  return `<div class="member ${m.kind} ${m.walkin ? 'walkin' : ''} ${open ? 'open' : ''}">
    <button class="mrow" data-open="${m.id}">${avatar(m)}${status}
      <span class="pname">${esc(G.displayName(m))}<small>${jobShort(m)} Lv${m.level}</small></span>
      ${statBars(st)}
    </button>
    ${
      open || candidate
        ? `<div class="more"><span class="perk">${esc(perkText(m))}</span>${
            m.salary ? `<span class="muted">${val('wallet', `${yen(m.salary)}/日`)}</span>` : ''
          }${!candidate && m.kind === 'staff' ? `<button class="btn fire" data-dismiss="${m.id}" ${m.busy ? 'disabled' : ''}>解雇</button>` : ''}${
            m.kind === 'legend' ? `<button class="link small" data-legend="${m.legend}">見る</button>` : ''
          }${candidate ? hireBtn() : ''}</div>`
        : ''
    }
  </div>`;
}
function renderTeam() {
  const v = $('#view-team');
  v.innerHTML = `
    <div class="list">${S.members.map((m) => memberRow(m)).join('')}</div>
    <div class="sec interview">${icon('people')}<b>面接</b><span class="grow"></span>${val('home', `${G.seatsUsed(S)}/${G.capacity(S)}`)}${val('clock', `<span data-left="${S.candAt + R.CANDIDATE_EVERY}"></span>`)}</div>
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
        opened.has(id) ? opened.delete(id) : opened.add(id);
        renderTeam();
      }),
  );
  // 面接に来る人がいないときは、勉強会へ（会社タブに移って勉強会を選ぶ）
  $('#go-meetup') &&
    ($('#go-meetup').onclick = () => {
      if (!G.ceoBusyUntil(S)) G.setActivity(S, 'meetup');
      save();
      document.querySelector('.tab[data-view="office"]').click();
    });
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
  const genres = Object.entries(R.GENRES)
    .map(([k, g]) => {
      const locked = S.office < g.office;
      return `<button class="panel genre" data-genre="${k}" ${locked || !canStart || S.money < g.cost ? 'disabled' : ''}>
        <span class="gname">${locked ? icon('lock') : ''}${g.name}</span>
        <span class="trend">${trendIcon(G.trendAt(S, k, now))}${seeNext ? `<span class="arrow">→</span>${trendIcon(G.trendAt(S, k, next + 1))}` : ''}</span>
        <span class="vals">${val('coin', yen(g.cost))}${val('clock', dur(g.hours * R.HOUR))}</span>
      </button>`;
    })
    .join('');
  const devs = S.devs
    .map((d) => `<div class="panel run"><div class="row1"><b>${R.GENRES[d.genre].name}</b>${icon('busy', 'spin')}</div>${progress(d.startAt, d.endsAt)}</div>`)
    .join('');
  const products = S.products
    .map(
      (p) => `<div class="panel prod">
        <span class="pname">${esc(p.name)}<small>${R.GENRES[p.genre].name}</small></span>
        ${rating(p.q)}
        <span class="val strong">+${yen(G.productIncome(S, p, now, ce))}/時</span>
        <button class="x" data-stop="${p.id}" aria-label="販売終了">×</button>
      </div>`,
    )
    .join('');
  $('#view-product').innerHTML = `
    <div class="sec">${icon('clock')}<span data-left="${next}"></span></div>
    <div class="genres">${genres}</div>
    ${devs}
    ${products}`;
  const v = $('#view-product');
  v.querySelectorAll('[data-genre]').forEach((b) => (b.onclick = () => assignDev(b.dataset.genre)));
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
  $('#zukan-grid').querySelectorAll('.card:not(.locked)').forEach((c) => (c.onclick = () => openLegend(c.dataset.id)));
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
function legendHead(legend) {
  return `<h2>${legend.name}</h2><div class="sub">${legend.title}</div>`;
}
function openLegend(id) {
  const legend = byId[id];
  const left = G.leftLegend(S, id);
  const m = S.members.find((x) => x.legend === id) ?? left;
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
  $('#detail-info').innerHTML = `${legendHead(legend)}
    <p class="scene">${esc(rule.scene)}</p>
    <div class="ability">${esc(rule.abilityText)}</div>
    <div class="vals">${val('target', pct(G.scoutChance(S, e.id)))}${val('clock', `<span data-left="${e.until}"></span>`)}</div>
    <button class="big" id="scout">仲間に誘う</button>`;
  updateTimers();
  $('#detail').showModal();
  // まだ姿はシルエットだけ
  const wrap = $('#detail-canvas').parentElement;
  wrap.querySelector('.silhouette')?.remove();
  thumbnailFor(legend).then((src) => {
    const img = new Image();
    img.src = src;
    img.className = 'silhouette';
    wrap.append(img);
  });
  $('#scout').onclick = async () => {
    const r = G.scout(S, Date.now());
    commit();
    wrap.querySelector('.silhouette')?.remove();
    if (r === 'joined') {
      $('#detail-info').innerHTML = `${legendHead(legend)}<div class="joined">仲間になった</div><div class="ability">${esc(rule.abilityText)}</div>`;
      await showOnDetail(legend, { reveal: true });
    } else {
      $('#detail-info').innerHTML = `${legendHead(legend)}<p class="scene">「まだ早いようだ」</p>`;
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
  if (!$('#notice').open) $('#notice').showModal();
}

// ---------- 時間を進める ----------
function commit() {
  save();
  renderAll();
}
function tick() {
  if (!S) return;
  const rival = S.rival;
  const ev = G.advance(S, Date.now());
  if (ev.length || S.rival !== rival) {
    // 起きたことを1つのポップアップにまとめて出す
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
      (t) => `<div class="result ${t.ok ? 'ok' : 'bad'}">${icon(t.ok ? 'check' : 'error')}<b>${esc(t.title)}</b>
        <span class="vals">${t.great ? icon('bolt', 'res-great') : ''}${t.early ? icon('clock', 'res-early') : ''}${val('coin', `+${yen(t.money)}`, t.ok ? 'ok' : '')}${t.rep ? val('star', `${t.rep > 0 ? '+' : ''}${t.rep}`, t.rep < 0 ? 'bad' : '') : ''}</span></div>`,
    ),
    tasks.length > 5 ? `<div class="muted">+${tasks.length - 5}</div>` : '',
    ...prods.map((p) => `<div class="result ok">${icon('box')}<b>${esc(p.name)}</b><span class="vals">${rating(p.q)}</span></div>`),
    levels.length ? `<div class="vals center">${levels.map((x) => val('level', `${esc(x.name)} Lv${x.level}`)).join('')}</div>` : '',
  ];
  const list = `<div class="results">${rows.join('')}</div>`;
  return head ? `${icon(tasks.some((t) => t.ok) || prods.length ? 'check' : 'task', 'big-ic done-ic')}<h2>完了</h2>${list}` : list;
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
  return `${head ? `${icon('error', 'big-ic rival-ic')}<h2>冷やかし</h2>` : ''}<div class="results">${rows.join('')}</div>`;
}

// 自分から辞めたレジェンド（呼び戻すお金も出す）
function quitsHtml(ev, { head = true } = {}) {
  const qs = ev.filter((e) => e.type === 'quit');
  if (!qs.length) return '';
  const rows = qs.map(
    (q) => `<div class="rival">
      <span class="av legend" style="--c:var(--muted)"><img data-thumb="${q.id}" alt=""></span>
      <span class="rival-what"><b>${esc(byId[q.id].name)}</b><small>${esc(R.LEGEND_RULES[q.id].quitText)}</small></span>
      ${val('crown', '-1', 'bad')}
    </div>`,
  );
  return `${head ? `${icon('back', 'big-ic rival-ic')}<h2>辞任</h2>` : ''}<div class="results">${rows.join('')}</div>`;
}

// 留守の間に起きたこと
function welcomeBack(ev, away) {
  if (away < 10 * 60000) return;
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
  if ($('#settings').open) renderSettings();
}
async function toggleLogin() {
  const u = cloud.currentUser();
  if (!u) return cloud.login();
  renderSettings();
  $('#settings').showModal();
}
document.querySelectorAll('.sync').forEach((b) => {
  b.onclick = toggleLogin;
  b.addEventListener('pointerdown', cloud.warmUp, { once: true });
});

function renderSettings() {
  const u = cloud.currentUser();
  const inGame = S && !$('#game').classList.contains('hidden');
  const hero = S?.members.find((m) => m.kind === 'hero');
  $('#settings-body').innerHTML = `
    ${inGame ? `<label class="set-row rename"><b>CEO</b><input id="set-name" maxlength="12" autocomplete="off" value="${esc(hero.name)}" /></label>
    <label class="set-row rename"><b>株式会社</b><input id="set-company" maxlength="16" autocomplete="off" value="${esc(S.company.replace('株式会社', ''))}" /></label>` : ''}
    ${inGame ? `<button class="set-row link-row" id="to-title">${icon('home')}<span class="grow">タイトルへ</span>${icon('back', 'flip')}</button>` : ''}
    <div class="set-row">${icon(u ? SYNC_ICON[syncState.cls] : 'cloud')}<span class="grow">${u ? esc(u.email ?? '') : 'Google'}</span>
      ${u ? '<button class="btn ghost" id="logout">ログアウト</button>' : '<button class="btn" id="login">ログイン</button>'}</div>
    ${S ? `<div class="set-row">${icon('error')}<span class="grow">最初から</span><button class="btn ghost danger" id="reset">消す</button></div>` : ''}`;
  if ($('#login')) {
    $('#login').onclick = () => cloud.login();
    cloud.warmUp();
  }
  $('#logout') && ($('#logout').onclick = () => cloud.logout());
  // 名前と会社名は途中でも変えられる（空のときは元に戻す）
  const rename = (el, apply) =>
    el &&
    (el.onchange = () => {
      const v = el.value.trim();
      if (v) apply(v);
      el.value = v || el.defaultValue;
      commit();
    });
  rename($('#set-name'), (v) => (hero.name = v));
  rename($('#set-company'), (v) => (S.company = G.companyTitle(v)));
  $('#to-title') &&
    ($('#to-title').onclick = () => {
      save();
      $('#settings').close();
      showTitle();
    });
  $('#reset') &&
    ($('#reset').onclick = async () => {
      if (!confirm(`記録を消しますか？${u ? '\n（クラウドの記録も消えます）' : ''}`)) return;
      S = null;
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {}
      await cloud.clear().catch(() => {});
      location.reload();
    });
}
$('#open-settings').onclick = () => {
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
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
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
cloud.init({ getState: () => S, applyState, decide, onStatus: showSync, onSynced });
