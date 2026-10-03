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

export function newGame({ job, name, company, look }, now = Date.now()) {
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
    candAt: now,
    encounter: null,
    activity: R.DEFAULT_ACTIVITY,
    met: {},
    counts: { tasks: 0, cat: {}, products: 0 },
    log: [],
    nextId: 1,
    guide: 0, // 最初の1回だけの案内（main.js の GUIDE）
  };
  const hero = makePerson(s, job, { hero: true });
  hero.name = name;
  if (look) hero.look = { ...hero.look, ...look, shirt: R.JOBS[job].shirt }; // 自分で選んだ顔
  s.members.push(hero);
  // 最初は短くてやさしい仕事（1分・10分・30分）。始めてすぐ「終わった」「育った」が見られるように
  for (const h of R.FIRST_OFFER_HOURS) addOffer(s, now, 0, h);
  refreshCandidates(s, now);
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

function makeLegend(s, id, now) {
  const rule = R.LEGEND_RULES[id];
  return { id: newId(s), kind: 'legend', legend: id, name: LEGEND_BY_ID[id].name, stats: { ...rule.stats }, level: 1, xp: 0, busy: null, joinedAt: now };
}

// ---------- 効果（職種の得意・偉人の力） ----------
function perksOf(m) {
  return m.kind === 'legend' ? R.LEGEND_RULES[m.legend].ability : R.JOBS[m.job].perk;
}

// 会社にいるだけで効くもの
export function companyEffects(s) {
  const e = { income: 0, offers: 1, nextTrend: 0, hireCost: 0, xpAll: 0, decaySlow: 0, luck: 0, statAll: {}, incomeGenre: {} };
  for (const m of s.members) {
    const p = perksOf(m);
    e.offers *= 1 + (p.offers ?? 0); // 依頼の届きやすさは掛け算で重ねる
    for (const k of ['income', 'nextTrend', 'hireCost', 'xpAll', 'decaySlow', 'luck']) e[k] += p[k] ?? 0;
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
// 席の数。いちばん上の会社のあとは増築したぶん増える
export const capacity = (s) => R.OFFICES[s.office].cap + (s.floors ?? 0) * R.FLOOR_CAP;
// 席を使う人数（偉人は特別な席なので数えない。せっかくの出会いを席不足で逃さないように）
export const seatsUsed = (s) => s.members.filter((m) => m.kind !== 'legend').length;

// ---------- 依頼（受託の仕事） ----------
// easy: 最初の仕事の時間（時間。0 や false ならふつうの仕事）
function addOffer(s, now, forceTier, easy = false) {
  const maxTier = Math.min(s.office, R.TIERS.length - 1);
  let tier = forceTier;
  if (tier == null) {
    const r = rand(s);
    tier = r < 0.55 ? maxTier : r < 0.85 ? Math.max(0, maxTier - 1) : Math.floor(rand(s) * (maxTier + 1));
  }
  // いま並んでいる依頼と同じ名前はなるべく出さない（全部並んでいるときだけ重なる）
  const pool = R.TASKS.filter((t) => t.tier === tier);
  const fresh = pool.filter((t) => !s.offers.some((o) => o.title === t.title));
  const tpl = pick(s, fresh.length ? fresh : pool);
  const T = R.TIERS[tier];
  const hours = easy ? easy : pick(s, T.hours);
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
    xp: Math.max(easy ? 5 : 0, Math.round(hours * 3 * (tier + 1) * (T.xp ?? 1))), // 最初の3つで CEO が Lv2 になる
    expiresAt: now + R.OFFER_LIFE,
  });
}

