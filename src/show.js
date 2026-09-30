import * as THREE from 'three';

// 偉人ごとの「ショー」: ステージを歩き回り、立ち止まって吹き出しでしゃべり、小物を出す。
// 設定は data.js の show: { stage?, lines: [{ text, sub?, prop?, anim? }], props?: [...] }
//   stage … 'keynote' でステージを基調講演のように暗くする。'dorm' は夜の寮の部屋
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
    this.theme = config.stage;
    if (this.theme) stage.canvas.parentElement.classList.add(`stage-${this.theme}`);
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
    if (this.theme) this.stage.canvas.parentElement.classList.remove(`stage-${this.theme}`);
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
  // Apple のロゴ：ステージの奥で光る背景
  appleLogo() {
    const g = new THREE.Group();
    const w = 1.9;
    const h = w * (1000 / 814);
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: logoTexture(false), transparent: true, depthWrite: false }),
    );
    // 後光：ぼかしたロゴを大きめに重ね、明るさを脈打たせる
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.5, h * 1.5),
      new THREE.MeshBasicMaterial({
        map: logoTexture(true),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.position.z = -0.01;
    g.add(glow, logo);
    g.position.set(0, 1.9, -2.4);
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      glow.material.opacity = 0.55 + Math.sin(t * 1.6) * 0.25;
      logo.material.opacity = 0.85 + Math.sin(t * 1.6) * 0.1;
    };
    return g;
  },

  // 初代 iPhone（2007）：セリフと一緒にポンと出てきて、キャラの横でゆらゆら回る
  phone() {
    const g = new THREE.Group();
    const W = 0.3;
    const H = 0.58;
    const D = 0.03;
    const R = 0.045;
    // 銀色のアルミの本体（背面と側面）
    const body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundRect(W, H, R), { depth: D, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 3, curveSegments: 12 }),
      new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.55, roughness: 0.3 }),
    );
    body.position.z = -D / 2;
    // 前面の黒いガラス
    const glass = new THREE.Mesh(
      new THREE.ShapeGeometry(roundRect(W - 0.004, H - 0.004, R - 0.002), 12),
      new THREE.MeshStandardMaterial({ color: 0x050507, metalness: 0.2, roughness: 0.08 }),
    );
    glass.position.z = D / 2 + 0.0065;
    // 画面（3.5インチ・縦長 2:3）
    const sw = W * 0.84;
    const sh = sw * 1.5;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: phoneScreen() }));
    screen.position.set(0, 0.004, glass.position.z + 0.0005);
    // ガラスの映り込み（斜めのハイライト）
    const shine = new THREE.Mesh(
      new THREE.ShapeGeometry(roundRect(W - 0.004, H - 0.004, R - 0.002), 12),
      new THREE.MeshBasicMaterial({ map: shineTexture(), transparent: true, depthWrite: false }),
    );
    fitUV(shine.geometry);
    shine.position.z = screen.position.z + 0.0005;
    // ホームボタンと受話口
    const button = new THREE.Mesh(
      new THREE.RingGeometry(0.017, 0.022, 32),
      new THREE.MeshBasicMaterial({ color: 0x3a3a3f }),
    );
    button.position.set(0, -(sh / 2 + (H - sh) / 4) + 0.004, glass.position.z + 0.0005);
    const square = new THREE.Mesh(
      new THREE.ShapeGeometry(roundRect(0.013, 0.013, 0.003)),
      new THREE.MeshBasicMaterial({ color: 0x55555c }),
    );
    square.position.copy(button.position).z += 0.0002;
    const speaker = new THREE.Mesh(
      new THREE.ShapeGeometry(roundRect(0.06, 0.007, 0.0035)),
      new THREE.MeshBasicMaterial({ color: 0x26262b }),
    );
    speaker.position.set(0, sh / 2 + (H - sh) / 4 + 0.004, glass.position.z + 0.0005);
    g.add(body, glass, screen, shine, button, square, speaker);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.95, 1.1 + Math.sin(t * 2.4) * 0.05, 0.3);
      p.rotation.y = Math.sin(t * 1.2) * 0.45 - 0.15;
      p.rotation.x = -0.08;
    };
    return g;
  },

  // ハーバードの寮の部屋（夜）：壁・床・ベッド・机、壁で光る Facebook の看板
  dormRoom() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: dormWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: floorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    // 看板：青く光る「f」。後光を重ねて明るさを脈打たせる
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.05, 1.05),
      new THREE.MeshBasicMaterial({ map: fLogoTexture(false), transparent: true, depthWrite: false }),
    );
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({ map: fLogoTexture(true), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sign.position.set(0, 2.75, -2.47);
    glow.position.set(0, 2.75, -2.48);
    g.add(wall, floor, glow, sign, bed(), desk());
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      glow.material.opacity = 0.6 + Math.sin(t * 1.6) * 0.25;
    };
    return g;
  },

  // ノートパソコン（画面は 2004 年の thefacebook）：セリフと一緒にキャラの横に小さな机ごと出てくる
  laptop() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.7 });
    const H = 0.72;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.05, 0.55), wood);
    top.position.y = H - 0.025;
    g.add(top);
    for (const [x, z] of [[-0.35, -0.23], [0.35, -0.23], [-0.35, 0.23], [0.35, 0.23]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, H - 0.05, 0.05), wood);
      leg.position.set(x, (H - 0.05) / 2, z);
      g.add(leg);
    }
    const pc = laptopModel();
    pc.position.y = H + 0.013;
    g.add(pc);
    g.userData.animate = (p, t, o) => {
      // 出てきたときのキャラの横に置いたら、あとは動かさない（床に置いた机なので）
      if (p.userData.placedAt !== p.userData.popAt) {
        p.userData.placedAt = p.userData.popAt;
        p.position.set(o.position.x + 0.95, 0, 0.2);
      }
      p.rotation.y = -0.35;
    };
    return g;
  },

  // VR ゴーグル：未来の話をするときに出てくる
  vr() {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.45 });
    const light = new THREE.MeshStandardMaterial({ color: 0xf2f2f4, roughness: 0.5 });
    const shell = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundRect(0.46, 0.26, 0.1), { depth: 0.16, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 4, curveSegments: 16 }),
      light,
    );
    shell.position.z = -0.08;
    // 前面の黒いパネルと、映り込みの青い光
    const face = new THREE.Mesh(new THREE.ShapeGeometry(roundRect(0.44, 0.24, 0.09), 16), new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.15, metalness: 0.3 }));
    face.position.z = 0.111;
    const shine = new THREE.Mesh(
      new THREE.ShapeGeometry(roundRect(0.44, 0.24, 0.09), 16),
      new THREE.MeshBasicMaterial({ map: shineTexture(), transparent: true, depthWrite: false, color: 0x9ecbff }),
    );
    fitUV(shine.geometry);
    shine.position.z = 0.112;
    // カメラの穴（4つ）
    for (const [x, y] of [[-0.15, 0.06], [0.15, 0.06], [-0.15, -0.06], [0.15, -0.06]]) {
      const cam = new THREE.Mesh(new THREE.CircleGeometry(0.018, 20), new THREE.MeshBasicMaterial({ color: 0x33363d }));
      cam.position.set(x, y, 0.113);
      g.add(cam);
    }
    // 頭にかけるバンド
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.022, 10, 40, Math.PI), dark);
    strap.rotation.x = Math.PI / 2;
    strap.rotation.z = Math.PI;
    strap.scale.set(1.05, 1.35, 1);
    strap.position.z = -0.12;
    g.add(shell, face, shine, strap);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.95, 1.2 + Math.sin(t * 2.4) * 0.05, 0.3);
      p.rotation.y = Math.sin(t * 1.2) * 0.5 - 0.2;
      p.rotation.x = 0.1;
    };
    return g;
  },
};

