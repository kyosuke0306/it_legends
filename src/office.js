// 会社の画面の3D。社員と偉人が事務所にいて、仕事中の人は机に向かい、手が空いている人は歩き回る
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildChibi, createCharacter, animateCharacter } from './character.js';
import { byId as LEGEND_BY_ID } from './data.js';
import { OFFICES } from './game/rules.js';

const mat = (color, opts) => new THREE.MeshToonMaterial({ color, ...opts });
const SPEED = 0.45;

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
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
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
      p.desk = this.desks[i % this.desks.length];
    });
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
    this.scene.add(room);
    this.room = room;
    this.camera.position.set(w * 0.35, w * 0.55, w * 1.05);
    this.controls.target.set(0, 0.3, 0);
    this.controls.minDistance = w * 0.6;
    this.controls.maxDistance = w * 2;
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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // 1人ぶんの動き：仕事中は机へ、そうでなければ部屋をぶらぶら
  step(p, t, dt) {
    if (!p.obj) return;
    const goal = p.busy ? p.desk : p.target;
    const pos = p.holder.position;
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
      } else if (p.busy) {
        p.holder.rotation.y = Math.PI; // 机（奥）のほうを向く
      } else {
        p.target = null;
        p.wait = 1.5 + Math.random() * 4;
      }
    } else if ((p.wait -= dt) <= 0) {
      p.target = this.randomSpot();
    }
    // 骨組み入りのモデルは、歩くときと止まっているときで動きを切り替える
    const mixer = p.obj.userData.mixer;
    if (mixer) {
      const want = moving ? 'walk' : p.busy ? 'agree' : 'fold_arms';
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
