import * as THREE from 'three';

// 偉人ごとの「ショー」: ステージを歩き回り、立ち止まって吹き出しでしゃべり、小物を出す。
// 設定は data.js の show: { stage?, lines: [{ text, sub?, prop?, anim? }], props?: [...] }
//   stage … 'keynote' でステージを基調講演のように暗くする。'dorm' は夜の寮の部屋。'msoffice' は初期の Microsoft の夜のオフィス。'garage' は Amazon を始めたガレージ。'studio' は Spotify を始めたストックホルムの夜のスタジオ。'iss' は前澤さんが行った国際宇宙ステーションの中（壁に ZOZO の文字）。'matsue' はまつもとさんが Ruby を育てた島根・松江の夜の書斎（壁に光る Ruby の公式ロゴ）。'spacex' は SpaceX のロケット工場の夜、'stanford' は Google を始めたスタンフォードの研究室、'gtc' は NVIDIA の基調講演、'softbank' はソフトバンクを始めた 1981 年の事務所、'openai' は OpenAI の明るい事務所（どれも壁に本物のロゴ）。'victorian' はラブレスの 1840 年代のロンドンの客間、'ias' はプリンストン高等研究所、'harvard' はホッパーの Mark II の部屋、'apollo' は 1969 年の MIT の研究室（NASA のマーク）、'bell' はベル研究所、'cern' は 1990 年の CERN（WWW のマーク）、'helsinki' はトーバルズのヘルシンキの学生部屋（Linux のペンギン）
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

  // 島根・松江の夜の書斎：木の壁と本棚、窓の外に松江城、壁で光る Ruby のロゴ
  matsue() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: matsueWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: floorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: rubyLogoTexture(false), transparent: true, depthWrite: false }));
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: rubyLogoTexture(true), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sign.position.set(1.0, 1.85, -2.47); // 吹き出しに隠れないよう、低め右寄りに
    glow.position.set(1.0, 1.85, -2.48);
    g.add(wall, floor, glow, sign);
    // 机の上の電気スタンドの明かり（左）
    const lamp = new THREE.PointLight(0xffd9a0, 2.5, 6);
    lamp.position.set(-1.8, 2.2, -1);
    g.add(lamp);
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      glow.material.opacity = 0.55 + Math.sin(t * 1.8) * 0.25;
    };
    return g;
  },

  // Ruby のプログラムを映した小さな画面（「楽しんで」のときに浮かぶ）
  rubyCode() {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.03), new THREE.MeshStandardMaterial({ color: 0x2a2b31, roughness: 0.5 }));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.36), new THREE.MeshBasicMaterial({ map: rubyCodeTexture() }));
    screen.position.z = 0.017;
    g.add(frame, screen);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x - 0.9, 1.3 + Math.sin(t * 2) * 0.04, 0.3); // 壁の Ruby のロゴと重ならないよう左側に
      p.rotation.y = 0.35 + Math.sin(t * 0.9) * 0.08;
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

  // SpaceX のロケット工場の夜：大きな窓の外に発射台と夕暮れの空、壁で光る SpaceX の文字
  spacex() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: spacexWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: concreteTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    const sign = logoPlane('assets/spacex-logo.svg', 1.9, 0.24, false);
    const glow = logoPlane('assets/spacex-logo.svg', 2.6, 0.6, true);
    sign.position.set(1.75, 1.75, -2.46); // 横に長い文字なので、人に隠れないよう右の端に
    glow.position.set(1.75, 1.75, -2.47);
    g.add(wall, floor, glow, sign);
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      glow.material.opacity = 0.5 + Math.sin(t * 1.5) * 0.25;
    };
    return g;
  },

  // ステンレスの銀のロケット（Starship）：横に出てきて、ゆっくり上がって戻る
  starship() {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xd4d8de, metalness: 0.7, roughness: 0.28 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.62, 28), steel);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), steel);
    nose.scale.y = 2;
    nose.position.y = 0.31;
    g.add(body, nose);
    for (const s of [-1, 1]) {
      // 前と後ろの小さな羽
      for (const [y, w, h] of [[-0.24, 0.07, 0.14], [0.2, 0.05, 0.09]]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), dark);
        fin.position.set(s * (0.07 + w / 2), y, 0);
        g.add(fin);
      }
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.22, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    flame.rotation.x = Math.PI;
    flame.position.y = -0.42;
    g.add(flame);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.9, 1.2 + Math.sin(t * 1.3) * 0.12, 0.3);
      p.rotation.z = Math.sin(t * 1.1) * 0.08;
      flame.scale.set(1, 0.8 + Math.sin(t * 30) * 0.2, 1);
    };
    return g;
  },

  // 火星：「火星で」のときに頭の横に浮かぶ
  mars() {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 40, 24), new THREE.MeshStandardMaterial({ map: marsTexture(), roughness: 0.9 }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.235, 32, 16), new THREE.MeshBasicMaterial({ color: 0xff8a5c, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(ball, halo);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x - 0.85, 1.35 + Math.sin(t * 2.2) * 0.05, 0.3); // 先に出たロケットと重ならないよう反対側に
      ball.rotation.y = t * 0.4;
    };
    return g;
  },

  // スタンフォードの研究室：PageRank の式とつながったページの絵のホワイトボード、壁に Google のロゴ、
  // 左に最初の Google のサーバーを入れたレゴの箱
  stanford() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: stanfordWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: floorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    const sign = logoPlane('assets/google-logo.svg', 1.4, 0.47, false);
    const glow = logoPlane('assets/google-logo.svg', 2.1, 1.0, true);
    sign.position.set(1.7, 1.8, -2.46);
    glow.position.set(1.7, 1.8, -2.47);
    g.add(wall, floor, glow, sign);
    // レゴの箱（赤・青・黄・緑のブロックを積んだ棚に、ハードディスクが並ぶ）
    const lego = new THREE.Group();
    const colors = [0xd8262e, 0x1f6fd1, 0xf5c518, 0x2e9e48];
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 3; x++) {
        const c = colors[(x + y * 2) % 4];
        const brick = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }));
        brick.position.set(-0.22 + x * 0.22, 0.06 + y * 0.24, 0);
        lego.add(brick);
        if (y < 5) {
          const disk = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.1, 0.44), new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.5, roughness: 0.4 }));
          disk.position.set(-0.22 + x * 0.22, 0.18 + y * 0.24, 0);
          lego.add(disk);
        }
      }
    }
    lego.position.set(-2.3, 0, -1.7);
    lego.rotation.y = 0.35;
    g.add(lego);
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      glow.material.opacity = 0.35 + Math.sin(t * 1.5) * 0.15;
    };
    return g;
  },

  // 検索の窓：文字が1つずつ打たれて、虫めがねが光る
  searchBox() {
    const g = new THREE.Group();
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 120;
    const tex = canvasTexture(c);
    const box = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.15), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    g.add(box);
    const word = 'IT Legends';
    let shown = -1;
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.95, 1.3 + Math.sin(t * 2) * 0.04, 0.3);
      p.rotation.y = -0.25 + Math.sin(t * 0.9) * 0.08;
      const n = Math.floor((t * 4) % (word.length + 8));
      if (n === shown) return;
      shown = n;
      const x = c.getContext('2d');
      x.clearRect(0, 0, 640, 120);
      x.fillStyle = '#ffffff';
      x.beginPath();
      x.roundRect(6, 6, 628, 108, 54);
      x.fill();
      x.strokeStyle = '#dfe1e5';
      x.lineWidth = 4;
      x.stroke();
      // 虫めがね
      x.strokeStyle = '#4285f4';
      x.lineWidth = 8;
      x.beginPath();
      x.arc(70, 54, 20, 0, Math.PI * 2);
      x.stroke();
      x.beginPath();
      x.moveTo(84, 68);
      x.lineTo(102, 86);
      x.stroke();
      x.fillStyle = '#202124';
      x.font = '44px Arial, sans-serif';
      const text = word.slice(0, Math.min(n, word.length));
      x.fillText(text, 130, 74);
      if (n <= word.length && Math.floor(t * 3) % 2 === 0) x.fillRect(132 + x.measureText(text).width, 36, 4, 50);
      tex.needsUpdate = true;
    };
    return g;
  },

  // NVIDIA の基調講演：黒に緑の回路の線、白と緑のロゴ
  gtc() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: gtcWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: stageFloorTexture(0x76b900) }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    const sign = logoPlane('assets/nvidia-logo.svg', 1.7, 0.31, false);
    const glow = logoPlane('assets/nvidia-logo.svg', 2.5, 0.8, true);
    sign.position.set(1.75, 1.8, -2.46);
    glow.position.set(1.75, 1.8, -2.47);
    g.add(wall, floor, glow, sign);
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      glow.material.opacity = 0.5 + Math.sin(t * 1.6) * 0.25;
    };
    return g;
  },

  // グラフィックボード（GPU）：2つのファンが回り、緑の線が光る
  gpu() {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.06), new THREE.MeshStandardMaterial({ color: 0x2c2e33, metalness: 0.6, roughness: 0.35 }));
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.062), new THREE.MeshBasicMaterial({ color: 0x76b900 }));
    stripe.position.y = -0.1;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.05), new THREE.MeshStandardMaterial({ color: 0x1a4a22 }));
    board.position.y = 0.13;
    g.add(shell, stripe, board);
    const fans = [];
    for (const x of [-0.15, 0.15]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 8, 32), new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.8, roughness: 0.3 }));
      ring.position.set(x, 0, 0.032);
      const fan = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.022, 0.004), new THREE.MeshStandardMaterial({ color: 0x15161a }));
        blade.position.x = 0.045;
        const arm = new THREE.Group();
        arm.rotation.z = (i / 7) * Math.PI * 2;
        blade.rotation.x = 0.4;
        arm.add(blade);
        fan.add(arm);
      }
      fan.position.set(x, 0, 0.034);
      g.add(ring, fan);
      fans.push(fan);
    }
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.95, 1.25 + Math.sin(t * 2.2) * 0.05, 0.3);
      p.rotation.y = -0.3 + Math.sin(t * 1.1) * 0.25;
      for (const f of fans) f.rotation.z = -t * 12;
    };
    return g;
  },

  // ソフトバンクを始めた 1981 年の小さな事務所：机2つ、壁にソフトバンクのロゴ、左にみかん箱
  softbank() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: softbankWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: tileFloorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    const sign = logoPlane('assets/softbank-logo.svg', 1.7, 0.28, false);
    sign.position.set(1.75, 1.85, -2.46);
    g.add(wall, floor, sign);
    // 創業の日に上に立って「いずれ1兆、2兆と数える」と話したみかん箱
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.4), [
      ...Array(4).fill(new THREE.MeshStandardMaterial({ color: 0xc69a62, roughness: 0.9 })),
      new THREE.MeshStandardMaterial({ map: mikanTexture(), roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0xc69a62, roughness: 0.9 }),
    ]);
    box.position.set(-1.9, 0.16, -1.2);
    box.rotation.y = 0.25;
    g.add(box);
    // 古い事務机（右奥）
    const steel = new THREE.MeshStandardMaterial({ color: 0x8c9198, metalness: 0.3, roughness: 0.6 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.65), new THREE.MeshStandardMaterial({ color: 0x5f7064, roughness: 0.7 }));
    top.position.set(2.4, 0.74, -1.9);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.6), steel);
    body.position.set(2.82, 0.36, -1.9);
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.16), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5 }));
    phone.position.set(2.1, 0.81, -1.85);
    g.add(top, body, phone);
    g.renderOrder = -1;
    return g;
  },

  // OpenAI の事務所：明るい木の壁と植物、壁の大きな画面に話しかけるだけの AI、黒い OpenAI のロゴ
  openai() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: openaiWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: lightWoodFloorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    const sign = logoPlane('assets/openai-logo.svg', 0.62, 0.62, false);
    sign.position.set(1.6, 1.9, -2.46);
    g.add(wall, floor, sign);
    // 鉢植え（左右）
    for (const [x, z, s] of [[-2.4, -1.8, 1], [2.5, -1.6, 0.8]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.14 * s, 0.34 * s, 20), new THREE.MeshStandardMaterial({ color: 0xece6dc, roughness: 0.8 }));
      pot.position.set(x, 0.17 * s, z);
      g.add(pot);
      for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 10, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x4f8a4a : 0x3d7440, roughness: 0.8 }));
        const a = (i / 7) * Math.PI * 2;
        leaf.scale.set(0.6, 1.3, 0.3);
        leaf.position.set(x + Math.cos(a) * 0.12 * s, (0.55 + (i % 3) * 0.12) * s, z + Math.sin(a) * 0.12 * s);
        leaf.rotation.z = Math.cos(a) * 0.5;
        g.add(leaf);
      }
    }
    g.renderOrder = -1;
    return g;
  },

  // 話しかけるだけの AI の画面：質問のあとに、答えが1文字ずつ出てくる
  chat() {
    const g = new THREE.Group();
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 360;
    const tex = canvasTexture(c);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.47, 0.03), new THREE.MeshStandardMaterial({ color: 0x1d1e22, roughness: 0.5 }));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.43), new THREE.MeshBasicMaterial({ map: tex }));
    screen.position.z = 0.017;
    g.add(frame, screen);
    const answer = 'はい、よろこんで。何から始めますか？';
    let shown = -1;
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.95, 1.3 + Math.sin(t * 2) * 0.04, 0.3);
      p.rotation.y = -0.3 + Math.sin(t * 0.9) * 0.08;
      const n = Math.floor((t * 6) % (answer.length + 18));
      if (n === shown) return;
      shown = n;
      const x = c.getContext('2d');
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, 512, 360);
      x.font = '26px sans-serif';
      // 自分の質問（右の灰色の吹き出し）
      x.fillStyle = '#ececf1';
      x.beginPath();
      x.roundRect(170, 30, 312, 60, 28);
      x.fill();
      x.fillStyle = '#202123';
      x.fillText('会社を手伝って！', 198, 70);
      // AI の答え（左に黒い印と文字）
      x.fillStyle = '#202123';
      x.beginPath();
      x.arc(50, 140, 18, 0, Math.PI * 2);
      x.fill();
      const text = answer.slice(0, Math.min(n, answer.length));
      x.fillText(text.slice(0, 11), 84, 150);
      x.fillText(text.slice(11), 84, 192);
      // 下の入力欄
      x.strokeStyle = '#d9d9e3';
      x.lineWidth = 3;
      x.beginPath();
      x.roundRect(30, 280, 452, 56, 28);
      x.stroke();
      tex.needsUpdate = true;
    };
    return g;
  },

  // 1840 年代のロンドンの夜の客間：ろうそくの明かり、壁紙と額縁、左にバベッジの階差機関（真ちゅうの歯車の柱）
  victorian() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: victorianWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: floorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    g.add(wall, floor);
    // 歯車の柱：真ちゅうの円盤を縦に重ねた列が3本、ゆっくり回る
    const brass = new THREE.MeshStandardMaterial({ color: 0xc89b45, metalness: 0.8, roughness: 0.3 });
    const engine = new THREE.Group();
    const cols = [];
    for (let k = 0; k < 3; k++) {
      const col = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 18), brass);
        wheel.position.y = 0.3 + i * 0.16;
        col.add(wheel);
      }
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 8), brass);
      axle.position.y = 0.8;
      col.add(axle);
      col.position.x = (k - 1) * 0.3;
      engine.add(col);
      cols.push(col);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.7 }));
    base.position.y = 0.1;
    const top = base.clone();
    top.position.y = 1.5;
    top.scale.set(1, 0.4, 1);
    engine.add(base, top);
    engine.position.set(-2.2, 0, -1.7);
    engine.rotation.y = 0.35;
    // ろうそくの明かり
    const candle = new THREE.PointLight(0xffb060, 2.6, 6);
    candle.position.set(1.9, 1.6, -1.2);
    g.add(engine, candle);
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      cols.forEach((c, i) => (c.rotation.y = t * (0.4 + i * 0.15) * (i % 2 ? -1 : 1)));
      candle.intensity = 2.4 + Math.sin(t * 13) * 0.15 + Math.sin(t * 7.3) * 0.15;
    };
    return g;
  },

  // ジャカード織機のパンチカード（穴の空いたカードがつながって流れる）
  punchCards() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ map: punchCardTexture(), roughness: 0.9, side: THREE.DoubleSide });
    const cards = [];
    for (let i = 0; i < 5; i++) {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), mat);
      g.add(card);
      cards.push(card);
    }
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.95, 1.25, 0.3);
      cards.forEach((c, i) => {
        const a = t * 0.8 + i * 0.5;
        c.position.set(0, Math.sin(a) * 0.3, Math.cos(a) * 0.12);
        c.rotation.x = -a;
      });
    };
    return g;
  },

  // 音符：「音楽さえ」のときに頭の横で踊る
  notes() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
    const items = [];
    for (let i = 0; i < 3; i++) {
      const n = new THREE.Group();
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), mat);
      head.scale.set(1.3, 1, 0.6);
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.14, 0.008), mat);
      stem.position.set(0.04, 0.07, 0);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.008), mat);
      flag.position.set(0.06, 0.135, 0);
      flag.rotation.z = -0.5;
      n.add(head, stem, flag);
      g.add(n);
      items.push(n);
    }
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x - 0.85, 1.3, 0.3);
      items.forEach((n, i) => {
        n.position.set((i - 1) * 0.18, Math.sin(t * 2.4 + i * 1.3) * 0.1 + i * 0.05, 0);
        n.rotation.z = Math.sin(t * 3 + i) * 0.3;
      });
    };
    return g;
  },

  // プリンストン高等研究所：黒板に式、左に真空管が光る IAS マシン
  ias() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: iasWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: floorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    g.add(wall, floor);
    const machine = new THREE.Group();
    const lights = [];
    for (let k = 0; k < 2; k++) {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.45), new THREE.MeshStandardMaterial({ color: 0x3c4148, metalness: 0.4, roughness: 0.5 }));
      cab.position.set(k * 0.64, 0.9, 0);
      machine.add(cab);
      for (let i = 0; i < 18; i++) {
        const tube = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff9a3c }));
        tube.position.set(k * 0.64 - 0.2 + (i % 3) * 0.2, 0.4 + Math.floor(i / 3) * 0.22, 0.23);
        machine.add(tube);
        lights.push(tube);
      }
    }
    machine.position.set(-2.5, 0, -1.8);
    machine.rotation.y = 0.35;
    g.add(machine);
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      lights.forEach((l, i) => l.material.color.setHex(Math.sin(t * 3 + i * 1.7) > 0.2 ? 0xffb35c : 0x5a2a10));
    };
    return g;
  },

  // トランプ（ゲーム理論）：扇のように広がってゆっくり回る
  cards() {
    const g = new THREE.Group();
    const back = new THREE.MeshStandardMaterial({ color: 0x9a2a2a, roughness: 0.6 });
    const faces = ['A', 'K', 'Q'].map((r, i) => new THREE.MeshStandardMaterial({ map: cardTexture(r, i === 1 ? '♥' : '♠'), roughness: 0.6 }));
    const items = faces.map((f) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.004), [back, back, back, back, f, back]);
      g.add(c);
      return c;
    });
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.9, 1.25 + Math.sin(t * 2) * 0.04, 0.3);
      p.rotation.y = -0.3 + Math.sin(t * 0.9) * 0.2;
      items.forEach((c, i) => {
        c.rotation.z = (1 - i) * 0.35;
        c.position.set((i - 1) * 0.07, -Math.abs(i - 1) * 0.02, i * 0.006);
      });
    };
    return g;
  },

  // ハーバード大学の Mark II の部屋：リレーの並んだ灰色の盤、壁に「最初のバグ」の蛾を貼った記録のページ
  harvard() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: harvardWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: tileFloorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    g.add(wall, floor);
    g.renderOrder = -1;
    return g;
  },

  // 1ナノ秒の電線（光が1ナノ秒に進む約30cm。ホッパーが講演でいつも配っていた）
  nanosecond() {
    const g = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([-0.3, -0.15, 0, 0.15, 0.3].map((x, i) => new THREE.Vector3(x, Math.sin(i * 1.4) * 0.03, 0)));
    const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.008, 8), new THREE.MeshStandardMaterial({ color: 0x3a7bd5, roughness: 0.4 }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
    g.add(wire, glow);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.9, 1.3 + Math.sin(t * 2) * 0.04, 0.3);
      p.rotation.z = Math.sin(t * 1.2) * 0.15;
      glow.position.copy(curve.getPoint((t * 0.8) % 1)); // 光が線の上を走る
    };
    return g;
  },

  // 1969 年の MIT の研究室：窓の外に月、壁に NASA のマーク、横に自分の背と同じ高さのプログラムの紙の山
  apollo() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: apolloWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: tileFloorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    const sign = logoPlane('assets/nasa-logo.svg', 0.85, 0.71, false);
    sign.position.set(1.7, 1.9, -2.46);
    g.add(wall, floor, sign);
    // プログラムを印刷した紙の束を積んだ山（アポロのソフトの有名な写真）
    const stack = new THREE.Group();
    let y = 0;
    for (let i = 0; i < 16; i++) {
      const h = 0.06 + ((i * 7) % 5) * 0.012;
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.42, h, 0.32), new THREE.MeshStandardMaterial({ color: i % 3 ? 0xf1ece0 : 0xe2dccb, roughness: 0.9 }));
      book.position.set(Math.sin(i * 2.1) * 0.015, y + h / 2, 0);
      book.rotation.y = Math.sin(i * 1.7) * 0.06;
      stack.add(book);
      y += h;
    }
    stack.position.set(-1.6, 0, -0.9);
    g.add(stack);
    g.renderOrder = -1;
    return g;
  },

  // 月着陸船（イーグル）：「1202」のときに横に浮かんで、ゆっくり降りる
  eagle() {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xd9a63a, metalness: 0.7, roughness: 0.35 });
    const gray = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.4, roughness: 0.5 });
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8), gold);
    const upper = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), gray);
    upper.position.y = 0.12;
    upper.scale.set(1.1, 0.8, 1);
    g.add(lower, upper);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 6), gray);
      leg.position.set(Math.cos(a) * 0.15, -0.09, Math.sin(a) * 0.15);
      leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.008, 10), gray);
      pad.position.set(Math.cos(a) * 0.2, -0.17, Math.sin(a) * 0.2);
      g.add(leg, pad);
    }
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.9, 1.25 + Math.sin(t * 0.9) * 0.1, 0.3);
      p.rotation.y = t * 0.5;
    };
    return g;
  },

  // ベル研究所の夜：PDP-11 の棚、壁に UNIX のディレクトリの木の図と光る C のマーク
  bell() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: bellWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: floorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    const sign = logoPlane('assets/c-logo.png', 0.8, 0.8, false);
    const glow = logoPlane('assets/c-logo.png', 1.3, 1.3, true);
    sign.position.set(1.75, 1.85, -2.46);
    glow.position.set(1.75, 1.85, -2.47);
    g.add(wall, floor, glow, sign);
    // PDP-11 の棚（左）：点滅するランプの列
    const rack = new THREE.Group();
    const lamps = [];
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.7, 0.5), new THREE.MeshStandardMaterial({ color: 0xd9d4c4, roughness: 0.6 }));
    cab.position.y = 0.85;
    rack.add(cab);
    for (const [y, c] of [[1.45, 0x9b2335], [1.25, 0x7a3a8a]]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.16, 0.02), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
      panel.position.set(0, y, 0.26);
      rack.add(panel);
      for (let i = 0; i < 9; i++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
        l.position.set(-0.28 + i * 0.07, y + 0.04, 0.275);
        rack.add(l);
        lamps.push(l);
      }
    }
    rack.position.set(-2.4, 0, -1.7);
    rack.rotation.y = 0.35;
    g.add(rack);
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      glow.material.opacity = 0.4 + Math.sin(t * 1.6) * 0.2;
      lamps.forEach((l, i) => (l.visible = Math.sin(t * 4 + i * 2.3) > -0.2));
    };
    return g;
  },

  // C のプログラム（hello, world）を映した画面
  helloC() {
    return codeScreen(
      [
        [['#include ', '#c792ea'], ['<stdio.h>', '#7ec97a']],
        [['main', '#82aaff'], ['() {', '#e8e8ee']],
        [['  printf', '#82aaff'], ['("hello, world\\n");', '#7ec97a']],
        [['}', '#e8e8ee']],
      ],
      -0.9,
    );
  },

  // 『プログラミング言語C』の本（白い表紙に青い大きな C）
  krBook() {
    const g = new THREE.Group();
    const side = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.8 });
    const cover = new THREE.MeshStandardMaterial({ map: krCoverTexture(), roughness: 0.8 });
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.05), [side, side, side, side, cover, side]);
    g.add(book);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.9, 1.25 + Math.sin(t * 2.2) * 0.05, 0.3);
      p.rotation.y = -0.4 + Math.sin(t * 1.1) * 0.3;
    };
    return g;
  },

  // CERN の 1990 年の事務所：窓の外にジュラの山、壁で光る WWW のマーク、机の上に黒い NeXT のパソコン
  cern() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: cernWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: floorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    const sign = logoPlane('assets/www-logo.svg', 1.0, 0.74, false);
    const glow = logoPlane('assets/www-logo.svg', 1.6, 1.3, true);
    sign.position.set(1.75, 1.85, -2.46);
    glow.position.set(1.75, 1.85, -2.47);
    g.add(wall, floor, glow, sign);
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      glow.material.opacity = 0.45 + Math.sin(t * 1.5) * 0.2;
    };
    return g;
  },

  // 世界最初の Web サーバーの NeXT（黒い立方体）と「電源を切らないで」の張り紙
  nextCube() {
    const g = new THREE.Group();
    const black = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.5, metalness: 0.2 });
    const face = new THREE.MeshStandardMaterial({ map: serverNoteTexture(), roughness: 0.6 });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), [black, black, black, black, face, black]);
    g.add(cube);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x + 0.9, 1.2 + Math.sin(t * 2) * 0.04, 0.3);
      p.rotation.y = -0.35 + Math.sin(t * 0.9) * 0.25;
      p.rotation.x = 0.1;
    };
    return g;
  },

  // ヘルシンキの冬の夜の学生部屋：雪の窓、古いパソコン、壁にペンギンの Tux（Linux のマスコット）
  helsinki() {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ map: helsinkiWallTexture() }));
    wall.position.set(0, 3, -2.5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: floorTexture() }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    const tux = logoPlane('assets/tux.svg', 0.7, 0.83, false);
    tux.position.set(1.75, 1.8, -2.46);
    g.add(wall, floor, tux);
    // 窓の外で降る雪
    const snow = [];
    const flake = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 30; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 4), flake);
      s.userData.seed = i;
      g.add(s);
      snow.push(s);
    }
    g.renderOrder = -1;
    g.userData.animate = (p, t) => {
      for (const s of snow) {
        const k = s.userData.seed;
        s.position.set(-2.55 + ((k * 0.137) % 1) * 1.5 + Math.sin(t + k) * 0.04, 2.75 - ((t * 0.25 + k * 0.071) % 1) * 1.3, -2.44);
      }
    };
    return g;
  },

  // Linux の画面（黒い画面に緑の文字。1991 年の最初の発表）
  linuxTerm() {
    return codeScreen(
      [
        [['$ ', '#7ec97a'], ['uname -a', '#e8e8ee']],
        [['Linux 0.01', '#e8e8ee']],
        [['"just a hobby,', '#f0b93a']],
        [[" won't be big\"", '#f0b93a']],
      ],
      0.9,
    );
  },

  // Git のマーク（白い札）と枝分かれするつながり
  gitTree() {
    const g = new THREE.Group();
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.36), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const logo = logoPlane('assets/git-logo.svg', 0.46, 0.2, false);
    logo.position.set(0, 0.06, 0.002);
    g.add(card, logo);
    // 枝分かれ（下の段）
    const orange = new THREE.MeshBasicMaterial({ color: 0xf05133 });
    for (const [x, y] of [[-0.18, -0.1], [-0.06, -0.1], [0.06, -0.1], [0.18, -0.1], [0, -0.15]]) {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), orange);
      dot.position.set(x, y, 0.003);
      g.add(dot);
    }
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.006), orange);
    line.position.set(0, -0.1, 0.0025);
    g.add(line);
    g.userData.animate = (p, t, o) => {
      p.position.set(o.position.x - 0.9, 1.3 + Math.sin(t * 2) * 0.04, 0.3);
      p.rotation.y = 0.35 + Math.sin(t * 0.9) * 0.08;
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

// 松江の夜の書斎の壁：木の板、左に本棚、右上の窓の外に松江城の影と月
function matsueWallTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 878;
  const x = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  const wall = x.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H * 0.5, W * 0.55);
  wall.addColorStop(0, '#5a4535');
  wall.addColorStop(1, '#1e1610');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  // 縦の木の板
  x.strokeStyle = 'rgba(0,0,0,0.18)';
  x.lineWidth = 3;
  for (let i = 1; i < 26; i++) {
    x.beginPath();
    x.moveTo(i * 80, 0);
    x.lineTo(i * 80, H);
    x.stroke();
  }
  // 本棚（左）
  x.fillStyle = '#3a2a1e';
  x.fillRect(260, 120, 420, 560);
  const colors = ['#b3262e', '#2d5a8a', '#d9c08f', '#3f7a4a', '#7a3a6a', '#c9822c', '#e8e2d4'];
  for (let r = 0; r < 4; r++) {
    x.fillStyle = '#2a1d14';
    x.fillRect(260, 120 + r * 140 + 126, 420, 14);
    let bx = 280;
    let k = r * 3;
    while (bx < 650) {
      const bw = 18 + ((k * 13) % 22);
      const bh = 90 + ((k * 29) % 30);
      x.fillStyle = colors[k % colors.length];
      x.fillRect(bx, 120 + r * 140 + 126 - bh, bw, bh);
      bx += bw + 3;
      k++;
    }
  }
  // 窓（右上）：夜空に月と松江城の影
  const wx = 1420;
  const wy = 140;
  const ww = 380;
  const wh = 280;
  x.fillStyle = '#132242';
  x.fillRect(wx, wy, ww, wh);
  x.fillStyle = '#fff3c4';
  x.beginPath();
  x.arc(wx + 300, wy + 70, 28, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#070d1c';
  // 石垣・天守（屋根を重ねた形）
  const cx = wx + 150;
  const base = wy + wh;
  x.fillRect(cx - 90, base - 40, 180, 40);
  for (const [w, y0, h] of [[150, 40, 34], [120, 74, 30], [90, 104, 28], [60, 132, 26]]) {
    x.fillRect(cx - w / 2 + 12, base - y0 - h + 8, w - 24, h);
    x.beginPath();
    x.moveTo(cx - w / 2 - 8, base - y0 + 2);
    x.lineTo(cx + w / 2 + 8, base - y0 + 2);
    x.lineTo(cx + w / 2 - 14, base - y0 - 12);
    x.lineTo(cx - w / 2 + 14, base - y0 - 12);
    x.closePath();
    x.fill();
  }
  x.strokeStyle = '#2a1d14';
  x.lineWidth = 14;
  x.strokeRect(wx, wy, ww, wh);
  x.beginPath();
  x.moveTo(wx + ww / 2, wy);
  x.lineTo(wx + ww / 2, wy + wh);
  x.stroke();
  x.fillStyle = 'rgba(8,10,20,0.22)';
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}
// Ruby のロゴ（公式の赤い宝石、assets/ruby-logo.svg）。読み込めたら描く。blur=true なら後光用のぼかし
function rubyLogoTexture(blur) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const tex = canvasTexture(c);
  const img = new Image();
  img.onload = () => {
    const x = c.getContext('2d');
    if (blur) x.filter = 'blur(36px) brightness(1.4)';
    x.drawImage(img, 56, 56, 400, 400);
    tex.needsUpdate = true;
  };
  img.src = 'assets/ruby-logo.svg';
  return tex;
}
// Ruby のプログラムの画面（黒い画面に色付きの文字）
function rubyCodeTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 330;
  const x = c.getContext('2d');
  x.fillStyle = '#1b1c22';
  x.fillRect(0, 0, 512, 330);
  x.font = 'bold 34px Menlo, Consolas, monospace';
  const lines = [
    [['5', '#f0b93a'], ['.times do', '#e8e8ee']],
    [['  puts ', '#e8e8ee'], ['"Happy!"', '#7ec97a']],
    [['end', '#ff6b70']],
  ];
  lines.forEach((parts, i) => {
    let px = 36;
    for (const [t, col] of parts) {
      x.fillStyle = col;
      x.fillText(t, px, 90 + i * 70);
      px += x.measureText(t).width;
    }
  });
  return canvasTexture(c);
}

