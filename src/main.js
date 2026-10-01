// 画面まわり。ゲームの中身は game/state.js、数字は game/rules.js
import { LEGENDS, RARITY, byId } from './data.js';
import { createCharacter, preloadCharacters, thumbnailUrl } from './character.js';
import { Stage, renderThumbnail } from './stage.js';
import { Office } from './office.js';
import { VERSION } from './version.js';
import * as G from './game/state.js';
import * as R from './game/rules.js';
import * as cloud from './cloud.js';
import { NOTES, NOTE_KINDS, noteHint } from './game/knowledge.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
document.getElementById('version').textContent = VERSION;

const SAVE_KEY = 'it_legends.save.v1';
let S = null; // ゲームの状態
let user = null; // Google でログインしている人
let lastCloudSave = null;
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
  const json = JSON.stringify(S);
  try {
    localStorage.setItem(SAVE_KEY, json);
  } catch {}
  if (user) cloud.flushSoon(user.uid, () => JSON.stringify(S), (e) => { lastCloudSave = e ? 'error' : Date.now(); });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    save();
    cloud.flush();
  }
});

// ---------- 表示の小道具 ----------
const yen = G.yen;
function dur(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}時間${m % 60}分` : `${h}時間`;
  return h % 24 ? `${Math.floor(h / 24)}日${h % 24}時間` : `${Math.floor(h / 24)}日`;
}
const pct = (x) => `${Math.round(x * 100)}%`;
const jobName = (m) => (m.kind === 'legend' ? '偉人' : R.JOBS[m.job].full);
const perkText = (m) => (m.kind === 'legend' ? R.LEGEND_RULES[m.legend].abilityText : R.JOBS[m.job].perkText);
function statBars(stats) {
  return `<div class="stats">${R.STAT_KEYS.map(
    (k) => `<div class="st"><span>${R.STATS[k]}</span><i style="--v:${Math.min(100, stats[k])}%"></i><b>${stats[k]}</b></div>`,
  ).join('')}</div>`;
}
function progress(start, end) {
  return `<div class="bar" data-start="${start}" data-ends="${end}"><i></i></div><div class="muted small" data-left="${end}"></div>`;
}

// ---------- はじめの画面 ----------
function showStart() {
  $('#start').classList.remove('hidden');
  $('#game').classList.add('hidden');
  let chosen = null;
  const box = $('#start-jobs');
  box.innerHTML = Object.entries(R.JOBS)
    .map(
      ([id, j]) => `<button class="job" data-job="${id}">
        <b>${j.full}</b>
        <div class="weights">${R.STAT_KEYS.map((k) => `<span>${R.STATS[k]}${'●'.repeat(Math.round(j.w[k]))}</span>`).join('')}</div>
        <div class="perk">得意：${j.perkText}</div>
      </button>`,
    )
    .join('');
  box.onclick = (e) => {
    const b = e.target.closest('.job');
    if (!b) return;
    chosen = b.dataset.job;
    box.querySelectorAll('.job').forEach((x) => x.classList.toggle('active', x === b));
    $('#start-go').disabled = false;
    $('#start-go').textContent = `${R.JOBS[chosen].full}として始める`;
  };
  $('#start-go').onclick = () => {
    if (!chosen) return;
    const name = $('#start-name').value.trim() || 'わたし';
    const company = $('#start-company').value.trim() || 'ガレージ・ラボ';
    S = G.newGame({ job: chosen, name, company });
    save();
    enterGame();
  };
}

// ---------- ゲーム画面 ----------
function enterGame() {
  noteCount = Object.keys(S.notes).length;
  $('#start').classList.add('hidden');
  $('#game').classList.remove('hidden');
  office ??= new Office($('#office-canvas'));
  preloadCharacters([...G.ownedLegends(S)]);
  renderAll();
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.onclick = () => {
    view = tab.dataset.view;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
    renderAll();
  };
});

function renderAll() {
  if (!S) return;
  $('#company-name').textContent = S.company;
  $('#money').textContent = yen(S.money);
  $('#money').classList.toggle('minus', S.money < 0);
  $('#rep').textContent = `評判 ${S.rep}`;
  $('#progress').textContent = `${G.ownedLegends(S).size}/${LEGENDS.length}`;
  const free = G.freeMembers(S).length;
  $('#badge-work').textContent = free && S.offers.length ? free : '';
  const unread = Object.values(S.notes).filter((n) => !n.read).length;
  $('#badge-notes').textContent = unread || '';
  ({ office: renderOffice, work: renderWork, team: renderTeam, product: renderProduct, legends: renderLegends, notes: renderNotes })[view]();
  updateTimers();
}

// 1秒ごとに残り時間だけ書き換える（全部描き直さない）
function updateTimers() {
  const now = Date.now();
  document.querySelectorAll('[data-ends]').forEach((el) => {
    const a = +el.dataset.start;
    const b = +el.dataset.ends;
    el.firstElementChild.style.width = pct(Math.min(1, (now - a) / (b - a)));
  });
  document.querySelectorAll('[data-left]').forEach((el) => {
    el.textContent = `あと ${dur(+el.dataset.left - now)}`;
  });
}

// ----- 会社 -----
function hourlyIncome() {
  const ce = G.companyEffects(S);
  return S.products.reduce((a, p) => a + G.productIncome(S, p, Date.now(), ce), 0);
}
function renderOffice() {
  office.sync(S);
  const enc = S.encounter;
  $('#encounter').innerHTML = enc
    ? `<button class="encounter" id="go-encounter">
        <span class="spark">✦</span> 時空のゆがみから、誰かが現れた！
        <small>${esc(R.LEGEND_RULES[enc.id].scene)}</small>
        <span class="muted small" data-left="${enc.until}"></span>
      </button>`
    : '';
  if (enc) $('#go-encounter').onclick = openEncounter;
  const o = R.OFFICES[S.office];
  const next = R.OFFICES[S.office + 1];
  const salary = S.members.reduce((a, m) => a + (m.salary ?? 0), 0);
  $('#office-info').innerHTML = `
    <div class="panel row">
      <div><div class="muted small">会社の場所</div><b>${o.name}</b></div>
      <div><div class="muted small">席</div><b>${G.seatsUsed(S)}/${o.cap}人</b></div>
      <div><div class="muted small">製品の収入</div><b>${yen(hourlyIncome())}/時</b></div>
      <div><div class="muted small">給料</div><b>${yen(salary)}/日</b></div>
    </div>
    ${
      next
        ? `<div class="panel row">
            <div>次は <b>${next.name}</b>（${next.cap}人まで）<div class="muted small">${yen(next.cost)}・評判 ${next.rep} 以上</div></div>
            <button class="btn" id="upgrade" ${S.money >= next.cost && S.rep >= next.rep ? '' : 'disabled'}>引っ越す</button>
          </div>`
        : ''
    }`;
  if (next) $('#upgrade').onclick = () => G.upgradeOffice(S, Date.now()) && commit();
  $('#log').innerHTML = S.log
    .slice(0, 20)
    .map((l) => `<li class="${l.kind}"><time>${new Date(l.t).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>${esc(l.text)}</li>`)
    .join('');
}

// ----- 仕事 -----
function renderWork() {
  const now = Date.now();
  const running = S.tasks
    .map((t) => {
      const names = t.members.map((id) => S.members.find((m) => m.id === id)?.name).join('・');
      return `<div class="panel"><b>${esc(t.title)}</b><div class="muted small">${esc(names)}</div>${progress(t.startAt, t.endsAt)}</div>`;
    })
    .join('');
  const offers = S.offers
    .map(
      (o) => `<div class="panel offer">
        <div class="grow">
          <span class="cat">${R.CAT_NAMES[o.cat]}</span> <b>${esc(o.title)}</b>
          <div class="muted small">${dur(o.hours * R.HOUR)}・最大${o.team}人・難しさ ${o.diff}・期限まで ${dur(o.expiresAt - now)}</div>
          <div>報酬 <b>${yen(o.reward)}</b>　評判 +${o.rep}</div>
        </div>
        <button class="btn" data-offer="${o.id}" ${G.freeMembers(S).length ? '' : 'disabled'}>受ける</button>
      </div>`,
    )
    .join('');
  const nextOffer = S.offerAt + R.OFFER_EVERY;
  $('#view-work').innerHTML = `
    ${running ? `<h3>進行中の仕事</h3>${running}` : ''}
    <h3>届いている依頼</h3>
    ${offers || '<p class="muted">依頼はまだありません</p>'}
    <p class="muted small">次の依頼まで <span data-left="${nextOffer}"></span>（${dur(R.OFFER_EVERY)}ごとに届きます）</p>`;
  $('#view-work').querySelectorAll('[data-offer]').forEach((b) => (b.onclick = () => assignTask(+b.dataset.offer)));
}

function assignTask(offerId) {
  const o = S.offers.find((x) => x.id === offerId);
  openAssign({
    title: o.title,
    sub: `${R.CAT_NAMES[o.cat]}・最大${o.team}人・難しさ ${o.diff}`,
    max: o.team,
    w: o.w,
    preview: (ids) => {
      const p = G.taskPreview(S, o, ids);
      return `成功率 <b class="${p.chance < 0.5 ? 'bad' : ''}">${pct(p.chance)}</b>　かかる時間 <b>${dur(p.duration)}</b>　報酬 <b>${yen(p.reward)}</b>`;
    },
    confirm: (ids) => G.startTask(S, offerId, ids, Date.now()),
  });
}

// 人を選ぶダイアログ（仕事・開発で共通）
function openAssign({ title, sub, max, w, preview, confirm, note = '' }) {
  const dlg = $('#assign');
  const free = G.freeMembers(S);
  const chosen = new Set();
  const powerOf = (m) => Math.round(G.teamPower(S, [m], w));
  const draw = () => {
    const ids = [...chosen];
    $('#assign-body').innerHTML = `
      <h2>${esc(title)}</h2>
      <div class="muted">${esc(sub)}</div>
      ${note}
      <p>担当する人を選んでください（${chosen.size}/${max}人）</p>
      <div class="pick">
        ${free
          .sort((a, b) => powerOf(b) - powerOf(a))
          .map(
            (m) => `<button class="person ${chosen.has(m.id) ? 'active' : ''} ${m.kind}" data-id="${m.id}">
              <b>${esc(m.name)}</b> <span class="muted small">${jobName(m)} Lv${m.level}</span>
              <span class="pw">力 ${powerOf(m)}</span>
            </button>`,
          )
          .join('')}
      </div>
      <div class="preview">${ids.length ? preview(ids) : '<span class="muted">まだ誰も選んでいません</span>'}</div>
      <button class="big" id="assign-go" ${ids.length ? '' : 'disabled'}>この人たちに任せる</button>`;
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
function memberCard(m) {
  const st = G.statsOf(S, m);
  const busy = m.busy ? [...S.tasks, ...S.devs].find((x) => x.id === m.busy) : null;
  const need = G.xpNeed(m.level);
  return `<div class="panel member ${m.kind}">
    <div class="mhead">
      <div><b>${esc(m.name)}</b> ${m.kind === 'hero' ? '<span class="tag">あなた</span>' : ''} ${m.kind === 'legend' ? `<span class="rarity r-${byId[m.legend].rarity}">${byId[m.legend].rarity}</span>` : ''}
        <div class="muted small">${jobName(m)}　Lv${m.level}（次まで ${Math.ceil(need - m.xp)}）</div></div>
    </div>
    <div class="state">${busy ? `<span class="busy">${esc(busy.title ?? R.GENRES[busy.genre].name + 'の開発')}中</span>` : '<span class="free">手が空いている</span>'}</div>
    ${statBars(st)}
    <div class="perk small">★ ${esc(perkText(m))}</div>
    ${m.salary ? `<div class="muted small">給料 ${yen(m.salary)}/日 ${m.busy ? '' : `<button class="link small" data-dismiss="${m.id}">やめてもらう</button>`}</div>` : ''}
    ${m.kind === 'legend' ? `<button class="link small" data-legend="${m.legend}">詳しく見る</button>` : ''}
  </div>`;
}
function renderTeam() {
  const full = G.seatsUsed(S) >= G.capacity(S);
  const cands = S.candidates
    .map((c) => {
      const cost = G.hireCost(S, c);
      return `<div class="panel member">
        <div class="mhead"><div><b>${esc(c.name)}</b><div class="muted small">${R.JOBS[c.job].full}　Lv${c.level}</div></div>
        <button class="btn" data-hire="${c.id}" ${!full && S.money >= cost ? '' : 'disabled'}>雇う ${yen(cost)}</button></div>
        ${statBars(c.stats)}
        <div class="perk small">★ ${R.JOBS[c.job].perkText}</div>
        <div class="muted small">給料 ${yen(c.salary)}/日</div>
      </div>`;
    })
    .join('');
  $('#view-team').innerHTML = `
    <h3>仲間（席 ${G.seatsUsed(S)}/${G.capacity(S)}人・偉人は別の特別席）</h3>
    <div class="cards">${S.members.map(memberCard).join('')}</div>
    <h3>採用の候補</h3>
    ${full ? '<p class="muted small">席がいっぱいです。会社を広げると雇えます</p>' : ''}
    <div class="cards">${cands}</div>
    <p class="muted small">候補は <span data-left="${S.candAt + R.CANDIDATE_EVERY}"></span> で入れ替わります</p>`;
  const v = $('#view-team');
  v.querySelectorAll('[data-hire]').forEach((b) => (b.onclick = () => G.hire(S, +b.dataset.hire, Date.now()) && commit()));
  v.querySelectorAll('[data-dismiss]').forEach(
    (b) => (b.onclick = () => confirm('本当にやめてもらいますか？') && G.dismiss(S, +b.dataset.dismiss, Date.now()) && commit()),
  );
  v.querySelectorAll('[data-legend]').forEach((b) => (b.onclick = () => openLegend(b.dataset.legend)));
}

// ----- 製品 -----
function trendLabel(x) {
  if (x >= 1.45) return '<span class="t up2">大人気 ↑↑</span>';
  if (x >= 1.1) return '<span class="t up">人気 ↑</span>';
  if (x >= 0.85) return '<span class="t">ふつう</span>';
  return '<span class="t down">下火 ↓</span>';
}
function renderProduct() {
  const now = Date.now();
  const ce = G.companyEffects(S);
  const ends = G.trendEndsAt(S, now);
  const seeNext = ce.nextTrend > 0;
  const genres = Object.entries(R.GENRES);
  const trends = `<div class="panel"><table class="trend">
      <tr><th></th><th>いまの流行</th>${seeNext ? '<th>次の流行</th>' : ''}</tr>
      ${genres.map(([k, g]) => `<tr><td>${g.name}</td><td>${trendLabel(G.trendAt(S, k, now))}</td>${seeNext ? `<td>${trendLabel(G.trendAt(S, k, ends + 1))}</td>` : ''}</tr>`).join('')}
    </table>
    <div class="muted small">流行は <span data-left="${ends}"></span> で変わります${seeNext ? '' : '（データサイエンティストがいると次の流行が分かります）'}</div></div>`;
  const devs = S.devs
    .map((d) => `<div class="panel"><b>${R.GENRES[d.genre].name}を開発中</b>${progress(d.startAt, d.endsAt)}</div>`)
    .join('');
  const products = S.products
    .map(
      (p) => `<div class="panel row">
        <div class="grow"><b>${esc(p.name)}</b> <span class="muted small">${R.GENRES[p.genre].name}</span>
          <div class="small">出来 <span class="stars">${G.stars(p.q)}</span>　いま ${yen(G.productIncome(S, p, now, ce))}/時　これまで ${yen(p.earned)}</div></div>
        <button class="link small" data-stop="${p.id}">販売終了</button>
      </div>`,
    )
    .join('');
  const canStart = G.freeMembers(S).length > 0;
  const newDev = genres
    .map(([k, g]) => {
      const locked = S.office < g.office;
      return `<button class="panel genre" data-genre="${k}" ${locked || !canStart || S.money < g.cost ? 'disabled' : ''}>
        <b>${g.name}</b>
        <div class="small">開発費 ${yen(g.cost)}・${dur(g.hours * R.HOUR)}</div>
        <div class="muted small">${locked ? `${R.OFFICES[g.office].name}から作れます` : `ふつうの出来に必要な力 ${g.need}`}</div>
      </button>`;
    })
    .join('');
  $('#view-product').innerHTML = `
    <p class="muted small">お金と時間をかけて自社製品を作ると、売れている間ずっと収入が入ります。流行に乗れば大もうけ、外せば赤字になることも。</p>
    ${trends}
    ${devs ? `<h3>開発中</h3>${devs}` : ''}
    <h3>販売中の製品</h3>
    ${products || '<p class="muted">まだ製品はありません</p>'}
    <h3>新しい製品を作る</h3>
    <div class="genres">${newDev}</div>`;
  const v = $('#view-product');
  v.querySelectorAll('[data-genre]').forEach((b) => (b.onclick = () => assignDev(b.dataset.genre)));
  v.querySelectorAll('[data-stop]').forEach(
    (b) => (b.onclick = () => confirm('この製品の販売をやめますか？（収入がなくなります）') && (G.stopProduct(S, +b.dataset.stop), commit())),
  );
}

function assignDev(genre) {
  const g = R.GENRES[genre];
  openAssign({
    title: `${g.name}を作る`,
    sub: `開発費 ${yen(g.cost)}・ふつうの出来に必要な力 ${g.need}`,
    max: 99,
    w: g.w,
    note: `<p class="small">いまの流行：${trendLabel(G.trendAt(S, genre, Date.now()))}（発売のころには変わっているかも）</p>`,
    preview: (ids) => {
      const p = G.devPreview(S, genre, ids);
      return `出来の見込み <b class="stars">${G.stars(p.quality * 0.6)}〜${G.stars(p.quality * 1.4)}</b>　かかる時間 <b>${dur(p.duration)}</b>`;
    },
    confirm: (ids) => G.startDev(S, genre, ids, Date.now()),
  });
}

// ----- 偉人（図鑑） -----
const thumbs = {};
function thumbnailFor(legend) {
  thumbs[legend.id] ??= thumbnailUrl(legend).then((url) => url ?? createCharacter(legend).then((obj) => renderThumbnail(obj)));
  return thumbs[legend.id];
}
function renderLegends() {
  const owned = G.ownedLegends(S);
  const grid = $('#zukan-grid');
  grid.innerHTML = '';
  // 会いやすい順（R → SR → SSR）に並べる
  const order = { R: 0, SR: 1, SSR: 2 };
  for (const legend of [...LEGENDS].sort((a, b) => order[a.rarity] - order[b.rarity])) {
    const has = owned.has(legend.id);
    const rule = R.LEGEND_RULES[legend.id];
    const card = document.createElement('button');
    card.className = `card r-${legend.rarity} ${has ? '' : 'locked'}`;
    const conds = G.meetProgress(S, legend.id);
    card.innerHTML = `
      <span class="rarity r-${legend.rarity}">${legend.rarity}</span>
      <div class="thumb"><span class="spinner"></span></div>
      <div class="name">${has ? legend.name : '？？？'}</div>
      ${
        has
          ? `<div class="count">${esc(legend.title)}</div>`
          : `<div class="hint">${esc(rule.hint)}</div><ul class="conds">${conds.map((c) => `<li class="${c.ok ? 'ok' : ''}">${esc(c.text)}</li>`).join('')}</ul>`
      }`;
    card.onclick = () => has && openLegend(legend.id);
    grid.append(card);
    thumbnailFor(legend).then((src) => {
      const img = new Image();
      img.src = src;
      card.querySelector('.thumb').replaceChildren(img);
    });
  }
}

// ----- 知識ノート（おまけ：遊んでいるとたまる IT・人物・IT会社のカード） -----
let noteKind = 'it';
let openNote = null;
function renderNotes() {
  const tabs = Object.entries(NOTE_KINDS)
    .map(([k, name]) => {
      const all = NOTES.filter((n) => n.kind === k);
      const got = all.filter((n) => S.notes[n.id]).length;
      const unread = all.filter((n) => S.notes[n.id] && !S.notes[n.id].read).length;
      return `<button class="chip-tab ${k === noteKind ? 'active' : ''}" data-kind="${k}">${name} ${got}/${all.length}${unread ? ' <span class="dot"></span>' : ''}</button>`;
    })
    .join('');
  const list = NOTES.filter((n) => n.kind === noteKind)
    .map((n) => {
      const got = S.notes[n.id];
      if (!got) return `<div class="note locked"><b>？？？</b><div class="muted small">${noteHint(n)}</div></div>`;
      const open = openNote === n.id;
      return `<button class="note ${open ? 'open' : ''}" data-note="${n.id}">
        <b>${got.read ? '' : '<span class="new">NEW</span> '}${esc(n.title)}</b>
        ${open ? `<p>${esc(n.text)}</p>` : ''}
      </button>`;
    })
    .join('');
  $('#view-notes').innerHTML = `
    <p class="muted small">仕事や出来事に合わせて、ITのこと・偉人のこと・IT会社のことがノートにたまっていきます。はじめて読むと評判 +1。</p>
    <div class="chip-tabs">${tabs}</div>
    <div class="notes">${list}</div>`;
  const v = $('#view-notes');
  v.querySelectorAll('[data-kind]').forEach((b) => (b.onclick = () => ((noteKind = b.dataset.kind), (openNote = null), renderNotes())));
  v.querySelectorAll('[data-note]').forEach(
    (b) =>
      (b.onclick = () => {
        const id = b.dataset.note;
        openNote = openNote === id ? null : id;
        if (G.readNote(S, id)) commit();
        else renderNotes();
      }),
  );
}

// 画面の下に少しだけ出るお知らせ
let toastTimer;
function toast(html) {
  const el = $('#toast');
  el.innerHTML = html;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 4000);
}

// ---------- 偉人の詳細・出会い ----------
let detailStage;
let detailToken;
function detailInfo(legend, extra = '') {
  return `
    <span class="rarity r-${legend.rarity}">${legend.rarity}</span>
    <h2>${legend.name}</h2>
    <div class="sub">${legend.nameEn}（${legend.years}）</div>
    <div class="title">「${legend.title}」</div>
    ${extra}
    <h3>何をした人？</h3>
    <p>${legend.summary}</p>
    <h3>おもな功績</h3>
    <ul>${legend.achievements.map((a) => `<li>${a}</li>`).join('')}</ul>`;
}
async function showOnDetail(legend, { reveal = false } = {}) {
  detailStage ??= new Stage($('#detail-canvas'));
  detailStage.setCharacter(null);
  const token = (detailToken = {});
  const p = createCharacter(legend);
  if (reveal) return detailStage.reveal(p, RARITY[legend.rarity].color);
  const obj = await p;
  if (token === detailToken) detailStage.setCharacter(obj);
}
function openLegend(id) {
  const legend = byId[id];
  const m = S.members.find((x) => x.legend === id);
  $('#detail-info').innerHTML = detailInfo(
    legend,
    `<div class="ability">★ ${esc(R.LEGEND_RULES[id].abilityText)}</div>${m ? `<div class="muted small">Lv${m.level}</div>${statBars(G.statsOf(S, m))}` : ''}`,
  );
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
  $('#detail-info').innerHTML = `
    <span class="rarity r-${legend.rarity}">${legend.rarity}</span>
    <h2>時を超えて、${legend.name} が現れた！</h2>
    <div class="title">「${legend.title}」</div>
    <p>${esc(rule.scene)}</p>
    <div class="ability">仲間になると：${esc(rule.abilityText)}</div>
    <p>仲間に誘えるのは1回だけ。断られると、しばらく会えません。</p>
    <div class="muted small">仲間になってくれる見込み ${pct(G.scoutChance(S, e.id))}・<span data-left="${e.until}"></span>で去ってしまう</div>
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
      $('#detail-info').innerHTML = detailInfo(legend, `<div class="joined">${legend.name} が仲間になった！！</div><div class="ability">★ ${esc(rule.abilityText)}</div>`);
      await showOnDetail(legend, { reveal: true });
    } else {
      $('#detail-info').innerHTML = `<h2>${legend.name} は首を横にふった…</h2><p>「まだ君の会社には早いようだ」</p><p class="muted">数日たてば、また会えるかもしれません。</p>`;
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
let noteCount = null;
function commit() {
  const n = Object.keys(S.notes).length;
  if (noteCount != null && n > noteCount) toast(`📘 ノートに ${n - noteCount} 枚加わりました`);
  noteCount = n;
  save();
  renderAll();
}
function tick() {
  if (!S) return;
  const ev = G.advance(S, Date.now());
  if (ev.length) {
    const notes = ev.filter((e) => e.type === 'note');
    if (notes.length) toast(`📘 ノートに ${notes.length} 枚加わりました`);
    if (ev.some((e) => e.type === 'encounter')) notice(`<h2>✦ 時空のゆがみ…</h2><p>誰かが現れたようです。「会社」の画面から会いに行こう！</p>`);
    commit();
  } else {
    $('#money').textContent = yen(S.money);
    updateTimers();
  }
}

// 留守の間に起きたことのまとめ
function welcomeBack(ev, away) {
  if (away < 10 * 60000) return;
  const tasks = ev.filter((e) => e.type === 'task');
  const ok = tasks.filter((e) => e.ok).length;
  const lines = [];
  if (tasks.length) lines.push(`仕事が ${tasks.length} 件終わった（成功 ${ok} 件）`);
  for (const e of ev.filter((e) => e.type === 'product')) lines.push(`新製品「${esc(e.name)}」を発売した`);
  for (const e of ev.filter((e) => e.type === 'level')) lines.push(`${esc(e.name)} がレベル ${e.level} になった`);
  const notes = ev.filter((e) => e.type === 'note').length;
  if (notes) lines.push(`📘 ノートに ${notes} 枚加わった`);
  if (ev.income > 1) lines.push(`製品の収入 +${yen(ev.income)}`);
  if (ev.salary > 1) lines.push(`給料の支払い −${yen(ev.salary)}`);
  if (ev.some((e) => e.type === 'encounter')) lines.push('<b>✦ 誰かが時を超えて現れた！</b>');
  if (!lines.length) return;
  notice(`<h2>おかえりなさい</h2><p class="muted">${dur(away)}ぶり</p><ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>`);
}

// ---------- 設定・ログイン ----------
function renderSettings() {
  const cloudPart = !cloud.cloudReady
    ? '<p class="muted">Google ログインでの保存は準備中です。</p>'
    : user
      ? `<p>ログイン中：<b>${esc(user.displayName ?? user.email ?? '')}</b></p>
         <p class="muted small">記録は自動でクラウドに保存されます（変化があってから約1分後・画面を閉じるとき）。${
           lastCloudSave === 'error' ? '<b class="bad">前回の保存に失敗しました</b>' : lastCloudSave ? `最後の保存 ${new Date(lastCloudSave).toLocaleTimeString('ja-JP')}` : ''
         }</p>
         <button class="btn" id="save-now">いま保存する</button> <button class="btn ghost" id="logout">ログアウト</button>`
      : `<p>Google でログインすると、記録がクラウドに保存され、別のスマホやパソコンでも続きから遊べます。</p>
         <button class="btn" id="login">Google でログイン</button>`;
  $('#settings-body').innerHTML = `
    <h2>設定</h2>
    <h3>記録の保存</h3>
    ${cloudPart}
    <p class="muted small">ログインしなくても、この端末のブラウザには自動で保存されます。</p>
    ${S ? `<h3>最初から</h3><button class="btn ghost danger" id="reset">記録を消して最初から始める</button>` : ''}`;
  $('#login') && ($('#login').onclick = login);
  $('#logout') &&
    ($('#logout').onclick = async () => {
      await cloud.flush();
      await cloud.signOut();
      user = null;
      renderSettings();
    });
  $('#save-now') &&
    ($('#save-now').onclick = async () => {
      save();
      await cloud.flush();
      renderSettings();
    });
  $('#reset') &&
    ($('#reset').onclick = () => {
      if (!confirm('本当に記録を消しますか？（元に戻せません）')) return;
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {}
      if (user) cloud.pushSave(user.uid, JSON.stringify(null)).catch(() => {});
      location.reload();
    });
}
$('#open-settings').onclick = () => {
  renderSettings();
  $('#settings').showModal();
};

async function login() {
  try {
    user = await cloud.signIn();
    await syncWithCloud();
  } catch (e) {
    console.warn(e);
    alert('ログインできませんでした');
  }
  renderSettings();
}

// ログインしたとき：クラウドと端末の記録のうち、どちらを使うか決める
async function syncWithCloud() {
  const remote = await cloud.fetchSave(user.uid);
  let rs = null;
  try {
    rs = remote?.state ? JSON.parse(remote.state) : null;
  } catch {}
  if (rs?.v !== 1) rs = null;
  else G.migrate(rs);
  let useRemote = false;
  if (rs && !S) useRemote = true;
  else if (rs && S && rs.seed === S.seed) useRemote = (rs.savedAt ?? 0) > (S.savedAt ?? 0);
  else if (rs && S) {
    const desc = (s) => `「${s.company}」${yen(s.money)}・偉人 ${s.members.filter((m) => m.kind === 'legend').length}人`;
    useRemote = confirm(`クラウドに別の記録があります。\n\nクラウド：${desc(rs)}\nこの端末：${desc(S)}\n\nクラウドの記録を使いますか？（キャンセルするとこの端末の記録で上書きします）`);
  }
  if (useRemote) {
    S = rs;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(S));
    } catch {}
    G.advance(S, Date.now());
    enterGame();
  } else if (S) {
    save();
    await cloud.flush();
  }
}

// ---------- 起動 ----------
S = loadLocal();
if (S) {
  const away = Date.now() - S.time;
  const ev = G.advance(S, Date.now());
  save();
  enterGame();
  welcomeBack(ev, away);
} else {
  showStart();
}
setInterval(tick, 1000);
// 前回ログインしていたら、裏でログイン状態を戻してクラウドと合わせる
cloud
  .restoreUser()
  .then(async (u) => {
    user = u;
    if (u) await syncWithCloud();
  })
  .catch((e) => console.warn('ログイン状態を戻せませんでした', e));