// 寮のベッド（左奥）
function bed() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.8 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 1.1), wood);
  frame.position.y = 0.2;
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.2, 1.0), new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.9 }));
  mattress.position.y = 0.47;
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.08, 1.06), new THREE.MeshStandardMaterial({ color: 0x8c1d2c, roughness: 0.9 }));
  blanket.position.set(0.33, 0.6, 0);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.75), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
  pillow.position.set(-0.78, 0.64, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 1.1), wood);
  head.position.set(-1.1, 0.6, 0);
  g.add(frame, mattress, blanket, pillow, head);
  g.position.set(-2.6, 0, -1.85);
  return g;
}

// 机と椅子、光るノートパソコン、電気スタンド（右奥）
function desk() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.7 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.75), wood);
  top.position.y = 0.78;
  g.add(top);
  for (const [x, z] of [[-0.74, -0.32], [0.74, -0.32], [-0.74, 0.32], [0.74, 0.32]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.06), wood);
    leg.position.set(x, 0.39, z);
    g.add(leg);
  }
  const pc = laptopModel();
  pc.scale.setScalar(0.85);
  pc.position.set(-0.15, 0.81, 0.05);
  pc.rotation.y = 0.25;
  // 電気スタンド：暖かい光で机まわりを照らす
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.4, metalness: 0.5 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.03, 24), metal);
  base.position.set(0.55, 0.825, -0.2);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), metal);
  arm.position.set(0.55, 1.07, -0.2);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.16, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x1f5c3a, side: THREE.DoubleSide, roughness: 0.5 }));
  shade.position.set(0.5, 1.33, -0.15);
  shade.rotation.z = 0.5;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
  bulb.position.set(0.47, 1.28, -0.14);
  const lamp = new THREE.PointLight(0xffc27a, 2.2, 3.5);
  lamp.position.copy(bulb.position);
  // 椅子
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), metal);
  seat.position.y = 0.48;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), metal);
  back.position.set(0, 0.75, 0.24);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.46, 8), metal);
  post.position.y = 0.23;
  chair.add(seat, back, post);
  chair.position.set(-0.2, 0, 0.6);
  chair.rotation.y = 0.3;
  g.add(pc, base, arm, shade, bulb, lamp, chair);
  g.position.set(2.5, 0, -1.9);
  g.rotation.y = -0.35;
  return g;
}

