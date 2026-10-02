import * as THREE from 'three';

// 偉人ごとの「ショー」: ステージを歩き回り、立ち止まって吹き出しでしゃべり、小物を出す。
// 設定は data.js の show: { stage?, lines: [{ text, sub?, prop?, anim? }], props?: [...] }
//   stage … 'keynote' でステージを基調講演のように暗くする。'dorm' は夜の寮の部屋。'msoffice' は初期の Microsoft の夜のオフィス。'garage' は Amazon を始めたガレージ。'studio' は Spotify を始めたストックホルムの夜のスタジオ。'iss' は前澤さんが行った国際宇宙ステーションの中（壁に ZOZO の文字）
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

  // 初期の Microsoft の夜のオフィス：壁・床・壁で光る4色の窓のマーク
  msOffice() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: msWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: floorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ map: windowLogoTexture(false), transparent: true, depthWrite: false }));
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 2.4),
      new THREE.MeshBasicMaterial({ map: windowLogoTexture(true), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sign.position.set(0, 2.75, -2.47);
    glow.position.set(0, 2.75, -2.48);
    g.add(wall, floor, glow, sign);
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      glow.material.opacity = 0.55 + Math.sin(t * 1.4) * 0.25;
    };
    return g;
  },

  // 1980年代のパソコン（ベージュの本体とブラウン管、画面は MS-DOS）：小さな机ごと横に出てくる
  retroPC() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.7 });
    const H = 0.72;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.6), wood);
    top.position.y = H - 0.025;
    g.add(top);
    for (const [x, z] of [[-0.41, -0.26], [0.41, -0.26], [-0.41, 0.26], [0.41, 0.26]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, H - 0.05, 0.05), wood);
      leg.position.set(x, (H - 0.05) / 2, z);
      g.add(leg);
    }
    const beige = new THREE.MeshStandardMaterial({ color: 0xd9cfb6, roughness: 0.6 });
    // 本体（横置き）と、その上のブラウン管
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.42), beige);
    box.position.set(0, H + 0.06, -0.05);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.015, 0.01), new THREE.MeshBasicMaterial({ color: 0x3a3a3a }));
    slot.position.set(0.15, H + 0.07, 0.165);
    const crt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.36, 0.36), beige);
    crt.position.set(0, H + 0.12 + 0.18, -0.08);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), new THREE.MeshBasicMaterial({ map: dosScreen() }));
    screen.position.set(0, H + 0.3, 0.101);
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.16), beige);
    kb.position.set(0, H + 0.013, 0.2);
    kb.rotation.x = 0.06;
    g.add(box, slot, crt, screen, kb);
    g.userData.animate = (p, t, o) => {
      if (p.userData.placedAt !== p.userData.popAt) {
        p.userData.placedAt = p.userData.popAt;
        p.position.set(o.position.x + 1, 0, 0.2);
      }
      p.rotation.y = -0.35;
    };
    return g;
  },

  // 地球儀：財団で世界の健康に取り組む話のときに、手の横に浮かぶ
  globe() {
    const g = new THREE.Group();
    const earth = new THREE.Mesh(new THREE.SphereGeometry(0.2, 40, 24), new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.7 }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.235, 32, 16), new THREE.MeshBasicMaterial({ color: 0x7fc8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(earth, halo);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.9, 1.25 + Math.sin(t * 2.2) * 0.05, 0.3);
      earth.rotation.y = t * 0.6;
      earth.rotation.z = 0.4;
    };
    return g;
  },

  // Amazon を始めたガレージ：シャッターの壁、積んだ段ボール、壁で光るオレンジの矢印の笑顔
  garage() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: garageWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: concreteTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: smileTexture(false), transparent: true, depthWrite: false }));
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 1.6),
      new THREE.MeshBasicMaterial({ map: smileTexture(true), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sign.position.set(0.9, 2.15, -2.47); // 吹き出しに隠れないよう、少し低く右寄りに
    glow.position.set(0.9, 2.15, -2.48);
    g.add(wall, floor, glow, sign);
    // 左右に積んだ段ボール箱
    const card = new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 0.9 });
    const tape = new THREE.MeshStandardMaterial({ color: 0xd9c08f, roughness: 0.6 });
    for (const [x, y, z, s, r] of [[-2.3, 0.3, -1.6, 0.6, 0.1], [-2.3, 0.85, -1.55, 0.5, -0.2], [-1.75, 0.25, -1.8, 0.5, 0.3], [2.2, 0.3, -1.7, 0.6, -0.15], [2.3, 0.85, -1.7, 0.5, 0.25], [1.7, 0.2, -1.4, 0.4, 0.5]]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), card);
      box.position.set(x, y, z);
      box.rotation.y = r;
      const t = new THREE.Mesh(new THREE.BoxGeometry(s * 1.01, 0.02, s * 0.18), tape);
      t.position.set(x, y + s / 2, z);
      t.rotation.y = r;
      g.add(box, t);
    }
    // 天井の裸電球
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
    bulb.position.set(-0.9, 3.4, -1);
    const lamp = new THREE.PointLight(0xffc27a, 3, 6);
    lamp.position.copy(bulb.position);
    g.add(bulb, lamp);
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      glow.material.opacity = 0.55 + Math.sin(t * 1.5) * 0.25;
    };
    return g;
  },

  // ドアの板で作った机（Amazon の創業時の有名な机）と古いモニター：横に出てくる
  doorDesk() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0xc9a77a, roughness: 0.7 });
    const H = 0.72;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.55), wood);
    door.position.y = H - 0.02;
    // ドアだったしるしのドアノブの穴
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.045, 16), new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.7, roughness: 0.3 }));
    knob.position.set(0.48, H - 0.02, 0.18);
    g.add(door, knob);
    // 脚は角材を組んだもの
    const leg = new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.8 });
    for (const [x, z] of [[-0.48, -0.22], [0.48, -0.22], [-0.48, 0.22], [0.48, 0.22]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, H - 0.04, 0.06), leg);
      l.position.set(x, (H - 0.04) / 2, z);
      g.add(l);
    }
    const beige = new THREE.MeshStandardMaterial({ color: 0xdcd3bd, roughness: 0.6 });
    const crt = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.32, 0.34), beige);
    crt.position.set(-0.15, H + 0.16, -0.06);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.23), new THREE.MeshBasicMaterial({ map: bookshopScreen() }));
    screen.position.set(-0.15, H + 0.17, 0.111);
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.28), new THREE.MeshStandardMaterial({ color: 0x2f5d8a, roughness: 0.6 }));
    book.position.set(0.3, H + 0.025, 0.02);
    book.rotation.y = 0.3;
    g.add(crt, screen, book);
    g.userData.animate = (p, t, o) => {
      if (p.userData.placedAt !== p.userData.popAt) {
        p.userData.placedAt = p.userData.popAt;
        p.position.set(o.position.x + 1.05, 0, 0.2);
      }
      p.rotation.y = -0.35;
    };
    return g;
  },

  // 宇宙ロケット（ブルーオリジン）：失敗と発明の話のときに、手の横に浮かんで火をふく
  rocket() {
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f4, roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 24), white);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), white);
    nose.scale.y = 1.6;
    nose.position.y = 0.21;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.03, 24), new THREE.MeshStandardMaterial({ color: 0x2c4f9e }));
    ring.position.y = 0.08;
    g.add(body, nose, ring);
    for (let i = 0; i < 3; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.07), new THREE.MeshStandardMaterial({ color: 0x2c4f9e }));
      const a = (i / 3) * Math.PI * 2;
      fin.position.set(Math.sin(a) * 0.09, -0.17, Math.cos(a) * 0.09);
      fin.rotation.y = a;
      g.add(fin);
    }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 16), new THREE.MeshBasicMaterial({ color: 0xffa83a, transparent: true, opacity: 0.9 }));
    flame.rotation.x = Math.PI;
    flame.position.y = -0.32;
    g.add(flame);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.9, 1.25 + Math.sin(t * 2.6) * 0.06, 0.3);
      p.rotation.z = Math.sin(t * 1.3) * 0.12;
      flame.scale.y = 0.8 + Math.abs(Math.sin(t * 18)) * 0.5;
    };
    return g;
  },

  // Spotify を始めたストックホルムの夜のスタジオ：壁で光る緑の音のマークと、音に合わせて動く光の棒
  studio() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: studioWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: floorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: soundLogoTexture(false), transparent: true, depthWrite: false }));
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 2.1),
      new THREE.MeshBasicMaterial({ map: soundLogoTexture(true), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sign.position.set(0.95, 2.2, -2.47);
    glow.position.set(0.95, 2.2, -2.48);
    g.add(wall, floor, glow, sign);
    // 音に合わせて伸び縮みする緑の光の棒（左の壁ぎわ）
    const bars = [];
    const barMat = new THREE.MeshBasicMaterial({ color: 0x1ed760, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 1), barMat);
      b.position.set(-2.1 + i * 0.2, 0.6, -2.46);
      bars.push(b);
      g.add(b);
    }
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      glow.material.opacity = 0.55 + Math.sin(t * 2.2) * 0.25;
      bars.forEach((b, i) => {
        const h = 0.25 + Math.abs(Math.sin(t * (2.3 + i * 0.37) + i * 1.7)) * 1.2;
        b.scale.y = h;
        b.position.y = 0.45 + h / 2;
      });
    };
    return g;
  },

  // レコードプレーヤー（小さな台ごと横に出てくる）。レコードが回る
  turntable() {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.6 });
    const H = 0.72;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.55), new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: 0.7 }));
    top.position.y = H - 0.025;
    g.add(top);
    for (const [x, z] of [[-0.31, -0.23], [0.31, -0.23], [-0.31, 0.23], [0.31, 0.23]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, H - 0.05, 0.05), dark);
      leg.position.set(x, (H - 0.05) / 2, z);
      g.add(leg);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.4), new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.5 }));
    base.position.y = H + 0.035;
    const record = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 40), new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.3 }));
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.014, 24), new THREE.MeshBasicMaterial({ color: 0x1ed760 }));
    record.add(disc, label);
    record.position.set(-0.05, H + 0.077, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.22), new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.6, roughness: 0.3 }));
    arm.position.set(0.17, H + 0.09, -0.03);
    arm.rotation.y = 0.35;
    g.add(base, record, arm);
    g.userData.animate = (p, t, o) => {
      if (p.userData.placedAt !== p.userData.popAt) {
        p.userData.placedAt = p.userData.popAt;
        p.position.set(o.position.x + 0.95, 0, 0.2);
      }
      p.rotation.y = -0.35;
      record.rotation.y = t * 3.5;
    };
    return g;
  },

  // ヘッドホン：「すべての人に、音楽を」のときに手の横に浮かぶ。まわりに音符の光
  headphones() {
    const g = new THREE.Group();
    const h = new THREE.Group(); // 小さく見えるので 1.7 倍に
    h.scale.setScalar(1.7);
    g.add(h);
    const dark = new THREE.MeshStandardMaterial({ color: 0x24252b, roughness: 0.4 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 10, 32, Math.PI), dark);
    band.position.y = 0.02;
    h.add(band);
    for (const s of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 24), dark);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(s * 0.15, -0.02, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 24), new THREE.MeshBasicMaterial({ color: 0x1ed760 }));
      ring.rotation.y = Math.PI / 2;
      ring.position.set(s * 0.177, -0.02, 0);
      h.add(cup, ring);
    }
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.9, 1.3 + Math.sin(t * 2.4) * 0.05, 0.3);
      p.rotation.y = Math.sin(t * 1.2) * 0.6;
    };
    return g;
  },

  // 国際宇宙ステーションの中：丸い窓の外に青い地球と星、白い壁の手すり。小物がふわふわ浮かぶ
  iss() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: issWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: issFloorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    // 壁の ZOZO の文字（後ろがほんのり白く光る。吹き出しに隠れないよう、少し低く右寄り）
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: zozoTexture(false), transparent: true, depthWrite: false }));
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.2),
      new THREE.MeshBasicMaterial({ map: zozoTexture(true), transparent: true, depthWrite: false }),
    );
    sign.position.set(0.9, 2.15, -2.47);
    glow.position.set(0.9, 2.15, -2.48);
    g.add(wall, floor, glow, sign);
    // 無重力で浮かぶ水の玉とペン（左奥）
    const water = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.7, roughness: 0.1 }));
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0xe0563a }));
    g.add(water, pen);
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      water.position.set(-1.9 + Math.sin(t * 0.5) * 0.15, 1.6 + Math.sin(t * 0.8) * 0.12, -1.2);
      water.scale.set(1 + Math.sin(t * 3) * 0.08, 1 - Math.sin(t * 3) * 0.08, 1);
      pen.position.set(-1.4 + Math.cos(t * 0.4) * 0.1, 1.1 + Math.sin(t * 0.6) * 0.1, -0.9);
      pen.rotation.set(t * 0.7, 0, t * 0.5);
      glow.material.opacity = 0.7 + Math.sin(t * 1.6) * 0.3;
    };
    return g;
  },

  // ZOZOSUIT（体のサイズを測る水玉もようの全身スーツ）：横にふわっと浮かんで、ゆっくり回る
  zozosuit() {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ map: dotsTexture(), roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.22, 6, 16), m);
    body.position.y = 0.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 14), m);
    head.position.y = 0.3;
    g.add(body, head);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.2, 4, 10), m);
      arm.position.set(s * 0.16, 0.06, 0);
      arm.rotation.z = s * 0.35;
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 4, 10), m);
      leg.position.set(s * 0.06, -0.25, 0);
      g.add(arm, leg);
    }
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.9, 1.15 + Math.sin(t * 1.8) * 0.06, 0.3);
      p.rotation.y = t * 0.8;
      p.rotation.z = Math.sin(t * 1.1) * 0.15;
    };
    return g;
  },

  // 月：「月に行きます」のときに頭の横に浮かぶ
  moon() {
    const g = new THREE.Group();
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 40, 24), new THREE.MeshStandardMaterial({ map: moonTexture(), roughness: 0.9 }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.235, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(moon, halo);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x - 0.85, 1.35 + Math.sin(t * 2.2) * 0.05, 0.3); // 先に出た ZOZOSUIT と重ならないよう反対側に
      moon.rotation.y = t * 0.4;
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