// 本物のロゴ（assets の SVG）を貼った板。読み込めたら描く。blur=true なら後光用のぼかし
function logoPlane(src, w, h, blur) {
  const c = document.createElement('canvas');
  const k = 1024 / Math.max(w, h);
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const tex = canvasTexture(c);
  const img = new Image();
  img.onload = () => {
    const x = c.getContext('2d');
    const pad = blur ? 0.22 : 0.02;
    const bw = c.width * (1 - pad * 2);
    const bh = c.height * (1 - pad * 2);
    const s = Math.min(bw / img.width, bh / img.height);
    if (blur) x.filter = 'blur(30px) brightness(1.4)';
    x.drawImage(img, (c.width - img.width * s) / 2, (c.height - img.height * s) / 2, img.width * s, img.height * s);
    tex.needsUpdate = true;
  };
  img.src = src;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  if (blur) mat.blending = THREE.AdditiveBlending;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

// 壁の絵はカメラに映る下半分（床から高さ3くらいまで）に寄せる。ここから先に描くものを縮めて下げる
function inView(x, W) {
  const k = 0.62;
  x.setTransform(k, 0, 0, k, (W / 2) * (1 - k), 440 - 100 * k);
}

function wallCanvas() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 878;
  return [c, c.getContext('2d'), c.width, c.height];
}

