// 模様替えで置く家具の3D（2026-10-19 ユーザー指示「暇な時間に」）。種類と効果は rules.js の FURNITURE
import * as THREE from 'three';

const mat = (color, opts) => new THREE.MeshToonMaterial({ color, ...opts });
const glow = (color, opts) => new THREE.MeshBasicMaterial({ color, ...opts });
const box = (w, h, d, m, x = 0, y = 0, z = 0) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  return b;
};
const cyl = (rt, rb, h, m, x = 0, y = 0, z = 0, seg = 16) => {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  c.position.set(x, y, z);
  return c;
};

const MODELS = {
  // 小さな台の上のコーヒーメーカーとカップ
  coffee: () => {
    const g = new THREE.Group();
    g.add(box(0.36, 0.42, 0.28, mat(0x8a6a4a), 0, 0.21, 0));
    g.add(box(0.16, 0.24, 0.16, mat(0x2a2a30), -0.06, 0.54, 0));
    g.add(box(0.12, 0.04, 0.06, mat(0x2a2a30), -0.06, 0.64, 0.09));
    g.add(cyl(0.05, 0.045, 0.08, glow(0x9bdcff, { transparent: true, opacity: 0.6 }), -0.06, 0.47, 0.05));
    g.add(box(0.03, 0.03, 0.005, glow(0xff5a4a), 0.0, 0.6, 0.082));
    for (const [x, c] of [[0.09, 0xf4f4f2], [0.15, 0xe2725b]]) g.add(cyl(0.028, 0.024, 0.06, mat(c), x, 0.45, 0.04));
    return g;
  },
  // 鉢植えの大きな葉っぱ
  plant: () => {
    const g = new THREE.Group();
    g.add(cyl(0.13, 0.1, 0.24, mat(0xd9d2c4), 0, 0.12, 0));
    g.add(cyl(0.12, 0.12, 0.02, mat(0x5a4030), 0, 0.235, 0));
    const leaf = mat(0x3f9a55);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), leaf);
      l.scale.set(0.5, 1.4, 0.18);
      l.position.set(Math.cos(a) * 0.1, 0.42 + (k % 3) * 0.06, Math.sin(a) * 0.1);
      l.rotation.set(Math.sin(a) * 0.6, -a, Math.cos(a) * 0.6);
      g.add(l);
    }
    return g;
  },
  // 黒と赤のゲーミングチェア
  chair: () => {
    const g = new THREE.Group();
    const black = mat(0x1c1c22);
    const red = mat(0xd8323f);
    g.add(cyl(0.2, 0.2, 0.02, black, 0, 0.03, 0, 5));
    g.add(cyl(0.025, 0.025, 0.22, mat(0x9a9aa6), 0, 0.14, 0));
    g.add(box(0.36, 0.07, 0.34, black, 0, 0.28, 0));
    g.add(box(0.36, 0.5, 0.07, black, 0, 0.56, -0.15));
    g.add(box(0.08, 0.46, 0.075, red, -0.11, 0.56, -0.148));
    g.add(box(0.08, 0.46, 0.075, red, 0.11, 0.56, -0.148));
    g.add(box(0.2, 0.08, 0.08, black, 0, 0.85, -0.14));
    for (const x of [-0.19, 0.19]) g.add(box(0.04, 0.04, 0.24, red, x, 0.4, 0));
    return g;
  },
  // 壁に掛ける </> のネオン（暗い部屋でも明るい部屋でも光って見える）
  neon: () => {
    const g = new THREE.Group();
    g.add(box(0.62, 0.36, 0.03, mat(0x15151c), 0, 0, 0));
    const pink = glow(0xff4fd8);
    const blue = glow(0x36e0ff);
    const bar = (len, m, x, y, rz) => {
      const b = box(len, 0.03, 0.02, m, x, y, 0.025);
      b.rotation.z = rz;
      g.add(b);
    };
    bar(0.15, blue, -0.18, 0.05, 0.75);
    bar(0.15, blue, -0.18, -0.05, -0.75);
    bar(0.15, blue, 0.18, 0.05, -0.75);
    bar(0.15, blue, 0.18, -0.05, 0.75);
    bar(0.26, pink, 0, 0, 1.25);
    const light = new THREE.PointLight(0xff6fe0, 0.8, 1.6, 1.5);
    light.position.set(0, 0, 0.3);
    g.add(light);
    return g;
  },
  // ガラスで囲った喫煙所（灰皿のスタンドと、立ちのぼる煙は userData.smoke）
  smoking: () => {
    const g = new THREE.Group();
    const glass = glow(0xbfe6ff, { transparent: true, opacity: 0.22, depthWrite: false });
    const frame = mat(0x8a8f96);
    g.add(box(0.7, 0.01, 0.6, mat(0x5a5f66), 0, 0.005, 0));
    g.add(box(0.7, 0.9, 0.02, glass, 0, 0.45, -0.3), box(0.02, 0.9, 0.6, glass, -0.35, 0.45, 0), box(0.02, 0.9, 0.6, glass, 0.35, 0.45, 0));
    for (const [x, z] of [[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]]) g.add(box(0.03, 0.92, 0.03, frame, x, 0.46, z));
    g.add(box(0.7, 0.03, 0.6, frame, 0, 0.92, 0));
    // 灰皿のスタンド
    g.add(cyl(0.03, 0.03, 0.5, mat(0x2a2a30), 0, 0.25, 0));
    g.add(cyl(0.1, 0.08, 0.04, mat(0x9a9aa6), 0, 0.52, 0));
    g.add(cyl(0.12, 0.12, 0.02, mat(0x2a2a30), 0, 0.01, 0));
    // 壁の札（たばこの絵）
    g.add(box(0.2, 0.12, 0.01, mat(0x2f6ad8), 0, 0.75, -0.285));
    g.add(box(0.12, 0.025, 0.005, glow(0xffffff), -0.01, 0.745, -0.278), box(0.02, 0.025, 0.005, glow(0xff8a2a), 0.06, 0.745, -0.278));
    const smoke = [];
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), glow(0xdddddd, { transparent: true, opacity: 0.5, depthWrite: false }));
      p.userData.phase = k / 4;
      g.add(p);
      smoke.push(p);
    }
    g.userData.smoke = smoke;
    return g;
  },
  // 2人がけのソファとクッション
  sofa: () => {
    const g = new THREE.Group();
    const c = mat(0x3e5f8a);
    g.add(box(0.95, 0.2, 0.42, c, 0, 0.16, 0));
    g.add(box(0.95, 0.34, 0.12, c, 0, 0.36, -0.16));
    for (const x of [-0.45, 0.45]) g.add(box(0.1, 0.28, 0.42, c, x, 0.24, 0));
    g.add(box(0.2, 0.18, 0.06, mat(0xf0b93a), -0.24, 0.36, -0.07));
    g.add(box(0.2, 0.18, 0.06, mat(0xe8e2d4), 0.2, 0.36, -0.07));
    for (const x of [-0.42, 0.42]) for (const z of [-0.17, 0.17]) g.add(box(0.04, 0.06, 0.04, mat(0x2a2a30), x, 0.03, z));
    return g;
  },
  // 台の上の水槽（泳ぐ魚は userData.fish）
  aquarium: () => {
    const g = new THREE.Group();
    g.add(box(0.7, 0.4, 0.3, mat(0x2a2a30), 0, 0.2, 0));
    g.add(box(0.7, 0.42, 0.3, glow(0x3aa8e8, { transparent: true, opacity: 0.45 }), 0, 0.61, 0));
    g.add(box(0.7, 0.03, 0.3, mat(0x2a2a30), 0, 0.835, 0));
    g.add(box(0.68, 0.05, 0.28, mat(0xe8d8a8), 0, 0.425, 0));
    const fish = [];
    for (const [c, y] of [[0xff8a2a, 0.6], [0xffd84a, 0.7], [0xff5a8a, 0.52]]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), glow(c));
      f.scale.set(1.6, 1, 0.6);
      f.position.y = y;
      g.add(f);
      fish.push(f);
    }
    for (let k = 0; k < 3; k++) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), mat(0x3f9a55));
      w.scale.set(0.5, 2.6, 0.5);
      w.position.set(-0.25 + k * 0.08, 0.52, -0.06);
      g.add(w);
    }
    g.userData.fish = fish;
    return g;
  },
  // 光るアーケードのゲーム機
  arcade: () => {
    const g = new THREE.Group();
    const body = mat(0x5a2fa8);
    g.add(box(0.42, 1.0, 0.4, body, 0, 0.5, 0));
    g.add(box(0.36, 0.26, 0.02, glow(0x36e0ff), 0, 0.72, 0.205));
    g.add(box(0.42, 0.08, 0.3, mat(0x2a2a30), 0, 0.5, 0.2));
    g.add(cyl(0.02, 0.02, 0.07, glow(0xff4f6a), -0.08, 0.57, 0.22));
    for (const [x, c] of [[0.05, 0xffd84a], [0.12, 0x3dff7a]]) g.add(cyl(0.022, 0.022, 0.02, glow(c), x, 0.55, 0.22));
    g.add(box(0.42, 0.1, 0.02, glow(0xff4fd8), 0, 0.95, 0.205));
    return g;
  },
  // ガラスのトロフィー棚（金のカップが3つ）
  trophy: () => {
    const g = new THREE.Group();
    g.add(box(0.6, 0.9, 0.26, mat(0x6a4a30), 0, 0.45, 0));
    g.add(box(0.54, 0.84, 0.02, glow(0xbfe6ff, { transparent: true, opacity: 0.25 }), 0, 0.45, 0.13));
    for (const y of [0.3, 0.6]) g.add(box(0.54, 0.02, 0.22, mat(0x8a6a4a), 0, y, 0));
    const gold = mat(0xf0b93a, { emissive: 0x3a2a00 });
    for (const [x, y] of [[-0.15, 0.31], [0.12, 0.31], [0, 0.61]]) {
      g.add(cyl(0.05, 0.02, 0.08, gold, x, y + 0.1, 0));
      g.add(cyl(0.012, 0.012, 0.05, gold, x, y + 0.035, 0));
      g.add(box(0.06, 0.015, 0.06, gold, x, y + 0.015, 0));
    }
    return g;
  },
  // 金の像（台の上で両手を上げる人）
  statue: () => {
    const g = new THREE.Group();
    g.add(box(0.4, 0.3, 0.4, mat(0xe8e4dc), 0, 0.15, 0));
    const gold = mat(0xf0b93a, { emissive: 0x4a3400 });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), gold).translateY(0.85));
    g.add(cyl(0.08, 0.1, 0.3, gold, 0, 0.6, 0));
    for (const x of [-1, 1]) {
      const arm = cyl(0.025, 0.025, 0.24, gold, x * 0.12, 0.8, 0);
      arm.rotation.z = -x * 0.5;
      const leg = cyl(0.03, 0.03, 0.16, gold, x * 0.04, 0.38, 0);
      g.add(arm, leg);
    }
    const light = new THREE.PointLight(0xffd36a, 0.6, 1.2, 1.5);
    light.position.set(0, 0.9, 0.3);
    g.add(light);
    return g;
  },
};

