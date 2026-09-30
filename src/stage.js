import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { animateCharacter } from './character.js';

function setupScene(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  scene.add(floor);
}

// キャラ1体を表示して動かす3D表示エリア
export class Stage {
  constructor(canvas, { controls = true } = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    setupScene(this.scene);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(0, 1.3, 5);
    if (controls) {
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.target.set(0, 1, 0);
      this.controls.enablePan = false;
      this.controls.minDistance = 2.5;
      this.controls.maxDistance = 8;
      this.controls.update();
    } else {
      this.camera.lookAt(0, 1, 0);
    }
    this.character = null;
    this.capsule = null;
    this.clock = new THREE.Clock();
    this.running = true;
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  setCharacter(obj) {
    if (this.character) this.scene.remove(this.character);
    this.character = obj;
    if (obj) {
      obj.scale.setScalar(1);
      this.scene.add(obj);
    }
  }

  // ガチャ演出：カプセルが揺れて弾け、キャラが飛び出す
  reveal(obj, rarityColor) {
    this.setCharacter(null);
    if (this.capsule) this.scene.remove(this.capsule);
    const g = new THREE.Group();
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshToonMaterial({ color: rarityColor }),
    );
    const bottom = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshToonMaterial({ color: 0xffffff }),
    );
    g.add(top, bottom);
    g.position.y = 0.8;
    this.scene.add(g);
    this.capsule = { group: g, top, bottom, start: this.clock.elapsedTime, obj };
    return new Promise((resolve) => (this.capsule.resolve = resolve));
  }

  updateCapsule(t) {
    const c = this.capsule;
    const k = t - c.start;
    if (k < 1.2) {
      c.group.rotation.z = Math.sin(k * 30) * 0.12 * Math.min(k * 2, 1);
      c.group.position.y = 0.8 + Math.abs(Math.sin(k * 8)) * 0.1;
    } else if (k < 1.6) {
      const u = (k - 1.2) / 0.4;
      c.top.position.y = u * 1.5;
      c.bottom.position.y = -u * 0.4;
      c.group.scale.setScalar(1 + u * 0.3);
      c.top.material.transparent = c.bottom.material.transparent = true;
      c.top.material.opacity = c.bottom.material.opacity = 1 - u;
      if (!this.character) {
        this.setCharacter(c.obj);
      }
      c.obj.scale.setScalar(Math.min(u * 1.2, 1.1));
    } else {
      c.obj.scale.setScalar(1);
      this.scene.remove(c.group);
      this.capsule = null;
      c.resolve();
    }
  }

  loop() {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    this.resize();
    const dt = this.clock.getDelta();
    const t = this.clock.elapsedTime;
    if (this.capsule) this.updateCapsule(t);
    if (this.character) {
      animateCharacter(this.character, t, dt);
      if (!this.controls) this.character.rotation.y = Math.sin(t * 0.6) * 0.5;
    }
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// 図鑑の一覧用に静止画サムネイルを作る（WebGLコンテキストは1つだけ使い回す）
let thumb;
export function renderThumbnail(obj, size = 256) {
  if (!thumb) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(size, size);
    const scene = new THREE.Scene();
    setupScene(scene);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0.6, 1.4, 4.6);
    camera.lookAt(0, 1, 0);
    thumb = { renderer, scene, camera };
  }
  thumb.scene.add(obj);
  obj.rotation.y = -0.25;
  thumb.renderer.render(thumb.scene, thumb.camera);
  thumb.scene.remove(obj);
  return thumb.renderer.domElement.toDataURL('image/png');
}
