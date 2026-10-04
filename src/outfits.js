// 社員の見た目を職種ごとに変える小物（職種の絵 assets/jobs/ に合わせる）。CEO には金のネクタイと頭の上の印
// buildChibi で作った体（頭は y=1.25・半径0.55、胴体は y=0.52・半径0.24）に付け足す
import * as THREE from 'three';
import { buildChibi } from './character.js';

const mat = (color) => new THREE.MeshToonMaterial({ color });
const mesh = (geo, color, [x, y, z] = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  return m;
};

// 胸のネクタイ
function tie(root, color) {
  const knot = mesh(new THREE.BoxGeometry(0.09, 0.07, 0.05), color, [0, 0.74, 0.22]);
  const blade = mesh(new THREE.ConeGeometry(0.075, 0.32, 4), color, [0, 0.56, 0.235]);
  blade.rotation.set(Math.PI, Math.PI / 4, 0);
  blade.scale.z = 0.4;
  const collarL = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.03), 0xffffff, [-0.07, 0.77, 0.2]);
  const collarR = collarL.clone();
  collarL.rotation.z = -0.5;
  collarR.rotation.z = 0.5;
  collarR.position.x = 0.07;
  root.add(knot, blade, collarL, collarR);
}

// 手に持つもの（左手）
function inHand(parts, obj) {
  obj.position.y -= 0.3;
  parts.armL.add(obj);
}

const DRESS = {
  // ヘッドホン
  pg(root, parts) {
    const band = mesh(new THREE.TorusGeometry(0.6, 0.035, 8, 32, Math.PI), 0x2a2a33);
    for (const side of [-1, 1]) {
      const cup = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 20), 0x2a2a33, [0.6 * side, 0, 0]);
      cup.rotation.z = Math.PI / 2;
      band.add(cup);
    }
    band.position.y = 0.02;
    parts.head.add(band);
  },
  // ベレー帽
  designer(root, parts) {
    const beret = mesh(new THREE.SphereGeometry(0.5, 24, 12), 0xb33a4a, [0.08, 0.5, -0.02]);
    beret.scale.set(1.15, 0.35, 1.15);
    beret.rotation.z = -0.25;
    parts.head.add(beret, mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08), 0xb33a4a, [0.12, 0.69, -0.02]));
  },
  // ヘルメット（データセンターの作業）
  infra(root, parts) {
    const hat = mesh(new THREE.SphereGeometry(0.6, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), 0xf2c230, [0, 0.12, 0]);
    const brim = mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.04, 28), 0xf2c230, [0, 0.12, 0.04]);
    parts.head.add(hat, brim);
  },
  // 白衣
  data(root, parts) {
    parts.body.material = mat(0xf4f4f8);
    for (const a of [parts.armL, parts.armR]) a.children[0].material = parts.body.material;
    root.add(mesh(new THREE.BoxGeometry(0.1, 0.34, 0.02), 0x7a5cc4, [0, 0.55, 0.235]));
  },
  // クリップボード
  pm(root, parts) {
    const board = mesh(new THREE.BoxGeometry(0.28, 0.36, 0.03), 0x9a6a3a, [0.02, 0, 0.1]);
    board.add(mesh(new THREE.BoxGeometry(0.23, 0.28, 0.01), 0xffffff, [0, -0.02, 0.02]));
    inHand(parts, board);
  },
  // 社員証
  se(root) {
    const strap = mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 24, Math.PI), 0x2d6ea8, [0, 0.78, 0.12]);
    strap.rotation.set(Math.PI / 2 + 0.6, 0, Math.PI);
    root.add(strap, mesh(new THREE.BoxGeometry(0.13, 0.16, 0.02), 0xffffff, [0, 0.6, 0.245]));
  },
  gm(root) {
    tie(root, 0x2d6ea8);
  },
  consul(root) {
    tie(root, 0x8a2b3a);
  },
  // ネクタイとかばん
  sales(root, parts) {
    tie(root, 0xd04a3a);
    const bag = mesh(new THREE.BoxGeometry(0.28, 0.2, 0.08), 0x4a3424, [0, -0.08, 0]);
    bag.add(mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), 0x2a2a2a, [0, 0.1, 0]));
    inHand(parts, bag);
  },
};

export function dress(root, job, { ceo = false } = {}) {
  const parts = root.userData.parts;
  DRESS[job]?.(root, parts);
  if (ceo) {
    if (!['gm', 'consul', 'sales'].includes(job)) tie(root, 0xe9b43a);
    // 頭の上でゆっくり回る金の印（CEO だとひと目でわかるように）
    const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), new THREE.MeshToonMaterial({ color: 0xffc83d, emissive: 0x6a4a00 }));
    mark.position.y = 2.25;
    mark.scale.y = 1.4;
    root.add(mark);
    root.userData.ceoMark = mark;
  }
  return root;
}

// 社員・CEO・面接に来た人・派遣の人の体（職種の小物つき。データ分析とコンサルはメガネ）
// look.headphones: CEO の顔を選ぶときのヘッドホン（プログラマーはもともと付けている）
export function buildPerson(look, job, { ceo = false } = {}) {
  const root = dress(buildChibi({ hairStyle: 'short', ...look, glasses: look.glasses || ['data', 'consul'].includes(job) }), job, { ceo });
  if (look.headphones && job !== 'pg') DRESS.pg(root, root.userData.parts);
  return root;
}