// 初期の Microsoft の夜のオフィスの壁：紺色の壁に、窓のブラインドとホワイトボード
function msWallTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 878;
  const x = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const wall = x.createRadialGradient(W / 2, H * 0.35, 50, W / 2, H * 0.5, W * 0.55);
  wall.addColorStop(0, '#34405a');
  wall.addColorStop(1, '#131925');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(0,0,0,0.25)';
  x.fillRect(0, H - 60, W, 60);
  // 左の窓：夜の街の明かりとブラインド
  const wx = 470;
  const wy = 220;
  const ww = 300;
  const wh = 320;
  x.fillStyle = '#0d1630';
  x.fillRect(wx, wy, ww, wh);
  for (let i = 0; i < 40; i++) {
    x.fillStyle = i % 3 ? '#f5d58a' : '#9ec3ff';
    x.globalAlpha = 0.35 + ((i * 7) % 5) / 10;
    x.fillRect(wx + ((i * 71) % (ww - 10)), wy + wh * 0.45 + ((i * 37) % (wh * 0.5)), 6, 8);
  }
  x.globalAlpha = 1;
  x.fillStyle = 'rgba(200,205,215,0.18)';
  for (let y = wy; y < wy + wh; y += 18) x.fillRect(wx, y, ww, 7);
  x.strokeStyle = '#5a6275';
  x.lineWidth = 10;
  x.strokeRect(wx, wy, ww, wh);
  // 右のホワイトボード：プログラムの走り書き
  const bx = 1290;
  const by = 230;
  x.fillStyle = '#d9dde4';
  x.fillRect(bx, by, 330, 220);
  x.strokeStyle = '#7d8494';
  x.lineWidth = 8;
  x.strokeRect(bx, by, 330, 220);
  x.fillStyle = '#2d4f9a';
  x.font = 'bold 30px "Courier New", monospace';
  ['10 PRINT "HELLO"', '20 GOTO 10', 'BASIC 4K', 'DOS 1.0'].forEach((s, i) => x.fillText(s, bx + 24, by + 52 + i * 44));
  x.fillStyle = 'rgba(8,10,20,0.25)';
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}

