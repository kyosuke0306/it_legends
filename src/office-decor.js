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

// ---------- 机 ----------
// span は机と机の間（長い机をつなげて見せるのに使う）。blink は光らせる LED を入れる箱
const shared = {};
const once = (k, f) => (shared[k] ??= f());
export function makeDesk(style, i, { span = 1, home = false } = {}) {
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
    g.add(screen(0.3, 0.18, uiTex(i % 2), clean ? -0.1 : 0, 0.6, -0.1, clean ? 0.12 : 0, 0x2a2a30));
    if (clean) g.add(screen(0.3, 0.18, codeTex(i), 0.2, 0.6, -0.1, -0.12, 0x2a2a30));
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
    g.add(h, inner, base);
  } else {
    // 一体型の薄い画面（銀の足）
    const stand = box(0.03, 0.12, 0.02, once('st', () => mat(0xd6d8dc)), 0, 0.48, -0.12);
    g.add(stand, screen(0.36, 0.21, uiTex(i % 2), 0, 0.64, -0.12, 0, 0xe9eaec));
    const lap = box(0.18, 0.008, 0.12, once('alap', () => mat(0xc9ccd2)), 0.27, 0.43, 0.06);
    g.add(lap);
  }
  g.add(box(0.22, 0.008, 0.07, once('akb', () => mat(0xf2f2f2)), 0, 0.43, 0.08));
  return g;
}

// ---------- 部屋の飾り ----------
// blink: 点滅させる LED を入れる配列（office.js が光らせる）
export function decorate(level, w, d, blink) {
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
  // 壁のポスター（抽象的な絵）
  const poster = (x, y, c1, c2, onLeft = false) => {
    const p = new THREE.Group();
    p.add(box(0.36, 0.5, 0.01, mat(c1)));
    const circ = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), glow(c2));
    circ.position.set(0, 0.06, 0.008);
    const bar = box(0.26, 0.04, 0.005, glow(0xffffff), 0, -0.16, 0.008);
    p.add(circ, bar);
    if (onLeft) {
      p.rotation.y = Math.PI / 2;
      p.position.set(left + 0.01, y, x);
    } else p.position.set(x, y, back + 0.01);
    add(p);
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

  if (level === 0) {
    // 自宅：壁のポスター、床のエナジードリンクの缶、机の横のサーバー代わりの古いPC
    poster(-0.15, 1.1, 0x1b1f3a, 0xff4fd8);
    poster(w * 0.42 - 0.5, 1.15, 0x2a1b3a, 0x36e0ff);
    cans(0.75, 0.55, 7);
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
    cable(0.6, 0.0, 0.3, 0);
    cable(-1.2, 0.4, 0.22, 1.2);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), glow(0xffe7a3));
    bulb.position.set(0.3, 1.5, -0.3);
    add(bulb, box(0.01, 0.4, 0.01, mat(0x222222), 0.3, 1.75, -0.3));
    ledStrip(0x36e0ff);
  }
  if (level === 2) {
    // 小さな事務所：まだ散らかっている。フィギュアの棚、サーバー2台、付箋の壁、ビーズクッション、ポスター
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
    poster(-w * 0.28, 1.15, 0x1b1f3a, 0xff4fd8);
    neonBraces(w * 0.28, 1.3, 0xff4fd8);
    whiteboard(-w / 2 + 0.08, 0.6, true);
    const bean = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), mat(0x3d2f6e));
    bean.scale.y = 0.6;
    bean.position.set(w / 2 - 0.6, 0.15, d / 2 - 0.6);
    add(bean);
    pizzas(w / 2 - 1.3, d / 2 - 0.5, 3);
    cans(-0.4, d / 2 - 0.5, 9);
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
  }
  if (level === 6) {
    // キャンパス：部屋の中の木、木のベンチ、外の緑
    for (const x of [left + 0.45, w / 2 - 0.45]) bigTree(x, d / 2 - 0.5);
    bigTree(left + 0.45, -0.2);
    for (let k = 0; k < 4; k++) add(box(0.7, 0.2, 0.3, mat(0xc99a62), -w * 0.3 + k * w * 0.2, 0.1, d / 2 - 0.35));
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
  }
  return g;
}