// SpaceX の工場の壁：鉄の柱と大きな窓、外は夕暮れの空と発射台に立つ銀のロケット、星
function spacexWallTexture() {
  const [c, x, W, H] = wallCanvas();
  x.fillStyle = '#15181d';
  x.fillRect(0, 0, W, H);
  // 窓の外（真ん中から右に大きく）
  const wx = 260;
  const wy = 90;
  const ww = 1500;
  const wh = 560;
  const sky = x.createLinearGradient(0, wy, 0, wy + wh);
  sky.addColorStop(0, '#0b1230');
  sky.addColorStop(0.6, '#3a2a55');
  sky.addColorStop(0.9, '#d9734a');
  sky.addColorStop(1, '#f2a35c');
  x.fillStyle = sky;
  x.fillRect(wx, wy, ww, wh);
  x.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 70; i++) x.fillRect(wx + ((i * 197) % ww), wy + ((i * 83) % (wh * 0.5)), 3, 3);
  // 地面と発射台の塔
  x.fillStyle = '#0a0b0e';
  x.fillRect(wx, wy + wh - 40, ww, 40);
  const tx = wx + 330;
  x.fillRect(tx, wy + 120, 40, wh - 160);
  x.strokeStyle = '#0a0b0e';
  x.lineWidth = 5;
  for (let y = wy + 140; y < wy + wh - 40; y += 40) {
    x.beginPath();
    x.moveTo(tx - 30, y);
    x.lineTo(tx + 70, y + 40);
    x.stroke();
  }
  // 銀のロケット
  const rx = tx + 90;
  const rocket = x.createLinearGradient(rx, 0, rx + 70, 0);
  rocket.addColorStop(0, '#6b7079');
  rocket.addColorStop(0.45, '#e6e9ee');
  rocket.addColorStop(1, '#7d828b');
  x.fillStyle = rocket;
  x.fillRect(rx, wy + 150, 70, wh - 190);
  x.beginPath();
  x.moveTo(rx, wy + 152);
  x.quadraticCurveTo(rx + 35, wy + 40, rx + 70, wy + 152);
  x.fill();
  // 鉄の柱と窓わく
  x.strokeStyle = '#2a2e35';
  x.lineWidth = 26;
  x.strokeRect(wx, wy, ww, wh);
  for (let i = 1; i < 5; i++) {
    x.beginPath();
    x.moveTo(wx + (ww / 5) * i, wy);
    x.lineTo(wx + (ww / 5) * i, wy + wh);
    x.stroke();
  }
  x.fillStyle = 'rgba(5,6,12,0.35)';
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}

