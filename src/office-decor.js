// 会社の広さごとの見た目（2026-10-02 ユーザー指示）
// 前半はオタクっぽく汚い：暗い部屋で画面だけが光る、配線・エナジードリンク・ピザの箱・手作りのサーバー
// 後半はきれいで最先端：白と明るい木、ガラスの壁、長い机に薄い画面、植物（Apple のオフィスのような）
import * as THREE from 'three';

const mat = (color, opts) => new THREE.MeshToonMaterial({ color, ...opts });
const glow = (color, opts) => new THREE.MeshBasicMaterial({ color, ...opts });
const box = (w, h, d, m, x = 0, y = 0, z = 0) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  return b;
};

// mood: night＝暗い部屋（画面とLEDが光る） / day＝ふつうの昼 / clean＝白く明るい最先端
// desk: otaku / office / apple / holo（机の形） sky: 窓の外の絵
export const THEMES = [
  { mood: 'night', desk: 'otaku', floor: 0x5a4a3a, wall: 0x6e6658, sky: 'nightHome', winW: 0.24, winH: 0.45, bg: ['#0a0c18', '#191427'] }, // 自宅の部屋
  { mood: 'night', desk: 'otaku', floor: 0x3d3f45, wall: 0x55575c, sky: null, bg: ['#090b14', '#16131f'] }, // ガレージ（窓なし、シャッター）
  { mood: 'night', desk: 'otaku', floor: 0x3a3646, wall: 0x4a4658, sky: 'nightCity', winW: 0.45, winH: 0.55, bg: ['#0b0d1a', '#1b1430'] }, // 小さな事務所
  { mood: 'day', desk: 'office', floor: 0x8a929e, wall: 0xdfe3e8, sky: 'dayCity', winW: 0.5, winH: 0.6 }, // オフィスビル
  { mood: 'day', desk: 'office2', floor: 0x9b8a74, wall: 0xf2f1ee, sky: 'dayCity', winW: 0.7, winH: 0.75 }, // 本社ビル
  { mood: 'clean', desk: 'apple', floor: 0xd9d6d0, wall: 0xf7f7f5, sky: 'skyline', winW: 0.92, winH: 1.25 }, // 高層タワー
  { mood: 'clean', desk: 'apple', floor: 0xe4cfa8, wall: 0xf7f7f5, sky: 'park', winW: 0.92, winH: 1.25, ground: 0x8fcf7a }, // テックキャンパス
  { mood: 'clean', desk: 'apple', floor: 0xf1efea, wall: 0xfbfbfa, sky: 'skyline', winW: 0.5, winH: 1.0 }, // 世界本社（奥は大きな光る壁）
  { mood: 'neon', desk: 'holo', floor: 0x2c3552, wall: 0x3a4466, sky: 'neonCity', winW: 0.92, winH: 1.25, bg: ['#070a16', '#141a33'], ground: 0x1d2233, path: 0x5ad0e0 }, // スマートシティ
  { mood: 'clean', desk: 'holo', floor: 0xdfe5ec, wall: 0xf3f6f9, sky: 'space', winW: 0.92, winH: 1.1, bg: ['#05070f', '#141a2e'], ground: 0x151a28, path: 0x2c3550, trees: false }, // 宇宙ステーション
];
export const themeOf = (level) => THEMES[Math.min(level, THEMES.length - 1)];

// 明るさ（全体の光の強さと色）
export const LIGHT = {
  night: { hemi: [0x8a96d8, 0x2a2238, 1.15], sun: [0xa0a8ff, 0.55] },
  day: { hemi: [0xffffff, 0x8899bb, 1.6], sun: [0xffffff, 1.6] },
  clean: { hemi: [0xffffff, 0xcfd6e4, 2.0], sun: [0xffffff, 1.5] },
  neon: { hemi: [0x9fb0ff, 0x203050, 1.7], sun: [0xc0ccff, 0.9] },
};

// ---------- 絵（canvas） ----------
const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}
// 決まった並びの乱数（毎回同じ絵になるように）
const seeded = (n) => () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;

// 黒い画面に色とりどりのプログラム
export const codeTex = (v = 0) =>
  canvasTex(`code${v}`, 128, 80, (g, w, h) => {
    const r = seeded(7 + v * 13);
    g.fillStyle = '#0d1117';
    g.fillRect(0, 0, w, h);
    const cols = ['#7ee787', '#79c0ff', '#ff7bd5', '#ffd479', '#a5d6ff', '#d2a8ff'];
    for (let y = 6; y < h - 4; y += 6) {
      let x = 6 + Math.floor(r() * 4) * 6;
      const n = 1 + Math.floor(r() * 4);
      for (let k = 0; k < n && x < w - 8; k++) {
        const len = 8 + r() * 26;
        g.fillStyle = cols[Math.floor(r() * cols.length)];
        g.fillRect(x, y, Math.min(len, w - 6 - x), 3);
        x += len + 4;
      }
    }
  });
// ターミナル（緑の文字）
export const termTex = () =>
  canvasTex('term', 128, 80, (g, w, h) => {
    const r = seeded(99);
    g.fillStyle = '#04120a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#3dff7a';
    for (let y = 5; y < h - 4; y += 6) g.fillRect(5, y, 6 + r() * 90, 3);
  });
// 明るい画面（グラフとカード）
export const uiTex = (v = 0) =>
  canvasTex(`ui${v}`, 128, 80, (g, w, h) => {
    const dark = v === 2;
    g.fillStyle = dark ? '#0e1424' : '#f5f7fb';
    g.fillRect(0, 0, w, h);
    g.fillStyle = dark ? '#1c2742' : '#e3e8f2';
    g.fillRect(0, 0, 22, h);
    const acc = ['#5b8cff', '#34c38f', '#ff8a5b', '#b07cff'];
    for (let i = 0; i < 3; i++) {
      g.fillStyle = dark ? '#18213a' : '#ffffff';
      g.fillRect(28 + i * 33, 8, 29, 22);
      g.fillStyle = acc[(i + v) % 4];
      g.fillRect(32 + i * 33, 22, 18, 4);
    }
    g.strokeStyle = acc[v % 4];
    g.lineWidth = 3;
    g.beginPath();
    for (let x = 0; x <= 95; x += 5) g.lineTo(28 + x, 66 - Math.sin(x / 12 + v) * 10 - x / 8);
    g.stroke();
  });

