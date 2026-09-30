import * as THREE from 'three';

// 偉人ごとの「ショー」: ステージを歩き回り、立ち止まって吹き出しでしゃべり、小物を出す。
// 設定は data.js の show: { lines: [{ text, sub?, prop?, anim? }], props?: [...] }
//   lines[i].prop … そのセリフで登場する小物   props … 最初から置いておく小物
//   lines[i].anim … 話すときの動き（骨組み入りモデルの動きの名前。歩くときは 'walk'）
const WALK_SPEED = 0.55; // 1秒あたりの移動量
const SAY_TIME = 3.4; // 1セリフを表示する秒数
const SPOTS = [0.55, -0.55, 0]; // 立ち止まって話す位置（x）

export class Show {
  constructor(stage, obj, config) {
    this.stage = stage;
    this.obj = obj;
    this.lines = config.lines ?? [];
    this.props = {};
    for (const name of new Set([...(config.props ?? []), ...this.lines.map((l) => l.prop).filter(Boolean)])) {
      const prop = PROPS[name]?.();
      if (!prop) continue;
      prop.userData.always = config.props?.includes(name);
      prop.scale.setScalar(prop.userData.always ? 1 : 0);
      stage.scene.add(prop);
      this.props[name] = prop;
    }
    this.bubble = document.createElement('div');
    this.bubble.className = 'bubble hidden';
    stage.canvas.parentElement.append(this.bubble);
    // 歩き回るぶんと吹き出しのぶん、カメラを少し引く
    this.camHome = stage.camera.position.clone();
    stage.camera.position.set(0, 1.45, 6.2);
    if (stage.controls) stage.controls.update();
    else stage.camera.lookAt(0, 1, 0);
    // 骨組み入りモデルなら、モデルの動き（歩く・腕組みなど）を切り替えて使う
    this.mixer = obj.userData.mixer;
    this.clips = obj.userData.clips ?? [];
    this.mixer?.stopAllAction();
    this.beat = -1;
    this.nextBeat(stage.clock.elapsedTime);
  }

  dispose() {
    for (const p of Object.values(this.props)) this.stage.scene.remove(p);
    this.bubble.remove();
    this.stage.camera.position.copy(this.camHome);
    if (this.stage.controls) this.stage.controls.update();
    else this.stage.camera.lookAt(0, 1, 0);
  }

  // 歩く → 話す を1拍として、セリフの数だけ繰り返す
  nextBeat(t) {
    this.beat = (this.beat + 1) % Math.max(this.lines.length, 1);
    if (this.beat === 0) {
      for (const p of Object.values(this.props)) if (!p.userData.always) p.userData.shown = false;
    }
    const from = this.obj.position.x;
    const to = SPOTS[this.beat % SPOTS.length];
    this.walk = { from, to, start: t, end: t + Math.abs(to - from) / WALK_SPEED };
    this.sayEnd = this.walk.end + SAY_TIME;
    this.bubble.classList.add('hidden');
    this.play('walk');
  }

  // モデルの動きをなめらかに切り替える（その動きが無ければ何もしない）
  play(name, from = 0) {
    const clip = this.mixer && this.clips.find((c) => c.name === name);
    if (!clip) return;
    const next = this.mixer.clipAction(clip);
    if (next === this.action) return;
    next.reset();
    next.time = from;
    next.fadeIn(0.3).play();
    this.action?.fadeOut(0.3);
    this.action = next;
  }

  update(t, dt) {
    const o = this.obj;
    const w = this.walk;
    const cam = this.stage.camera.position;
    let face;
    if (t < w.end) {
      // 歩く：進む向きを向いて、ひょこひょこ揺れる
      const u = (t - w.start) / (w.end - w.start);
      o.position.x = w.from + (w.to - w.from) * u;
      const rigged = this.action?.getClip().name === 'walk';
      o.position.y = rigged ? 0 : Math.abs(Math.sin(t * 9)) * 0.06;
      o.rotation.z = rigged ? 0 : Math.sin(t * 9) * 0.05;
      face = Math.sign(w.to - w.from) * (Math.PI / 2);
    } else if (t < this.sayEnd) {
      // 話す：カメラの方を向き、うなずくように軽く跳ねる
      const k = t - w.end;
      const line = this.lines[this.beat];
      if (line && this.bubble.classList.contains('hidden')) {
        this.bubble.innerHTML = `${line.text}${line.sub ? `<small>${line.sub}</small>` : ''}`;
        this.bubble.classList.remove('hidden');
        if (line.anim) this.play(line.anim, line.animFrom);
        if (line.prop && this.props[line.prop]) {
          this.props[line.prop].userData.shown = true;
          this.props[line.prop].userData.popAt = t;
        }
      }
      o.position.y = this.action ? 0 : k < 0.35 ? Math.sin((k / 0.35) * Math.PI) * 0.12 : Math.abs(Math.sin(k * 2.2)) * 0.02;
      o.rotation.z *= 0.85;
      face = Math.atan2(cam.x - o.position.x, cam.z - o.position.z);
    } else {
      this.nextBeat(t);
      return;
    }
    o.rotation.y += angleDiff(face, o.rotation.y) * Math.min(dt * 8, 1);
    this.mixer?.update(dt);

    this.updateProps(t);
    this.placeBubble();
  }