// 火星（赤茶のまだらと白い極冠）
function marsTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#c1562e';
  x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 60; i++) {
    x.fillStyle = i % 3 ? 'rgba(120,40,20,0.35)' : 'rgba(230,140,90,0.3)';
    x.beginPath();
    x.ellipse((i * 137) % 512, 40 + ((i * 59) % 180), 20 + (i % 5) * 9, 8 + (i % 4) * 5, 0, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = 'rgba(255,255,255,0.85)';
  x.fillRect(0, 0, 512, 14);
  x.fillRect(0, 244, 512, 12);
  return canvasTexture(c);
}

// スタンフォードの研究室の壁：明るめの灰色、PageRank の式とページのつながりのホワイトボード
function stanfordWallTexture() {
  const [c, x, W, H] = wallCanvas();
  const wall = x.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H * 0.5, W * 0.55);
  wall.addColorStop(0, '#5b6270');
  wall.addColorStop(1, '#262a33');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  inView(x, W);
  // ホワイトボード（左）
  const bx = 300;
  const by = 130;
  x.fillStyle = '#eef0f2';
  x.fillRect(bx, by, 640, 400);
  x.strokeStyle = '#9aa0a8';
  x.lineWidth = 12;
  x.strokeRect(bx, by, 640, 400);
  // ページ（丸）と矢印
  const nodes = [[420, 260], [560, 200], [700, 290], [520, 400], [820, 420], [650, 450]];
  x.strokeStyle = '#2a5bd7';
  x.lineWidth = 5;
  for (const [a, b] of [[0, 1], [1, 2], [0, 3], [3, 2], [2, 4], [3, 5], [5, 2], [4, 1]]) {
    x.beginPath();
    x.moveTo(...nodes[a]);
    x.lineTo(...nodes[b]);
    x.stroke();
  }
  nodes.forEach(([nx, ny], i) => {
    x.fillStyle = i === 2 ? '#d93025' : '#2a5bd7';
    x.beginPath();
    x.arc(nx, ny, i === 2 ? 30 : 18, 0, Math.PI * 2);
    x.fill();
  });
  x.fillStyle = '#202124';
  x.font = 'italic 40px Georgia, serif';
  x.fillText('PR(A) = (1-d) + d Σ PR(T)/C(T)', bx + 30, by + 70);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = 'rgba(8,10,20,0.15)';
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}