// 窓の外
function skyTex(kind) {
  return canvasTex(`sky-${kind}`, 512, 160, (g, w, h) => {
    const r = seeded(kind.length * 31 + 5);
    const grad = (a, b) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, a);
      gr.addColorStop(1, b);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    };
    const city = (base, lit, top, n, litRate) => {
      for (let i = 0; i < n; i++) {
        const bw = 14 + r() * 30;
        const x = r() * w;
        const bh = top * (0.35 + r() * 0.65);
        g.fillStyle = base;
        g.fillRect(x, h - bh, bw, bh);
        if (lit) {
          g.fillStyle = lit;
          for (let yy = h - bh + 5; yy < h - 4; yy += 8) for (let xx = x + 3; xx < x + bw - 4; xx += 7) if (r() < litRate) g.fillRect(xx, yy, 3, 4);
        }
      }
    };
    const stars = (n) => {
      g.fillStyle = '#ffffff';
      for (let i = 0; i < n; i++) g.fillRect(r() * w, r() * h * 0.7, 1.5, 1.5);
    };
    if (kind === 'nightHome') {
      grad('#0b1230', '#1d2650');
      stars(40);
      g.fillStyle = '#fff4c8';
      g.beginPath();
      g.arc(w * 0.72, h * 0.3, 18, 0, Math.PI * 2);
      g.fill();
      city('#0a0e1c', '#ffd77a', h * 0.45, 26, 0.18);
    } else if (kind === 'nightCity') {
      grad('#0a0f26', '#2a1f4a');
      stars(25);
      city('#141a33', null, h * 0.9, 18, 0);
      city('#0b0f20', '#ffd77a', h * 0.7, 30, 0.3);
    } else if (kind === 'dayCity') {
      grad('#8fc6ff', '#d9eeff');
      city('#a9bdd3', null, h * 0.8, 20, 0);
      city('#8aa1bb', '#c9e2ff', h * 0.55, 26, 0.4);
    } else if (kind === 'skyline') {
      grad('#7fb8ff', '#e6f3ff');
      g.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 6; i++) g.fillRect(r() * w, 10 + r() * 40, 60 + r() * 60, 8);
      city('#b8c9dc', null, h * 0.55, 30, 0);
      city('#9cb0c8', '#e4f0ff', h * 0.38, 40, 0.3);
    } else if (kind === 'park') {
      grad('#8cc8ff', '#e9f6ff');
      g.fillStyle = '#7cc46c';
      g.fillRect(0, h * 0.72, w, h);
      for (let i = 0; i < 40; i++) {
        const x = r() * w;
        const s = 14 + r() * 22;
        g.fillStyle = ['#4f9e4a', '#62b25a', '#3f8a44'][i % 3];
        g.beginPath();
        g.arc(x, h * 0.72 - s * 0.4, s, 0, Math.PI * 2);
        g.fill();
      }
    } else if (kind === 'neonCity') {
      grad('#050818', '#1a0f3a');
      stars(20);
      city('#0d1330', '#36e0ff', h * 0.95, 22, 0.25);
      city('#080b20', '#ff5bd8', h * 0.6, 30, 0.2);
      g.fillStyle = '#36e0ff';
      g.fillRect(0, h - 3, w, 3);
    } else if (kind === 'space') {
      g.fillStyle = '#03050c';
      g.fillRect(0, 0, w, h);
      stars(120);
      const gr = g.createRadialGradient(w * 0.6, h * 1.55, h * 0.6, w * 0.6, h * 1.55, h * 1.15);
      gr.addColorStop(0, '#2f7fe0');
      gr.addColorStop(0.92, '#6fb8ff');
      gr.addColorStop(1, 'rgba(120,190,255,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(w * 0.6, h * 1.55, h * 1.15, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#5cae5c';
      g.beginPath();
      g.ellipse(w * 0.52, h * 0.62, 50, 14, -0.2, 0, Math.PI * 2);
      g.fill();
    }
  });
}
export const windowMaterial = (kind) => glow(0xffffff, { map: skyTex(kind) });

// 自分で描く壁の、まだ何も描いていないときの絵（点線の枠と、真ん中にペン）
export const artBlankTex = () =>
  canvasTex('art-blank', 400, 300, (c, W, H) => {
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 4;
    c.setLineDash([16, 12]);
    c.strokeRect(6, 6, W - 12, H - 12);
    c.setLineDash([]);
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.translate(W / 2 - 36, H / 2 - 36);
    c.scale(3, 3);
    c.lineWidth = 2;
    c.stroke(new Path2D('M4.5 19.5l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3l-10 10z'));
    c.stroke(new Path2D('M13.5 7l3 3'));
  });