// 4色の窓のマーク（赤・緑・青・黄）。blur=true なら後光用のぼかし
function windowLogoTexture(blur) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  if (blur) x.filter = 'blur(40px)';
  const s = blur ? 120 : 200;
  const gap = blur ? 10 : 16;
  const colors = ['#f25022', '#7fba00', '#00a4ef', '#ffb900'];
  colors.forEach((col, i) => {
    x.fillStyle = col;
    x.shadowColor = col;
    x.shadowBlur = blur ? 0 : 24;
    x.fillRect(256 - s - gap / 2 + (i % 2) * (s + gap), 256 - s - gap / 2 + Math.floor(i / 2) * (s + gap), s, s);
  });
  return canvasTexture(c);
}

// MS-DOS の画面（黒地に灰色の文字）
function dosScreen() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 392;
  const x = c.getContext('2d');
  x.fillStyle = '#05070a';
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#c8c8c8';
  x.font = 'bold 28px "Courier New", monospace';
  ['MS-DOS Version 1.25', '(C)Copyright 1981', '', 'A>dir', ' COMMAND  COM', ' BASIC    COM', '', 'A>_'].forEach((s, i) => x.fillText(s, 22, 44 + i * 42));
  return canvasTexture(c);
}

// 地球：海の青に、緑の大陸をざっくり
function earthTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#2b6fd6';
  x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#4fae5a';
  const blobs = [[90, 80, 55, 40], [120, 160, 30, 50], [250, 70, 45, 30], [270, 150, 35, 55], [380, 80, 80, 40], [420, 175, 30, 22]];
  for (const [cx, cy, rx, ry] of blobs) {
    x.beginPath();
    x.ellipse(cx, cy, rx, ry, 0.3, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = '#eef4ff';
  x.fillRect(0, 0, 512, 12);
  x.fillRect(0, 244, 512, 12);
  return canvasTexture(c);
}

// ガレージの奥の壁：波打つシャッターと工具の棚
function garageWallTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 878;
  const x = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const wall = x.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H * 0.5, W * 0.55);
  wall.addColorStop(0, '#5a5348');
  wall.addColorStop(1, '#1d1a16');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  // シャッター（中央）
  const sx = 560;
  const sw = 920;
  for (let y = 120; y < H - 60; y += 26) {
    x.fillStyle = 'rgba(255,255,255,0.05)';
    x.fillRect(sx, y, sw, 13);
    x.fillStyle = 'rgba(0,0,0,0.18)';
    x.fillRect(sx, y + 13, sw, 4);
  }
  x.strokeStyle = 'rgba(0,0,0,0.4)';
  x.lineWidth = 14;
  x.strokeRect(sx, 110, sw, H - 170);
  // 左の工具をかける板
  x.fillStyle = '#6e5a40';
  x.fillRect(200, 250, 260, 200);
  x.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) x.fillRect(222 + i * 40, 270 + j * 38, 6, 6);
  x.fillStyle = '#9aa0a8';
  x.fillRect(250, 290, 12, 110);
  x.fillRect(310, 300, 50, 12);
  x.fillRect(390, 290, 10, 90);
  x.fillStyle = 'rgba(8,10,20,0.25)';
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}