// NVIDIA の基調講演の壁：黒に緑の回路の線と光る点
function gtcWallTexture() {
  const [c, x, W, H] = wallCanvas();
  const bg = x.createRadialGradient(W * 0.55, H * 0.45, 40, W / 2, H / 2, W * 0.6);
  bg.addColorStop(0, '#16210f');
  bg.addColorStop(1, '#040504');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  x.lineWidth = 3;
  for (let i = 0; i < 46; i++) {
    const y0 = 40 + ((i * 113) % (H - 80));
    let px = (i * 211) % W;
    let py = y0;
    x.strokeStyle = `rgba(118,185,0,${0.15 + (i % 4) * 0.08})`;
    x.beginPath();
    x.moveTo(px, py);
    for (let k = 0; k < 4; k++) {
      px += 60 + ((i + k) * 37) % 120;
      x.lineTo(px, py);
      py += (k % 2 ? -1 : 1) * 40;
      x.lineTo(px + 40, py);
      px += 40;
    }
    x.stroke();
    x.fillStyle = 'rgba(160,230,40,0.7)';
    x.beginPath();
    x.arc(px, py, 6, 0, Math.PI * 2);
    x.fill();
  }
  return canvasTexture(c);
}

// 暗い舞台の床：手前にうっすら色の光
function stageFloorTexture(color) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#0b0c0e';
  x.fillRect(0, 0, 1024, 512);
  const hex = `#${color.toString(16).padStart(6, '0')}`;
  const g = x.createRadialGradient(512, 160, 20, 512, 200, 520);
  g.addColorStop(0, `${hex}44`);
  g.addColorStop(1, '#00000000');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 512);
  return canvasTexture(c);
}

