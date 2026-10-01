import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// GLB は pipeline/optimize.mjs で meshopt 圧縮しているので、その展開器を設定する
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let manifestPromise;

// models/manifest.json に載っている偉人だけ GLB を読みにいく（404を出さないため）
function loadManifest() {
  manifestPromise ??= fetch('models/manifest.json')
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
  return manifestPromise;
}

const mat = (color, opts = {}) => new THREE.MeshToonMaterial({ color, ...opts });

// 頭が大きく体が小さい仮キャラ（全長およそ2）
export function buildChibi(look) {
  const root = new THREE.Group();
  const parts = {};

  const skin = mat(look.skin);
  const shirt = mat(look.shirt);
  const hair = mat(look.hairColor);
  const dark = mat(0x222226);

  // 脚
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(0.12 * side, 0.3, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.16, 4, 12), dark);
    m.position.y = -0.14;
    leg.add(m);
    root.add(leg);
    parts[side < 0 ? 'legL' : 'legR'] = leg;
  }

  // 胴体
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.22, 6, 16), shirt);
  body.position.y = 0.52;
  root.add(body);
  parts.body = body;

  // 腕
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(0.3 * side, 0.66, 0);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 4, 12), shirt);
    sleeve.position.y = -0.12;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), skin);
    hand.position.y = -0.27;
    arm.add(sleeve, hand);
    arm.rotation.z = 0.25 * side;
    root.add(arm);
    parts[side < 0 ? 'armL' : 'armR'] = arm;
  }

  // 頭
  const head = new THREE.Group();
  head.position.y = 1.25;
  root.add(head);
  parts.head = head;
  const R = 0.55;
  head.add(new THREE.Mesh(new THREE.SphereGeometry(R, 40, 32), skin));

  // 目
  const eyes = new THREE.Group();
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), dark);
    eye.scale.set(1, 1.3, 0.6);
    eye.position.set(0.18 * side, -0.05, R - 0.03);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hl.position.set(0.02, 0.03, 0.045);
    eye.add(hl);
    eyes.add(eye);
    const cheek = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 16),
      new THREE.MeshBasicMaterial({ color: 0xff9a9a, transparent: true, opacity: 0.45 }),
    );
    cheek.position.set(0.3 * side, -0.17, R - 0.06);
    cheek.lookAt(cheek.position.clone().multiplyScalar(2));
    head.add(cheek);
  }
  head.add(eyes);
  parts.eyes = eyes;

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 16, Math.PI), mat(0x8a3b3b));
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -0.2, R - 0.04);
  head.add(mouth);

  addHair(head, look.hairStyle, hair, R);

  if (look.beard) {
    const beard = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.02, 32, 16, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.7, Math.PI * 0.2),
      hair,
    );
    head.add(beard);
    mouth.position.z += 0.03;
  }

  if (look.glasses) {
    const frame = mat(0x333333);
    for (const side of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 24), frame);
      ring.position.set(0.18 * side, -0.05, R + 0.01);
      head.add(ring);
    }
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16), frame);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, -0.03, R + 0.02);
    head.add(bridge);
  }

  root.userData.parts = parts;
  root.userData.blinkAt = 1 + Math.random() * 2;
  return root;
}

function addHair(head, style, hair, R) {
  const cap = (tilt, thetaLen = Math.PI * 0.5) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 40, 20, 0, Math.PI * 2, 0, thetaLen), hair);
    m.rotation.x = tilt;
    head.add(m);
    return m;
  };
  switch (style) {
    case 'bald':
      break;
    case 'receding': {
      // 生え際が後退：前を大きく上げ、横と後ろだけ残す
      cap(-0.75, Math.PI * 0.45);
      break;
    }
    case 'side': {
      cap(-0.4);
      const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), hair);
      fringe.scale.set(1.4, 0.5, 0.6);
      fringe.position.set(-0.18, 0.36, 0.38);
      fringe.rotation.z = 0.35;
      head.add(fringe);
      break;
    }
    case 'long': {
      cap(-0.3);
      const back = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.95, 0.35, 8, 24), hair);
      back.scale.z = 0.6;
      back.position.set(0, -0.25, -0.18);
      head.add(back);
      break;
    }
    case 'bun': {
      cap(-0.35);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), hair);
      bun.position.set(0, 0.3, -0.5);
      head.add(bun);
      break;
    }
    default:
      cap(-0.35);
  }
}