// 銀色のノートパソコン（開いた状態、原点はキーボード面の中心）
function laptopModel() {
  const g = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.5, roughness: 0.35 });
  const W = 0.62;
  const Dp = 0.42;
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, 0.025, Dp), silver);
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.86, Dp * 0.45), new THREE.MeshStandardMaterial({ color: 0x2c2d31, roughness: 0.8 }));
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, 0.0131, -0.05);
  const lid = new THREE.Group();
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, 0.4, 0.018), silver);
  back.position.y = 0.2;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.9, 0.34), new THREE.MeshBasicMaterial({ map: thefacebookScreen() }));
  screen.position.set(0, 0.2, 0.0095);
  lid.add(back, screen);
  lid.position.set(0, 0.012, -Dp / 2);
  lid.rotation.x = -0.28;
  g.add(base, keys, lid);
  return g;
}

// 中心を原点にした角丸の四角形
function roundRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ShapeGeometry の UV を 0〜1 に収める（テクスチャを全面に貼るため）
function fitUV(geo) {
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - min.x) / (max.x - min.x), (pos.getY(i) - min.y) / (max.y - min.y));
  }
}

function canvasTexture(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Apple ロゴ（assets/apple-logo.svg のパス）を光る白銀で描く。blur=true なら後光用のぼかし
function logoTexture(blur) {
  const c = document.createElement('canvas');
  c.width = 407 * 2;
  c.height = 500 * 2;
  const tex = canvasTexture(c);
  fetch('assets/apple-logo.svg')
    .then((r) => r.text())
    .then((svg) => {
      const d = svg.match(/ d="([^"]+)"/)[1];
      const x = c.getContext('2d');
      const pad = blur ? 0.2 : 0.06; // 後光はぼかしがはみ出さないよう余白を多めに
      const s = (c.height * (1 - pad * 2)) / 1000;
      x.translate((c.width - 814 * s) / 2, c.height * pad);
      x.scale(s, s);
      const path = new Path2D(d);
      if (blur) {
        x.filter = 'blur(28px)';
        x.fillStyle = '#9ecbff';
        x.fill(path);
      } else {
        const grad = x.createLinearGradient(0, 0, 0, 1000);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.55, '#e4e8ef');
        grad.addColorStop(1, '#b7bfcc');
        x.shadowColor = 'rgba(190, 220, 255, 0.95)';
        x.shadowBlur = 40;
        x.fillStyle = grad;
        x.fill(path);
      }
      tex.needsUpdate = true;
    });
  return tex;
}