// 1981 年の事務所の壁：クリーム色の壁、窓の外に昼の街、カレンダー
function softbankWallTexture() {
  const [c, x, W, H] = wallCanvas();
  const wall = x.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H * 0.5, W * 0.6);
  wall.addColorStop(0, '#efe7d4');
  wall.addColorStop(1, '#a89c84');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  // 腰の高さの板
  x.fillStyle = '#8a7a62';
  x.fillRect(0, H - 170, W, 170);
  inView(x, W);
  // 窓（左）：昼の空と低いビル
  const wx = 260;
  const wy = 150;
  x.fillStyle = '#9cc8ea';
  x.fillRect(wx, wy, 520, 330);
  x.fillStyle = '#7d8a96';
  for (let i = 0; i < 7; i++) x.fillRect(wx + i * 76, wy + 180 - ((i * 47) % 90), 64, 150 + ((i * 47) % 90));
  x.strokeStyle = '#d9d2c2';
  x.lineWidth = 16;
  x.strokeRect(wx, wy, 520, 330);
  x.beginPath();
  x.moveTo(wx + 260, wy);
  x.lineTo(wx + 260, wy + 330);
  x.stroke();
  // 1981 のカレンダー（右）
  x.fillStyle = '#ffffff';
  x.fillRect(1700, 180, 180, 230);
  x.fillStyle = '#c0392b';
  x.fillRect(1700, 180, 180, 50);
  x.fillStyle = '#ffffff';
  x.font = 'bold 36px sans-serif';
  x.fillText('1981', 1752, 220);
  x.fillStyle = '#555';
  for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) x.fillRect(1716 + k * 27, 250 + r * 30, 16, 14);
  return canvasTexture(c);
}

// 事務所の床：くすんだ緑と灰色のタイル
function tileFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    for (let k = 0; k < 8; k++) {
      x.fillStyle = (i + k) % 2 ? '#8f978c' : '#a6ab9f';
      x.fillRect(i * 64, k * 64, 64, 64);
    }
  }
  const shade = x.createLinearGradient(0, 0, 0, 512);
  shade.addColorStop(0, 'rgba(20,20,15,0.45)');
  shade.addColorStop(1, 'rgba(20,20,15,0.05)');
  x.fillStyle = shade;
  x.fillRect(0, 0, 1024, 512);
  return canvasTexture(c);
}

// みかん箱の横の絵（だいだい色のみかんと文字）
function mikanTexture() {
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 208;
  const x = c.getContext('2d');
  x.fillStyle = '#c69a62';
  x.fillRect(0, 0, 384, 208);
  x.fillStyle = '#f08a1c';
  x.beginPath();
  x.arc(110, 104, 56, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#3f7a2a';
  x.beginPath();
  x.ellipse(126, 50, 22, 10, -0.5, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#8a3a12';
  x.font = 'bold 64px sans-serif';
  x.fillText('みかん', 180, 126);
  return canvasTexture(c);
}

// OpenAI の事務所の壁：明るい木の板、右に大きな窓（昼のサンフランシスコの丘）
function openaiWallTexture() {
  const [c, x, W, H] = wallCanvas();
  const wall = x.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#d8c3a5');
  wall.addColorStop(1, '#a88d6c');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(90,60,30,0.18)';
  x.lineWidth = 3;
  for (let i = 1; i < 40; i++) {
    x.beginPath();
    x.moveTo(i * 52, 0);
    x.lineTo(i * 52, H);
    x.stroke();
  }
  inView(x, W);
  // 窓（左）
  const wx = 240;
  const wy = 140;
  const sky = x.createLinearGradient(0, wy, 0, wy + 360);
  sky.addColorStop(0, '#bcd8ec');
  sky.addColorStop(1, '#f2e6d2');
  x.fillStyle = sky;
  x.fillRect(wx, wy, 620, 360);
  x.fillStyle = '#8fa48c';
  x.beginPath();
  x.moveTo(wx, wy + 360);
  x.quadraticCurveTo(wx + 200, wy + 210, wx + 380, wy + 300);
  x.quadraticCurveTo(wx + 520, wy + 240, wx + 620, wy + 280);
  x.lineTo(wx + 620, wy + 360);
  x.fill();
  x.strokeStyle = '#3a3a3a';
  x.lineWidth = 10;
  x.strokeRect(wx, wy, 620, 360);
  x.beginPath();
  x.moveTo(wx + 310, wy);
  x.lineTo(wx + 310, wy + 360);
  x.stroke();
  x.setTransform(1, 0, 0, 1, 0, 0);
  // ロゴの後ろの白い丸い札（黒いロゴが見えるように）
  x.fillStyle = 'rgba(250,247,240,0.92)';
  x.beginPath();
  x.arc(W * 0.5 + 1.6 * (W / 14), H - 1.9 * (H / 6), 120, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = 'rgba(10,8,5,0.12)';
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}

// 明るい木の床
function lightWoodFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d');
  const n = 16;
  for (let i = 0; i < n; i++) {
    x.fillStyle = `hsl(32, 35%, ${52 + ((i * 37) % 9)}%)`;
    x.fillRect((i * c.width) / n, 0, c.width / n, c.height);
    x.fillStyle = 'rgba(0,0,0,0.15)';
    x.fillRect((i * c.width) / n, 0, 2, c.height);
  }
  const shade = x.createLinearGradient(0, 0, 0, c.height);
  shade.addColorStop(0, 'rgba(30,20,10,0.4)');
  shade.addColorStop(1, 'rgba(30,20,10,0.05)');
  x.fillStyle = shade;
  x.fillRect(0, 0, c.width, c.height);
  return canvasTexture(c);
}

// 黒い画面に色付きの文字のプログラム。side は人から見て左右どちらに浮かぶか（-なら左）
function codeScreen(lines, side) {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 330;
  const x = c.getContext('2d');
  x.fillStyle = '#16171c';
  x.fillRect(0, 0, 512, 330);
  x.font = 'bold 28px Menlo, Consolas, monospace';
  lines.forEach((parts, i) => {
    let px = 28;
    for (const [t, col] of parts) {
      x.fillStyle = col;
      x.fillText(t, px, 70 + i * 62);
      px += x.measureText(t).width;
    }
  });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.03), new THREE.MeshStandardMaterial({ color: 0x2a2b31, roughness: 0.5 }));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.36), new THREE.MeshBasicMaterial({ map: canvasTexture(c) }));
  screen.position.z = 0.017;
  g.add(frame, screen);
  g.userData.animate = (p, t, o) => {
    p.position.set(o.position.x + side, 1.3 + Math.sin(t * 2) * 0.04, 0.3);
    p.rotation.y = -Math.sign(side) * 0.35 + Math.sin(t * 0.9) * 0.08;
  };
  return g;
}