// ---------- 要員派遣（仕事の間だけ借りる人） ----------
// その仕事に一番向いた職種
function bestJob(w) {
  const fit = (j) => R.STAT_KEYS.reduce((a, k) => a + R.JOBS[j].w[k] * w[k], 0) / R.STAT_KEYS.reduce((a, k) => a + R.JOBS[j].w[k], 0);
  return Object.keys(R.JOBS).reduce((a, b) => (fit(b) > fit(a) ? b : a));
}
// i 人目に来る人。選ぶ前に力を見せるため、記録の乱数は使わず仕事ごとに決まった人が来る
export function makeTemp(s, offer, i) {
  let x = Math.floor(hash01(s.seed, offer.id, i, 'temp') * 2 ** 31);
  const r = () => {
    x = (Math.imul(x, 1103515245) + 12345) & 0x7fffffff;
    return x / 2 ** 31;
  };
  const job = bestJob(offer.w);
  const j = R.JOBS[job];
  const p = randomPerson(r);
  const level = R.OFFICES[s.office].temp;
  const stats = {};
  for (const k of R.STAT_KEYS) stats[k] = Math.round(4 + j.w[k] * (3 + 1.5 * r()) + (level - 1) * j.w[k] * 1.1);
  return { id: -(offer.id * 10 + i + 1), kind: 'temp', job, name: p.name, look: { ...p.look, shirt: j.shirt }, stats, level, xp: 0, busy: offer.id };
}
export const tempFee = (offer) => round(offer.reward * R.TEMP_FEE);

// 見込み（画面に出す）。temps は派遣の人
export function taskPreview(s, offer, ids, temps = offer.temps ?? []) {
  const team = [...ids.map((id) => memberById(s, id)), ...temps];
  const te = teamEffects(team);
  const power = teamPower(s, team, offer.w);
  const chance = te.alwaysSuccess ? 1 : Math.min(0.98, Math.max(0.05, 0.9 * (power / offer.diff) + te.teamSuccess));
  const duration = (offer.hours * R.HOUR * (1 - Math.min(0.6, te.teamSpeed))) / (1 + R.TEAM_SPEEDUP * (team.length - 1));
  const great = power >= offer.diff * R.REP_GREAT;
  const early = duration <= offer.hours * R.HOUR * R.REP_EARLY;
  return { power, chance, duration, reward: round(offer.reward * (1 + te.teamReward)), rep: taskRep(offer, power, early), great, early };
}
// 成功したときの評判（出来と早さで変わる）
function taskRep(offer, power, early) {
  const q = power >= offer.diff * R.REP_GREAT ? 1.5 : power >= offer.diff ? 1 : 0.7;
  return Math.max(1, Math.round(offer.rep * q * (early ? 1.5 : 1)));
}

// nTemps は派遣で借りる人数（自分の会社から1人は出す）
export function startTask(s, offerId, ids, now, nTemps = 0) {
  const offer = s.offers.find((o) => o.id === offerId);
  if (!offer || !ids.length || ids.length + nTemps > offer.team) return false;
  if (ids.some((id) => memberById(s, id)?.busy)) return false;
  const fee = tempFee(offer) * nTemps;
  if (nTemps && s.money < fee) return false;
  const temps = Array.from({ length: nTemps }, (_, i) => makeTemp(s, offer, i));
  s.money -= fee;
  const pv = taskPreview(s, offer, ids, temps);
  const task = { ...offer, members: ids, temps, startAt: now, endsAt: now + pv.duration };
  s.offers = s.offers.filter((o) => o !== offer);
  s.tasks.push(task);
  for (const id of ids) memberById(s, id).busy = task.id;
  return true;
}