// 置く場所。カメラに近い手前の床に、買った順に真ん中から左右へ並べる（奥は机で埋まり、遠くて見えないため）
// ネオンは左の壁に掛ける
const SLOTS = [-0.2, 0.2, -0.6, 0, 0.85, -0.4, 0.4, -0.8, 0.6, -1]; // 0.6 あたりは外の木に隠れやすいので後回し
// 置いた家具をまとめて作る（office.js が部屋を作るたび・家具が増えたときに呼ぶ）
export function buildFurniture(ids, w, d, home) {
  const g = new THREE.Group();
  let k = 0;
  for (const id of ids) {
    if (!MODELS[id]) continue;
    const m = MODELS[id]();
    if (id === 'neon') {
      m.position.set(-w / 2 + 0.07, 1.15, home ? 0.15 : 0);
      m.rotation.y = Math.PI / 2;
    } else {
      m.position.set((SLOTS[k++ % SLOTS.length] + 0.15) * (w / 2 - 0.45), 0, d / 2 - 0.2); // カメラが右手前にあるので、左の端は少し空ける
      m.rotation.y = 0.15; // カメラのほうを向く
    }
    m.userData.id = id;
    g.add(m);
  }
  return g;
}

// 水槽の魚を泳がせる
export function animateFurniture(g, t) {
  g?.traverse((o) => {
    // 喫煙所の煙：灰皿から上へゆらゆら昇って消える
    o.userData.smoke?.forEach((p) => {
      const k = (t * 0.35 + p.userData.phase) % 1;
      p.position.set(Math.sin(k * 9 + p.userData.phase * 6) * 0.05, 0.56 + k * 0.6, 0);
      p.scale.setScalar(0.6 + k * 1.4);
      p.material.opacity = 0.5 * (1 - k);
    });
    o.userData.fish?.forEach((f, k) => {
      const a = t * (0.6 + k * 0.25) + k * 2;
      f.position.x = Math.sin(a) * 0.25;
      f.position.z = Math.cos(a * 1.3) * 0.06;
      f.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
    });
  });
}

// 家具の小さな絵（模様替えのシートに出す）。初めて開いたときに全部まとめて描いて覚え、描く道具はすぐ片付ける
// （iPhone は同時に使える 3D の数が少ないので、出しっぱなしにしない）
const shots = new Map();
export function furnitureThumb(id) {
  if (!shots.size) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(160, 160);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(2, 4, 3);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    for (const [key, make] of Object.entries(MODELS)) {
      const m = make();
      m.rotation.y = key === 'neon' ? 0 : -0.5; // 壁掛けのネオンは正面から
      scene.add(m);
      const bb = new THREE.Box3().setFromObject(m);
      const c = bb.getCenter(new THREE.Vector3());
      const size = bb.getSize(new THREE.Vector3()).length();
      camera.position.set(c.x + size * 0.5, c.y + size * 0.55, c.z + size * 1.45);
      camera.lookAt(c);
      renderer.render(scene, camera);
      shots.set(key, renderer.domElement.toDataURL('image/png'));
      scene.remove(m);
    }
    renderer.dispose();
    renderer.forceContextLoss();
  }
  return shots.get(id) ?? '';
}