// 初代 iPhone 風のホーム画面
function phoneScreen() {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 480;
  const x = c.getContext('2d');
  // 壁紙：夜の地球のような青いグラデーション
  const bg = x.createRadialGradient(160, 520, 40, 160, 380, 420);
  bg.addColorStop(0, '#7fc4ff');
  bg.addColorStop(0.35, '#1f5fb0');
  bg.addColorStop(1, '#030b1f');
  x.fillStyle = bg;
  x.fillRect(0, 0, 320, 480);
  // ステータスバー
  x.fillStyle = 'rgba(0,0,0,0.75)';
  x.fillRect(0, 0, 320, 20);
  x.fillStyle = '#fff';
  x.font = 'bold 13px Helvetica, Arial, sans-serif';
  x.textAlign = 'center';
  x.fillText('9:41 AM', 160, 15);
  for (let i = 0; i < 5; i++) x.fillRect(6 + i * 5, 14 - i * 2, 3, 3 + i * 2); // 電波
  x.strokeStyle = '#fff';
  x.strokeRect(286, 5, 24, 11); // 電池
  x.fillStyle = '#8ef08a';
  x.fillRect(288, 7, 18, 7);
  x.fillStyle = '#fff';
  x.fillRect(310, 8, 2, 5);
  // アプリのアイコン（4列×3段）とドック
  const apps = [
    ['Text', '#6fe36b', '#1ea81a'], ['Calendar', '#ffffff', '#d9d9d9'], ['Photos', '#ffe08a', '#f0a830'], ['Camera', '#9aa3ad', '#4a525c'],
    ['YouTube', '#ff6a6a', '#c01818'], ['Stocks', '#4d4d4d', '#111111'], ['Maps', '#b8e39a', '#5aa33a'], ['Weather', '#7fc8ff', '#2379d6'],
    ['Clock', '#3a3a3a', '#000000'], ['Calculator', '#ffb24a', '#e36b0c'], ['Notes', '#fff59a', '#e8c93a'], ['Settings', '#c2c7cf', '#6e7580'],
  ];
  const dock = [['Phone', '#6fe36b', '#1ea81a'], ['Mail', '#8fd0ff', '#1e78e0'], ['Safari', '#a8dcff', '#2a8ae6'], ['iPod', '#ffa45a', '#e8580c']];
  const icon = (ix, iy, [label, c1, c2], labelColor = '#fff') => {
    const grad = x.createLinearGradient(0, iy, 0, iy + 57);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    x.fillStyle = grad;
    x.beginPath();
    x.roundRect(ix, iy, 57, 57, 12);
    x.fill();
    // 当時らしい上半分のツヤ
    const gloss = x.createLinearGradient(0, iy, 0, iy + 30);
    gloss.addColorStop(0, 'rgba(255,255,255,0.65)');
    gloss.addColorStop(1, 'rgba(255,255,255,0.08)');
    x.fillStyle = gloss;
    x.beginPath();
    x.roundRect(ix, iy, 57, 28, [12, 12, 4, 4]);
    x.fill();
    drawGlyph(x, label, ix + 28.5, iy + 28.5);
    x.fillStyle = labelColor;
    x.font = '11px Helvetica, Arial, sans-serif';
    x.textAlign = 'center';
    x.fillText(label, ix + 28.5, iy + 71);
  };
  apps.forEach((a, i) => icon(12 + (i % 4) * 76, 34 + Math.floor(i / 4) * 88, a));
  const dockGrad = x.createLinearGradient(0, 390, 0, 480);
  dockGrad.addColorStop(0, 'rgba(255,255,255,0.45)');
  dockGrad.addColorStop(1, 'rgba(255,255,255,0.12)');
  x.fillStyle = dockGrad;
  x.fillRect(0, 392, 320, 88);
  dock.forEach((a, i) => icon(12 + i * 76, 400, a));
  return canvasTexture(c);
}