// 仕事中に人を足す（派遣も）。進んだ割合はそのままで、残りが新しい人数の速さで進む
export function addToTask(s, taskId, ids, now, nTemps = 0) {
  const task = s.tasks.find((x) => x.id === taskId);
  const temps = task?.temps ?? [];
  if (!task || !(ids.length + nTemps) || task.members.length + temps.length + ids.length + nTemps > task.team) return false;
  if (ids.some((id) => !memberById(s, id) || memberById(s, id).busy)) return false;
  const fee = tempFee(task) * nTemps;
  if (nTemps && s.money < fee) return false;
  s.money -= fee;
  const done = Math.min(1, Math.max(0, (now - task.startAt) / (task.endsAt - task.startAt)));
  task.begunAt ??= task.startAt; // 早く終わったかは、最初に始めた時刻から測る
  task.members = [...task.members, ...ids];
  task.temps = [...temps, ...Array.from({ length: nTemps }, (_, i) => makeTemp(s, task, temps.length + i))];
  for (const id of ids) memberById(s, id).busy = task.id;
  const full = taskPreview(s, task, task.members.filter((id) => memberById(s, id))).duration;
  task.startAt = now - done * full;
  task.endsAt = now + (1 - done) * full;
  return true;
}

function finishTask(s, task, t, ev) {
  const team = task.members.map((id) => memberById(s, id)).filter(Boolean);
  const pv = taskPreview(s, task, team.map((m) => m.id));
  const ok = rand(s) < pv.chance;
  const money = ok ? pv.reward : round(pv.reward * 0.2);
  s.money += money;
  // 早さは実際にかかった時間で決める
  const early = task.endsAt - (task.begunAt ?? task.startAt) <= task.hours * R.HOUR * R.REP_EARLY;
  const rep = ok ? taskRep(task, pv.power, early) : -Math.min(s.rep, Math.max(1, Math.round(task.rep * R.FAIL_REP)));
  s.rep += rep;
  if (ok) {
    s.counts.tasks++;
    s.counts.cat[task.cat] = (s.counts.cat[task.cat] ?? 0) + 1;
  }
  const xp = task.xp * (ok ? 1 : 0.4);
  giveXp(s, team, xp, t, ev);
  for (const m of team) m.busy = null;
  s.tasks = s.tasks.filter((x) => x !== task);
  addLog(s, t, ok ? `${task.title}  成功` : `${task.title}  失敗`, ok ? 'good' : 'bad');
  ev.push({ type: 'task', ok, money, rep, great: ok && pv.great, early: ok && early, title: task.title });
  // これまでの仕事（仕事タブの「実績」で見る）。新しい順に最大 HISTORY_MAX 件
  (s.history ??= []).unshift({ t, title: task.title, cat: task.cat, ok, money, rep, great: ok && pv.great, early: ok && early, who: team.map((m) => m.name) });
  s.history.length = Math.min(s.history.length, HISTORY_MAX);
}

