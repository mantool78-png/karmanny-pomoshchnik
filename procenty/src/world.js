import * as THREE from '../lib/three.module.js';
import { makeTextures } from './textures.js';

const gsap = window.gsap;
const N = 10;

export const cellPos = (i) => ({ x: (i % N) - 4.5, z: Math.floor((i % (N * N)) / N) - 4.5 });
const LAYERS = 2;

const hash = (n) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

export class World {
  constructor(canvas, labelLayer, { reduceMotion = false } = {}) {
    this.canvas = canvas;
    this.labelLayer = labelLayer;
    this.reduce = reduceMotion;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 500);
    this.cam = { px: 12, py: 13, pz: 15, tx: 0, ty: -1.5, tz: 0, sx: 0, sy: 0 };
    this.tex = makeTextures();
    this.dummy = new THREE.Object3D();
    this.tmpColor = new THREE.Color();
    this.tmpVec = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.island = new THREE.Group();
    this.scene.add(this.island);
    this.rise = { y: 0 };
    this.sway = 1;
    this.yaw = 0;
    this.yawTarget = 0;
    this.interactive = false;
    this.hover = -1;
    this.labels = [];
    this.timers = [];
    this.onCellClick = null;

    this.cells = Array.from({ length: N * N * LAYERS }, (_, i) => {
      const base = 1 + Math.floor(i / (N * N));
      return { y: base, base, s: 0, active: false, glow: 0, lift: 0 };
    });

    this.buildLights();
    this.buildIsland();
    this.buildGold();
    this.buildDecor();
    this.buildMarker();
    this.bindPointer();

