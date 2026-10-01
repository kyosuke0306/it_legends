// 会社の画面の3D。社員と偉人が事務所にいて、仕事中の人は机に向かい、手が空いている人は歩き回る
// CEO（主人公）は手が空いていると、選んだ過ごし方をする（散歩＝外の道を歩く／ネット＝自分の机でPC／勉強会＝ホワイトボードの前で話す）
// 面接に来た人は、事務所の前の道で待っている
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildChibi, createCharacter, animateCharacter } from './character.js';
import { byId as LEGEND_BY_ID } from './data.js';
import { OFFICES } from './game/rules.js';

const mat = (color, opts) => new THREE.MeshToonMaterial({ color, ...opts });
const SPEED = 0.45;
const GUEST_LOOKS = [
  { skin: 0xf6d7c3, hairColor: 0x2a1d14, shirt: 0x5b8bd0, hairStyle: 'side' },
  { skin: 0xc68e64, hairColor: 0x1d1a1a, shirt: 0xd07a5b, hairStyle: 'long' },
  { skin: 0xfbe3d3, hairColor: 0xc9a050, shirt: 0x6bb08a, glasses: true },
];

export class Office {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // 細かすぎると重いので抑える
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(3, 6, 4);
    this.scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.maxPolarAngle = Math.PI * 0.45;
    this.room = null;
    this.level = -1;
    this.people = new Map(); // member.id → { holder, obj, busy, target, desk }
    this.activity = 'net';
    this.guests = []; // 勉強会に来た人（勉強会のときだけ）
    this.visitor = null; // 面接に来た人 { id, holder }
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // はじめからやり直すとき：人を全部消す
  reset() {
    for (const p of this.people.values()) this.scene.remove(p.holder);
    this.people.clear();
    this.setVisitor(null);
    this.level = -1;
  }

  // ゲームの状態に合わせて、部屋と人をそろえる
  sync(state) {
    if (state.office !== this.level) this.buildRoom(state.office);
    const ids = new Set(state.members.map((m) => m.id));
    for (const [id, p] of this.people) {
      if (!ids.has(id)) {
        this.scene.remove(p.holder);
        this.people.delete(id);
      }
    }
    state.members.forEach((m, i) => {
      let p = this.people.get(m.id);
      if (!p) {
        p = { holder: new THREE.Group(), obj: null, target: null, wait: Math.random() * 2 };
        p.holder.position.copy(this.randomSpot());
        this.scene.add(p.holder);
        this.people.set(m.id, p);
        this.makeBody(m).then((obj) => {
          if (this.people.get(m.id) !== p) return;
          obj.scale.setScalar(0.55);
          p.holder.add(obj);
          p.obj = obj;
        });
      }
      p.busy = Boolean(m.busy);
      p.hero = m.kind === 'hero';
      p.desk = this.desks[i % this.desks.length];
    });
    this.activity = state.activity;
    this.board.visible = state.activity === 'meetup';
    this.setGuests(state.activity === 'meetup' ? 3 : 0);
    this.setVisitor(state.candidates.find((c) => c.walkin) ?? null);
  }

  // 勉強会に来た人（見た目はその場で作るだけで、記録には残さない）
  setGuests(n) {
    while (this.guests.length > n) this.scene.remove(this.guests.pop());
    while (this.guests.length < n) {
      const i = this.guests.length;
      const g = new THREE.Group();
      const look = GUEST_LOOKS[i % GUEST_LOOKS.length];
      const obj = buildChibi({ hairStyle: 'short', ...look });
      obj.scale.setScalar(0.55);
      g.add(obj);
      g.userData.obj = obj;
      g.position.copy(this.spots.guests[i]);
      g.rotation.y = Math.atan2(this.spots.board.x - g.position.x, this.spots.board.z - g.position.z);
      this.scene.add(g);
      this.guests.push(g);
    }
  }

  // 面接に来た人。事務所の前の道で、こちらを向いて待つ
  setVisitor(c) {
    if (this.visitor && this.visitor.id !== c?.id) {
      this.scene.remove(this.visitor.holder);
      this.visitor = null;
    }
    if (!c || this.visitor) return;
    const holder = new THREE.Group();
    holder.position.copy(this.spots.door);
    holder.rotation.y = Math.PI; // 事務所のほうを向く
    this.scene.add(holder);
    this.visitor = { id: c.id, holder };
    const obj = buildChibi({ hairStyle: 'short', ...c.look });
    obj.scale.setScalar(0.55);
    holder.add(obj);
    holder.userData.obj = obj;
  }