// アイコンの絵柄（中心 cx, cy）
function drawGlyph(x, label, cx, cy) {
  x.save();
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const text = (t, size, color, dy = 0) => {
    x.fillStyle = color;
    x.font = `bold ${size}px Helvetica, Arial, sans-serif`;
    x.fillText(t, cx, cy + dy);
  };
  const circle = (r, color, stroke) => {
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    if (stroke) {
      x.strokeStyle = color;
      x.lineWidth = stroke;
      x.stroke();
    } else {
      x.fillStyle = color;
      x.fill();
    }
  };
  switch (label) {
    case 'Text':
      x.fillStyle = '#fff';
      x.beginPath();
      x.ellipse(cx, cy - 2, 18, 13, 0, 0, Math.PI * 2);
      x.fill();
      x.beginPath();
      x.moveTo(cx - 10, cy + 6);
      x.lineTo(cx - 16, cy + 16);
      x.lineTo(cx - 2, cy + 9);
      x.fill();
      break;
    case 'Calendar':
      x.fillStyle = '#d8261f';
      x.fillRect(cx - 28.5, cy - 28.5, 57, 14);
      text('Tuesday', 9, '#fff', -21);
      text('9', 30, '#222', 7);
      break;
    case 'Photos':
      circle(16, '#ffd23a');
      x.fillStyle = '#ff8a1c';
      for (let i = 0; i < 6; i++) {
        x.beginPath();
        x.ellipse(cx + Math.cos(i) * 9, cy + Math.sin(i) * 9, 7, 4, i, 0, Math.PI * 2);
        x.fill();
      }
      break;
    case 'Camera':
      x.fillStyle = '#222';
      x.fillRect(cx - 18, cy - 10, 36, 24);
      circle(9, '#6b8fb3');
      circle(9, '#ddd', 2);
      break;
    case 'YouTube':
      x.fillStyle = '#fff';
      x.fillRect(cx - 20, cy - 12, 40, 24);
      text('You', 12, '#222', 0);
      break;
    case 'Stocks':
      x.strokeStyle = '#4de34d';
      x.lineWidth = 2.5;
      x.beginPath();
      x.moveTo(cx - 20, cy + 10);
      x.lineTo(cx - 8, cy - 2);
      x.lineTo(cx + 2, cy + 6);
      x.lineTo(cx + 20, cy - 14);
      x.stroke();
      break;
    case 'Maps':
      x.strokeStyle = '#fff';
      x.lineWidth = 4;
      x.beginPath();
      x.moveTo(cx - 24, cy + 16);
      x.lineTo(cx + 24, cy - 16);
      x.moveTo(cx - 10, cy - 24);
      x.lineTo(cx + 6, cy + 24);
      x.stroke();
      text('280', 9, '#1e5aa8', -12);
      break;
    case 'Weather':
      circle(11, '#ffe34d');
      x.fillStyle = '#fff';
      x.beginPath();
      x.ellipse(cx + 6, cy + 10, 14, 8, 0, 0, Math.PI * 2);
      x.fill();
      text('73°', 11, '#fff', -18);
      break;
    case 'Clock':
      circle(21, '#fff');
      x.strokeStyle = '#000';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(cx, cy);
      x.lineTo(cx, cy - 15);
      x.moveTo(cx, cy);
      x.lineTo(cx + 10, cy + 4);
      x.stroke();
      break;
    case 'Calculator':
      text('+ −', 16, '#fff', -8);
      text('× =', 16, '#fff', 10);
      break;
    case 'Notes':
      x.strokeStyle = '#c9a53a';
      x.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        x.beginPath();
        x.moveTo(cx - 20, cy - 8 + i * 8);
        x.lineTo(cx + 20, cy - 8 + i * 8);
        x.stroke();
      }
      break;
    case 'Settings':
      circle(15, '#444', 6);
      circle(5, '#444');
      break;
    case 'Phone':
      text('☎', 32, '#fff', 1);
      break;
    case 'Mail':
      x.fillStyle = '#fff';
      x.fillRect(cx - 18, cy - 12, 36, 24);
      x.strokeStyle = '#1e78e0';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(cx - 18, cy - 12);
      x.lineTo(cx, cy + 2);
      x.lineTo(cx + 18, cy - 12);
      x.stroke();
      break;
    case 'Safari':
      circle(19, '#fff', 3);
      x.fillStyle = '#e8322a';
      x.beginPath();
      x.moveTo(cx + 12, cy - 12);
      x.lineTo(cx + 3, cy + 3);
      x.lineTo(cx - 3, cy - 3);
      x.fill();
      x.fillStyle = '#fff';
      x.beginPath();
      x.moveTo(cx - 12, cy + 12);
      x.lineTo(cx + 3, cy + 3);
      x.lineTo(cx - 3, cy - 3);
      x.fill();
      break;
    case 'iPod':
      text('♫', 30, '#fff', 1);
      break;
  }
  x.restore();
}

