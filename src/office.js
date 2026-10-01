// 会社の画面の3D。社員と偉人が事務所にいて、仕事中の人は机に向かい、手が空いている人は歩き回る
// CEO（主人公）は手が空いていると、選んだ過ごし方をする（散歩＝外の道を歩く／ネット＝自分の机でPC／勉強会＝ホワイトボードの前で話す）
// 面接に来た人は、事務所の前の道で待っている
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildChibi, createCharacter, animateCharacter } from './character.js';
import { byId as LEGEND_BY_ID } from './data.js';
import { OFFICES, JOBS } from './game/rules.js';
import { displayName, workOf, capacity } from './game/state.js';
import { dress } from './outfits.js';

const mat = (color, opts) => new THREE.MeshToonMaterial({ color, ...opts });
const SPEED = 0.45;
// タップしたときに出す名前と職種
function labelOf(m) {
  if (m.kind === 'legend') return { name: m.name, sub: LEGEND_BY_ID[m.legend].title };
  if (m.kind === 'temp') return { name: m.name, sub: `${JOBS[m.job].full}・派遣` };
  if (m.kind === 'rival') return { name: m.name, sub: '冷やかし' };
  return { name: displayName(m), sub: JOBS[m.job].full };
}
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
    // 人をタップすると名前と職種を出す（ドラッグで向きを変えたときは出さない）
    this.tag = document.createElement('div');
    this.tag.className = 'person-tag';
    canvas.parentElement.append(this.tag);
    this.tagged = null;
    let down = null;
    canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
    canvas.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 8) this.pick(e);
      down = null;
    });
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
    // 引っ越し・増築をしたら部屋を作り直す
    const key = `${state.office}:${state.floors ?? 0}`;
    if (key !== this.level) {
      this.buildRoom(state.office, capacity(state));
      this.level = key;
    }
    // 派遣の人は仕事の間だけ事務所にいる（席が足りないときは机の横に立つ）
    const people = [...state.members, ...state.tasks.flatMap((x) => x.temps ?? [])];
    // 冷やかしに来たレジェンド（まだ仲間でない）。しばらく事務所をうろうろして帰る
    if (state.rival && state.rival.until > Date.now()) people.push({ id: `rival-${state.rival.id}`, kind: 'rival', legend: state.rival.id, name: LEGEND_BY_ID[state.rival.id].name, busy: null });
    const ids = new Set(people.map((m) => m.id));
    for (const [id, p] of this.people) {
      if (!ids.has(id)) {
        this.scene.remove(p.holder);
        this.people.delete(id);
      }
    }
    people.forEach((m, i) => {
      let p = this.people.get(m.id);
      if (!p) {
        p = { holder: new THREE.Group(), obj: null, target: null, wait: Math.random() * 2 };
        p.holder.position.copy(m.kind === 'temp' || m.kind === 'rival' ? this.spots.door : this.randomSpot());
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
      p.label = { ...labelOf(m), work: workOf(state, m)?.title ?? '' }; // 仕事中なら仕事の名前も出す
      const desk = this.desks[i % this.desks.length];
      p.desk = i < this.desks.length ? desk : desk.clone().add(new THREE.Vector3(0.32 * Math.ceil(i / this.desks.length), 0, 0.15));
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
    this.visitor = { id: c.id, holder, label: { name: c.name, sub: `${JOBS[c.job].full}・面接` } };
    holder.userData.label = this.visitor.label;
    const obj = dress(buildChibi({ hairStyle: 'short', ...c.look, glasses: c.look.glasses || ['data', 'consul'].includes(c.job) }), c.job);
    obj.scale.setScalar(0.55);
    holder.add(obj);
    holder.userData.obj = obj;
  }

  async makeBody(m) {
    if (m.kind === 'legend' || m.kind === 'rival') return createCharacter(LEGEND_BY_ID[m.legend]);
    // 職種ごとの小物を付ける（データ分析とコンサルはメガネ）。CEO は金のネクタイと頭の上の印
    return dress(buildChibi({ hairStyle: 'short', ...m.look, glasses: m.look.glasses || ['data', 'consul'].includes(m.job) }), m.job, { ceo: m.kind === 'hero' });
  }

  buildRoom(level, cap = OFFICES[level].cap) {
    if (this.room) this.scene.remove(this.room);
    const o = OFFICES[level];
    cap = Math.min(cap, 64); // 増築を重ねても、机を並べるのはここまで（重く・広くなりすぎないように。あふれた人は机の横）
    const room = new THREE.Group();
    // 部屋の広さは人数に合わせて広げる
    // 最初の自宅の部屋だけは、狭くて散らかった部屋にする
    const home = level === 0;
    const w = home ? 3.6 : 3 + Math.ceil(Math.sqrt(cap)) * 1.3;
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
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w * (o.winW ?? 0.4), 0.6), new THREE.MeshBasicMaterial({ color: o.win ?? 0xbfe3ff }));
    win.position.set(Math.min(w * 0.15, w * (0.48 - (o.winW ?? 0.4) / 2)), 1.0, -d / 2 + 0.06); // 広い窓は壁からはみ出さないように
    room.add(win);
    if (home) {
      win.scale.set(0.6, 0.8, 1);
      win.material.color.set(0x9fb4c2); // くもった窓
      room.add(messyRoom(w, d));
    }
    room.add(grandRoom(level, w, d, win.position));
    // 机（定員の数だけ、奥に並べる）
    this.desks = [];
    const cols = Math.ceil(Math.sqrt(cap * 1.5));
    const deskMat = mat(home ? 0x7a6450 : 0xe8d5b5); // 自宅は古い木の机
    const pcMat = mat(0x2a2a33);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x8fd3ff });
    for (let i = 0; i < cap; i++) {
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
    const ground = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.08, out), mat(o.ground ?? (level <= 1 ? 0x9fd08a : 0xc4c4cc)));
    ground.position.set(0, -0.06, d / 2 + out / 2);
    const path = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.09, 0.5), mat(o.path ?? (level <= 1 ? 0xe6d6b0 : 0x9a9aa6)));
    path.position.set(0, -0.05, d / 2 + out * 0.55);
    room.add(ground, path);
    for (const tx of o.trees === false ? [] : home ? [-w / 2 - 0.45, w / 2 + 0.35] : [-w * 0.42, w * 0.3]) { // 自宅は散らかった物が木で隠れないよう外側に
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
    const bz = home ? 0.25 : 0; // 自宅は布団をよけて手前に
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
    // 自宅は狭いので、部屋全体が入るようにカメラは広さのわりに引いておく
    this.view = { cw: Math.max(w, 4.6), z: out * 0.4, fit: level >= 5 };
    this.frame();
  }

  // カメラを置く。高層タワーより先の広い部屋は、縦長の画面でも横幅が入るように引く
  frame() {
    const { cw, z, fit } = this.view;
    let k = 1;
    if (fit) {
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect);
      const seen = 2 * cw * 2 * Math.tan(half); // 今の距離で見える横幅
      k = Math.max(1, Math.min(1.8, (1.05 * this.size.w) / seen));
    }
    this.camera.position.set(cw * 0.3 * k, cw * 1.0 * k, cw * 1.7 * k);
    this.controls.target.set(0, 0.2, z);
    this.controls.minDistance = cw * 0.6;
    this.controls.maxDistance = cw * 3 * k;
    this.controls.update();
  }

  randomSpot() {
    const { w = 4, d = 3 } = this.size ?? {};
    return new THREE.Vector3((Math.random() - 0.5) * (w - 1.2), 0, (Math.random() - 0.1) * (d / 2 - 0.4));
  }

  // タップした人を探して、名前と職種を3秒出す
  pick(e) {
    const r = this.canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const targets = [...this.people.values()].filter((p) => p.holder.visible).map((p) => [p.holder, p.label]);
    if (this.visitor) targets.push([this.visitor.holder, this.visitor.label]);
    let best = null;
    for (const [holder, label] of targets) {
      const hit = ray.intersectObject(holder, true)[0];
      if (hit && (!best || hit.distance < best.d)) best = { holder, label, d: hit.distance };
    }
    clearTimeout(this.tagTimer);
    this.tagged = best;
    if (!best) return this.tag.classList.remove('show');
    this.tag.innerHTML = `<b></b><small></small>${best.label.work ? '<span class="work"></span>' : ''}`;
    this.tag.querySelector('b').textContent = best.label.name;
    this.tag.querySelector('small').textContent = best.label.sub;
    if (best.label.work) this.tag.querySelector('.work').textContent = best.label.work;
    this.tag.classList.add('show');
    this.tagTimer = setTimeout(() => {
      this.tagged = null;
      this.tag.classList.remove('show');
    }, 3000);
  }

  // 名前の札を、その人の頭の上に合わせる
  placeTag() {
    if (!this.tagged) return;
    const v = new THREE.Vector3();
    this.tagged.holder.getWorldPosition(v);
    v.y += 1.35;
    v.project(this.camera);
    // 札が画面の端からはみ出さないように寄せる（矢印は人のほうを指したまま）
    const W = this.canvas.clientWidth;
    const x = ((v.x + 1) / 2) * W;
    const half = this.tag.offsetWidth / 2;
    const cx = Math.min(Math.max(x, half + 4), Math.max(half + 4, W - half - 4));
    this.tag.style.left = `${cx}px`;
    this.tag.style.setProperty('--ax', `${Math.max(-half + 12, Math.min(half - 12, x - cx))}px`);
    this.tag.style.top = `${((1 - v.y) / 2) * this.canvas.clientHeight}px`;
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return false;
    if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      if (this.view?.fit) this.frame();
    }
    return true;
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    // 画面に出ていないとき（ほかのタブ・裏に回したとき）は描かない（電池と処理を節約）
    if (document.hidden || !this.canvas.offsetParent || !this.resize()) return;
    const t = this.clock.elapsedTime;
    for (const p of this.people.values()) {
      this.step(p, t, dt);
      const mark = p.obj?.userData.ceoMark;
      if (mark) {
        mark.rotation.y = t * 1.5;
        mark.position.y = 2.25 + Math.sin(t * 2) * 0.06;
      }
    }
    this.placeTag();
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