  async makeBody(m) {
    if (m.kind === 'legend') return createCharacter(LEGEND_BY_ID[m.legend]);
    return buildChibi({ hairStyle: 'short', ...m.look });
  }

  buildRoom(level) {
    if (this.room) this.scene.remove(this.room);
    this.level = level;
    const o = OFFICES[level];
    const room = new THREE.Group();
    // 部屋の広さは人数に合わせて広げる
    const w = 3 + Math.ceil(Math.sqrt(o.cap)) * 1.3;
    const d = w * 0.75;
    this.size = { w, d };
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), mat(o.floor));
    floor.position.y = -0.05;
    room.add(floor);
    const wallMat = mat(o.wall);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, 0.1), wallMat);
    back.position.set(0, 0.8, -d / 2);
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, d), wallMat);
    side.position.set(-w / 2, 0.8, 0);
    room.add(back, side);
    // 窓
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.4, 0.6), new THREE.MeshBasicMaterial({ color: 0xbfe3ff }));
    win.position.set(w * 0.15, 1.0, -d / 2 + 0.06);
    room.add(win);
    // 机（定員の数だけ、奥に並べる）
    this.desks = [];
    const cols = Math.ceil(Math.sqrt(o.cap * 1.5));
    const rows = Math.ceil(o.cap / cols);
    const deskMat = mat(0xe8d5b5);
    const pcMat = mat(0x2a2a33);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x8fd3ff });
    for (let i = 0; i < o.cap; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = (c - (cols - 1) / 2) * ((w - 1) / cols);
      const z = -d / 2 + 0.7 + r * 1.1;
      const desk = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.4), deskMat);
      top.position.y = 0.4;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.3), deskMat);
      leg.position.y = 0.19;
      const pc = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.03), pcMat);
      pc.position.set(0, 0.55, -0.1);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), screenMat);
      screen.position.set(0, 0.55, -0.084);
      desk.add(top, leg, pc, screen);
      desk.position.set(x, 0, z);
      room.add(desk);
      this.desks.push(new THREE.Vector3(x, 0, z + 0.4));
    }
    // 事務所の前の外（散歩の道・面接に来た人が待つところ）
    const out = 1.5; // 外の奥行き
    const ground = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.08, out), mat(level <= 1 ? 0x9fd08a : 0xc4c4cc));
    ground.position.set(0, -0.06, d / 2 + out / 2);
    const path = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.09, 0.5), mat(level <= 1 ? 0xe6d6b0 : 0x9a9aa6));
    path.position.set(0, -0.05, d / 2 + out * 0.55);
    room.add(ground, path);
    for (const tx of [-w * 0.42, w * 0.3]) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 8), mat(0x8a5a3a));
      trunk.position.y = 0.25;
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), mat(0x5cae5c));
      leaves.position.y = 0.7;
      tree.add(trunk, leaves);
      tree.position.set(tx, 0, d / 2 + out * 0.15);
      room.add(tree);
    }
    const pathZ = d / 2 + out * 0.55;
    // 勉強会のホワイトボード（左の壁ぎわ、手前）
    const board = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.9), mat(0x9aa0aa));
    frame.position.y = 0.75;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.54), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    face.rotation.y = Math.PI / 2;
    face.position.set(0.03, 0.75, 0);
    // ボードに書いた図（四角を線でつないだもの）
    const ink = new THREE.MeshBasicMaterial({ color: 0x3a6fd8 });
    for (const [y, z, bw] of [[0.88, -0.22, 0.2], [0.88, 0.2, 0.2], [0.64, 0, 0.26]]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(bw, 0.1), ink);
      b.rotation.y = Math.PI / 2;
      b.position.set(0.035, y, z);
      board.add(b);
    }
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), mat(0x9aa0aa));
    legL.position.set(0, 0.22, -0.38);
    const legR = legL.clone();
    legR.position.z = 0.38;
    board.add(frame, face, legL, legR);
    const bx = -w / 2 + 0.35;
    const bz = 0;
    board.position.set(bx, 0, bz);
    board.visible = false;
    room.add(board);
    this.board = board;
    this.spots = {
      pathZ,
      // 散歩：画面の外（左右の先）まで道を歩いていく
      farLeft: new THREE.Vector3(-w * 1.1, 0, pathZ),
      farRight: new THREE.Vector3(w * 1.1, 0, pathZ),
      board: new THREE.Vector3(bx + 0.35, 0, bz + 0.15),
      guests: [0, 1, 2].map((k) => new THREE.Vector3(bx + 1.25 + (k % 2) * 0.3, 0, bz - 0.55 + k * 0.55)),
      door: new THREE.Vector3(w * 0.12, 0, pathZ + 0.05),
    };
    this.scene.add(room);
    this.room = room;
    // 外の道まで入るように、少し引いて見下ろす
    this.camera.position.set(w * 0.3, w * 1.0, w * 1.7);
    this.controls.target.set(0, 0.2, out * 0.4);
    this.controls.minDistance = w * 0.6;
    this.controls.maxDistance = w * 3;
    this.controls.update();
  }

  randomSpot() {
    const { w = 4, d = 3 } = this.size ?? {};
    return new THREE.Vector3((Math.random() - 0.5) * (w - 1.2), 0, (Math.random() - 0.1) * (d / 2 - 0.4));
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return false;
    if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    return true;
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    // 画面に出ていないとき（ほかのタブ・裏に回したとき）は描かない（電池と処理を節約）
    if (document.hidden || !this.canvas.offsetParent || !this.resize()) return;
    const t = this.clock.elapsedTime;
    for (const p of this.people.values()) this.step(p, t, dt);
    for (const g of [...this.guests, this.visitor?.holder]) {
      const obj = g?.userData.obj;
      if (!obj) continue;
      animateCharacter(obj, t + g.id, dt);
      obj.position.y *= 0.3; // 立っているだけなので跳ねを小さく
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // 1人ぶんの動き：仕事中は机へ、そうでなければ部屋をぶらぶら
  step(p, t, dt) {
    if (!p.obj) return;
    // CEO は手が空いていると、選んだ過ごし方をする（仕事中は過ごし方はできない）
    const plan = p.hero && !p.busy ? this.activity : null;
    const pos = p.holder.position;
    if (plan === 'walk') {
      // 散歩：事務所を出て道に出て、右の画面の外へ。しばらくして左から戻ってきて、また右へ
      if (p.away > 0) {
        if ((p.away -= dt) > 0) return;
        pos.copy(this.spots.farLeft);
        p.holder.visible = true;
        p.target = this.spots.farRight;
      } else if (!p.target) {
        p.target = pos.z < this.spots.pathZ - 0.1 ? new THREE.Vector3(pos.x, 0, this.spots.pathZ) : this.spots.farRight;
      }
    } else if (!p.holder.visible) {
      // 散歩の途中でほかの過ごし方に変えたら、事務所の前の道から戻ってくる
      p.holder.visible = true;
      p.away = 0;
      pos.copy(this.spots.door);
      p.target = null;
    }
    const atDesk = p.busy || plan === 'net';
    const goal = atDesk ? p.desk : plan === 'meetup' ? this.spots.board : p.target;
    let moving = false;
    if (goal) {
      const dx = goal.x - pos.x;
      const dz = goal.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05) {
        const k = Math.min(1, (SPEED * dt) / dist);
        pos.x += dx * k;
        pos.z += dz * k;
        p.holder.rotation.y = Math.atan2(dx, dz);
        moving = true;
      } else if (atDesk) {
        p.holder.rotation.y = Math.PI; // 机（奥）のほうを向く
      } else if (plan === 'meetup') {
        p.holder.rotation.y = Math.PI / 2; // 勉強会に来た人のほうを向く
      } else if (plan === 'walk') {
        if (goal === this.spots.farRight) {
          p.holder.visible = false; // 画面の外を歩いている
          p.away = 4 + Math.random() * 6;
        }
        p.target = null;
      } else {
        p.target = null;
        p.wait = 1.5 + Math.random() * 4;
      }
    } else if ((p.wait -= dt) <= 0) {
      p.target = plan === 'walk' ? null : this.randomSpot();
    }
    // 骨組み入りのモデルは、歩くときと止まっているときで動きを切り替える
    const mixer = p.obj.userData.mixer;
    if (mixer) {
      const want = moving ? 'walk' : atDesk || plan === 'meetup' ? 'agree' : 'fold_arms';
      if (p.clip !== want) {
        const clip = p.obj.userData.clips.find((c) => c.name === want) ?? p.obj.userData.clips[0];
        mixer.stopAllAction();
        mixer.clipAction(clip).play();
        p.clip = want;
      }
    }
    animateCharacter(p.obj, t + p.holder.id, dt);
    if (!moving && !mixer) p.obj.userData.parts && (p.obj.position.y *= 0.3); // 止まっているときは跳ねを小さく
  }
}
