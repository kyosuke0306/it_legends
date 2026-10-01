// 画面まわり。ゲームの中身は game/state.js、数字は game/rules.js
// 文字は少なく、アイコンと数字で見せる（絵文字は使わない。アイコンは icons.js）
import { LEGENDS, RARITY, byId } from './data.js';
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
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    save();
    cloud.flush();
  }
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
const jobShort = (m) => (m.kind === 'legend' ? byId[m.legend].rarity : m.kind === 'hero' ? `CEO・${R.JOBS[m.job].name}` : R.JOBS[m.job].name);
const perkText = (m) => (m.kind === 'legend' ? R.LEGEND_RULES[m.legend].abilityText : R.JOBS[m.job].perkText);
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
function avatar(m) {
  if (m.kind === 'legend') return `<span class="av legend" style="--c:${RARITY[byId[m.legend].rarity].css}"><img data-thumb="${m.legend}" alt=""></span>`;
  const c = m.kind === 'hero' ? 'var(--accent)' : hex(R.JOBS[m.job].shirt);
  return `<span class="av" style="--c:${c}">${esc(m.name.replace(/\s.*/, '').slice(0, 1))}</span>`;
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
function enterGame() {
  $('#start').classList.add('hidden');
  $('#game').classList.remove('hidden');
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
  $('#dot-work').classList.toggle('on', G.freeMembers(S).length > 0 && S.offers.length > 0);
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
  $('#activity').innerHTML = Object.entries(R.ACTIVITIES)
    .map(
      ([id, a]) => `<button class="act ${S.activity === id ? 'active' : ''}" data-act="${id}">
        ${icon(a.icon, 'act-ic')}<span>${a.name}</span>${icon(EVENT_ICON[a.event], `act-ev ev-${a.event}`)}
      </button>`,
    )
    .join('');
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
  $('#log').innerHTML = S.log
    .slice(0, 6)
    .map((l) => `<li class="${l.kind}"><time>${new Date(l.t).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</time>${esc(l.text)}</li>`)
    .join('');
}

// ----- 仕事 -----
function renderWork() {
  const byIdM = (id) => S.members.find((m) => m.id === id);
  const running = S.tasks
    .map((t) => `<div class="panel run"><div class="row1"><b>${esc(t.title)}</b><span class="avs">${t.members.map((id) => avatar(byIdM(id))).join('')}</span></div>${progress(t.startAt, t.endsAt)}</div>`)
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
  $('#view-work').innerHTML = `
    ${running}
    ${offers || `<p class="empty">${icon('clock')}<span data-left="${S.offerAt + R.OFFER_EVERY}"></span></p>`}`;
  fillThumbs($('#view-work'));
  $('#view-work').querySelectorAll('[data-offer]').forEach((b) => (b.onclick = () => assignTask(+b.dataset.offer)));
}

function assignTask(offerId) {
  const o = S.offers.find((x) => x.id === offerId);
  openAssign({
    title: o.title,
    max: o.team,
    w: o.w,
    preview: (ids) => {
      const p = G.taskPreview(S, o, ids);
      return `${val('target', pct(p.chance), p.chance < 0.5 ? 'bad' : p.chance >= 0.8 ? 'ok' : '')}${val('clock', dur(p.duration))}${val('coin', yen(p.reward))}`;
    },
    confirm: (ids) => G.startTask(S, offerId, ids, Date.now()),
  });
}

// 人を選ぶ（仕事・開発で共通）。下から出るシート
function openAssign({ title, max, w, preview, confirm, extra = '' }) {
  const dlg = $('#assign');
  const chosen = new Set();
  const power = (m) => Math.round(G.teamPower(S, [m], w));
  const free = G.freeMembers(S).sort((a, b) => power(b) - power(a));
  const draw = () => {
    const ids = [...chosen];
    $('#assign-body').innerHTML = `
      <div class="sheet-head"><b>${esc(title)}</b><span class="muted">${chosen.size}/${max > 20 ? free.length : max}</span></div>
      ${extra}
      <div class="pick">${free
        .map(
          (m) => `<button class="person ${chosen.has(m.id) ? 'active' : ''}" data-id="${m.id}">
            ${avatar(m)}<span class="pname">${esc(m.name)}<small>${jobShort(m)} Lv${m.level}</small></span><span class="pw">${power(m)}</span>
          </button>`,
        )
        .join('')}</div>
      <div class="preview">${ids.length ? preview(ids) : '&nbsp;'}</div>
      <button class="big" id="assign-go" ${ids.length ? '' : 'disabled'}>任せる</button>`;
    fillThumbs($('#assign-body'));
    $('#assign-body').querySelectorAll('.person').forEach(
      (b) =>
        (b.onclick = () => {
          const id = +b.dataset.id;
          if (chosen.has(id)) chosen.delete(id);
          else if (chosen.size < max) chosen.add(id);
          draw();
        }),
    );
    $('#assign-go').onclick = () => {
      if (confirm([...chosen])) {
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
    const wait = m.walkin ? `<span class="muted">${val('clock', `<span data-left="${m.until}"></span>`)}</span>` : '';
    return `${wait}<button class="btn hire" data-hire="${m.id}" ${can ? '' : 'disabled'}>${yen(cost)}</button>`;
  };
  return `<div class="member ${m.kind} ${m.walkin ? 'walkin' : ''} ${open ? 'open' : ''}">
    <button class="mrow" data-open="${m.id}">${avatar(m)}${status}
      <span class="pname">${esc(m.name)}<small>${jobShort(m)} Lv${m.level}</small></span>
      ${statBars(st)}
    </button>
    ${
      open || candidate
        ? `<div class="more"><span class="perk">${esc(perkText(m))}</span>${
            m.salary ? `<span class="muted">${val('wallet', `${yen(m.salary)}/日`)}</span>` : ''
          }${!candidate && m.kind === 'staff' && !m.busy ? `<button class="link small" data-dismiss="${m.id}">やめてもらう</button>` : ''}${
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
    <div class="sec">${icon('plus')}<span>${G.seatsUsed(S)}/${G.capacity(S)}</span><span class="left" data-left="${S.candAt + R.CANDIDATE_EVERY}"></span></div>
    <div class="list">${S.candidates.map((c) => memberRow(c, { candidate: true })).join('')}</div>`;
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
  v.querySelectorAll('[data-hire]').forEach((b) => (b.onclick = () => G.hire(S, +b.dataset.hire, Date.now()) && commit()));
  v.querySelectorAll('[data-dismiss]').forEach((b) => (b.onclick = () => confirm('やめてもらいますか？') && G.dismiss(S, +b.dataset.dismiss, Date.now()) && commit()));
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
  const order = { R: 0, SR: 1, SSR: 2 };
  $('#zukan-grid').innerHTML = [...LEGENDS]
    .sort((a, b) => order[a.rarity] - order[b.rarity])
    .map((l) => {
      const has = owned.has(l.id);
      // 出会いの条件を、短い言葉と進み具合の棒で
      const conds = has
        ? ''
        : `<div class="conds">${G.meetProgress(S, l.id)
            .map((c) => `<div class="cond ${c.ok ? 'ok' : ''}"><span>${esc(c.label)}</span><i><b style="width:${pct(c.ratio)}"></b></i></div>`)
            .join('')}</div>`;
      return `<button class="card r-${l.rarity} ${has ? '' : 'locked'}" data-id="${l.id}">
        <span class="rarity r-${l.rarity}">${l.rarity}</span>
        <div class="thumb"><img data-thumb="${l.id}" alt=""></div>
        ${has ? `<div class="name">${l.name}</div>` : conds}
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
  if (reveal) return detailStage.reveal(p, RARITY[legend.rarity].color);
  const obj = await p;
  if (token === detailToken) detailStage.setCharacter(obj);
}
function legendHead(legend) {
  return `<span class="rarity r-${legend.rarity}">${legend.rarity}</span><h2>${legend.name}</h2><div class="sub">${legend.title}</div>`;
}
function openLegend(id) {
  const legend = byId[id];
  const m = S.members.find((x) => x.legend === id);
  $('#detail-info').innerHTML = `${legendHead(legend)}
    <div class="ability">${esc(R.LEGEND_RULES[id].abilityText)}</div>
    ${m ? `<div class="lvrow">Lv${m.level} ${statBars(G.statsOf(S, m))}</div>` : ''}
    <details><summary>くわしく</summary><p>${legend.summary}</p></details>`;
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
  if (!$('#notice').open) $('#notice').showModal();
}

// ---------- 時間を進める ----------
function commit() {
  save();
  renderAll();
}
function tick() {
  if (!S) return;
  const ev = G.advance(S, Date.now());
  if (ev.length) {
    if (ev.some((e) => e.type === 'encounter')) notice(`${icon('spark', 'big-ic spin')}<h2>誰かが現れた</h2>`);
    else if (ev.some((e) => e.type === 'walkin')) notice(`${icon('people', 'big-ic')}<h2>入社したい人が来た</h2><p class="muted">${esc(ev.find((e) => e.type === 'walkin').name)}</p>`);
    else if (ev.some((e) => e.type === 'luck')) {
      const l = ev.find((e) => e.type === 'luck');
      notice(`${icon('coin', 'big-ic')}<h2>${esc(l.title)}</h2><div class="welcome">${val('coin', `+${yen(l.money)}`, 'ok')}</div>`);
    }
    commit();
  } else {
    renderHeader();
    updateTimers();
  }
}

// 留守の間に起きたこと
function welcomeBack(ev, away) {
  if (away < 10 * 60000) return;
  const tasks = ev.filter((e) => e.type === 'task');
  const rows = [];
  if (tasks.length) rows.push(val('task', `${tasks.filter((e) => e.ok).length}/${tasks.length}`, 'ok'));
  const levels = ev.filter((e) => e.type === 'level').length;
  if (levels) rows.push(val('level', `+${levels}`));
  const prods = ev.filter((e) => e.type === 'product').length;
  if (prods) rows.push(val('box', `+${prods}`));
  const luck = ev.filter((e) => e.type === 'luck').reduce((a, e) => a + e.money, 0); // 臨時収入も含める
  const net = (ev.income ?? 0) - (ev.salary ?? 0) + luck;
  if (Math.abs(net) >= 1) rows.push(val('coin', `${net >= 0 ? '+' : ''}${yen(net)}`, net >= 0 ? 'ok' : 'bad'));
  if (ev.some((e) => e.type === 'encounter')) rows.push(val('spark', '誰かが現れた', 'legend'));
  if (ev.some((e) => e.type === 'walkin') && S.candidates.some((c) => c.walkin)) rows.push(val('people', '入社したい人が来た', 'legend'));
  if (!rows.length) return;
  notice(`<h2>おかえりなさい</h2><p class="muted">${dur(away)}</p><div class="welcome">${rows.join('')}</div>`);
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
  $('#settings-body').innerHTML = `
    ${S && !$('#game').classList.contains('hidden') ? `<button class="set-row link-row" id="to-title">${icon('home')}<span class="grow">タイトルへ</span>${icon('back', 'flip')}</button>` : ''}
    <div class="set-row">${icon(u ? SYNC_ICON[syncState.cls] : 'cloud')}<span class="grow">${u ? esc(u.email ?? '') : 'Google'}</span>
      ${u ? '<button class="btn ghost" id="logout">ログアウト</button>' : '<button class="btn" id="login">ログイン</button>'}</div>
    ${S ? `<div class="set-row">${icon('error')}<span class="grow">最初から</span><button class="btn ghost danger" id="reset">消す</button></div>` : ''}`;
  if ($('#login')) {
    $('#login').onclick = () => cloud.login();
    cloud.warmUp();
  }
  $('#logout') && ($('#logout').onclick = () => cloud.logout());
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
  const desc = (s) => `${s.company}  ${yen(s.money)}  偉人${legendCount(s)}`;
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