// 一度読み込んだ GLB は覚えておき、2回目からは複製して使う（読み直さないので一瞬で出る）
const glbCache = {};
function loadGltf(url) {
  glbCache[url] ??= loader.loadAsync(url).then(prepareGltf);
  glbCache[url].catch(() => delete glbCache[url]); // 失敗したら次回やり直す
  return glbCache[url];
}

// 起動後、ひまなときに 3D モデルを先に読んでおく。ids を渡すとその偉人だけ（仲間にした偉人だけ読み、通信を節約）
export async function preloadCharacters(ids) {
  const manifest = await loadManifest();
  for (const id of manifest) {
    if (ids && !ids.includes(id)) continue;
    await new Promise((r) => (window.requestIdleCallback ?? setTimeout)(r));
    await loadGltf(`models/${id}.glb`).catch(() => {});
  }
}

// 図鑑の一覧用の絵。3D モデルのある偉人は用意した画像（models/<id>.webp）を使う
export async function thumbnailUrl(legend) {
  const manifest = await loadManifest();
  return manifest.includes(legend.id) ? `models/${legend.id}.webp` : null;
}

// GLB（Gemini + Tripo で作ったモデル）を、全長2・足元y=0にそろえる
function prepareGltf(gltf) {
  const model = gltf.scene;
  // Tripo のモデルは +X 向きで出てくるので、カメラ(+Z)側を向かせる
  model.rotation.y = -Math.PI / 2;
  model.updateMatrixWorld(true);
  // 金属・反射の設定があるとテカテカするので、つや消しにして画像の質感に寄せる
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; // 骨で動くモデルが途中で消えないように
    for (const m of [o.material].flat()) {
      m.metalness = 0;
      m.roughness = 1;
      m.metalnessMap = m.roughnessMap = null;
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const s = 2 / Math.max(size.y, 1e-6);
  model.scale.setScalar(s);
  box.setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x, -box.min.y, -c.z);
  return gltf;
}

async function loadGlb(url) {
  const gltf = await loadGltf(url);
  const model = cloneSkinned(gltf.scene); // 形や画像は共有し、骨と位置だけ別にする
  const root = new THREE.Group();
  root.add(model);
  let mixer = null;
  if (gltf.animations.length) {
    mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(gltf.animations[0]).play();
  }
  root.userData.mixer = mixer;
  root.userData.clips = gltf.animations; // show.js が名前で動きを切り替える
  return root;
}

export async function createCharacter(legend) {
  const obj = await loadCharacter(legend);
  obj.userData.show = legend.show; // ステージで歩いたりしゃべったりする設定（show.js）
  return obj;
}

async function loadCharacter(legend) {
  const manifest = await loadManifest();
  if (manifest.includes(legend.id)) {
    try {
      return await loadGlb(`models/${legend.id}.glb`);
    } catch (e) {
      console.warn(`GLBの読み込みに失敗したので仮モデルを使います: ${legend.id}`, e);
    }
  }
  return buildChibi(legend.look);
}

// 毎フレーム呼ぶ。ぴょこぴょこ跳ねる・腕を振る・まばたき
export function animateCharacter(root, t, dt) {
  const bounce = Math.abs(Math.sin(t * 3));
  root.position.y = bounce * 0.08;

  if (root.userData.mixer) {
    root.userData.mixer.update(dt);
    root.rotation.z = Math.sin(t * 1.5) * 0.04;
    return;
  }

  const p = root.userData.parts;
  if (!p) return;
  const squash = 1 - (1 - bounce) * 0.05;
  p.body.scale.set(2 - squash, squash, 2 - squash);
  p.head.rotation.z = Math.sin(t * 1.5) * 0.08;
  p.head.rotation.x = Math.sin(t * 3) * 0.03;
  p.armL.rotation.x = Math.sin(t * 3) * 0.5;
  p.armR.rotation.x = -Math.sin(t * 3) * 0.5;
  p.legL.rotation.x = -Math.sin(t * 3) * 0.3;
  p.legR.rotation.x = Math.sin(t * 3) * 0.3;

  // まばたき
  const u = root.userData;
  if (t > u.blinkAt) {
    const k = (t - u.blinkAt) / 0.15;
    p.eyes.scale.y = k < 1 ? Math.abs(1 - 2 * k) + 0.05 : 1;
    if (k >= 1) u.blinkAt = t + 2 + Math.random() * 3;
  }
}
