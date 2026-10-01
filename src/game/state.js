// ゲームの中身（お金・社員・仕事・製品・偉人との出会い）。画面には関わらない
// 時間は現実の時刻で進む。ゲームを閉じていた間のぶんは advance() でまとめて進める
import * as R from './rules.js';
import { byId as LEGEND_BY_ID, LEGENDS } from '../data.js';
import { randomPerson, productName } from './names.js';

// ---------- 乱数（記録に種を持たせ、毎回同じ結果になるように） ----------
export function rand(s) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (s, a, b) => a + (b - a) * rand(s);
const pick = (s, a) => a[Math.floor(rand(s) * a.length)];
const round = (n, unit = 1000) => Math.max(unit, Math.round(n / unit) * unit);

function hash01(...xs) {
  let h = 2166136261;
  for (const ch of xs.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

// ---------- はじめる ----------
// 会社名には「株式会社」、主人公の名前には「CEO」を付けて見せる
export const companyTitle = (c) => (c.includes('株式会社') ? c : `株式会社${c}`);
export const displayName = (m) => (m.kind === 'hero' ? `CEO ${m.name}` : m.name);

export function newGame({ job, name, company }, now = Date.now()) {
  const seed = (Math.random() * 2 ** 31) | 0;
  const s = {
    v: 1,
    seed,
    rng: seed,
    createdAt: now,
    time: now,
    company: companyTitle(company),
    money: R.START_MONEY,
    rep: 0,
    office: 0,
    members: [],
    offers: [],
    tasks: [],
    devs: [],
    products: [],
    candidates: [],
    offerAt: now,
    candAt: now,
    encounter: null,
    activity: R.DEFAULT_ACTIVITY,
    met: {},
    counts: { tasks: 0, cat: {}, products: 0 },
    log: [],
    nextId: 1,
  };
  const hero = makePerson(s, job, { hero: true });
  hero.name = name;
  s.members.push(hero);
  for (let i = 0; i < 3; i++) addOffer(s, now, 0, true); // 最初は短くてやさしい仕事
  refreshCandidates(s);
  addLog(s, now, `${s.company} 創業`);
  return s;
}

const newId = (s) => s.nextId++;

function makePerson(s, job, { hero = false } = {}) {
  const j = R.JOBS[job];
  const p = randomPerson(() => rand(s));
  const stats = {};
  for (const k of R.STAT_KEYS) stats[k] = Math.round(hero ? 6 + j.w[k] * between(s, 4, 5) : 4 + j.w[k] * between(s, 3, 4.5));
  const m = { id: newId(s), kind: hero ? 'hero' : 'staff', job, name: p.name, look: { ...p.look, shirt: j.shirt }, stats, level: 1, xp: 0, busy: null };
  if (!hero) {
    const avg = R.STAT_KEYS.reduce((a, k) => a + stats[k], 0) / 4;
    m.salary = round(2000 + avg * 350, 500);
  }
  return m;
}

function makeLegend(s, id) {
  const rule = R.LEGEND_RULES[id];
  return { id: newId(s), kind: 'legend', legend: id, name: LEGEND_BY_ID[id].name, stats: { ...rule.stats }, level: 1, xp: 0, busy: null };
}

// ---------- 効果（職種の得意・偉人の力） ----------
function perksOf(m) {
  return m.kind === 'legend' ? R.LEGEND_RULES[m.legend].ability : R.JOBS[m.job].perk;
}

// 会社にいるだけで効くもの
export function companyEffects(s) {
  const e = { income: 0, offers: 0, nextTrend: 0, hireCost: 0, xpAll: 0, decaySlow: 0, statAll: {}, incomeGenre: {} };
  for (const m of s.members) {
    const p = perksOf(m);
    for (const k of ['income', 'offers', 'nextTrend', 'hireCost', 'xpAll', 'decaySlow']) e[k] += p[k] ?? 0;
    for (const [k, v] of Object.entries(p.statAll ?? {})) e.statAll[k] = (e.statAll[k] ?? 0) + v;
    for (const [k, v] of Object.entries(p.incomeGenre ?? {})) e.incomeGenre[k] = (e.incomeGenre[k] ?? 0) + v;
  }
  return e;
}

// 仕事・開発に参加した人だけに効くもの
function teamEffects(team) {
  const e = { teamSpeed: 0, teamReward: 0, teamSuccess: 0, teamQuality: 0, teamXp: 0, alwaysSuccess: 0 };
  for (const m of team) {
    const p = perksOf(m);
    for (const k of Object.keys(e)) e[k] += p[k] ?? 0;
  }
  return e;
}

export function statsOf(s, m, ce = companyEffects(s)) {
  const out = {};
  for (const k of R.STAT_KEYS) out[k] = Math.round(m.stats[k] * (1 + (ce.statAll[k] ?? 0)));
  return out;
}

// w（能力の重み）に対する1人の力
function powerOf(s, m, w, ce) {
  const st = statsOf(s, m, ce);
  let sum = 0;
  let ws = 0;
  for (const k of R.STAT_KEYS) {
    sum += st[k] * w[k];
    ws += w[k];
  }
  return sum / ws;
}
export function teamPower(s, team, w) {
  const ce = companyEffects(s);
  return team.reduce((a, m) => a + powerOf(s, m, w, ce), 0);
}

const memberById = (s, id) => s.members.find((m) => m.id === id);
export const freeMembers = (s) => s.members.filter((m) => !m.busy);
export const capacity = (s) => R.OFFICES[s.office].cap;
// 席を使う人数（偉人は特別な席なので数えない。せっかくの出会いを席不足で逃さないように）
export const seatsUsed = (s) => s.members.filter((m) => m.kind !== 'legend').length;

// ---------- 依頼（受託の仕事） ----------
function addOffer(s, now, forceTier, easy = false) {
  const maxTier = Math.min(s.office, R.TIERS.length - 1);
  let tier = forceTier;
  if (tier == null) {
    const r = rand(s);
    tier = r < 0.55 ? maxTier : r < 0.85 ? Math.max(0, maxTier - 1) : Math.floor(rand(s) * (maxTier + 1));
  }
  const tpl = pick(s, R.TASKS.filter((t) => t.tier === tier));
  const T = R.TIERS[tier];
  const hours = easy ? pick(s, [1, 2]) : pick(s, T.hours);
  const diff = Math.round(easy ? T.diff[0] * 0.8 : between(s, ...T.diff));
  s.offers.push({
    id: newId(s),
    tier,
    title: tpl.title,
    cat: tpl.cat,
    w: tpl.w,
    hours,
    diff,
    team: T.team,
    reward: round(T.rate * hours * between(s, 0.85, 1.2) * (diff / T.diff[0]) ** 0.3),
    rep: Math.max(1, Math.round(T.rep * Math.sqrt(hours))),
    xp: Math.round(hours * 3 * (tier + 1)),
    expiresAt: now + R.OFFER_LIFE,
  });
}
const maxOffers = (s) => R.BASE_OFFERS + companyEffects(s).offers;

// 見込み（画面に出す）
export function taskPreview(s, offer, ids) {
  const team = ids.map((id) => memberById(s, id));
  const te = teamEffects(team);
  const power = teamPower(s, team, offer.w);
  const chance = te.alwaysSuccess ? 1 : Math.min(0.98, Math.max(0.05, 0.9 * (power / offer.diff) + te.teamSuccess));
  const duration = offer.hours * R.HOUR * (1 - Math.min(0.6, te.teamSpeed));
  return { power, chance, duration, reward: round(offer.reward * (1 + te.teamReward)) };
}

export function startTask(s, offerId, ids, now) {
  const offer = s.offers.find((o) => o.id === offerId);
  if (!offer || !ids.length || ids.length > offer.team) return false;
  if (ids.some((id) => memberById(s, id)?.busy)) return false;
  const pv = taskPreview(s, offer, ids);
  const task = { ...offer, members: ids, startAt: now, endsAt: now + pv.duration };
  s.offers = s.offers.filter((o) => o !== offer);
  s.tasks.push(task);
  for (const id of ids) memberById(s, id).busy = task.id;
  return true;
}

function finishTask(s, task, t, ev) {
  const team = task.members.map((id) => memberById(s, id)).filter(Boolean);
  const pv = taskPreview(s, task, team.map((m) => m.id));
  const ok = rand(s) < pv.chance;
  const money = ok ? pv.reward : round(pv.reward * 0.2);
  s.money += money;
  if (ok) {
    s.rep += task.rep;
    s.counts.tasks++;
    s.counts.cat[task.cat] = (s.counts.cat[task.cat] ?? 0) + 1;
  }
  const xp = task.xp * (ok ? 1 : 0.4);
  giveXp(s, team, xp, t, ev);
  for (const m of team) m.busy = null;
  s.tasks = s.tasks.filter((x) => x !== task);
  addLog(s, t, ok ? `${task.title}  成功` : `${task.title}  失敗`, ok ? 'good' : 'bad');
  ev.push({ type: 'task', ok, money, title: task.title });
}

export const xpNeed = (level) => Math.round(12 * level ** 1.6);

function giveXp(s, team, base, t, ev) {
  const ce = companyEffects(s);
  const te = teamEffects(team);
  for (const m of team) {
    m.xp += base * (1 + ce.xpAll + te.teamXp);
    while (m.xp >= xpNeed(m.level)) {
      m.xp -= xpNeed(m.level);
      m.level++;
      const w = m.kind === 'legend' ? Object.fromEntries(R.STAT_KEYS.map((k) => [k, m.stats[k] / 40])) : R.JOBS[m.job].w;
      for (const k of R.STAT_KEYS) m.stats[k] += Math.round(w[k] * between(s, 0.8, 1.4));
      if (m.salary) m.salary = round(m.salary * 1.08, 500);
      addLog(s, t, `${displayName(m)}  Lv${m.level}`, 'good');
      ev.push({ type: 'level', name: displayName(m), level: m.level });
    }
  }
}

// ---------- 自社製品（投資） ----------
export function trendAt(s, genre, t) {
  const n = Math.floor((t - s.createdAt) / R.TREND_PERIOD);
  return 0.6 + 1.2 * hash01(s.seed, n, genre);
}
export function trendEndsAt(s, t) {
  const n = Math.floor((t - s.createdAt) / R.TREND_PERIOD);
  return s.createdAt + (n + 1) * R.TREND_PERIOD;
}

export function devPreview(s, genre, ids) {
  const g = R.GENRES[genre];
  const team = ids.map((id) => memberById(s, id));
  const te = teamEffects(team);
  const power = teamPower(s, team, g.w);
  return { power, quality: (power / g.need) * (1 + te.teamQuality), duration: g.hours * R.HOUR * (1 - Math.min(0.6, te.teamSpeed)) };
}

export function startDev(s, genre, ids, now) {
  const g = R.GENRES[genre];
  if (!g || s.office < g.office || s.money < g.cost || !ids.length) return false;
  if (ids.some((id) => memberById(s, id)?.busy)) return false;
  const pv = devPreview(s, genre, ids);
  s.money -= g.cost;
  const dev = { id: newId(s), genre, members: ids, startAt: now, endsAt: now + pv.duration };
  s.devs.push(dev);
  for (const id of ids) memberById(s, id).busy = dev.id;
  addLog(s, now, `${g.name} 開発開始`);
  return true;
}

function finishDev(s, dev, t, ev) {
  const g = R.GENRES[dev.genre];
  const team = dev.members.map((id) => memberById(s, id)).filter(Boolean);
  const pv = devPreview(s, dev.genre, team.map((m) => m.id));
  const q = Math.min(3, pv.quality * between(s, 0.6, 1.4));
  const product = { id: newId(s), genre: dev.genre, name: productName(dev.genre, () => rand(s)), q, launchedAt: t, earned: 0 };
  s.products.push(product);
  s.counts.products++;
  s.rep += Math.round(5 * q * (g.office + 1));
  giveXp(s, team, g.hours * 2, t, ev);
  for (const m of team) m.busy = null;
  s.devs = s.devs.filter((x) => x !== dev);
  addLog(s, t, `${product.name}  発売`, 'good');
  ev.push({ type: 'product', name: product.name, q });
}

export function productIncome(s, p, t, ce = companyEffects(s)) {
  const g = R.GENRES[p.genre];
  const age = Math.max(0, t - p.launchedAt);
  const decay = 0.5 ** (age / (R.PRODUCT_HALF_LIFE * (1 + ce.decaySlow)));
  return g.cost * R.PRODUCT_RATE * p.q * trendAt(s, p.genre, t) * decay * (1 + ce.income + (ce.incomeGenre[p.genre] ?? 0));
}

export function stopProduct(s, id) {
  s.products = s.products.filter((p) => p.id !== id);
}

// ---------- 採用 ----------
// 採用候補を lv まで育った状態にする
function growTo(s, m, lv) {
  while (m.level < lv) {
    m.level++;
    for (const k of R.STAT_KEYS) m.stats[k] += Math.round(R.JOBS[m.job].w[k] * between(s, 0.8, 1.4));
    m.salary = round(m.salary * 1.08, 500);
  }
}
function refreshCandidates(s, t = 0) {
  const jobs = Object.keys(R.JOBS);
  const walkins = s.candidates.filter((c) => c.walkin && c.until > t); // 訪ねてきた人は待っている間は残す
  s.candidates = Array.from({ length: 3 }, () => {
    const m = makePerson(s, pick(s, jobs));
    // 会社が大きくなると、育った人も応募してくる
    growTo(s, m, 1 + Math.floor(rand(s) * (s.office + 1) * 1.5));
    return m;
  });
  s.candidates.unshift(...walkins);
}
// 訪ねてきた人は雇うのにお金がかからない
export const hireCost = (s, m) => (m.walkin ? 0 : round(m.salary * 5 * (1 - Math.min(0.8, companyEffects(s).hireCost))));

export function hire(s, candId, now) {
  const m = s.candidates.find((c) => c.id === candId);
  if (!m || seatsUsed(s) >= capacity(s)) return false;
  const cost = hireCost(s, m);
  if (s.money < cost) return false;
  s.money -= cost;
  s.candidates = s.candidates.filter((c) => c !== m);
  delete m.walkin;
  delete m.until;
  s.members.push(m);
  addLog(s, now, `${m.name}  入社`, 'good');
  return true;
}

export function dismiss(s, id, now) {
  const m = memberById(s, id);
  if (!m || m.kind !== 'staff' || m.busy) return false;
  s.members = s.members.filter((x) => x !== m);
  addLog(s, now, `${m.name}  退社`);
  return true;
}

// ---------- 会社を広げる ----------
export function upgradeOffice(s, now) {
  const next = R.OFFICES[s.office + 1];
  if (!next || s.money < next.cost || s.rep < next.rep) return false;
  s.money -= next.cost;
  s.office++;
  addLog(s, now, `${next.name}へ引っ越し`, 'good');
  return true;
}

// ---------- 偉人との出会い ----------
export const ownedLegends = (s) => new Set(s.members.filter((m) => m.kind === 'legend').map((m) => m.legend));

// 出会いの条件ごとの達成状況 [{ label, ratio, ok }]
export function meetProgress(s, id) {
  const meet = R.LEGEND_RULES[id].meet;
  const out = [];
  const add = (label, now, need) => out.push({ label: `${label} ${Math.min(now, need)}/${need}`, ratio: Math.min(1, now / need), ok: now >= need });
  if (meet.office) out.push({ label: R.OFFICES[meet.office].name, ratio: Math.min(1, s.office / meet.office), ok: s.office >= meet.office });
  if (meet.rep) add('評判', s.rep, meet.rep);
  for (const [cat, n] of Object.entries(meet.cat ?? {})) add(R.CAT_NAMES[cat], s.counts.cat[cat] ?? 0, n);
  if (meet.tasks) add('仕事', s.counts.tasks, meet.tasks);
  if (meet.products) add('製品', s.counts.products, meet.products);
  if (meet.staff) add('社員', s.members.filter((m) => m.kind === 'staff').length, meet.staff);
  if (meet.legends) add('レジェンド', ownedLegends(s).size, meet.legends);
  return out;
}

function rollEncounter(s, t, ev) {
  if (s.encounter) return;
  const owned = ownedLegends(s);
  const free = LEGENDS.filter((l) => !owned.has(l.id) && !((s.met[l.id]?.cooldown ?? 0) > t));
  const ready = free.filter((l) => meetProgress(s, l.id).every((c) => c.ok));
  let l;
  const p = R.ENCOUNTER_PER_HOUR * (owned.size === 0 ? 2 : 1); // 最初の1人目は少し会いやすい
  if (ready.length && rand(s) < p) l = pick(s, ready);
  // 条件を満たしていなくても、ごくまれに偶然出会う
  // 散歩していると、条件を満たしていなくてもまれに偶然出会う
  else if (free.length && activityRoll(s, 'legend')) l = pick(s, free);
  if (!l) return;
  s.encounter = { id: l.id, at: t, until: t + R.ENCOUNTER_LIFE };
  s.met[l.id] = { ...s.met[l.id], seen: true };
  addLog(s, t, `誰かが現れた`, 'legend');
  ev.push({ type: 'encounter', id: l.id });
}

export function scoutChance(s, id) {
  return Math.min(0.9, R.LEGEND_RULES[id].join + Math.min(0.15, s.rep / 5000) + (s.met[id]?.tries ?? 0) * 0.1);
}

// 口説く。結果 'joined' | 'refused' | null
export function scout(s, now) {
  const e = s.encounter;
  if (!e || e.until <= now) return null;
  const id = e.id;
  const met = (s.met[id] = { ...s.met[id] });
  const ok = rand(s) < scoutChance(s, id);
  s.encounter = null;
  if (ok) {
    s.members.push(makeLegend(s, id));
    addLog(s, now, `${LEGEND_BY_ID[id].name}  仲間に`, 'legend');
    return 'joined';
  }
  met.tries = (met.tries ?? 0) + 1;
  met.cooldown = now + R.RETRY_COOLDOWN;
  addLog(s, now, `${LEGEND_BY_ID[id].name}  去った`, 'bad');
  return 'refused';
}

// ---------- CEO の過ごし方と、それで起きる出来事 ----------
export function setActivity(s, id) {
  if (!R.ACTIVITIES[id]) return false;
  s.activity = id;
  return true;
}
// CEO が仕事・開発を任されている間は、過ごし方はできない。終わる時刻を返す（手が空いていれば 0）
export function ceoBusyUntil(s) {
  const hero = s.members.find((m) => m.kind === 'hero');
  if (!hero?.busy) return 0;
  return [...s.tasks, ...s.devs].find((x) => x.id === hero.busy)?.endsAt ?? 0;
}
// いまの過ごし方で、その出来事が起きるか（CEO の手が空いているときだけ）
function activityRoll(s, event) {
  const a = R.ACTIVITIES[s.activity];
  return a?.event === event && !ceoBusyUntil(s) && rand(s) < a.perHour;
}

function rollLuck(s, t, ev) {
  if (!activityRoll(s, 'luck')) return;
  const L = pick(s, R.LUCKS);
  const money = round(R.TIERS[Math.min(s.office, R.TIERS.length - 1)].rate * between(s, ...L.amount));
  s.money += money;
  addLog(s, t, `${L.title}  +${money.toLocaleString('ja-JP')}円`, 'good');
  ev.push({ type: 'luck', title: L.title, money });
}

function rollWalkin(s, t, ev) {
  if (!activityRoll(s, 'walkin')) return;
  s.candidates = s.candidates.filter((c) => !c.walkin); // 訪ねてくるのは1人ずつ
  const m = makePerson(s, pick(s, Object.keys(R.JOBS)));
  // 腕のいい人が訪ねてくる（今の会社より少し育っている）
  growTo(s, m, 2 + s.office * 2 + Math.floor(rand(s) * 3));
  m.walkin = true;
  m.until = t + R.WALKIN_LIFE;
  s.candidates.unshift(m);
  addLog(s, t, `${m.name}  面接に来た`, 'good');
  ev.push({ type: 'walkin', id: m.id, name: m.name });
}

// ---------- 時間を進める ----------
// ゲームを閉じていた間も含めて now まで進める。起きたことを ev に入れて返す
export function advance(s, now, ev = []) {
  if (now - s.time > R.MAX_CATCHUP) s.time = now - R.MAX_CATCHUP;
  while (s.time < now) {
    const boundary = s.createdAt + (Math.floor((s.time - s.createdAt) / R.HOUR) + 1) * R.HOUR;
    const next = Math.min(now, boundary);
    // この間に終わる仕事・開発
    const ending = [...s.tasks.map((x) => ['task', x]), ...s.devs.map((x) => ['dev', x])]
      .filter(([, x]) => x.endsAt <= next)
      .sort((a, b) => a[1].endsAt - b[1].endsAt);
    for (const [kind, x] of ending) (kind === 'task' ? finishTask : finishDev)(s, x, x.endsAt, ev);
    // 製品の収入と給料
    const dt = next - s.time;
    const mid = s.time + dt / 2;
    const ce = companyEffects(s);
    let income = 0;
    for (const p of s.products) {
      const v = (productIncome(s, p, mid, ce) * dt) / R.HOUR;
      p.earned += v;
      income += v;
    }
    const salary = (s.members.reduce((a, m) => a + (m.salary ?? 0), 0) * dt) / R.DAY;
    s.money += income - salary;
    ev.income = (ev.income ?? 0) + income;
    ev.salary = (ev.salary ?? 0) + salary;
    // 依頼が届く・期限切れ
    while (s.offerAt + R.OFFER_EVERY <= next) {
      s.offerAt += R.OFFER_EVERY;
      s.offers = s.offers.filter((o) => o.expiresAt > s.offerAt);
      if (s.offers.length < maxOffers(s)) addOffer(s, s.offerAt);
    }
    // 採用候補の入れ替え
    while (s.candAt + R.CANDIDATE_EVERY <= next) {
      s.candAt += R.CANDIDATE_EVERY;
      refreshCandidates(s, s.candAt);
    }
    // 偉人との出会い（1時間ごとに判定）
    if (s.encounter && s.encounter.until <= next) {
      addLog(s, s.encounter.until, `${LEGEND_BY_ID[s.encounter.id].name}  去った`, 'bad');
      s.met[s.encounter.id] = { ...s.met[s.encounter.id], cooldown: s.encounter.until + R.RETRY_COOLDOWN };
      s.encounter = null;
    }
    s.candidates = s.candidates.filter((c) => !c.walkin || c.until > next);
    if (next === boundary) {
      rollEncounter(s, next, ev);
      rollLuck(s, next, ev);
      rollWalkin(s, next, ev);
    }
    s.time = next;
  }
  return ev;
}

// 古い記録を今の形にそろえる（以前あった知識ノートのデータは使わないので消す）
export function migrate(s) {
  if (!R.ACTIVITIES[s.activity]) s.activity = R.DEFAULT_ACTIVITY;
  s.company = companyTitle(s.company);
  delete s.notes;
  s.log = s.log.filter((l) => l.kind !== 'note');
  return s;
}

// ---------- 記録 ----------
function addLog(s, t, text, kind = '') {
  s.log.unshift({ t, text, kind });
  s.log.length = Math.min(s.log.length, 60);
}