// ---------- 机 ----------
// span は机と机の間（長い机をつなげて見せるのに使う）。blink は光らせる LED を入れる箱
const shared = {};
const once = (k, f) => (shared[k] ??= f());
// big: 大きな画面を持てる会社（本社ビルから）。一部の机が大きな画面になる
export function makeDesk(style, i, { span = 1, home = false, big = false } = {}) {
  const g = new THREE.Group();
  const screen = (wd, ht, tex, x, y, z, ry = 0, frame = 0x1a1a22) => {
    const s = new THREE.Group();
    s.add(box(wd + 0.03, ht + 0.03, 0.025, once(`f${frame}`, () => mat(frame))));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), glow(0xffffff, { map: tex }));
    p.position.z = 0.014;
    s.add(p);
    s.position.set(x, y, z);
    s.rotation.y = ry;
    return s;
  };
  if (style === 'otaku') {
    const top = home ? 0x5e4a38 : 0x24242c;
    g.add(box(0.74, 0.04, 0.42, once(`dt${top}`, () => mat(top)), 0, 0.4, 0));
    g.add(box(0.04, 0.38, 0.38, once('dl', () => mat(0x18181e)), -0.33, 0.19, 0), box(0.04, 0.38, 0.38, once('dl', () => mat(0x18181e)), 0.33, 0.19, 0));
    // 画面2枚（自宅は1枚とノートPC）
    if (home) {
      g.add(screen(0.3, 0.19, codeTex(i), -0.06, 0.58, -0.12));
      const lap = box(0.2, 0.01, 0.14, once('lap', () => mat(0x3a3a44)), 0.24, 0.43, 0.02);
      const lid = screen(0.18, 0.11, termTex(), 0.24, 0.49, -0.05, 0, 0x3a3a44);
      lid.rotation.x = -0.2;
      g.add(lap, lid);
    } else {
      g.add(screen(0.28, 0.18, codeTex(i), -0.15, 0.58, -0.1, 0.18), screen(0.28, 0.18, i % 3 === 1 ? termTex() : codeTex(i + 5), 0.15, 0.58, -0.1, -0.18));
    }
    // 光るキーボード
    g.add(box(0.26, 0.015, 0.08, once('kb', () => mat(0x111116)), 0, 0.43, 0.08));
    g.add(box(0.26, 0.004, 0.006, once(`rgb${i % 3}`, () => glow([0xff4fd8, 0x36e0ff, 0x7cff6b][i % 3])), 0, 0.438, 0.122));
    // 机の下のゲーミングPC（横に光る線）
    const tower = box(0.14, 0.3, 0.3, once('tw', () => mat(0x15151b)), 0.42, 0.15, -0.02);
    const led = box(0.005, 0.26, 0.02, once(`rgb${(i + 1) % 3}`, () => glow([0xff4fd8, 0x36e0ff, 0x7cff6b][(i + 1) % 3])), 0.35, 0.15, 0.1);
    g.add(tower, led);
    // エナジードリンクの缶
    const can = new THREE.Mesh(once('cang', () => new THREE.CylinderGeometry(0.022, 0.022, 0.07, 10)), once(`can${i % 2}`, () => mat(i % 2 ? 0x2fd36b : 0x1d1d1d)));
    can.position.set(-0.3, 0.46, 0.1);
    g.add(can);
    return g;
  }
  if (style === 'office' || style === 'office2') {
    const clean = style === 'office2';
    g.add(box(0.74, 0.04, 0.42, once(`ot${clean}`, () => mat(clean ? 0xf4f4f2 : 0xd8d2c4)), 0, 0.4, 0));
    g.add(box(0.7, 0.36, 0.03, once('ol', () => mat(0xa8adb5)), 0, 0.2, -0.17));
    if (!clean) g.add(box(0.76, 0.42, 0.03, once('part', () => mat(0x6f8aa8)), 0, 0.62, -0.23)); // 仕切り
    if (big && i % 3 === 0) {
      // 横に長い曲がった大きな画面（3枚をつないで曲げて見せる）
      g.add(box(0.06, 0.1, 0.06, once('ust', () => mat(0x2a2a30)), 0, 0.47, -0.12));
      g.add(screen(0.34, 0.2, uiTex(i % 2), 0, 0.64, -0.13, 0, 0x1a1a1f));
      g.add(screen(0.17, 0.2, codeTex(i), -0.25, 0.64, -0.1, 0.38, 0x1a1a1f), screen(0.17, 0.2, codeTex(i + 3), 0.25, 0.64, -0.1, -0.38, 0x1a1a1f));
    } else {
      g.add(screen(0.3, 0.18, uiTex(i % 2), clean ? -0.1 : 0, 0.6, -0.1, clean ? 0.12 : 0, 0x2a2a30));
      if (clean) g.add(screen(0.3, 0.18, codeTex(i), 0.2, 0.6, -0.1, -0.12, 0x2a2a30));
    }
    g.add(box(0.24, 0.012, 0.08, once('okb', () => mat(0xe6e6e6)), 0, 0.43, 0.08));
    const mug = new THREE.Mesh(once('mug', () => new THREE.CylinderGeometry(0.03, 0.03, 0.06, 10)), once('mugm', () => mat(0xffffff)));
    mug.position.set(0.28, 0.45, 0.08);
    g.add(mug);
    return g;
  }
  // 長い明るい木の机に、薄い銀の画面（apple）／浮かぶ光の画面（holo）
  const holo = style === 'holo';
  const len = Math.max(0.74, span * 0.98);
  g.add(box(len, 0.03, 0.46, once(`at${holo}`, () => mat(holo ? 0xeef2f6 : 0xdcb98a)), 0, 0.41, 0));
  g.add(box(0.03, 0.4, 0.36, once('al', () => mat(0xe8e8ea)), -0.28, 0.2, 0), box(0.03, 0.4, 0.36, once('al', () => mat(0xe8e8ea)), 0.28, 0.2, 0));
  if (holo) {
    const h = new THREE.Mesh(once('holog', () => new THREE.PlaneGeometry(0.42, 0.24)), once('holom', () => glow(0x7fe8ff, { transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })));
    h.position.set(0, 0.68, -0.08);
    const inner = new THREE.Mesh(once('holog2', () => new THREE.PlaneGeometry(0.38, 0.2)), glow(0xffffff, { map: uiTex(2), transparent: true, opacity: 0.85, depthWrite: false }));
    inner.position.set(0, 0.68, -0.075);
    const base = box(0.16, 0.012, 0.06, once('hb', () => glow(0x7fe8ff)), 0, 0.43, -0.08);
    if (big && i % 2 === 0) {
      // 大きな光の画面
      for (const m of [h, inner]) {
        m.scale.setScalar(1.6);
        m.position.y = 0.8;
      }
    }
    g.add(h, inner, base);
  } else {
    if (big && i % 2 === 0) {
      // 大きな画面（黒い細いふちと銀の足）。横にもう1枚、縦に置いた画面
      g.add(box(0.12, 0.012, 0.1, once('bst0', () => mat(0xd6d8dc)), 0, 0.43, -0.13), box(0.03, 0.2, 0.02, once('bst', () => mat(0xd6d8dc)), 0, 0.53, -0.15));
      g.add(screen(0.62, 0.35, uiTex(i % 2), 0, 0.8, -0.13, 0, 0x16161a));
      g.add(screen(0.2, 0.34, codeTex(i), 0.48, 0.66, -0.08, -0.45, 0x16161a));
    } else {
      // 一体型の薄い画面（銀の足）
      const stand = box(0.03, 0.12, 0.02, once('st', () => mat(0xd6d8dc)), 0, 0.48, -0.12);
      g.add(stand, screen(0.36, 0.21, uiTex(i % 2), 0, 0.64, -0.12, 0, 0xe9eaec));
    }
    const lap = box(0.18, 0.008, 0.12, once('alap', () => mat(0xc9ccd2)), 0.27, 0.43, 0.06);
    g.add(lap);
  }
  g.add(box(0.22, 0.008, 0.07, once('akb', () => mat(0xf2f2f2)), 0, 0.43, 0.08));
  return g;
}

