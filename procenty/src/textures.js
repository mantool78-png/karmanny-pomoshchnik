import * as THREE from '../lib/three.module.js';

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function pixelTexture(draw, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  draw(g, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function speckle(g, r, palette, y0 = 0, y1 = 16) {
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < 16; x++) {
      g.fillStyle = palette[Math.floor(r() * palette.length)];
      g.fillRect(x, y, 1, 1);
    }
  }
}

const GRASS = ['#5aa83a', '#66b843', '#4e9a33', '#72c64e', '#5fb03d', '#468c2d'];
const DIRT = ['#8b5a3c', '#7b4f34', '#976545', '#6d462e', '#a06f4b'];
const STONE = ['#8a8e93', '#7b7f84', '#999da2', '#6c7075', '#83878c'];
const GOLD = ['#ffd84a', '#ffcd35', '#ffe174', '#f6bd2c', '#ffd23f'];
const WOOD = ['#6b4a2b', '#7a5532', '#5d3f24', '#836039'];
const LEAF = ['#2f7d32', '#3a8f3c', '#27692a', '#45a047', '#2c7430'];

export function makeTextures() {
  const grassTop = pixelTexture((g, r) => speckle(g, r, GRASS), 11);
  const dirt = pixelTexture((g, r) => speckle(g, r, DIRT), 23);

  const grassSide = pixelTexture((g, r) => {
    speckle(g, r, DIRT);
    for (let x = 0; x < 16; x++) {
      const h = 3 + (r() < 0.45 ? 1 : 0) + (r() < 0.2 ? 1 : 0);
      for (let y = 0; y < h; y++) {
        g.fillStyle = GRASS[Math.floor(r() * GRASS.length)];
        g.fillRect(x, y, 1, 1);
      }
    }
  }, 37);

  const stone = pixelTexture((g, r) => {
    speckle(g, r, STONE);
    g.fillStyle = '#5c6065';
    for (let k = 0; k < 7; k++) {
      const x = Math.floor(r() * 14);
      const y = Math.floor(r() * 15);
      g.fillRect(x, y, 2 + Math.floor(r() * 2), 1);
    }
  }, 53);

  const gold = pixelTexture((g, r) => {
    speckle(g, r, GOLD);
    g.fillStyle = '#fff4b0';
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 0, 1, 16);
    g.fillStyle = '#c98a12';
    g.fillRect(0, 15, 16, 1);
    g.fillRect(15, 0, 1, 16);
    g.fillStyle = '#fff8d2';
    g.fillRect(2, 2, 12, 1);
    g.fillRect(2, 2, 1, 12);
    g.fillStyle = '#e3a01d';
    g.fillRect(2, 13, 12, 1);
    g.fillRect(13, 2, 1, 12);
  }, 41);

  const wood = pixelTexture((g, r) => {
    for (let x = 0; x < 16; x++) {
      const base = WOOD[(x * 3 + Math.floor(r() * 2)) % WOOD.length];
      for (let y = 0; y < 16; y++) {
        g.fillStyle = r() < 0.12 ? WOOD[Math.floor(r() * WOOD.length)] : base;
        g.fillRect(x, y, 1, 1);
      }
    }
  }, 67);

  const leaves = pixelTexture((g, r) => speckle(g, r, LEAF), 79);

  return { grassTop, grassSide, dirt, stone, gold, wood, leaves };
}