// コンクリートの床
function concreteTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#5b5852';
  x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(${i % 2 ? '255,255,255' : '0,0,0'},0.05)`;
    x.fillRect((i * 97) % c.width, (i * 53) % c.height, 4, 4);
  }
  // 油じみ
  x.fillStyle = 'rgba(0,0,0,0.2)';
  x.beginPath();
  x.ellipse(620, 300, 120, 50, 0.2, 0, Math.PI * 2);
  x.fill();
  const shade = x.createLinearGradient(0, 0, 0, c.height);
  shade.addColorStop(0, 'rgba(5,6,12,0.75)');
  shade.addColorStop(1, 'rgba(5,6,12,0.3)');
  x.fillStyle = shade;
  x.fillRect(0, 0, c.width, c.height);
  return canvasTexture(c);
}

// オレンジの矢印の笑顔（A から Z へ）。blur=true なら後光用のぼかし
function smileTexture(blur) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d');
  if (blur) x.filter = 'blur(40px)';
  x.strokeStyle = '#ff9900';
  x.fillStyle = '#ff9900';
  x.lineCap = 'round';
  x.lineWidth = blur ? 90 : 56;
  x.shadowColor = 'rgba(255,170,60,0.9)';
  x.shadowBlur = blur ? 0 : 24;
  x.beginPath();
  x.moveTo(180, 230);
  x.quadraticCurveTo(512, 470, 830, 230);
  x.stroke();
  if (!blur) {
    // 矢じり
    x.beginPath();
    x.moveTo(890, 170);
    x.lineTo(900, 300);
    x.lineTo(770, 250);
    x.closePath();
    x.fill();
  }
  return canvasTexture(c);
}

// 1995年ごろのネットの本屋の画面
function bookshopScreen() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 368;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#1b3f8c';
  x.font = 'bold 34px Georgia, serif';
  x.fillText("Earth's Biggest", 24, 52);
  x.fillText('Bookstore', 24, 92);
  x.fillStyle = '#c45a00';
  x.font = '24px Georgia, serif';
  x.fillText('1 million titles', 24, 132);
  x.fillStyle = '#1a55c8';
  x.font = '22px "Times New Roman", serif';
  ['Search books', 'Best sellers', 'Shopping cart'].forEach((s, i) => {
    x.fillText(s, 40, 186 + i * 40);
    x.fillRect(40, 190 + i * 40, x.measureText(s).width, 2);
  });
  for (let i = 0; i < 3; i++) {
    x.fillStyle = ['#7a3b2e', '#2e5a7a', '#5a7a2e'][i];
    x.fillRect(330 + i * 52, 170, 40, 120);
  }
  return canvasTexture(c);
}

// ストックホルムの夜のスタジオの壁：吸音パネルと、窓の外の雪の夜
function studioWallTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 878;
  const x = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const wall = x.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H * 0.5, W * 0.55);
  wall.addColorStop(0, '#2c2f36');
  wall.addColorStop(1, '#0e0f12');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  // 吸音パネル（右）
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++) {
      x.fillStyle = (i + j) % 2 ? '#24262c' : '#1b1d22';
      x.fillRect(1380 + i * 120, 150 + j * 120, 112, 112);
    }
  // 窓（左上）：雪の夜
  const wx = 380;
  const wy = 150;
  x.fillStyle = '#0d1b33';
  x.fillRect(wx, wy, 280, 230);
  x.fillStyle = '#ffffff';
  for (let i = 0; i < 40; i++) {
    x.globalAlpha = 0.3 + ((i * 7) % 5) / 8;
    x.fillRect(wx + ((i * 67) % 270), wy + ((i * 41) % 220), 3, 3);
  }
  x.globalAlpha = 1;
  x.strokeStyle = '#3a3e48';
  x.lineWidth = 10;
  x.strokeRect(wx, wy, 280, 230);
  x.fillStyle = 'rgba(8,10,20,0.2)';
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}

// 緑の丸に3本の音の線のマーク。blur=true なら後光用のぼかし
function soundLogoTexture(blur) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  if (blur) x.filter = 'blur(40px)';
  x.fillStyle = '#1ed760';
  x.shadowColor = 'rgba(30,215,96,0.9)';
  x.shadowBlur = blur ? 0 : 20;
  x.beginPath();
  x.arc(256, 256, blur ? 140 : 230, 0, Math.PI * 2);
  x.fill();
  if (!blur) {
    x.shadowBlur = 0;
    x.strokeStyle = '#0b0b0d';
    x.lineCap = 'round';
    [[180, 40, 0.36], [235, 32, 0.32], [285, 26, 0.28]].forEach(([y, w, k]) => {
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(256 - 512 * k * 0.42, y);
      x.quadraticCurveTo(256, y - 512 * k * 0.13, 256 + 512 * k * 0.42, y + 512 * k * 0.08);
      x.stroke();
    });
  }
  return canvasTexture(c);
}

// ZOZO の文字（太い黒の文字。どの端末でも同じ形になるよう、Z と O を線で描く）。blur=true なら後ろの淡い光
function zozoTexture(blur) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 384;
  const x = c.getContext('2d');
  if (blur) x.filter = 'blur(30px)';
  const col = blur ? '#ffffff' : '#111114';
  x.strokeStyle = col;
  x.fillStyle = col;
  const T = 52; // 線の太さ
  const top = 72;
  const h = 240;
  const w = 190;
  const gap = 34;
  const left = (1024 - (w * 4 + gap * 3)) / 2;
  for (let i = 0; i < 4; i++) {
    const x0 = left + i * (w + gap);
    if (i % 2 === 0) {
      // Z：上の横線・斜めの線・下の横線
      x.fillRect(x0, top, w, T);
      x.fillRect(x0, top + h - T, w, T);
      x.beginPath();
      x.moveTo(x0 + w - T * 1.15, top + T);
      x.lineTo(x0 + w, top + T);
      x.lineTo(x0 + T * 1.15, top + h - T);
      x.lineTo(x0, top + h - T);
      x.closePath();
      x.fill();
    } else {
      // O：太い輪
      x.lineWidth = T;
      x.beginPath();
      x.ellipse(x0 + w / 2, top + h / 2, w / 2 - T / 2, h / 2 - T / 2, 0, 0, Math.PI * 2);
      x.stroke();
    }
  }
  return canvasTexture(c);
}

// 宇宙ステーションの壁：白いパネルと手すり、丸い窓が2つ（外は星と青い地球）
function issWallTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 878;
  const x = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const wall = x.createRadialGradient(W / 2, H * 0.4, 80, W / 2, H * 0.5, W * 0.6);
  wall.addColorStop(0, '#d9dee6');
  wall.addColorStop(1, '#6f7884');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  // パネルのつなぎ目
  x.strokeStyle = 'rgba(40,50,60,0.25)';
  x.lineWidth = 4;
  for (let i = 1; i < 8; i++) {
    x.beginPath();
    x.moveTo((W / 8) * i, 0);
    x.lineTo((W / 8) * i, H);
    x.stroke();
  }
  x.beginPath();
  x.moveTo(0, H * 0.78);
  x.lineTo(W, H * 0.78);
  x.stroke();
  // 手すり（黄色）
  x.fillStyle = '#d8b23a';
  x.fillRect(120, H * 0.7, 420, 14);
  x.fillRect(W - 540, H * 0.7, 420, 14);
  // 丸い窓
  const star = (cx, cy, r) => {
    x.save();
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.clip();
    x.fillStyle = '#03050c';
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
    for (let i = 0; i < 70; i++) {
      x.fillStyle = `rgba(255,255,255,${0.4 + ((i * 37) % 60) / 100})`;
      x.fillRect(cx - r + ((i * 97) % (r * 2)), cy - r + ((i * 53) % (r * 2)), 3, 3);
    }
    // 下から見える青い地球のふち
    const earth = x.createRadialGradient(cx, cy + r * 1.9, r * 0.9, cx, cy + r * 1.9, r * 1.35);
    earth.addColorStop(0, '#2c6fd6');
    earth.addColorStop(0.85, '#5fb0ff');
    earth.addColorStop(1, 'rgba(160,220,255,0)');
    x.fillStyle = earth;
    x.beginPath();
    x.arc(cx, cy + r * 1.9, r * 1.35, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.5)';
    x.beginPath();
    x.ellipse(cx - r * 0.3, cy + r * 0.75, r * 0.25, r * 0.06, -0.2, 0, Math.PI * 2);
    x.fill();
    x.restore();
    x.strokeStyle = '#4a525e';
    x.lineWidth = 26;
    x.beginPath();
    x.arc(cx, cy, r + 13, 0, Math.PI * 2);
    x.stroke();
  };
  star(W * 0.3, H * 0.42, 190);
  star(W * 0.72, H * 0.42, 190);
  return canvasTexture(c);
}
function issFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#8a929c';
  x.fillRect(0, 0, 512, 256);
  x.strokeStyle = 'rgba(30,36,44,0.35)';
  x.lineWidth = 3;
  for (let i = 0; i <= 8; i++) {
    x.beginPath();
    x.moveTo(i * 64, 0);
    x.lineTo(i * 64, 256);
    x.stroke();
  }
  for (let j = 0; j <= 4; j++) {
    x.beginPath();
    x.moveTo(0, j * 64);
    x.lineTo(512, j * 64);
    x.stroke();
  }
  x.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) x.fillRect(i * 64 + 6, j * 64 + 6, 4, 4);
  return canvasTexture(c);
}
// ZOZOSUIT の水玉もよう（黒地に白い点）
function dotsTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#16171b';
  x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#f4f4f4';
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      x.beginPath();
      x.arc(16 + i * 32 + (j % 2) * 16, 16 + j * 32, 6, 0, Math.PI * 2);
      x.fill();
    }
  const t = canvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}
function moonTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#c9c6bd';
  x.fillRect(0, 0, 512, 256);
  for (const [cx, cy, r, a] of [[80, 70, 40, 0.25], [200, 150, 55, 0.2], [330, 60, 30, 0.3], [420, 170, 45, 0.22], [150, 40, 18, 0.3], [280, 210, 22, 0.3], [470, 60, 20, 0.3]]) {
    x.fillStyle = `rgba(90,88,84,${a})`;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
  return canvasTexture(c);
}