// 自宅の部屋の散らかりよう：しみ、はがれた壁紙、敷きっぱなしの布団、脱いだ服の山、段ボール、ピザの箱、カップ麺、ゴミ袋、裸電球
// 本社ビルより先の会社の飾り（2026-10-01 追加）。win は窓の位置
//   5 高層タワー＝窓の外のビル街 / 6 テックキャンパス＝鉢植えの木 / 7 世界本社＝光る地球儀
//   8 スマートシティ＝床のふちの光る線・夜の街 / 9 宇宙ステーション＝窓の外の星と地球
function grandRoom(level, w, d, win) {
  const g = new THREE.Group();
  const o = OFFICES[level];
  const ww = w * (o.winW ?? 0.4);
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c });
  // 窓の外のビルの影（タワー・スマートシティ）
  if (level === 5 || level === 8) {
    const c = level === 5 ? 0x7da6cf : 0x14203f;
    for (let i = 0; i < 14; i++) {
      const bw = ww / 14;
      const h = 0.12 + ((i * 37) % 11) / 30;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.85, h), glow(c));
      b.position.set(win.x - ww / 2 + bw * (i + 0.5), win.y - 0.3 + h / 2, win.z + 0.005);
      g.add(b);
      if (level === 8 && i % 2 === 0) {
        const lit = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.2, 0.03), glow(0xffe08a));
        lit.position.set(b.position.x, b.position.y + h * 0.2, win.z + 0.01);
        g.add(lit);
      }
    }
  }
  if (level === 6) {
    // 壁ぎわの鉢植えの木
    for (const x of [-w / 2 + 0.35, w / 2 - 0.35]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 12), mat(0xe8e2d4));
      pot.position.set(x, 0.11, -d / 2 + 0.3);
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), mat(0x5cae5c));
      leaves.position.set(x, 0.5, -d / 2 + 0.3);
      g.add(pot, leaves);
    }
  }
  if (level === 7) {
    // 奥の壁の前に光る地球儀
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 16), mat(0xd9b65a));
    stand.position.set(-w / 2 + 0.6, 0.25, -d / 2 + 0.4);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), glow(0x5ab0ff));
    globe.position.set(-w / 2 + 0.6, 0.72, -d / 2 + 0.4);
    g.add(stand, globe);
  }
  if (level === 8) {
    // 床のふちの光る線
    const line = glow(0x5ad0e0);
    const a = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, 0.04), line);
    a.position.set(0, 0.01, -d / 2 + 0.07);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, d), line);
    b.position.set(-w / 2 + 0.07, 0.01, 0);
    g.add(a, b);
  }
  if (level === 9) {
    // 窓の外の星と、青い地球
    for (let i = 0; i < 40; i++) {
      const star = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.025), glow(0xffffff));
      star.position.set(win.x + (((i * 53) % 100) / 100 - 0.5) * ww * 0.96, win.y + (((i * 29) % 100) / 100 - 0.5) * 0.55, win.z + 0.005);
      g.add(star);
    }
    const earth = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32, 0, Math.PI), glow(0x3a7fd8));
    earth.position.set(win.x + ww * 0.25, win.y - 0.3, win.z + 0.01);
    const land = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16, 0, Math.PI), glow(0x5cae5c));
    land.position.set(win.x + ww * 0.2, win.y - 0.3, win.z + 0.015);
    g.add(earth, land);
  }
  return g;
}