// 1840 年代の客間の壁：深い緑の模様の壁紙、金の額縁の肖像、右に暖炉の明かり
function victorianWallTexture() {
  const [c, x, W, H] = wallCanvas();
  x.fillStyle = '#23342c';
  x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(200,170,90,0.10)';
  for (let r = 0; r < 12; r++) {
    for (let k = 0; k < 28; k++) {
      x.beginPath();
      x.ellipse(k * 76 + (r % 2) * 38, r * 76 + 30, 10, 20, 0, 0, Math.PI * 2);
      x.fill();
    }
  }
  // 腰板
  x.fillStyle = '#3b2618';
  x.fillRect(0, H - 200, W, 200);
  inView(x, W);
  // 金の額縁（左）：解析機関の図面
  x.fillStyle = '#b8903f';
  x.fillRect(520, 170, 380, 290);
  x.fillStyle = '#efe4c8';
  x.fillRect(545, 195, 330, 240);
  x.strokeStyle = '#6b5a3a';
  x.lineWidth = 3;
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < 5; i++) {
      x.beginPath();
      x.arc(600 + k * 72, 240 + i * 40, 14, 0, Math.PI * 2);
      x.stroke();
    }
  }
  // 窓（右寄り）：夜のロンドンと月
  x.fillStyle = '#0d1426';
  x.fillRect(1500, 160, 260, 340);
  x.fillStyle = '#f3e7b8';
  x.beginPath();
  x.arc(1690, 220, 22, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = '#3b2618';
  x.lineWidth = 14;
  x.strokeRect(1500, 160, 260, 340);
  x.fillStyle = '#5a1e22';
  x.fillRect(1460, 140, 50, 400);
  x.fillRect(1750, 140, 50, 400);
  x.setTransform(1, 0, 0, 1, 0, 0);
  // ろうそくの明かりのにじみ
  const glow = x.createRadialGradient(W * 0.64, H * 0.55, 10, W * 0.64, H * 0.55, 600);
  glow.addColorStop(0, 'rgba(255,190,110,0.22)');
  glow.addColorStop(1, 'rgba(255,190,110,0)');
  x.fillStyle = glow;
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}

// 織機のパンチカード：茶色い紙に穴の列
function punchCardTexture() {
  const c = document.createElement('canvas');
  c.width = 420;
  c.height = 130;
  const x = c.getContext('2d');
  x.fillStyle = '#c9a66b';
  x.fillRect(0, 0, 420, 130);
  x.fillStyle = '#2a1a0e';
  for (let r = 0; r < 4; r++) for (let k = 0; k < 16; k++) if ((k * 7 + r * 3) % 5 < 2) x.fillRect(16 + k * 25, 18 + r * 26, 12, 12);
  return canvasTexture(c);
}

// トランプの表（白地に数字とマーク）
function cardTexture(rank, suit) {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 240;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 160, 240);
  x.fillStyle = suit === '♥' ? '#c62828' : '#111111';
  x.font = 'bold 44px Georgia, serif';
  x.fillText(rank, 14, 52);
  x.font = '90px Georgia, serif';
  x.fillText(suit, 46, 160);
  return canvasTexture(c);
}

// プリンストンの研究室の壁：黒板にゲーム理論とノイマン型の図、右に本棚
function iasWallTexture() {
  const [c, x, W, H] = wallCanvas();
  const wall = x.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H * 0.5, W * 0.55);
  wall.addColorStop(0, '#6a5a48');
  wall.addColorStop(1, '#2a221a');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  inView(x, W);
  // 黒板（真ん中から左）
  x.fillStyle = '#5a4030';
  x.fillRect(560, 120, 980, 430);
  x.fillStyle = '#23352b';
  x.fillRect(580, 140, 940, 390);
  x.strokeStyle = 'rgba(240,240,230,0.85)';
  x.fillStyle = 'rgba(240,240,230,0.85)';
  x.lineWidth = 4;
  x.font = 'italic 40px Georgia, serif';
  x.fillText('max min  Σ xᵢ aᵢⱼ yⱼ', 620, 210);
  // 中央処理・記憶・入出力の箱（ノイマン型）
  for (const [bx, label] of [[640, 'CPU'], [880, 'MEMORY'], [1180, 'I/O']]) {
    x.strokeRect(bx, 300, 200, 110);
    x.font = '34px Georgia, serif';
    x.fillText(label, bx + 26, 368);
  }
  for (const ax of [840, 1080]) {
    x.beginPath();
    x.moveTo(ax, 355);
    x.lineTo(ax + 40, 355);
    x.stroke();
  }
  x.font = '30px Georgia, serif';
  x.fillText('EDVAC 1945', 640, 480);
  // 本棚（右）
  x.fillStyle = '#3a2a1e';
  x.fillRect(1640, 140, 300, 520);
  const colors = ['#7a2a2a', '#2d4a6a', '#c9b48a', '#3f5a3a', '#5a3a5a'];
  for (let r = 0; r < 4; r++) {
    let bx = 1655;
    let k = r * 2;
    while (bx < 1920) {
      const bw = 16 + ((k * 13) % 18);
      x.fillStyle = colors[k % colors.length];
      x.fillRect(bx, 140 + r * 130 + 118 - (80 + ((k * 29) % 30)), bw, 80 + ((k * 29) % 30));
      bx += bw + 3;
      k++;
    }
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = 'rgba(8,8,10,0.25)';
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}

