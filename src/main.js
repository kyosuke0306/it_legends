import { LEGENDS, RARITY, byId } from './data.js';
import { createCharacter } from './character.js';
import { Stage, renderThumbnail } from './stage.js';

const $ = (s) => document.querySelector(s);
const SAVE_KEY = 'it_legends.collection';

// 所持状況 { id: 枚数 }
let collection = {};
try {
  collection = JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
} catch {}
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(collection));
  } catch {}
}

// ---------- ガチャ ----------
function drawOne() {
  let r = Math.random();
  let rarity = 'R';
  for (const [key, { rate }] of Object.entries(RARITY)) {
    if (r < rate) {
      rarity = key;
      break;
    }
    r -= rate;
  }
  const pool = LEGENDS.filter((l) => l.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

const gachaStage = new Stage($('#gacha-canvas'));
let busy = false;

async function pull(n) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('.pull').forEach((b) => (b.disabled = true));
  $('#gacha-placeholder').classList.add('hidden');

  const results = Array.from({ length: n }, () => {
    const legend = drawOne();
    const isNew = !collection[legend.id];
    collection[legend.id] = (collection[legend.id] || 0) + 1;
    return { legend, isNew };
  });
  save();
  updateProgress();

  // 一番レアなものを演出で見せる
  const order = ['SSR', 'SR', 'R'];
  const best = [...results].sort((a, b) => order.indexOf(a.legend.rarity) - order.indexOf(b.legend.rarity))[0];
  renderPullList(n > 1 ? results : []);
  $('#gacha-result').classList.add('hidden');
  await showOnGachaStage(best, true);

  busy = false;
  document.querySelectorAll('.pull').forEach((b) => (b.disabled = false));
}

async function showOnGachaStage({ legend, isNew }, withCapsule) {
  const obj = await createCharacter(legend);
  if (withCapsule) await gachaStage.reveal(obj, RARITY[legend.rarity].color);
  else gachaStage.setCharacter(obj);
  const el = $('#gacha-result');
  el.innerHTML = `
    <span class="rarity r-${legend.rarity}">${legend.rarity}</span>
    ${isNew ? '<span class="new">NEW!</span>' : ''}
    <div class="name">${legend.name}</div>
    <div class="title">${legend.title}</div>
    <button class="link">何をした人？</button>`;
  el.querySelector('.link').onclick = () => openDetail(legend.id);
  el.classList.remove('hidden');
}

function renderPullList(results) {
  const list = $('#gacha-list');
  list.innerHTML = '';
  for (const r of results) {
    const b = document.createElement('button');
    b.className = `chip r-${r.legend.rarity}`;
    b.innerHTML = `${r.isNew ? '<b>NEW</b> ' : ''}${r.legend.name}`;
    b.onclick = () => !busy && showOnGachaStage(r, false);
    list.append(b);
  }
}

$('#pull1').onclick = () => pull(1);
$('#pull10').onclick = () => pull(10);

// ---------- 図鑑 ----------
const thumbs = {};
async function thumbnailFor(legend) {
  thumbs[legend.id] ??= createCharacter(legend).then((obj) => renderThumbnail(obj));
  return thumbs[legend.id];
}

async function renderZukan() {
  const grid = $('#zukan-grid');
  grid.innerHTML = '';
  for (const legend of LEGENDS) {
    const owned = collection[legend.id];
    const card = document.createElement('button');
    card.className = `card r-${legend.rarity} ${owned ? '' : 'locked'}`;
    card.innerHTML = `
      <span class="rarity r-${legend.rarity}">${legend.rarity}</span>
      <div class="thumb"></div>
      <div class="name">${owned ? legend.name : '？？？'}</div>
      ${owned ? `<div class="count">×${owned}</div>` : ''}`;
    card.onclick = () => owned && openDetail(legend.id);
    grid.append(card);
    thumbnailFor(legend).then((src) => {
      const img = new Image();
      img.src = src;
      card.querySelector('.thumb').append(img);
    });
  }
}

function updateProgress() {
  const got = LEGENDS.filter((l) => collection[l.id]).length;
  $('#progress').textContent = `${got}/${LEGENDS.length}`;
}

// ---------- 詳細 ----------
let detailStage;
async function openDetail(id) {
  const legend = byId[id];
  const dialog = $('#detail');
  $('#detail-info').innerHTML = `
    <span class="rarity r-${legend.rarity}">${legend.rarity}</span>
    <h2>${legend.name}</h2>
    <div class="sub">${legend.nameEn}（${legend.years}）</div>
    <div class="title">「${legend.title}」</div>
    <h3>何をした人？</h3>
    <p>${legend.summary}</p>
    <h3>おもな功績</h3>
    <ul>${legend.achievements.map((a) => `<li>${a}</li>`).join('')}</ul>
    <a href="https://ja.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(legend.name)}" target="_blank" rel="noopener">Wikipediaでもっと知る</a>`;
  dialog.showModal();
  detailStage ??= new Stage($('#detail-canvas'));
  detailStage.setCharacter(null);
  detailStage.setCharacter(await createCharacter(legend));
}

$('#detail .close').onclick = () => $('#detail').close();
$('#detail').addEventListener('click', (e) => {
  if (e.target.id === 'detail') e.target.close();
});

// ---------- タブ ----------
document.querySelectorAll('.tab').forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${tab.dataset.view}`));
    if (tab.dataset.view === 'zukan') renderZukan();
  };
});

updateProgress();