// ガラス面の斜めのハイライト
function shineTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const x = c.getContext('2d');
  const grad = x.createLinearGradient(0, 0, 128, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.22)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.06)');
  grad.addColorStop(0.46, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 128, 256);
  return canvasTexture(c);
}

// ---------- 寮の部屋のテクスチャ ----------
// 夜の寮の壁：窓（星と月）、赤いペナント、コルクボード
function dormWallTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 878;
  const x = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const wall = x.createRadialGradient(W / 2, H * 0.35, 50, W / 2, H * 0.5, W * 0.55);
  wall.addColorStop(0, '#3a4058');
  wall.addColorStop(1, '#161a26');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  // 腰板
  x.fillStyle = 'rgba(0,0,0,0.25)';
  x.fillRect(0, H - 60, W, 60);
  // 窓（左）：夜空と月
  const wx = 560;
  const wy = 230;
  const ww = 250;
  const wh = 300;
  const sky = x.createLinearGradient(0, wy, 0, wy + wh);
  sky.addColorStop(0, '#0b1a3f');
  sky.addColorStop(1, '#23386b');
  x.fillStyle = sky;
  x.fillRect(wx, wy, ww, wh);
  x.fillStyle = '#fff';
  for (let i = 0; i < 26; i++) {
    const sx = wx + ((i * 97) % ww);
    const sy = wy + ((i * 53) % (wh * 0.7));
    x.globalAlpha = 0.4 + ((i * 7) % 5) / 8;
    x.fillRect(sx, sy, 3, 3);
  }
  x.globalAlpha = 1;
  x.fillStyle = '#fdf3c8';
  x.shadowColor = '#fdf3c8';
  x.shadowBlur = 30;
  x.beginPath();
  x.arc(wx + ww * 0.7, wy + 80, 32, 0, Math.PI * 2);
  x.fill();
  x.shadowBlur = 0;
  x.strokeStyle = '#d9d2c3';
  x.lineWidth = 14;
  x.strokeRect(wx, wy, ww, wh);
  x.lineWidth = 8;
  x.beginPath();
  x.moveTo(wx + ww / 2, wy);
  x.lineTo(wx + ww / 2, wy + wh);
  x.moveTo(wx, wy + wh / 2);
  x.lineTo(wx + ww, wy + wh / 2);
  x.stroke();
  // 赤いペナント（右上）
  x.fillStyle = '#a51c30';
  x.beginPath();
  x.moveTo(1290, 190);
  x.lineTo(1290, 300);
  x.lineTo(1560, 245);
  x.closePath();
  x.fill();
  x.fillStyle = '#fff';
  x.font = 'bold 40px Georgia, serif';
  x.textBaseline = 'middle';
  x.fillText('2004', 1310, 247);
  // コルクボードとメモ（右）
  x.fillStyle = '#9c7446';
  x.fillRect(1330, 360, 260, 170);
  x.strokeStyle = '#5e4128';
  x.lineWidth = 10;
  x.strokeRect(1330, 360, 260, 170);
  for (const [nx, ny, col] of [[1355, 380, '#fff7a8'], [1450, 395, '#ffffff'], [1520, 450, '#bfe3ff'], [1375, 455, '#ffd0d8']]) {
    x.fillStyle = col;
    x.fillRect(nx, ny, 60, 55);
  }
  // 部屋を暗めに
  x.fillStyle = 'rgba(8,10,20,0.25)';
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}