// Mark II の部屋の壁：リレーが並んだ灰色の盤と、蛾を貼った記録のページ（1947 年 9 月 9 日）
function harvardWallTexture() {
  const [c, x, W, H] = wallCanvas();
  x.fillStyle = '#c9c4b4';
  x.fillRect(0, 0, W, H);
  inView(x, W);
  // リレーの盤（左右）
  for (const px of [150, 1600]) {
    x.fillStyle = '#7d8288';
    x.fillRect(px, 80, 360, 620);
    x.fillStyle = '#2b2e33';
    for (let r = 0; r < 14; r++) for (let k = 0; k < 8; k++) x.fillRect(px + 22 + k * 42, 100 + r * 42, 28, 26);
  }
  // 記録のページ（額に入れて真ん中より左に）
  const bx = 640;
  const by = 160;
  x.fillStyle = '#5a4a32';
  x.fillRect(bx - 20, by - 20, 520, 380);
  x.fillStyle = '#f4efdc';
  x.fillRect(bx, by, 480, 340);
  x.strokeStyle = 'rgba(80,110,170,0.45)';
  x.lineWidth = 2;
  for (let i = 1; i < 12; i++) {
    x.beginPath();
    x.moveTo(bx, by + i * 28);
    x.lineTo(bx + 480, by + i * 28);
    x.stroke();
  }
  x.fillStyle = '#2a2a6a';
  x.font = 'italic 24px Georgia, serif';
  x.fillText('9/9  1545  Relay #70 Panel F', bx + 20, by + 50);
  x.fillText('(moth) in relay.', bx + 20, by + 220);
  x.fillText('First actual case of bug being found.', bx + 20, by + 300);
  // 貼られた蛾
  x.fillStyle = 'rgba(240,240,230,0.9)';
  x.fillRect(bx + 170, by + 85, 140, 90);
  x.fillStyle = '#6b5636';
  x.beginPath();
  x.ellipse(bx + 240, by + 130, 8, 26, 0, 0, Math.PI * 2);
  x.fill();
  for (const s of [-1, 1]) {
    x.beginPath();
    x.ellipse(bx + 240 + s * 30, by + 120, 28, 18, s * 0.5, 0, Math.PI * 2);
    x.fill();
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = 'rgba(20,20,10,0.18)';
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}

// 1969 年の MIT の研究室の壁：青みの壁、窓の外の夜空に月
function apolloWallTexture() {
  const [c, x, W, H] = wallCanvas();
  const wall = x.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H * 0.5, W * 0.6);
  wall.addColorStop(0, '#5d6878');
  wall.addColorStop(1, '#232a35');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  inView(x, W);
  // 窓（左寄り）
  const wx = 500;
  const wy = 130;
  x.fillStyle = '#0a1024';
  x.fillRect(wx, wy, 560, 360);
  x.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 40; i++) x.fillRect(wx + ((i * 151) % 560), wy + ((i * 73) % 360), 3, 3);
  x.fillStyle = '#e8e4d4';
  x.beginPath();
  x.arc(wx + 400, wy + 120, 60, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = 'rgba(120,115,100,0.5)';
  for (const [dx, dy, r] of [[-20, -10, 14], [18, 20, 10], [10, -30, 8]]) {
    x.beginPath();
    x.arc(wx + 400 + dx, wy + 120 + dy, r, 0, Math.PI * 2);
    x.fill();
  }
  x.strokeStyle = '#8a929c';
  x.lineWidth = 14;
  x.strokeRect(wx, wy, 560, 360);
  // 時計（右）
  x.fillStyle = '#f0f0ea';
  x.beginPath();
  x.arc(1820, 230, 70, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = '#222';
  x.lineWidth = 6;
  x.beginPath();
  x.moveTo(1820, 230);
  x.lineTo(1820, 180);
  x.moveTo(1820, 230);
  x.lineTo(1855, 245);
  x.stroke();
  return canvasTexture(c);
}

// ベル研究所の夜の壁：薄い緑の壁に、UNIX のディレクトリの木を描いた紙
function bellWallTexture() {
  const [c, x, W, H] = wallCanvas();
  const wall = x.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H * 0.5, W * 0.55);
  wall.addColorStop(0, '#4c5a50');
  wall.addColorStop(1, '#1b221d');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  inView(x, W);
  // 壁の黒板代わりの大きな紙（UNIX の木の図）
  x.fillStyle = '#e9e6da';
  x.fillRect(560, 150, 560, 360);
  x.fillStyle = '#222';
  x.font = 'bold 36px Menlo, Consolas, monospace';
  x.fillText('/', 820, 210);
  const dirs = ['bin', 'usr', 'etc', 'dev'];
  x.strokeStyle = '#222';
  x.lineWidth = 3;
  dirs.forEach((d, i) => {
    const dx = 600 + i * 130;
    x.beginPath();
    x.moveTo(832, 222);
    x.lineTo(dx + 40, 300);
    x.stroke();
    x.fillText(d, dx, 340);
  });
  x.font = '28px Menlo, Consolas, monospace';
  x.fillText('UNIX  1969', 600, 470);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = 'rgba(8,10,8,0.2)';
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}

// 『プログラミング言語C』の表紙
function krCoverTexture() {
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = 400;
  const x = c.getContext('2d');
  x.fillStyle = '#f6f6f2';
  x.fillRect(0, 0, 300, 400);
  x.fillStyle = '#111';
  x.font = 'bold 22px Helvetica, Arial, sans-serif';
  x.fillText('THE', 30, 50);
  x.fillText('PROGRAMMING', 30, 78);
  x.fillText('LANGUAGE', 30, 106);
  x.fillStyle = '#1f5fbf';
  x.font = 'bold 200px Helvetica, Arial, sans-serif';
  x.fillText('C', 70, 330);
  return canvasTexture(c);
}

// CERN の事務所の壁：白っぽい壁、窓の外に昼のジュラの山
function cernWallTexture() {
  const [c, x, W, H] = wallCanvas();
  const wall = x.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H * 0.5, W * 0.6);
  wall.addColorStop(0, '#9aa2a8');
  wall.addColorStop(1, '#3e4448');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  inView(x, W);
  const wx = 480;
  const wy = 140;
  const sky = x.createLinearGradient(0, wy, 0, wy + 350);
  sky.addColorStop(0, '#8fbfe6');
  sky.addColorStop(1, '#d8e8f2');
  x.fillStyle = sky;
  x.fillRect(wx, wy, 640, 350);
  x.fillStyle = '#6d7f8a';
  x.beginPath();
  x.moveTo(wx, wy + 300);
  x.lineTo(wx + 160, wy + 200);
  x.lineTo(wx + 300, wy + 260);
  x.lineTo(wx + 470, wy + 180);
  x.lineTo(wx + 640, wy + 250);
  x.lineTo(wx + 640, wy + 350);
  x.lineTo(wx, wy + 350);
  x.fill();
  x.fillStyle = '#6a8a4a';
  x.fillRect(wx, wy + 310, 640, 40);
  x.strokeStyle = '#d6d8d8';
  x.lineWidth = 14;
  x.strokeRect(wx, wy, 640, 350);
  // 壁に貼った提案書「Information Management: A Proposal」
  x.fillStyle = '#f7f5ee';
  x.fillRect(900, 220, 200, 260);
  x.fillStyle = '#333';
  x.font = '18px Georgia, serif';
  x.fillText('Information', 922, 262);
  x.fillText('Management:', 922, 286);
  x.fillText('A Proposal', 922, 310);
  x.fillStyle = '#c33';
  x.font = 'italic 18px Georgia, serif';
  x.fillText('Vague but exciting...', 910, 450);
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.fillStyle = 'rgba(8,10,12,0.2)';
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}

// NeXT の正面に貼った張り紙
function serverNoteTexture() {
  const c = document.createElement('canvas');
  c.width = 340;
  c.height = 340;
  const x = c.getContext('2d');
  x.fillStyle = '#141416';
  x.fillRect(0, 0, 340, 340);
  x.fillStyle = '#f4f1e6';
  x.fillRect(40, 90, 260, 150);
  x.fillStyle = '#c62828';
  x.font = 'bold 26px Arial, sans-serif';
  x.fillText('This machine', 60, 135);
  x.fillText('is a server.', 60, 168);
  x.fillText('DO NOT POWER', 60, 205);
  x.fillText('IT DOWN!!', 60, 232);
  return canvasTexture(c);
}

// ヘルシンキの学生部屋の壁：木の壁、左上に雪の夜の窓、右下に古いパソコンの机
function helsinkiWallTexture() {
  const [c, x, W, H] = wallCanvas();
  const wall = x.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H * 0.5, W * 0.55);
  wall.addColorStop(0, '#5f5a6e');
  wall.addColorStop(1, '#1d1b24');
  x.fillStyle = wall;
  x.fillRect(0, 0, W, H);
  // 窓（show.js の helsinki の雪が降る場所）
  const wx = 640;
  const wy = 470;
  x.fillStyle = '#16213d';
  x.fillRect(wx, wy, 240, 250);
  x.fillStyle = '#e8eef6';
  x.fillRect(wx, wy + 210, 240, 40);
  x.strokeStyle = '#d8d4c8';
  x.lineWidth = 12;
  x.strokeRect(wx, wy, 240, 250);
  x.beginPath();
  x.moveTo(wx + 120, wy);
  x.lineTo(wx + 120, wy + 250);
  x.stroke();
  // 壁に貼った紙「comp.os.minix  Aug 25 1991」
  x.fillStyle = '#f2efe4';
  x.fillRect(1000, 500, 300, 160);
  x.fillStyle = '#333';
  x.font = '22px Menlo, Consolas, monospace';
  x.fillText('comp.os.minix', 1020, 548);
  x.fillText('25 Aug 1991', 1020, 582);
  x.fillText('free OS (386)', 1020, 616);
  x.fillStyle = 'rgba(8,8,12,0.22)';
  x.fillRect(0, 0, W, H);
  return canvasTexture(c);
}