    this.clock = new THREE.Clock();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.tick());
  }

  d(seconds) {
    return this.reduce ? 0.001 : seconds;
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight('#a9d8ff', '#40301f', 1.4));

    const sun = new THREE.DirectionalLight('#fff0d0', 2.5);
    sun.position.set(9, 16, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10; sc.near = 1; sc.far = 60;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight('#7fb8ff', 0.9);
    rim.position.set(-12, 6, -12);
    this.scene.add(rim);

    this.goldLight = new THREE.PointLight('#ffbf3c', 0, 0, 2);
    this.goldLight.position.set(0, 4.5, 0);
    this.island.add(this.goldLight);
  }

  buildIsland() {
    const t = this.tex;
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.box = box;
    const side = new THREE.MeshLambertMaterial({ map: t.grassSide });
    const top = new THREE.MeshLambertMaterial({ map: t.grassTop });
    this.dirtMat = new THREE.MeshLambertMaterial({ map: t.dirt });
    this.stoneMat = new THREE.MeshLambertMaterial({ map: t.stone });
    this.grassMats = [side, side, top, this.dirtMat, side, side];

    this.grass = new THREE.InstancedMesh(box, this.grassMats, N * N);
    this.grass.castShadow = true;
    this.grass.receiveShadow = true;
    this.grass.frustumCulled = false;
    for (let i = 0; i < N * N; i++) this.grass.setColorAt(i, this.tmpColor.setRGB(1, 1, 1));
    this.island.add(this.grass);

    const layers = [[99, 'dirt'], [5.4, 'dirt'], [4.5, 'dirt'], [3.6, 'stone'], [2.7, 'stone'], [1.8, 'stone'], [0.9, 'stone']];
    const dirt = [];
    const stone = [];
    layers.forEach(([R, kind], depth) => {
      for (let i = 0; i < N * N; i++) {
        const { x, z } = cellPos(i);
        const dist = Math.hypot(x, z) + (hash(i * 7 + depth * 131) - 0.5) * 1.2;
        if (dist < R) (kind === 'dirt' ? dirt : stone).push([x, -1 - depth, z]);
      }
    });
    stone.push([0.5, -8, -0.5], [-0.5, -8.6, 0.5]);

    const fill = (list, mat) => {
      const mesh = new THREE.InstancedMesh(box, mat, list.length);
      list.forEach(([x, y, z], i) => {
        this.dummy.position.set(x, y, z);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.island.add(mesh);
    };
    fill(dirt, this.dirtMat);
    fill(stone, this.stoneMat);
  }

  buildGold() {
    this.goldMat = new THREE.MeshLambertMaterial({
      map: this.tex.gold,
      emissive: new THREE.Color('#ffae00'),
      emissiveMap: this.tex.gold,
      emissiveIntensity: 0.35,
    });
    this.gold = new THREE.InstancedMesh(this.box, this.goldMat, N * N * LAYERS);
    const markup = new THREE.Color(1, 0.5, 0.42);
    for (let i = 0; i < N * N * LAYERS; i++) this.gold.setColorAt(i, i < N * N ? this.tmpColor.setRGB(1, 1, 1) : markup);
    this.gold.castShadow = true;
    this.gold.receiveShadow = true;
    this.gold.frustumCulled = false;
    this.island.add(this.gold);
  }

  buildDecor() {
    const t = this.tex;
    const woodMat = new THREE.MeshLambertMaterial({ map: t.wood });
    const leafMat = new THREE.MeshLambertMaterial({ map: t.leaves });

    const mini = (cx, cy, cz, size, tree) => {
      const g = new THREE.Group();
      const add = (mat, x, y, z) => {
        const m = new THREE.Mesh(this.box, mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
      };
      for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
          add(this.grassMats, x, 0, z);
          add(this.dirtMat, x, -1, z);
          if ((x + z) % 2 === 0) add(this.stoneMat, x, -2, z);
        }
      }
      add(this.stoneMat, Math.floor(size / 2), -3, Math.floor(size / 2));
      if (tree) {
        const tx = Math.floor(size / 2);
        for (let y = 1; y <= 3; y++) add(woodMat, tx, y, tx);
        for (let x = -1; x <= 1; x++) {
          for (let z = -1; z <= 1; z++) {
            add(leafMat, tx + x, 4, tx + z);
            if (Math.abs(x) + Math.abs(z) < 2) add(leafMat, tx + x, 5, tx + z);
          }
        }
      }
      g.position.set(cx, cy, cz);
      g.userData.base = cy;
      g.userData.phase = Math.random() * Math.PI * 2;
      this.scene.add(g);
      return g;
    };
    this.minis = [
      mini(-17, -6, -12, 3, true),
      mini(15, 2, -15, 2, false),
      mini(9.5, -4.5, 6, 2, true),
    ];

    const cloudMat = new THREE.MeshLambertMaterial({ color: '#f4f8ff', transparent: true, opacity: 0.88 });
    this.clouds = [];
    for (let k = 0; k < 6; k++) {
      const g = new THREE.Group();
      const parts = 3 + Math.floor(hash(k + 3) * 3);
      for (let p = 0; p < parts; p++) {
        const m = new THREE.Mesh(this.box, cloudMat);
        m.scale.set(2 + hash(k * 9 + p) * 3, 0.7, 1.6 + hash(k * 5 + p) * 2);
        m.position.set(p * 1.8 - parts, hash(k * 3 + p) * 0.3, (hash(k * 11 + p) - 0.5) * 2);
        g.add(m);
      }
      g.position.set(-40 + k * 15, 7 + hash(k) * 6, -14 - hash(k + 7) * 22);
      g.userData.speed = 0.4 + hash(k + 1) * 0.5;
      this.scene.add(g);
      this.clouds.push(g);
    }

    const starGeo = new THREE.BufferGeometry();
    const stars = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 1.2 - 0.2);
      const r = 160;
      stars[i * 3] = r * Math.sin(ph) * Math.cos(th);
      stars[i * 3 + 1] = r * Math.cos(ph);
      stars[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#dfe9ff', size: 0.9, transparent: true, opacity: 0.85 }));
    this.scene.add(this.stars);

    const moon = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ color: '#f6f1d4' }));
    moon.position.set(-55, 48, -110);
    moon.lookAt(0, 0, 0);
    this.scene.add(moon);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ color: '#f6f1d4', transparent: true, opacity: 0.08 }));
    halo.position.copy(moon.position).multiplyScalar(1.01);
    halo.lookAt(0, 0, 0);
    this.scene.add(halo);

    const flyGeo = new THREE.BufferGeometry();
    this.flySeeds = Array.from({ length: 70 }, (_, i) => ({
      r: 5 + hash(i) * 6,
      a: hash(i + 100) * Math.PI * 2,
      y: -3 + hash(i + 200) * 8,
      sp: 0.05 + hash(i + 300) * 0.15,
    }));
    flyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(70 * 3), 3));
    this.flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({
      color: '#ffe68a', size: 0.16, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.island.add(this.flies);
  }

  buildMarker() {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.08, 1.08, 1.08));
    this.markerMat = new THREE.LineBasicMaterial({ color: '#fff6c2', transparent: true, opacity: 0 });
    this.marker = new THREE.LineSegments(g, this.markerMat);
    this.island.add(this.marker);
  }

  bindPointer() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, yaw: this.yawTarget, moved: false };
    });
    window.addEventListener('pointermove', (e) => {
      if (this.drag) {
        const dx = e.clientX - this.drag.x;
        if (Math.abs(dx) > 5) this.drag.moved = true;
        this.yawTarget = this.drag.yaw + dx * 0.008;
      }
      if (this.interactive && e.target === c) {
        this.hover = this.pick(e.clientX, e.clientY);
        c.style.cursor = this.hover >= 0 ? 'pointer' : 'grab';
      } else if (this.hover !== -1 && e.target !== c) {
        this.hover = -1;
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (this.drag && !this.drag.moved && this.interactive && e.target === c) {
        const idx = this.pick(e.clientX, e.clientY);
        if (idx >= 0 && this.onCellClick) this.onCellClick(idx);
      }
      this.drag = null;
    });
    window.addEventListener('pointercancel', () => (this.drag = null));
  }

  pick(clientX, clientY) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.pointer.set((clientX / w) * 2 - 1, -(clientY / h) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.gold.computeBoundingSphere();
    this.grass.computeBoundingSphere();
    const hits = this.raycaster.intersectObjects([this.gold, this.grass], false);
    for (const hit of hits) {
      if (hit.object === this.gold && !this.cells[hit.instanceId].active) continue;
      return hit.instanceId;
    }
    return -1;
  }

  activeIndices() {
    const out = [];
    this.cells.forEach((c, i) => c.active && out.push(i));
    return out;
  }

  setGold(indices, { maxTotal = 0.9, stagger = 0.035 } = {}) {
    const want = new Set(indices);
    const adds = indices.filter((i) => !this.cells[i].active);
    const removes = [];
    this.cells.forEach((c, i) => c.active && !want.has(i) && removes.push(i));

    removes.forEach((i, k) => {
      const c = this.cells[i];
      c.active = false;
      if (c.move) c.move.kill();
      c.move = c.s < 0.01
        ? null
        : gsap.to(c, { s: 0, y: Math.min(c.y, c.base + 0.5) + 0.9, duration: this.d(0.35), ease: 'back.in(2)', delay: this.d(Math.min(k * 0.008, 0.25)) });
      if (!c.move) { c.s = 0; c.y = c.base; }
    });

    const step = adds.length ? Math.min(stagger, maxTotal / adds.length) : 0;
    adds.forEach((i, k) => {
      const c = this.cells[i];
      c.active = true;
      if (c.move) c.move.kill();
      c.s = 0;
      c.move = gsap.timeline({ delay: this.d(k * step) })
        .set(c, { y: c.base + 6 + Math.random() * 2, s: 1 })
        .to(c, { y: c.base, duration: this.d(0.75), ease: 'bounce.out' });
    });
  }

  pulseRows(onRow) {
    this.clearTimers();
    for (let r = 0; r < N; r++) {
      const at = 0.35 + r * 0.24;
      for (let col = 0; col < N; col++) {
        const c = this.cells[r * N + col];
        if (c.shine) c.shine.kill();
        c.shine = gsap.timeline({ delay: this.d(at + col * 0.015) })
          .to(c, { glow: 1, lift: 0.22, duration: this.d(0.18), ease: 'power2.out' })
          .to(c, { glow: 0.12, lift: 0, duration: this.d(0.8), ease: 'power2.inOut' });
      }
      this.timers.push(gsap.delayedCall(this.d(at + 0.08), () => onRow && onRow(r)));
    }
  }

  clearGlow() {
    this.clearTimers();
    this.cells.forEach((c) => {
      if (c.shine) c.shine.kill();
      c.shine = c.glow || c.lift ? gsap.to(c, { glow: 0, lift: 0, duration: this.d(0.4) }) : null;
    });
  }

  clearTimers() {
    this.timers.forEach((t) => t.kill());
    this.timers = [];
  }

  setLabels(items) {
    this.labels.forEach((l) => {
      gsap.to(l.el, { opacity: 0, scale: 0.6, duration: this.d(0.25), onComplete: () => l.el.remove() });
    });
    this.labels = items.map((it) => this.makeLabel(it));
  }

  addLabels(items) {
    this.labels.push(...items.map((it) => this.makeLabel(it)));
  }

  makeLabel(it) {
    const el = document.createElement('div');
    el.className = 'label' + (it.cls ? ' ' + it.cls : '');
    const span = document.createElement('span');
    span.textContent = it.text;
    el.appendChild(span);
    this.labelLayer.appendChild(el);
    gsap.fromTo(el, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: this.d(0.55), ease: 'back.out(2.6)', delay: this.d(it.delay || 0) });
    return { el, v: new THREE.Vector3(it.x, it.y, it.z) };
  }

  glowCells(indices, rest = 0.45) {
    indices.forEach((i, k) => {
      const c = this.cells[i];
      if (c.shine) c.shine.kill();
      c.shine = gsap.timeline({ delay: this.d(k * 0.006) })
        .to(c, { glow: 1, lift: 0.22, duration: this.d(0.18), ease: 'power2.out' })
        .to(c, { glow: rest, lift: 0, duration: this.d(0.8), ease: 'power2.inOut' });
    });
  }

  setView(view, duration = 1.8) {
    gsap.to(this.cam, { ...view, duration: this.d(duration), ease: 'power3.inOut', overwrite: true });
  }

  intro(onDone) {
    this.rise.y = -16;
    gsap.to(this.rise, { y: 0, duration: this.d(2.4), ease: 'power4.out', onComplete: onDone });
  }

  bump() {
    gsap.fromTo(this.rise, { y: 0 }, { y: 0.35, duration: this.d(0.12), yoyo: true, repeat: 1, ease: 'power2.out' });
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    this.yaw += (this.yawTarget - this.yaw) * Math.min(1, dt * 6);
    this.island.rotation.y = this.yaw + Math.sin(t * 0.22) * 0.14 * this.sway;
    this.island.position.y = Math.sin(t * 0.8) * 0.12 + this.rise.y;

    const d = this.dummy;
    let lit = 0;
    for (let i = 0; i < N * N * LAYERS; i++) {
      const c = this.cells[i];
      const { x, z } = cellPos(i);
      const ground = this.cells[i % (N * N)];
      if (i < N * N) {
        d.rotation.set(0, 0, 0);
        d.position.set(x, c.lift, z);
        d.scale.setScalar(1);
        d.updateMatrix();
        this.grass.setMatrixAt(i, d.matrix);
        const g = c.glow;
        this.grass.setColorAt(i, this.tmpColor.setRGB(1 + g * 1.1, 1 + g * 1.0, 1 + g * 0.35));
      }

      const s = Math.max(c.s, 0.0001);
      d.position.set(x, c.y + ground.lift, z);
      d.rotation.y = (c.y - c.base) * 0.25;
      d.scale.setScalar(s);
      d.updateMatrix();
      this.gold.setMatrixAt(i, d.matrix);
      if (c.active) lit++;
    }
    this.grass.instanceMatrix.needsUpdate = true;
    this.grass.instanceColor.needsUpdate = true;
    this.gold.instanceMatrix.needsUpdate = true;
    this.goldLight.intensity += ((Math.min(lit, 100) / 100) * 40 - this.goldLight.intensity) * Math.min(1, dt * 3);

    if (this.interactive && this.hover >= 0) {
      const { x, z } = cellPos(this.hover);
      const c = this.cells[this.hover];
      this.marker.position.set(x, c.active ? 1 : 0, z);
      this.markerMat.opacity += (0.95 - this.markerMat.opacity) * Math.min(1, dt * 10);
    } else {
      this.markerMat.opacity += (0 - this.markerMat.opacity) * Math.min(1, dt * 10);
    }

    const pos = this.flies.geometry.attributes.position;
    this.flySeeds.forEach((f, i) => {
      const a = f.a + t * f.sp;
      pos.setXYZ(i, Math.cos(a) * f.r, f.y + Math.sin(t * 0.7 + i) * 0.6, Math.sin(a) * f.r);
    });
    pos.needsUpdate = true;
    this.flies.material.opacity = 0.55 + Math.sin(t * 2.3) * 0.3;

    this.clouds.forEach((g) => {
      g.position.x += g.userData.speed * dt;
      if (g.position.x > 50) g.position.x = -50;
    });
    this.minis.forEach((g) => {
      g.position.y = g.userData.base + Math.sin(t * 0.6 + g.userData.phase) * 0.35;
      g.rotation.y = Math.sin(t * 0.15 + g.userData.phase) * 0.2;
    });
    this.stars.rotation.y = t * 0.004;

    const cm = this.cam;
    const aspect = w / h;
    const k = aspect < 1 ? 1 + (1 - aspect) * 1.25 : 1;
    this.camera.position.set(cm.tx + (cm.px - cm.tx) * k, cm.ty + (cm.py - cm.ty) * k, cm.tz + (cm.pz - cm.tz) * k);
    this.camera.lookAt(cm.tx, cm.ty, cm.tz);
    this.camera.setViewOffset(w, h, -cm.sx * w, cm.sy * h, w, h);

    this.island.updateMatrixWorld();
    this.camera.updateMatrixWorld();
    this.labels.forEach((l) => {
      const v = this.tmpVec.copy(l.v).applyMatrix4(this.island.matrixWorld).project(this.camera);
      const hidden = v.z > 1;
      l.el.style.translate = `${((v.x + 1) / 2) * w}px ${((1 - v.y) / 2) * h}px`;
      l.el.style.visibility = hidden ? 'hidden' : 'visible';
    });

    this.renderer.render(this.scene, this.camera);
  }
}