// 木の床
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d');
  const n = 14;
  for (let i = 0; i < n; i++) {
    const l = 30 + ((i * 37) % 9);
    x.fillStyle = `hsl(28, 32%, ${l}%)`;
    x.fillRect((i * c.width) / n, 0, c.width / n, c.height);
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.fillRect((i * c.width) / n, 0, 2, c.height);
  }
  // 奥ほど暗く
  const shade = x.createLinearGradient(0, 0, 0, c.height);
  shade.addColorStop(0, 'rgba(5,6,12,0.75)');
  shade.addColorStop(1, 'rgba(5,6,12,0.35)');
  x.fillStyle = shade;
  x.fillRect(0, 0, c.width, c.height);
  return canvasTexture(c);
}

// Facebook の「f」マーク。blur=true なら後光用のぼかし
function fLogoTexture(blur) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const r = blur ? 130 : 230;
  if (blur) x.filter = 'blur(40px)';
  x.fillStyle = '#1877f2';
  x.shadowColor = 'rgba(80,160,255,0.9)';
  x.shadowBlur = blur ? 0 : 20;
  x.beginPath();
  x.arc(256, 256, r, 0, Math.PI * 2);
  x.fill();
  if (!blur) {
    x.shadowBlur = 0;
    x.fillStyle = '#fff';
    x.font = 'bold 380px "Helvetica Neue", Arial, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'alphabetic';
    x.fillText('f', 276, 470);
    // 円からはみ出た「f」の下側を切り落とす
    x.globalCompositeOperation = 'destination-in';
    x.beginPath();
    x.arc(256, 256, r, 0, Math.PI * 2);
    x.fill();
  }
  return canvasTexture(c);
}

// 2004 年ごろの thefacebook の画面
function thefacebookScreen() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 330;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 512, 330);
  x.fillStyle = '#3b5998';
  x.fillRect(0, 0, 512, 48);
  x.fillStyle = '#fff';
  x.font = 'bold 26px Tahoma, Verdana, sans-serif';
  x.textBaseline = 'middle';
  x.fillText('[ thefacebook ]', 16, 25);
  x.font = '13px Tahoma, Verdana, sans-serif';
  x.fillText('home   search   invite   logout', 300, 26);
  // 左のメニュー
  x.fillStyle = '#eceff5';
  x.fillRect(0, 48, 120, 282);
  x.fillStyle = '#3b5998';
  x.font = '13px Tahoma, Verdana, sans-serif';
  ['My Profile', 'My Friends', 'My Photos', 'My Groups', 'My Privacy'].forEach((t, i) => x.fillText(t, 14, 76 + i * 26));
  // 本文
  x.fillStyle = '#6d84b4';
  x.fillRect(135, 60, 362, 26);
  x.fillStyle = '#fff';
  x.font = 'bold 15px Tahoma, Verdana, sans-serif';
  x.fillText('Welcome to Thefacebook', 145, 74);
  x.fillStyle = '#333';
  x.font = '13px Tahoma, Verdana, sans-serif';
  x.fillText('Thefacebook is an online directory that', 145, 108);
  x.fillText('connects people through social networks', 145, 128);
  x.fillText('at colleges.', 145, 148);
  x.fillStyle = '#d8dfea';
  x.fillRect(145, 172, 90, 110);
  x.fillStyle = '#9aa7c2';
  x.beginPath();
  x.arc(190, 212, 22, 0, Math.PI * 2);
  x.fill();
  x.fillRect(160, 240, 60, 42);
  x.fillStyle = '#3b5998';
  x.font = 'bold 14px Tahoma, Verdana, sans-serif';
  x.fillText('Mark Zuckerberg', 250, 190);
  x.fillStyle = '#555';
  x.font = '12px Tahoma, Verdana, sans-serif';
  x.fillText('Harvard University', 250, 212);
  x.fillText('Friends: 1,024', 250, 232);
  x.fillStyle = '#3b5998';
  x.fillRect(250, 252, 110, 26);
  x.fillStyle = '#fff';
  x.fillText('Add to Friends', 262, 266);
  return canvasTexture(c);
}