const HISTORY_MAX = 100;

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
      ev.push({ type: 'level', id: m.id, name: displayName(m), level: m.level });
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
  const duration = (g.hours * R.HOUR * (1 - Math.min(0.6, te.teamSpeed))) / (1 + R.TEAM_SPEEDUP * (team.length - 1));
  return { power, quality: (power / g.need) * (1 + te.teamQuality), duration };
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
  ev.push({ type: 'product', id: product.id, genre: dev.genre, name: product.name, q });
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
// 1日ごとに新しい人が面接に来る。前から待っている人は、待てる期限（until）までは残る
function refreshCandidates(s, t = 0) {
  s.candidates = s.candidates.filter((c) => c.until > t);
  // 平均 n 人（小数のぶんは確率で1人増える）
  const n = R.CANDIDATES_PER_DAY[s.office] ?? 3;
  const count = Math.min(Math.floor(n) + (rand(s) < n % 1 ? 1 : 0), R.MAX_CANDIDATES - s.candidates.length);
  for (let i = 0; i < count; i++) addCandidate(s, t);
}
function addCandidate(s, t) {
  const m = makePerson(s, pick(s, Object.keys(R.JOBS)));
  // 会社が大きくなると、育った人も応募してくる
  const [lo, hi] = R.OFFICES[s.office].lv;
  growTo(s, m, lo + Math.floor(rand(s) * (hi - lo + 1)));
  m.until = t + between(s, ...R.CANDIDATE_LIFE) * R.DAY;
  m.at = t; // 来た時刻（新着の印に使う）
  s.candidates.push(m);
}
// ---------- 求人広告 ----------
export const adCost = (s) => round(R.TIERS[Math.min(s.office, R.TIERS.length - 1)].rate * R.AD_HOURS, 1000);
export const adPerDay = (s) => Math.max(R.AD_PER_DAY, R.CANDIDATES_PER_DAY[s.office] ?? 3);
export const adActive = (s, t) => (s.adUntil ?? 0) > t;
export function startAd(s, now) {
  const cost = adCost(s);
  if (adActive(s, now) || s.money < cost) return false;
  s.money -= cost;
  s.adUntil = now + R.AD_DAYS * R.DAY;
  addLog(s, now, `求人広告  -${cost.toLocaleString('ja-JP')}円`);
  return true;
}
// 広告を出している間は、1時間ごとに確率で1人ずつ面接に来る
function rollAd(s, t) {
  if (!adActive(s, t - R.HOUR) || s.candidates.length >= R.MAX_CANDIDATES || rand(s) >= adPerDay(s) / 24) return;
  addCandidate(s, t);
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

// いちばん上の会社まで来たら、あとはいくらでも増築できる（席が増える。費用はだんだん上がる）
export const canExpand = (s) => s.office === R.OFFICES.length - 1;
export const expandCost = (s) => round(R.FLOOR_COST * R.FLOOR_GROW ** (s.floors ?? 0), 1e8);
export function expand(s, now) {
  const cost = expandCost(s);
  if (!canExpand(s) || s.money < cost) return false;
  s.money -= cost;
  s.floors = (s.floors ?? 0) + 1;
  addLog(s, now, `増築 ${s.floors}`, 'good');
  return true;
}

// ---------- 偉人との出会い ----------
export const ownedLegends = (s) => new Set(s.members.filter((m) => m.kind === 'legend').map((m) => m.legend));

// 出会いの条件ごとの達成状況 [{ label, ratio, ok }]
export function meetProgress(s, id) {
  const meet = R.LEGEND_RULES[id].meet;
  const out = [];
  const add = (label, now, need) => out.push({ label: `${label} ${Math.min(now, need)}/${need}`, ratio: Math.min(1, now / need), ok: now >= need });
  if (meet.office) out.push({ label: `${R.OFFICES[meet.office].name}へ引っ越し`, ratio: Math.min(1, s.office / meet.office), ok: s.office >= meet.office });
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
    // 前に辞めたレジェンドなら、そのときのレベルのまま戻ってくる
    s.members.push(met.left ? { ...met.left, busy: null, joinedAt: now } : makeLegend(s, id, now));
    delete met.left;
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
  return ceoWork(s)?.endsAt ?? 0;
}
// CEO がいま任されている仕事か開発（なければ null）
export const ceoWork = (s) => workOf(s, s.members.find((m) => m.kind === 'hero'));
// その人がいま任されている仕事か開発（なければ null）。画面に名前を出すため title を付けて返す
export function workOf(s, m) {
  if (!m?.busy) return null;
  const task = s.tasks.find((x) => x.id === m.busy);
  if (task) return { title: task.title, endsAt: task.endsAt };
  const dev = s.devs.find((x) => x.id === m.busy);
  return dev ? { title: R.GENRES[dev.genre].name, endsAt: dev.endsAt } : null;
}
// いまの過ごし方で、その出来事が起きるか（CEO の手が空いているときだけ）
function activityRoll(s, event) {
  const a = R.ACTIVITIES[s.activity];
  return a?.event === event && !ceoBusyUntil(s) && rand(s) < a.perHour;
}

// 新しい依頼が届くか（1時間ごとに、評判と営業・レジェンドの倍率で決まる確率で。並べる数に上限はない）
export const offerChance = (s) => Math.min(1, (R.OFFER_BASE + R.OFFER_PER_DIGIT * Math.log10(Math.max(0, s.rep) + 1)) * companyEffects(s).offers);
function rollOffer(s, t) {
  if (rand(s) < offerChance(s)) addOffer(s, t);
}

// 散歩：仕事の相談を受ける（ふつうの依頼とは別に届く）
function rollWalkOffer(s, t) {
  const a = R.ACTIVITIES[s.activity];
  if (!a?.offerPerHour || ceoBusyUntil(s) || rand(s) >= a.offerPerHour) return;
  addOffer(s, t);
}

function rollLuck(s, t, ev) {
  if (!activityRoll(s, 'luck')) return;
  const L = pick(s, R.LUCKS);
  const money = round(R.TIERS[Math.min(s.office, R.TIERS.length - 1)].rate * between(s, ...L.amount) * (1 + companyEffects(s).luck));
  s.money += money;
  addLog(s, t, `${L.title}  +${money.toLocaleString('ja-JP')}円`, 'good');
  ev.push({ type: 'luck', title: L.title, money });
}

function rollWalkin(s, t, ev) {
  if (!activityRoll(s, 'walkin')) return;
  s.candidates = s.candidates.filter((c) => !c.walkin); // 訪ねてくるのは1人ずつ
  const m = makePerson(s, pick(s, Object.keys(R.JOBS)));
  // 腕のいい人が訪ねてくる（今の会社より少し育っている）
  growTo(s, m, Math.max(2 + s.office * 2, R.OFFICES[s.office].lv[1]) + Math.floor(rand(s) * 3));
  m.walkin = true;
  m.at = t;
  m.until = t + R.WALKIN_LIFE;
  s.candidates.unshift(m);
  addLog(s, t, `${m.name}  面接に来た`, 'good');
  ev.push({ type: 'walkin', id: m.id, name: m.name });
}

// ---------- 辞任（我の強いレジェンドは、いつか自分から辞める） ----------
function rollQuit(s, t, ev) {
  for (const m of s.members.filter((x) => x.kind === 'legend' && !x.busy)) {
    const days = R.LEGEND_RULES[m.legend].quit;
    if (!days || t - (m.joinedAt ?? 0) < R.LEGEND_SETTLE) continue; // 仲間になってしばらくは辞めない
    if (rand(s) >= 1 / (days * 24)) continue;
    s.members = s.members.filter((x) => x !== m);
    // 辞めたときの姿（レベル・能力）を覚えておく。少しの間は出会えない
    s.met[m.legend] = { ...s.met[m.legend], left: { ...m, busy: null }, cooldown: t + R.RETRY_COOLDOWN };
    addLog(s, t, `${m.name}  辞任`, 'bad');
    ev.push({ type: 'quit', id: m.legend });
  }
}
export const leftLegend = (s, id) => s.met[id]?.left ?? null;
export const rehireCost = (s) => round(R.TIERS[Math.min(s.office, R.TIERS.length - 1)].rate * R.REHIRE_HOURS, 10000);
// 高いお金を払って呼び戻す
export function rehire(s, id, now) {
  const m = leftLegend(s, id);
  const cost = rehireCost(s);
  if (!m || s.money < cost) return false;
  s.money -= cost;
  s.members.push({ ...m, busy: null, joinedAt: now });
  delete s.met[id].left;
  if (s.encounter?.id === id) s.encounter = null;
  addLog(s, now, `${m.name}  復帰`, 'legend');
  return true;
}

// ---------- 冷やかし（まだ仲間でないレジェンドがライバルとして来る） ----------
function rollRival(s, t, ev) {
  if (!s.tasks.length && !s.devs.length) return; // 仕事中だけ
  if (t - s.createdAt < R.RIVAL_GRACE) return; // 始めてしばらくは来ない
  if (rand(s) >= R.RIVAL_PER_HOUR) return;
  const owned = ownedLegends(s);
  const pool = LEGENDS.filter((l) => !owned.has(l.id) && l.id !== s.encounter?.id);
  if (!pool.length) return;
  const l = pick(s, pool);
  const free = s.members.filter((m) => m.kind === 'staff' && !m.busy);
  const e = { type: 'rival', id: l.id };
  if (free.length && s.members.filter((m) => m.kind === 'staff').length >= 2 && rand(s) < R.RIVAL_POACH) {
    const m = pick(s, free);
    s.members = s.members.filter((x) => x !== m);
    e.poached = displayName(m);
    addLog(s, t, `${l.name}  ${m.name}を引き抜いた`, 'bad');
  } else {
    const hit = pick(s, R.RIVAL_HITS);
    e.title = hit.title;
    e.money = round(R.TIERS[Math.min(s.office, R.TIERS.length - 1)].rate * between(s, ...hit.amount));
    s.money -= e.money; // 赤字になってもよい
    addLog(s, t, `${l.name}  ${hit.title}`, 'bad');
  }
  s.rival = { id: l.id, until: t + R.RIVAL_STAY };
  ev.push(e);
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
    for (const o of s.offers.filter((o) => o.expiresAt <= next)) addLog(s, o.expiresAt, `${o.title}  期限切れ`);
    s.offers = s.offers.filter((o) => o.expiresAt > next);
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
    if (s.rival && s.rival.until <= next) s.rival = null; // 冷やかしに来たレジェンドは帰る
    // 選ばれないまま待てる期限が過ぎた人は辞退する
    for (const c of s.candidates.filter((c) => c.until <= next)) addLog(s, c.until, `${c.name}  辞退`);
    s.candidates = s.candidates.filter((c) => c.until > next);
    if (next === boundary) {
      rollEncounter(s, next, ev);
      rollLuck(s, next, ev);
      rollOffer(s, next);
      rollWalkOffer(s, next);
      rollRival(s, next, ev);
      rollQuit(s, next, ev);
      rollWalkin(s, next, ev);
      rollAd(s, next);
    }
    s.time = next;
  }
  return ev;
}