// ---------- 部屋の飾り ----------
// blink: 点滅させる LED を入れる配列（office.js が光らせる）
// seats: クッションに座る場所 { pos, ry } を入れる配列（手の空いた社員が座ってノートPCで働く）
// extra.artPlane: 自分で描ける壁（自宅のいちばん目立つところ）。office.js がタップを受けて絵を貼る
export function decorate(level, w, d, blink, seats = [], extra = {}) {
  const g = new THREE.Group();
  const back = -d / 2 + 0.06;
  const left = -w / 2 + 0.06;
  const add = (...a) => g.add(...a);
  // 壁の LED テープ（オタク部屋の紫やピンクの光）
  const ledStrip = (color) => {
    add(box(w, 0.02, 0.02, glow(color), 0, 1.58, back + 0.02));
    add(box(0.02, 0.02, d, glow(color), left + 0.02, 1.58, 0));
  };
  // 手作りのサーバー棚（点滅する LED つき）
  const rack = (x, z, h = 0.9, ry = 0) => {
    const r = new THREE.Group();
    r.add(box(0.36, h, 0.3, mat(0x16161c), 0, h / 2, 0));
    for (let k = 0; k < Math.floor(h / 0.12); k++) {
      r.add(box(0.32, 0.08, 0.005, mat(0x26262e), 0, 0.08 + k * 0.12, 0.152));
      for (let j = 0; j < 3; j++) {
        const l = box(0.018, 0.018, 0.005, glow([0x3dff7a, 0x3dff7a, 0xffb02e, 0x36e0ff][(k + j) % 4]), -0.12 + j * 0.03, 0.08 + k * 0.12, 0.156);
        l.userData.phase = Math.random() * 10;
        blink.push(l);
        r.add(l);
      }
    }
    r.position.set(x, 0, z);
    r.rotation.y = ry;
    add(r);
  };
  // 光る看板（{ } の形）
  const neonBraces = (x, y, color) => {
    const m = glow(color);
    for (const s of [-1, 1]) {
      const a = box(0.03, 0.14, 0.01, m, x + s * 0.16, y + 0.08, back + 0.02);
      const b = box(0.03, 0.14, 0.01, m, x + s * 0.16, y - 0.08, back + 0.02);
      const c = box(0.06, 0.03, 0.01, m, x + s * 0.2, y, back + 0.02);
      a.rotation.z = s * 0.25;
      b.rotation.z = -s * 0.25;
      add(a, b, c);
    }
    add(box(0.12, 0.03, 0.01, glow(0xffffff), x, y - 0.12, back + 0.02));
  };
  const cans = (x, z, n) => {
    for (let k = 0; k < n; k++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 10), mat([0x2fd36b, 0x1d1d1d, 0x3a6fd8][k % 3]));
      c.position.set(x + (k % 3) * 0.06 - 0.06, 0.035, z + Math.floor(k / 3) * 0.06);
      if (k % 4 === 3) {
        c.rotation.z = Math.PI / 2;
        c.position.y = 0.022;
      }
      add(c);
    }
  };
  const pizzas = (x, z, n) => {
    for (let k = 0; k < n; k++) {
      const p = box(0.34, 0.035, 0.34, mat(0xd9b98a), x, 0.02 + k * 0.036, z);
      p.rotation.y = k * 0.3;
      add(p);
    }
  };
  const cable = (x, z, r, rot) => {
    const c = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 24, Math.PI * 1.4), mat(0x111111));
    c.rotation.set(-Math.PI / 2, 0, rot);
    c.position.set(x, 0.012, z);
    add(c);
  };
  const plant = (x, z, s = 1, pot = 0xf2f2f2) => {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.11 * s, 0.24 * s, 14), mat(pot)).translateX(x).translateY(0.12 * s).translateZ(z));
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.24 * s, 12, 10), mat(0x4f9e4a));
    leaf.scale.y = 1.3;
    leaf.position.set(x, 0.24 * s + 0.26 * s, z);
    add(leaf);
  };
  const bigTree = (x, z) => {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.9, 8), mat(0x8a6a4a)).translateX(x).translateY(0.45).translateZ(z));
    for (const [dx, dy, s] of [[0, 1.0, 0.38], [0.18, 0.85, 0.26], [-0.16, 0.9, 0.28]]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 10), mat(0x5aa84f));
      l.position.set(x + dx, dy, z);
      add(l);
    }
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 20), mat(0xe9e6df)).translateX(x).translateY(0.06).translateZ(z));
  };
  const sofa = (x, z, color, ry = 0) => {
    const s = new THREE.Group();
    s.add(box(0.9, 0.18, 0.4, mat(color), 0, 0.12, 0), box(0.9, 0.28, 0.1, mat(color), 0, 0.3, -0.17), box(0.1, 0.24, 0.4, mat(color), -0.45, 0.2, 0), box(0.1, 0.24, 0.4, mat(color), 0.45, 0.2, 0));
    s.position.set(x, 0, z);
    s.rotation.y = ry;
    add(s);
    return s;
  };
  const whiteboard = (x, z, scribble) => {
    const b = new THREE.Group();
    b.add(box(0.03, 0.55, 0.9, mat(0xb0b4bc), 0, 0.85, 0));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.49), glow(0xffffff, { map: canvasTex('wb', 128, 76, (c, W, H) => {
      const r = seeded(3);
      c.fillStyle = '#f4f4f0';
      c.fillRect(0, 0, W, H);
      c.lineWidth = 2;
      for (let k = 0; k < (scribble ? 14 : 5); k++) {
        c.strokeStyle = ['#2a5bd8', '#d83a3a', '#222', '#2a9d5b'][k % 4];
        c.beginPath();
        if (k % 3 === 0) c.strokeRect(6 + r() * 90, 6 + r() * 50, 18, 12);
        else {
          c.moveTo(6 + r() * 110, 6 + r() * 64);
          c.lineTo(6 + r() * 110, 6 + r() * 64);
          c.stroke();
        }
      }
    }) }));
    face.rotation.y = Math.PI / 2;
    face.position.set(0.02, 0.85, 0);
    b.add(face);
    b.position.set(x, 0, z);
    add(b);
  };
  // 光る大きな画面の壁（世界本社など）
  const videoWall = (x, y, wd, ht, tex) => {
    add(box(wd + 0.06, ht + 0.06, 0.03, mat(0x1b1d22), x, y, back + 0.02));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), glow(0xffffff, { map: tex }));
    p.position.set(x, y, back + 0.04);
    add(p);
  };

  // 床に散らかったごみ（缶・ペットボトル・丸めた紙・お菓子の袋）。n 個を決まった並びで散らす
  const trash = (n, seed, area = {}) => {
    const r = seeded(seed);
    const { x0 = -w / 2 + 0.25, x1 = w / 2 - 0.25, z0 = -d / 2 + 0.25, z1 = d / 2 - 0.2, cx, cz, rad } = area;
    for (let k = 0; k < n; k++) {
      // cx, cz, rad があれば、そのまわりに山にする
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(r()) * (rad ?? 0);
      const x = cx !== undefined ? cx + Math.cos(a) * rr : x0 + r() * (x1 - x0);
      const z = cz !== undefined ? cz + Math.sin(a) * rr : z0 + r() * (z1 - z0);
      const kind = Math.floor(r() * 5);
      const lie = r() < 0.6;
      let m;
      if (kind <= 1) {
        // 缶（銀、黒と緑のエナジードリンク、青）
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 10), mat([0xb8bcc4, 0x1d1d1d, 0x2fd36b, 0x3a6fd8][Math.floor(r() * 4)]));
        m.position.set(x, lie ? 0.022 : 0.035, z);
      } else if (kind === 2) {
        // ペットボトル（うす青のボトルと色のふた）
        m = new THREE.Group();
        m.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.11, 10), mat(0x9fd4e8, { transparent: true, opacity: 0.75 })));
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.025, 8), mat([0xff9a2e, 0x2e7dff, 0x2fbf5f][Math.floor(r() * 3)]));
        cap.position.y = 0.065;
        m.add(cap);
        m.position.set(x, lie ? 0.025 : 0.055, z);
      } else if (kind === 3) {
        // 丸めた紙
        m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), mat(0xc9c6bd));
        m.position.set(x, 0.025, z);
      } else {
        // お菓子の袋
        m = box(0.12, 0.015, 0.16, mat([0xf2b53a, 0x3a8fd8, 0x55b04a, 0x9a5bd0][Math.floor(r() * 4)]), x, 0.01, z);
      }
      m.rotation.y = r() * Math.PI * 2;
      if (lie && kind <= 2) m.rotation.z = Math.PI / 2;
      m.scale.setScalar(1.7); // 遠くからでもごみだとわかる大きさ
      m.position.y *= 1.7;
      if (cx !== undefined) m.position.y += r() * 0.05; // 山は少し積み重なる
      add(m);
    }
  };
  // 空き缶を積み上げたタワー
  const canTower = (x, z, rows = 4) => {
    for (let row = 0; row < rows; row++) {
      for (let k = 0; k < rows - row; k++) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 10), mat([0x1d1d1d, 0x2fd36b, 0xb8bcc4][(row + k) % 3]));
        c.position.set(x + (k - (rows - row - 1) / 2) * 0.05, 0.035 + row * 0.072, z);
        add(c);
      }
    }
  };
  // 黒いごみ袋
  const trashBag = (x, z, s = 1) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 10, 8), mat(0x24272b));
    b.scale.set(1, 1.15, 1);
    b.position.set(x, 0.18 * s, z);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.1 * s, 8), mat(0x24272b));
    knot.position.set(x, 0.4 * s, z);
    add(b, knot);
  };
  // 床で寝る用の寝袋と枕（生活が夜型）
  const sleepingBag = (x, z, ry = 0) => {
    const sb = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.55, 4, 10), mat(0x3d5a80));
    body.rotation.z = Math.PI / 2;
    body.scale.set(1, 1, 0.6);
    body.position.y = 0.08;
    const pillow = box(0.22, 0.06, 0.16, mat(0xb9b3a6), -0.42, 0.05, 0);
    sb.add(body, pillow);
    sb.position.set(x, 0, z);
    sb.rotation.y = ry;
    add(sb);
  };
  // 光る目覚まし時計（夜中の4時）
  const alarmClock = (x, z) => {
    add(box(0.14, 0.08, 0.06, mat(0x1a1a1f), x, 0.04, z));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.055), glow(0xffffff, { map: canvasTex('clock', 64, 30, (c, W, H) => {
      c.fillStyle = '#05140c';
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#3dff7a';
      c.font = 'bold 24px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('4:27', W / 2, H / 2 + 1);
    }) }));
    face.position.set(x, 0.045, z + 0.031);
    add(face);
  };
  // ヨギボーのような大きなクッション（寝そべったり、もたれて仕事したり）
  const yogibo = (x, z, color, ry = 0, laptop = true, up = false) => {
    const y = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 6, 14), mat(color));
    if (up) {
      body.position.y = 0.42;
      body.rotation.x = -0.25;
    } else {
      body.rotation.z = Math.PI / 2;
      body.scale.set(0.75, 1, 1);
      body.position.y = 0.15;
      body.rotation.y = 0.15;
    }
    y.add(body);
    if (laptop) {
      const lap = new THREE.Group();
      lap.add(box(0.16, 0.008, 0.11, mat(0xc9ccd2)));
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.09), glow(0xffffff, { map: uiTex(1) }));
      scr.position.set(0, 0.05, -0.05);
      scr.rotation.x = -0.25;
      lap.add(scr);
      lap.position.set(up ? 0 : 0.1, up ? 0.04 : 0.3, up ? 0.3 : 0.02);
      y.add(lap);
    }
    y.position.set(x, 0, z);
    y.rotation.y = ry;
    add(y);
  };
  // くつろぎながら働く場所：丸いラグ、ヨギボー、低いテーブル
  const lounge = (x, z, colors, rug = 0xe9e3d6) => {
    const rugM = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.01, 40), mat(rug));
    rugM.position.set(x, 0.005, z);
    add(rugM);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.14, 24), mat(0xd9b98a)).translateX(x).translateY(0.07).translateZ(z));
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.06, 10), mat(0xf4f4f2));
    cup.position.set(x + 0.04, 0.17, z);
    add(cup);
    // クッションにもたれて、真ん中のテーブルのほうを向いて座る
    colors.forEach((c, k) => {
      const a = (k / colors.length) * Math.PI * 2 + 0.4;
      yogibo(x + Math.cos(a) * 0.66, z + Math.sin(a) * 0.66, c, -a + Math.PI / 2, false, k === 1);
      seats.push({ pos: new THREE.Vector3(x + Math.cos(a) * 0.44, 0, z + Math.sin(a) * 0.44), ry: Math.atan2(-Math.cos(a), -Math.sin(a)) });
    });
  };
  // 下りの階段席（座れる大きな段、クッションつき）
  const steps = (x, z, wd) => {
    for (let k = 0; k < 3; k++) add(box(wd, 0.14 * (3 - k), 0.35, mat(0xd8b88a), x, 0.07 * (3 - k), z - 0.35 * (2 - k)));
    for (let k = 0; k < 5; k++) add(box(0.28, 0.06, 0.25, mat([0x6f8a6a, 0xd4a24c, 0x4a5f80][k % 3]), x - wd / 2 + 0.3 + k * (wd - 0.6) / 4, 0.14 * ((k % 3) + 1) + 0.03, z - 0.35 * (2 - (k % 3))));
  };

  // 壁のペンの落書き（英語のかっこいい言葉や変な絵）。暗い部屋でも見えるよう少し光るペン
  const scribble = (key, cw, ch, worldW, draw, { x = 0, y = 1, z = 0, onLeft = false, rot = 0 } = {}) => {
    const tex = canvasTex(`scr-${key}`, cw, ch, (c) => {
      c.lineCap = 'round';
      c.lineJoin = 'round';
      draw(c);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(worldW, (worldW * ch) / cw), glow(0xffffff, { map: tex, transparent: true, opacity: 0.9, depthWrite: false }));
    if (onLeft) {
      m.rotation.set(0, Math.PI / 2, rot);
      m.position.set(left + 0.006, y, z);
    } else {
      m.rotation.z = rot;
      m.position.set(x, y, back + 0.006);
    }
    add(m);
  };
  const FONT = (px) => `bold ${px}px "Marker Felt", "Comic Sans MS", "Chalkboard SE", cursive, sans-serif`;
  const words = (lines, color, px) => (c) => {
    c.fillStyle = color;
    c.font = FONT(px);
    c.textBaseline = 'top';
    lines.forEach((t, k) => c.fillText(t, 8 + k * 14, 6 + k * px * 1.1));
  };
  const pen = (c, color, wdt = 7) => {
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = wdt;
    c.beginPath();
  };

  if (level === 0) {
    // 自宅：壁はペンの落書きだらけ。床じゅうの缶とペットボトル、空き缶のタワー、夜中4時の目覚まし
    // いちばん目立つところは空けておき、自分で落書きできる（タップで描く。空のときは点線の枠とペン）
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.75), glow(0xffffff, { map: artBlankTex(), transparent: true, depthWrite: false }));
    art.position.set(-0.95, 1.17, back + 0.007);
    art.userData.blank = art.material.map;
    add(art);
    extra.artPlane = art;
    scribble('sleep', 420, 140, 0.7, words(['404:', 'SLEEP NOT FOUND'], '#7cff6b', 50), { x: -1.25, y: 0.62, rot: -0.06 });
    scribble('loop', 380, 150, 0.62, words(['while (alive)', ' { code(); }'], '#5fe6ff', 46), { x: 1.38, y: 1.25, rot: 0.05 });
    // 寝ていない日を数えた正の字のような線
    scribble('tally', 300, 120, 0.42, (c) => {
      pen(c, '#ffd84a', 7);
      for (let g2 = 0; g2 < 3; g2++) {
        for (let k = 0; k < 4; k++) {
          c.moveTo(20 + g2 * 95 + k * 16, 20);
          c.lineTo(22 + g2 * 95 + k * 16, 100);
        }
        c.moveTo(10 + g2 * 95, 90);
        c.lineTo(85 + g2 * 95, 30);
      }
      c.stroke();
    }, { x: 1.4, y: 0.88, rot: -0.04 });
    // ロケット
    scribble('rocket', 200, 260, 0.34, (c) => {
      pen(c, '#ff7bd5', 7);
      c.moveTo(100, 15);
      c.quadraticCurveTo(160, 80, 140, 180);
      c.lineTo(60, 180);
      c.quadraticCurveTo(40, 80, 100, 15);
      c.moveTo(60, 150);
      c.lineTo(25, 200);
      c.lineTo(62, 180);
      c.moveTo(140, 150);
      c.lineTo(175, 200);
      c.lineTo(138, 180);
      c.moveTo(80, 190);
      c.lineTo(100, 245);
      c.lineTo(120, 190);
      c.stroke();
      c.beginPath();
      c.arc(100, 95, 18, 0, Math.PI * 2);
      c.stroke();
    }, { x: -0.17, y: 1.25, rot: 0.25 });
    // 変な宇宙人の顔（目が3つ）
    scribble('alien', 240, 220, 0.4, (c) => {
      pen(c, '#b6ff5c', 7);
      c.ellipse(120, 115, 90, 80, 0, 0, Math.PI * 2);
      c.moveTo(60, 40);
      c.lineTo(30, 5);
      c.moveTo(180, 40);
      c.lineTo(210, 5);
      c.stroke();
      for (const [ex, ey] of [[80, 100], [120, 80], [160, 100]]) {
        c.beginPath();
        c.arc(ex, ey, 12, 0, Math.PI * 2);
        c.fill();
      }
      pen(c, '#b6ff5c', 7);
      c.moveTo(80, 150);
      c.quadraticCurveTo(120, 185, 160, 150);
      c.stroke();
    }, { x: -0.45, y: 0.55, rot: -0.1 });
    // 左の壁：HELLO, WORLD・バグも仕様・おばけ・矢印
    scribble('hello', 460, 150, 0.95, words(['HELLO,', 'WORLD!!'], '#ff5bd8', 62), { onLeft: true, z: -0.15, y: 1.2, rot: 0.05 });
    scribble('bug', 460, 90, 0.8, words(['BUG = FEATURE'], '#ffd84a', 54), { onLeft: true, z: 0.75, y: 1.32, rot: -0.04 });
    scribble('ghost', 200, 220, 0.3, (c) => {
      pen(c, '#e8e8ff', 7);
      c.moveTo(30, 200);
      c.lineTo(30, 90);
      c.arc(100, 90, 70, Math.PI, 0);
      c.lineTo(170, 200);
      for (let k = 0; k < 4; k++) c.lineTo(170 - (k + 0.5) * 35, k % 2 ? 200 : 175);
      c.lineTo(30, 200);
      c.stroke();
      c.beginPath();
      c.arc(75, 95, 9, 0, Math.PI * 2);
      c.arc(125, 95, 9, 0, Math.PI * 2);
      c.fill();
    }, { onLeft: true, z: 0.45, y: 0.72, rot: 0.1 });
    scribble('arrow', 300, 160, 0.5, (c) => {
      pen(c, '#5fe6ff', 7);
      c.moveTo(20, 120);
      c.bezierCurveTo(90, 10, 180, 150, 260, 50);
      c.moveTo(230, 40);
      c.lineTo(262, 48);
      c.lineTo(255, 82);
      c.stroke();
    }, { onLeft: true, z: 0.95, y: 0.95, rot: 0 });
    // 窓のカーテン（閉めっぱなしで、少しだけ開いている）
    const ww = w * 0.24;
    const wx = Math.min(w * 0.15, w * (0.48 - 0.12));
    for (const sgn of [-1, 1]) add(box(ww * 0.36, 0.62, 0.02, mat(0x2b3550), wx + sgn * ww * 0.36, 0.98, back + 0.02));
    add(box(ww * 1.15, 0.04, 0.04, mat(0x1a1a1f), wx, 1.3, back + 0.03));
    trash(30, 5);
    trash(22, 6, { cx: 1.0, cz: 0.45, rad: 0.35 }); // 机の手前のごみの山
    trash(16, 7, { cx: -0.9, cz: 0.75, rad: 0.3 }); // 布団の足もとの山
    canTower(0.2, d / 2 - 0.3, 5);
    trashBag(w / 2 - 0.3, d / 2 - 0.35, 0.9);
    trashBag(w / 2 - 0.65, d / 2 - 0.25, 0.75);
    alarmClock(-w / 2 + 1.0, -d / 2 + 0.3);
    rack(-w / 2 + 0.35, 0.9, 0.5);
    ledStrip(0xb04fff);
  }
  if (level === 1) {
    // ガレージ：シャッター、手作りのサーバー、作業台、ピザの箱、仮眠のソファ、ホワイトボード
    for (let k = 0; k < 14; k++) add(box(w * 0.55, 0.012, 0.012, mat(0x6a6d72), w * 0.12, 0.1 + k * 0.1, back + 0.01));
    add(box(w * 0.56, 0.06, 0.03, mat(0x3a3c40), w * 0.12, 1.5, back + 0.015));
    rack(-w / 2 + 0.3, -d / 2 + 0.3, 1.1);
    rack(-w / 2 + 0.7, -d / 2 + 0.3, 0.8);
    neonBraces(-w * 0.22, 1.2, 0x36e0ff);
    whiteboard(-w / 2 + 0.08, 0.55, true);
    sofa(w / 2 - 0.7, d / 2 - 0.5, 0x5a3e6e, Math.PI);
    add(box(0.6, 0.12, 0.3, mat(0x7a8fa8), w / 2 - 0.7, 0.28, d / 2 - 0.45)); // 寝袋
    pizzas(0.3, d / 2 - 0.5, 4);
    cans(-0.6, d / 2 - 0.6, 8);
    trash(45, 9);
    trash(25, 10, { cx: w * 0.3, cz: 0.6, rad: 0.45 });
    trash(20, 11, { cx: -w * 0.25, cz: d / 2 - 0.6, rad: 0.4 });
    canTower(w * 0.05, d / 2 - 0.3, 6);
    trashBag(-w / 2 + 0.3, d / 2 - 0.35);
    trashBag(-w / 2 + 0.6, d / 2 - 0.3, 0.8);
    sleepingBag(-0.1, 0.25, 0.3);
    cable(0.6, 0.0, 0.3, 0);
    cable(-1.2, 0.4, 0.22, 1.2);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), glow(0xffe7a3));
    bulb.position.set(0.3, 1.5, -0.3);
    add(bulb, box(0.01, 0.4, 0.01, mat(0x222222), 0.3, 1.75, -0.3));
    ledStrip(0x36e0ff);
  }
  if (level === 2) {
    // 小さな事務所：まだ散らかっている。フィギュアの棚、サーバー2台、付箋の壁、ビーズクッション、床じゅうのごみと寝袋
    rack(-w / 2 + 0.3, -d / 2 + 0.3, 1.2);
    rack(-w / 2 + 0.7, -d / 2 + 0.3, 1.2);
    const shelf = new THREE.Group();
    for (let k = 0; k < 3; k++) shelf.add(box(0.7, 0.03, 0.2, mat(0x2b2b33), 0, 0.5 + k * 0.32, 0));
    for (let k = 0; k < 9; k++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.06, 4, 8), mat([0xff4fd8, 0x36e0ff, 0xffd479, 0x7cff6b][k % 4]));
      f.position.set(-0.27 + (k % 3) * 0.27 + (k % 2) * 0.05, 0.57 + Math.floor(k / 3) * 0.32, 0);
      shelf.add(f);
    }
    shelf.position.set(w / 2 - 0.6, 0, back + 0.12);
    add(shelf);
    for (let k = 0; k < 16; k++) add(box(0.07, 0.07, 0.005, glow([0xffe066, 0xff9ecb, 0x9fe3ff][k % 3]), -w * 0.05 + (k % 8) * 0.09, 1.15 + Math.floor(k / 8) * 0.09 + (k % 3) * 0.01, back + 0.01));
    neonBraces(w * 0.28, 1.3, 0xff4fd8);
    whiteboard(-w / 2 + 0.08, 0.6, true);
    const bean = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), mat(0x3d2f6e));
    bean.scale.y = 0.6;
    bean.position.set(w / 2 - 0.6, 0.15, d / 2 - 0.6);
    add(bean);
    pizzas(w / 2 - 1.3, d / 2 - 0.5, 3);
    cans(-0.4, d / 2 - 0.5, 9);
    trash(60, 13);
    trash(25, 14, { cx: w * 0.3, cz: 0.9, rad: 0.5 });
    trash(25, 15, { cx: -w * 0.1, cz: d / 2 - 0.6, rad: 0.5 });
    canTower(-w * 0.32, d / 2 - 0.35, 6);
    trashBag(-w / 2 + 0.3, d / 2 - 0.35);
    trashBag(-w / 2 + 0.65, d / 2 - 0.3, 0.85);
    trashBag(w / 2 - 1.9, d / 2 - 0.3, 0.9);
    sleepingBag(w * 0.15, 0.35, -0.2);
    sleepingBag(-w * 0.2, 0.55, 0.4);
    cable(0.3, 0.2, 0.35, 0.5);
    ledStrip(0xb04fff);
  }
  if (level === 3) {
    // オフィスビル：ふつうの会社。本棚、コピー機、ウォーターサーバー、観葉植物
    add(box(0.5, 0.45, 0.4, mat(0xe6e6e6), w / 2 - 0.4, 0.22, back + 0.25));
    add(box(0.4, 0.05, 0.3, mat(0x4a4a50), w / 2 - 0.4, 0.47, back + 0.25));
    add(box(0.22, 0.6, 0.22, mat(0xf2f2f2), w / 2 - 0.85, 0.3, back + 0.2), new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.3, 12), mat(0x8fc8ff, { transparent: true, opacity: 0.8 })).translateX(w / 2 - 0.85).translateY(0.75).translateZ(back + 0.2));
    for (let k = 0; k < 3; k++) {
      const bk = new THREE.Group();
      bk.add(box(0.3, 1.0, 0.7, mat(0x7a6650), 0, 0.5, 0));
      for (let j = 0; j < 3; j++) bk.add(box(0.05, 0.2, 0.6, mat([0xc94f4f, 0x4f7fc9, 0x4fa86a][(j + k) % 3]), 0.16, 0.25 + j * 0.3, 0));
      bk.position.set(left + 0.15, 0, -d / 2 + 0.6 + k * 0.75);
      add(bk);
    }
    plant(w / 2 - 0.35, d / 2 - 0.4, 1, 0xd8d2c4);
    whiteboard(-w / 2 + 0.36, d / 2 - 0.9, false);
  }
  if (level === 4) {
    // 本社ビル：ガラスの会議室、光る会社のマーク、ラウンジのソファ、コーヒーバー、植物
    const glass = new THREE.MeshToonMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.28, depthWrite: false });
    const gw = 1.6;
    add(box(gw, 1.2, 0.02, glass, left + gw / 2, 0.6, -d / 2 + 1.4), box(0.02, 1.2, 1.3, glass, left + gw, 0.6, -d / 2 + 0.75));
    add(box(0.9, 0.04, 0.5, mat(0xffffff), left + gw / 2, 0.4, -d / 2 + 0.7), box(0.08, 0.38, 0.08, mat(0xcccccc), left + gw / 2, 0.2, -d / 2 + 0.7));
    videoWall(left + gw / 2, 0.85, 0.7, 0.4, uiTex(1));
    sofa(w / 2 - 0.8, d / 2 - 0.5, 0xe8e0d4, Math.PI);
    add(box(1.0, 0.45, 0.35, mat(0x3a3a40), w / 2 - 0.7, 0.22, back + 0.22), box(1.0, 0.03, 0.37, mat(0xd8b88a), w / 2 - 0.7, 0.46, back + 0.22));
    add(box(0.16, 0.2, 0.16, mat(0x1d1d1d), w / 2 - 0.95, 0.58, back + 0.2));
    for (const x of [-w * 0.1, w * 0.18]) plant(x, d / 2 - 0.35, 1.1);
    // 光るマーク
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 10, 32), glow(0x5b8cff));
    ring.position.set(w * 0.05, 1.2, back + 0.03);
    add(ring);
  }
  if (level === 5) {
    plant(w / 2 - 0.4, d / 2 - 0.4, 1.2);
    plant(left + 0.35, d / 2 - 0.4, 1.2);
    sofa(left + 0.8, 0.2, 0xf2f0ea, Math.PI / 2);
    lounge(w * 0.22, d / 2 - 1.2, [0x8a8f96, 0x2f3e5c, 0xd4a24c, 0xb76e4b]);
    lounge(-w * 0.18, d / 2 - 1.2, [0x6f8a6a, 0xe0ddd4, 0x2f3e5c]);
  }
  if (level === 6) {
    // キャンパス：部屋の中の木、木のベンチ、外の緑
    for (const x of [left + 0.45, w / 2 - 0.45]) bigTree(x, d / 2 - 0.5);
    bigTree(left + 0.45, -0.2);
    lounge(w * 0.2, d / 2 - 1.2, [0x6f8a6a, 0xd4a24c, 0xe0ddd4, 0x8a8f96], 0xcfe0c4);
    lounge(-w * 0.12, d / 2 - 1.2, [0xb76e4b, 0x2f3e5c, 0x6f8a6a]);
    // 卓球台
    const tt = new THREE.Group();
    tt.add(box(0.9, 0.03, 0.5, mat(0x2f5f8a), 0, 0.4, 0), box(0.9, 0.008, 0.01, mat(0xffffff), 0, 0.416, 0), box(0.02, 0.07, 0.5, mat(0x222222), 0, 0.45, 0));
    for (const [lx, lz] of [[-0.4, -0.2], [0.4, -0.2], [-0.4, 0.2], [0.4, 0.2]]) tt.add(box(0.03, 0.4, 0.03, mat(0x333333), lx, 0.2, lz));
    tt.position.set(w / 2 - 1.3, 0, d / 2 - 2.6);
    add(tt);
  }
  if (level === 7) {
    // 世界本社：奥の光る大きな画面（世界とつながる線）、光る地球儀
    const wall = canvasTex('world', 256, 96, (c, W, H) => {
      const r = seeded(11);
      c.fillStyle = '#071226';
      c.fillRect(0, 0, W, H);
      const pts = [];
      for (let k = 0; k < 60; k++) {
        const x = r() * W;
        const y = H / 2 + Math.sin(x / 30) * 15 + (r() - 0.5) * 50;
        pts.push([x, y]);
        c.fillStyle = '#5ab0ff';
        c.fillRect(x, y, 2, 2);
      }
      c.strokeStyle = 'rgba(120,220,255,0.6)';
      for (let k = 0; k < 18; k++) {
        const [a, b] = [pts[k * 3], pts[k * 3 + 1]];
        c.beginPath();
        c.moveTo(a[0], a[1]);
        c.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 25, b[0], b[1]);
        c.stroke();
      }
    });
    videoWall(-w * 0.18, 0.95, w * 0.42, 1.0, wall);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), glow(0x5ab0ff, { wireframe: true }));
    globe.position.set(left + 0.6, 0.9, d / 2 - 0.7);
    add(globe, new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.1, 24), glow(0x9fe3ff)).translateX(left + 0.6).translateY(0.05).translateZ(d / 2 - 0.7));
    plant(w / 2 - 0.4, d / 2 - 0.4, 1.2);
    for (let k = 0; k < 3; k++) plant(left + 0.3, -d / 2 + 0.4 + k * 1.0, 0.9);
    steps(w * 0.2, d / 2 - 0.7, 2.4);
    lounge(-w * 0.15, d / 2 - 1.2, [0x2f3e5c, 0xd4a24c, 0xe0ddd4, 0xb76e4b]);
    lounge(w * 0.38, d / 2 - 1.5, [0x6f8a6a, 0x8a8f96, 0x2f3e5c]);
  }
  if (level === 8) {
    // スマートシティ：床と天井の光る線、浮かぶ光の画面、夜のネオン街
    const line = glow(0x5ad0e0);
    add(box(w, 0.02, 0.04, line, 0, 0.01, back + 0.03), box(0.04, 0.02, d, line, left + 0.03, 0.01, 0));
    const holo = (x, y, z, s) => {
      const h = new THREE.Mesh(new THREE.PlaneGeometry(0.8 * s, 0.45 * s), glow(0xffffff, { map: uiTex(2), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      h.position.set(x, y, z);
      h.rotation.y = Math.PI / 2;
      add(h, box(0.3 * s, 0.02, 0.3 * s, glow(0x5ad0e0), x, 0.01, z));
    };
    holo(left + 0.5, 0.9, -0.4, 1.4);
    holo(left + 0.5, 0.9, d / 2 - 0.8, 1.1);
    lounge(w * 0.2, d / 2 - 1.1, [0x5a3e9e, 0x2a6a8a, 0x8a3e7a, 0x3a4a8a], 0x1d2a44);
    lounge(-w * 0.15, d / 2 - 1.1, [0x2a6a8a, 0x5a3e9e, 0x3a4a8a], 0x1d2a44);
  }
  if (level === 9) {
    // 宇宙ステーション：白い壁のパネル、青い光の線
    for (let k = 0; k < 6; k++) add(box(0.01, 1.5, 0.02, mat(0xc9d2dc), left + 0.01, 0.8, -d / 2 + (k + 0.5) * (d / 6)));
    add(box(w, 0.02, 0.03, glow(0x5ab0ff), 0, 0.05, back + 0.03), box(0.03, 0.02, d, glow(0x5ab0ff), left + 0.03, 0.05, 0));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 10, 40), glow(0x9fe3ff));
    ring.rotation.y = Math.PI / 2;
    ring.position.set(left + 0.05, 0.9, 0.3);
    add(ring);
    plant(w / 2 - 0.4, d / 2 - 0.4, 1.0);
    lounge(w * 0.2, d / 2 - 1.1, [0xe0ddd4, 0x4a6fa8, 0x8a8f96, 0xd4a24c], 0xdfe6ee);
    lounge(-w * 0.15, d / 2 - 1.1, [0x4a6fa8, 0xe0ddd4, 0x8a8f96], 0xdfe6ee);
  }
  return g;
}
