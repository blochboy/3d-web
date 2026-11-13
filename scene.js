import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

/* ---------- Core setup ---------- */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05060a, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060a, 0.042);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 0.6, 9.5);

const world = new THREE.Group();
scene.add(world);

/* ---------- Pointer + scroll state ---------- */
const pointer = new THREE.Vector2();
const smoothPointer = new THREE.Vector2();
const target = { x: 0, y: 0.6, z: 9.5 };
let drag = { active: false, x: 0, y: 0, rx: 0, ry: 0 };
let scrollNorm = 0;
let smoothScroll = 0;

window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  if (drag.active) {
    drag.ry += (e.clientX - drag.x) * 0.004;
    drag.rx += (e.clientY - drag.y) * 0.002;
    drag.x = e.clientX; drag.y = e.clientY;
  }
});
window.addEventListener('pointerdown', (e) => {
  drag.active = true; drag.x = e.clientX; drag.y = e.clientY;
});
window.addEventListener('pointerup', () => { drag.active = false; });
window.addEventListener('pointerleave', () => { drag.active = false; });

window.addEventListener('scroll', () => {
  const max = document.body.scrollHeight - window.innerHeight;
  scrollNorm = max > 0 ? window.scrollY / max : 0;
}, { passive: true });

/* ---------- Galaxy of particles ---------- */
const COUNT = 24000;
const pos = new Float32Array(COUNT * 3);
const col = new Float32Array(COUNT * 3);
const size = new Float32Array(COUNT);
const rnd = new Float32Array(COUNT);

const blue = new THREE.Color('#49c9ff');
const violet = new THREE.Color('#a56bff');
const pink = new THREE.Color('#ff5fa2');
const white = new THREE.Color('#eaf6ff');
const tmp = new THREE.Color();

for (let i = 0; i < COUNT; i++) {
  const r = Math.pow(Math.random(), 0.62) * 9.2;
  const arm = Math.floor(Math.random() * 3) * ((Math.PI * 2) / 3);
  const angle = arm + r * 0.52 + (Math.random() - 0.5) * (0.7 + r * 0.09);
  const i3 = i * 3;

  pos[i3] = Math.cos(angle) * r + (Math.random() - 0.5) * 0.55;
  pos[i3 + 1] = (Math.random() - 0.5) * (0.45 + r * 0.1) * 1.6;
  pos[i3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * 0.55;

  const t = Math.min(r / 9.2, 1);
  tmp.copy(blue).lerp(violet, t);
  if (t > 0.7) tmp.lerp(pink, (t - 0.7) / 0.3 * 0.7);
  if (Math.random() > 0.94) tmp.lerp(white, 0.85);

  col[i3] = tmp.r; col[i3 + 1] = tmp.g; col[i3 + 2] = tmp.b;
  size[i] = 0.55 + Math.random() * 1.9;
  rnd[i] = Math.random();
}

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
geo.setAttribute('aRandom', new THREE.BufferAttribute(rnd, 1));

const uniforms = {
  uTime: { value: 0 },
  uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
  uMouse: { value: new THREE.Vector2(0, 0) },
  uScroll: { value: 0 }
};

const particleMat = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: `
    uniform float uTime;
    uniform float uPixelRatio;
    uniform vec2  uMouse;
    uniform float uScroll;
    attribute vec3  aColor;
    attribute float aSize;
    attribute float aRandom;
    varying vec3  vColor;
    varying float vAlpha;

    mat3 rotY(float a){ float s = sin(a), c = cos(a); return mat3(c,0.0,-s, 0.0,1.0,0.0, s,0.0,c); }

    void main() {
      vec3 p = position;
      float ang = uTime * (0.055 + aRandom * 0.075);
      p = rotY(ang) * p;

      p.y += sin(p.x * 0.55 + uTime * 0.85) * 0.28;
      p.y += cos(p.z * 0.4 - uTime * 0.6) * 0.22;
      p *= 1.0 + uScroll * 0.55;

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vec2 m = uMouse * 5.5;
      vec2 d = mv.xy - m;
      float dist = length(d);
      float push = smoothstep(4.2, 0.0, dist) * 1.9;
      mv.xy += normalize(d + 0.001) * push;

      vColor = aColor;
      vAlpha = 0.45 + aRandom * 0.55;

      gl_Position = projectionMatrix * mv;
      float sz = aSize * uPixelRatio * (30.0 / max(-mv.z, 0.35));
      gl_PointSize = clamp(sz, 0.8, 26.0);
    }
  `,
  fragmentShader: `
    varying vec3  vColor;
    varying float vAlpha;
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      float a = smoothstep(0.5, 0.0, d);
      a = pow(a, 1.7);
      if (a < 0.01) discard;
      gl_FragColor = vec4(vColor, a * vAlpha);
    }
  `
});

const galaxy = new THREE.Points(geo, particleMat);
world.add(galaxy);