function messyRoom(w, d) {
  const g = new THREE.Group();
  const flat = (geo, color, x, z, ry = 0) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }));
    m.rotation.set(-Math.PI / 2, 0, ry);
    m.position.set(x, 0.006, z);
    return m;
  };
  // 床のしみ
  for (const [x, z, r] of [[-0.6, 0.3, 0.22], [0.9, 0.6, 0.16], [0.2, -0.2, 0.12], [-1.2, 0.9, 0.18]]) g.add(flat(new THREE.CircleGeometry(r, 16), 0x5a4630, x * (w / 3.6), z));
  // 壁のしみとはがれた壁紙
  const wallAt = (geo, color, x, y) => {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x, y, -d / 2 + 0.056);
    return m;
  };
  g.add(wallAt(new THREE.CircleGeometry(0.18, 14), 0xb3a27e, -w * 0.3, 1.2), wallAt(new THREE.PlaneGeometry(0.22, 0.3), 0xc7b998, w * 0.38, 0.55));
  const peel = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.26), mat(0xeae0c8, { side: THREE.DoubleSide }));
  peel.position.set(w * 0.38 + 0.06, 0.62, -d / 2 + 0.12);
  peel.rotation.set(0, -0.6, 0.15);
  g.add(peel);
  // 敷きっぱなしの布団（左奥）と、くしゃくしゃの掛け布団
  const futon = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.08, 1.0), mat(0xd8d2c4));
  futon.position.set(-w / 2 + 0.48, 0.04, -d / 2 + 0.6);
  const blanket = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mat(0x6f8fb5));
  blanket.scale.set(1.1, 0.35, 1.3);
  blanket.position.set(-w / 2 + 0.5, 0.12, -d / 2 + 0.8);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.22), mat(0xf0ead8));
  pillow.position.set(-w / 2 + 0.48, 0.11, -d / 2 + 0.25);
  pillow.rotation.y = 0.25;
  g.add(futon, blanket, pillow);
  // 脱いだ服の山
  for (const [c, dx, dz, s] of [[0x3d4f6b, 0, 0, 1], [0xa33b3b, 0.1, 0.06, 0.8], [0x55605a, -0.08, 0.08, 0.7], [0xe2dccb, 0.02, -0.05, 0.6]]) {
    const cloth = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 8, 6), mat(c));
    cloth.scale.set(1.3, 0.45, 1);
    cloth.position.set(w / 2 - 0.55 + dx, 0.05 + s * 0.03, d / 2 - 0.5 + dz);
    g.add(cloth);
  }
  // 段ボール箱（右奥に積んである）
  const card = mat(0xb88a52);
  for (const [x, y, z, s, ry] of [[w / 2 - 0.35, 0.17, -d / 2 + 0.35, 0.34, 0.1], [w / 2 - 0.4, 0.45, -d / 2 + 0.38, 0.26, -0.3], [w / 2 - 0.75, 0.13, -d / 2 + 0.3, 0.26, 0.4]]) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), card);
    box.position.set(x, y, z);
    box.rotation.y = ry;
    const tape = new THREE.Mesh(new THREE.BoxGeometry(s * 1.01, 0.012, 0.06), mat(0xd8c49a));
    tape.position.set(x, y + s / 2, z);
    tape.rotation.y = ry;
    g.add(box, tape);
  }
  // 床に置いたピザの箱とカップ麺
  const pizza = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.34), mat(0xe9e1cf));
  pizza.position.set(0.15, 0.02, d / 2 - 0.45);
  pizza.rotation.y = 0.5;
  const lid = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), mat(0xc23b2b));
  lid.rotation.set(-Math.PI / 2, 0, 0);
  lid.position.set(0.15, 0.04, d / 2 - 0.45);
  g.add(pizza, lid);
  for (const [x, z, tip] of [[-0.3, d / 2 - 0.35, 0], [-0.15, d / 2 - 0.25, 1.4], [w / 2 - 0.9, 0.1, 0]]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.1, 12), mat(0xf4f0e6));
    cup.position.set(x, tip ? 0.05 : 0.05, z);
    cup.rotation.z = tip;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.061, 0.055, 0.03, 12), mat(0xd23b3b));
    band.position.copy(cup.position);
    band.rotation.z = tip;
    g.add(cup, band);
  }
  // ゴミ袋（左手前）
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0x2b2f33));
  bag.scale.set(1, 1.2, 1);
  bag.position.set(-w / 2 + 0.3, 0.2, d / 2 - 0.35);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 8), mat(0x2b2f33));
  knot.position.set(-w / 2 + 0.3, 0.46, d / 2 - 0.35);
  g.add(bag, knot);
  // 床をはう配線
  const cable = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.012, 6, 24, Math.PI * 1.3), mat(0x222222));
  cable.rotation.x = -Math.PI / 2;
  cable.position.set(0.5, 0.012, -0.1);
  g.add(cable);
  // 天井からぶら下がる裸電球
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6), mat(0x222222));
  cord.position.set(0, 1.85, -0.2);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe7a3 }));
  bulb.position.set(0, 1.56, -0.2);
  g.add(cord, bulb);
  return g;
}