  updateProps(t) {
    const o = this.obj;
    for (const p of Object.values(this.props)) {
      const shown = p.userData.always || p.userData.shown;
      let s = shown ? 1 : 0;
      if (shown && p.userData.popAt != null) {
        const u = Math.min((t - p.userData.popAt) / 0.5, 1);
        s = easeOutBack(u);
      }
      p.scale.setScalar(Math.max(s, 0));
      p.userData.animate?.(p, t, o);
    }
  }

  // 頭の上に吹き出しを置く（画面からはみ出さないように）
  placeBubble() {
    if (this.bubble.classList.contains('hidden')) return;
    const head = new THREE.Vector3(this.obj.position.x, 2.15, this.obj.position.z).project(this.stage.camera);
    const wrap = this.bubble.parentElement;
    const half = this.bubble.offsetWidth / 2 + 8;
    const x = Math.min(Math.max(((head.x + 1) / 2) * wrap.clientWidth, half), wrap.clientWidth - half);
    const y = Math.max(((1 - head.y) / 2) * wrap.clientHeight, this.bubble.offsetHeight + 8);
    this.bubble.style.left = `${x}px`;
    this.bubble.style.top = `${y}px`;
  }
}

function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function easeOutBack(u) {
  const c = 1.7;
  return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2;
}

// ---------- 小物 ----------
const PROPS = {
  // リンゴ（果物）：キャラの横でふわふわ浮く
  apple() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 32, 24),
      new THREE.MeshStandardMaterial({ color: 0xd8262e, roughness: 0.6 }),
    );
    body.scale.set(1, 0.92, 1);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.016, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4423 }),
    );
    stem.position.y = 0.17;
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 8),
      new THREE.MeshStandardMaterial({ color: 0x4caf50 }),
    );
    leaf.scale.set(1, 0.25, 0.5);
    leaf.position.set(0.06, 0.2, 0);
    leaf.rotation.z = -0.5;
    g.add(body, stem, leaf);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x - 1.0, 0.5 + Math.sin(t * 2) * 0.06, 0.2);
      p.rotation.y = t * 0.8;
    };
    return g;
  },

  // スマートフォン：セリフと一緒にポンと出てきて、キャラの横でくるくる回る
  phone() {
    const g = new THREE.Group();
    const w = 0.34;
    const h = 0.66;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.4 }),
    );
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.03, h - 0.05), new THREE.MeshBasicMaterial({ map: phoneScreen() }));
    screen.position.z = 0.021;
    g.add(body, screen);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.95, 1.1 + Math.sin(t * 2.4) * 0.05, 0.3);
      p.rotation.y = Math.sin(t * 1.2) * 0.5;
    };
    return g;
  },
};

// スマホの画面：グラデーションの壁紙にアイコンが並ぶ絵
function phoneScreen() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const x = c.getContext('2d');
  const grad = x.createLinearGradient(0, 0, 128, 256);
  grad.addColorStop(0, '#5b8cff');
  grad.addColorStop(1, '#b36bff');
  x.fillStyle = grad;
  x.fillRect(0, 0, 128, 256);
  const colors = ['#ff5f57', '#ffbd2e', '#28c840', '#34aadc', '#ff9500', '#5856d6', '#ff2d55', '#4cd964'];
  for (let i = 0; i < 16; i++) {
    x.fillStyle = colors[i % colors.length];
    x.beginPath();
    x.roundRect(12 + (i % 4) * 28, 24 + Math.floor(i / 4) * 34, 20, 20, 5);
    x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