// 古い記録を今の形にそろえる（以前あった知識ノートのデータは使わないので消す）
export function migrate(s) {
  for (const c of s.candidates) c.until ??= s.candAt + R.CANDIDATE_EVERY; // 前の記録の人は、次の入れ替えまで待つ
  if (!R.ACTIVITIES[s.activity]) s.activity = R.DEFAULT_ACTIVITY;
  s.company = companyTitle(s.company);
  delete s.notes;
  s.log = s.log.filter((l) => l.kind !== 'note');
  backfillHistory(s);
  for (const m of s.members) if (m.kind === 'legend') m.joinedAt ??= s.time; // 前の記録のレジェンドは、いまから数える
  return s;
}

// 「これまでの仕事」を作る前に終わった仕事を、出来事のメモ（「仕事の名前  成功／失敗」）から一覧に足す（1回だけ）
// メモには報酬・評判・担当者が残っていないので空欄（money / rep は null）
function backfillHistory(s) {
  if (s.historyBackfilled) return;
  s.historyBackfilled = true;
  const oldest = Math.min(...(s.history ?? []).map((h) => h.t), Infinity);
  const old = s.log
    .map((l) => ({ l, m: l.text.match(/^(.+)  (成功|失敗)$/) }))
    .filter(({ l, m }) => m && l.t < oldest && R.TASKS.some((x) => x.title === m[1]))
    .map(({ l, m }) => ({ t: l.t, title: m[1], cat: R.TASKS.find((x) => x.title === m[1]).cat, ok: m[2] === '成功', money: null, rep: null, who: [] }));
  s.history = [...(s.history ?? []), ...old].slice(0, HISTORY_MAX);
}

// ---------- 記録 ----------
function addLog(s, t, text, kind = '') {
  s.log.unshift({ t, text, kind });
  s.log.length = Math.min(s.log.length, 60);
}

