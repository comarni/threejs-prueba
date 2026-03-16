/**
 * main.js — El Cubo Sensible v2
 * ════════════════════════════════════════════════════════════
 * 100 interacciones, easter eggs y transformaciones.
 * OrbitControls para rotar/mover libremente.
 * Deformaciones suaves sin destruir la silueta del cubo.
 *
 * Módulos:
 *  ① SceneSetup        — renderer, cámara, OrbitControls, luces, postpro
 *  ② CubeMesh          — geometría subdividida, material, partículas burst
 *  ③ ShapeSystem       — morphing suave entre formas (cubo↔esfera↔pirámide…)
 *  ④ EmotionSystem     — 15+ estados emocionales + transiciones de color/luz
 *  ⑤ DeformSystem      — deformación de vértices conservando silueta
 *  ⑥ InteractionSystem — todos los eventos (mouse, teclado, scroll, touch)
 *  ⑦ TextCommandSystem — palabras clave escritas por el usuario
 *  ⑧ MicSystem         — análisis de micrófono en tiempo real
 *  ⑨ TimeSystem        — comportamiento según hora del día
 *  ⑩ SpontaneousSystem — vida propia, mensajes de soledad, etc.
 *  ⑪ UI                — barra de estrés, desafíos, hints, easter eggs
 *  ⑫ AnimationLoop     — loop principal
 * ════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import { OrbitControls }  from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js';

/* ════════════════════════════════════════════════════════════
   ① SceneSetup
════════════════════════════════════════════════════════════ */

const container = document.getElementById('canvas-container');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog   = new THREE.FogExp2(0x000010, 0.032);

const camera = new THREE.PerspectiveCamera(
  60,
  container.clientWidth / container.clientHeight,
  0.1, 120
);
camera.position.set(0, 1, 6);
camera.lookAt(0, 0, 0);

// ── OrbitControls ──────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping    = true;
controls.dampingFactor    = 0.08;
controls.enablePan        = true;
controls.minDistance      = 2;
controls.maxDistance      = 18;
controls.minPolarAngle    = 0;
controls.maxPolarAngle    = Math.PI * 0.85;
controls.rotateSpeed      = 0.8;
controls.target.set(0, 0, 0);

// ── Luces ──────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0x111122, 0.6);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
keyLight.position.set(3, 6, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);

const fillLight = new THREE.PointLight(0xff00ff, 2.2, 18);
fillLight.position.set(-4, 2, 2);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0x00ffff, 1.8, 18);
rimLight.position.set(3, -2, -3);
scene.add(rimLight);

const underGlow = new THREE.PointLight(0xff6600, 1.0, 9);
underGlow.position.set(0, -3, 0);
scene.add(underGlow);

// Luz extra para modo especial
const specialLight = new THREE.PointLight(0xffffff, 0, 12);
specialLight.position.set(0, 4, 0);
scene.add(specialLight);

// ── Post-processing ────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(container.clientWidth, container.clientHeight),
  0.9, 0.4, 0.15
);
composer.addPass(bloomPass);

// Glitch shader custom
const GlitchShader = {
  uniforms: {
    tDiffuse: { value: null },
    time:     { value: 0 },
    amount:   { value: 0.0 },
    rgbShift: { value: 0.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time, amount, rgbShift;
    varying vec2 vUv;
    float rand(vec2 c){ return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 uv = vUv;
      if(amount>0.01){
        float s = rand(vec2(floor(uv.y*30.),time));
        if(s>0.6) uv.x += (s-0.6)*amount*0.25;
        float r = texture2D(tDiffuse, uv+vec2(rgbShift,0.)).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uv-vec2(rgbShift,0.)).b;
        gl_FragColor = vec4(r,g,b,1.);
      } else {
        gl_FragColor = texture2D(tDiffuse,uv);
      }
    }
  `,
};
const glitchPass = new ShaderPass(GlitchShader);
composer.addPass(glitchPass);

// Fondo distorsionado para modo "REALIDAD CÚBICA"
const BgWarpShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, warp: { value: 0.0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, warp; varying vec2 vUv;
    void main(){
      vec2 uv = vUv;
      if(warp>0.001){
        uv += warp*0.04*vec2(sin(uv.y*8.+time*2.), cos(uv.x*8.+time*1.5));
      }
      gl_FragColor = texture2D(tDiffuse, uv);
    }
  `,
};
const bgWarpPass = new ShaderPass(BgWarpShader);
composer.addPass(bgWarpPass);

// ── Partículas de fondo ────────────────────────────────────
const PARTICLE_COUNT = 900;
const pPos   = new Float32Array(PARTICLE_COUNT * 3);
const pCol   = new Float32Array(PARTICLE_COUNT * 3);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  pPos[i*3]   = (Math.random()-0.5)*35;
  pPos[i*3+1] = (Math.random()-0.5)*35;
  pPos[i*3+2] = (Math.random()-0.5)*35;
  pCol[i*3]   = 0.3+Math.random()*0.7;
  pCol[i*3+1] = 0.1+Math.random()*0.4;
  pCol[i*3+2] = 1.0;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol, 3));
const pMat = new THREE.PointsMaterial({ size:0.055, vertexColors:true, transparent:true, opacity:0.65, sizeAttenuation:true });
const bgParticles = new THREE.Points(pGeo, pMat);
scene.add(bgParticles);

// ── Suelo ──────────────────────────────────────────────────
const floorMat  = new THREE.MeshStandardMaterial({ color:0x060616, roughness:0.2, metalness:0.85 });
const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(12,80), floorMat);
floorMesh.rotation.x = -Math.PI/2;
floorMesh.position.y = -2.4;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

/* ════════════════════════════════════════════════════════════
   ② CubeMesh — geometría + material + burst
════════════════════════════════════════════════════════════ */

// Geometría con subdivisiones para deformaciones suaves
const cubeGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8, 10, 10, 10);
const origPos = cubeGeo.attributes.position.array.slice(); // snapshot original

const cubeMat = new THREE.MeshPhysicalMaterial({
  color: 0x8844ff,
  emissive: 0x220044,
  emissiveIntensity: 0.3,
  roughness: 0.12,
  metalness: 0.05,
  clearcoat: 1.0,
  clearcoatRoughness: 0.08,
  transparent: true,
  opacity: 1.0,
});
const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
cubeMesh.castShadow = true;
cubeMesh.receiveShadow = true;
scene.add(cubeMesh);

// Wireframe opcional (modo hueco - Backspace)
const wireMat  = new THREE.MeshBasicMaterial({ color:0x00ffff, wireframe:true, transparent:true, opacity:0.18 });
const wireMesh = new THREE.Mesh(new THREE.BoxGeometry(1.82,1.82,1.82,4,4,4), wireMat);
cubeMesh.add(wireMesh);
wireMesh.visible = false;

// ── Burst de partículas (pool) ─────────────────────────────
const BURST_N  = 80;
const burstBuf = new Float32Array(BURST_N * 3);
const burstGeo = new THREE.BufferGeometry();
burstGeo.setAttribute('position', new THREE.BufferAttribute(burstBuf, 3));
const burstMat = new THREE.PointsMaterial({ color:0xff88ff, size:0.14, transparent:true, opacity:0, sizeAttenuation:true });
const burstPts = new THREE.Points(burstGeo, burstMat);
scene.add(burstPts);
const burstVel = Array.from({length:BURST_N}, ()=>({x:0,y:0,z:0}));
const burstState = { active:false, life:0 };

function triggerBurst(hex=0xff88ff, spread=0.35) {
  burstMat.color.setHex(hex);
  burstMat.opacity = 1;
  burstState.active = true;
  burstState.life   = 1;
  const p = cubeMesh.position;
  for(let i=0;i<BURST_N;i++){
    burstBuf[i*3]   = p.x+(Math.random()-0.5)*0.3;
    burstBuf[i*3+1] = p.y+(Math.random()-0.5)*0.3;
    burstBuf[i*3+2] = p.z+(Math.random()-0.5)*0.3;
    burstVel[i] = { x:(Math.random()-0.5)*spread, y:(Math.random()-0.5)*spread, z:(Math.random()-0.5)*spread };
  }
  burstGeo.attributes.position.needsUpdate = true;
}
function updateBurst() {
  if(!burstState.active) return;
  burstState.life -= 0.016;
  burstMat.opacity = Math.max(0, burstState.life);
  for(let i=0;i<BURST_N;i++){
    burstBuf[i*3]   += burstVel[i].x;
    burstBuf[i*3+1] += burstVel[i].y - 0.004;
    burstBuf[i*3+2] += burstVel[i].z;
  }
  burstGeo.attributes.position.needsUpdate = true;
  if(burstState.life<=0){ burstState.active=false; burstMat.opacity=0; }
}

// ── Cubo bebé (esquina) ────────────────────────────────────
const babyMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.35,0.35,0.35,3,3,3),
  new THREE.MeshPhysicalMaterial({ color:0xff88ff, emissive:0x880044, emissiveIntensity:0.4, clearcoat:1 })
);
babyMesh.position.set(3.2, -1.8, 0);
babyMesh.visible = false;
scene.add(babyMesh);

// ── Texto 3D flotante (emojis en canvas) ──────────────────
function makeFloatLabel(txt) {
  const cv = document.createElement('canvas');
  cv.width=256; cv.height=128;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0,0,256,128);
  ctx.font='bold 60px serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(txt, 128, 64);
  const tex = new THREE.CanvasTexture(cv);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2,0.6),
    new THREE.MeshBasicMaterial({map:tex, transparent:true, depthWrite:false, side:THREE.DoubleSide})
  );
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}
const floatLabel = makeFloatLabel('❤️');

/* ════════════════════════════════════════════════════════════
   ③ ShapeSystem — morphing suave entre formas
════════════════════════════════════════════════════════════ */

// Precalculamos las posiciones "objetivo" para cada forma
function buildSpherePositions(count) {
  const out = new Float32Array(count * 3);
  const sp  = new THREE.SphereGeometry(0.9, 32, 32);
  const spPos = sp.attributes.position.array;
  const spN   = sp.attributes.position.count;
  for(let i=0;i<count;i++){
    const j = (i % spN);
    out[i*3]   = spPos[j*3];
    out[i*3+1] = spPos[j*3+1];
    out[i*3+2] = spPos[j*3+2];
  }
  return out;
}

function buildConePositions(count) {
  const out = new Float32Array(count * 3);
  const co  = new THREE.ConeGeometry(0.9, 1.8, 32, 8);
  const coPos = co.attributes.position.array;
  const coN   = co.attributes.position.count;
  for(let i=0;i<count;i++){
    const j = (i % coN);
    out[i*3]   = coPos[j*3];
    out[i*3+1] = coPos[j*3+1];
    out[i*3+2] = coPos[j*3+2];
  }
  return out;
}

function buildTorusPositions(count) {
  const out = new Float32Array(count * 3);
  const to  = new THREE.TorusGeometry(0.8, 0.35, 16, 48);
  const toPos = to.attributes.position.array;
  const toN   = to.attributes.position.count;
  for(let i=0;i<count;i++){
    const j = (i % toN);
    out[i*3]   = toPos[j*3];
    out[i*3+1] = toPos[j*3+1];
    out[i*3+2] = toPos[j*3+2];
  }
  return out;
}

function buildFlatPositions(count) {
  // Aplastado horizontalmente
  const out = new Float32Array(count * 3);
  for(let i=0;i<count;i++){
    out[i*3]   = origPos[i*3]   * 1.4;
    out[i*3+1] = origPos[i*3+1] * 0.05;
    out[i*3+2] = origPos[i*3+2] * 1.4;
  }
  return out;
}

function buildInflatedPositions(count) {
  const out = new Float32Array(count * 3);
  for(let i=0;i<count;i++){
    const x=origPos[i*3], y=origPos[i*3+1], z=origPos[i*3+2];
    const len = Math.sqrt(x*x+y*y+z*z)||1;
    out[i*3]   = x/len*1.2;
    out[i*3+1] = y/len*1.2;
    out[i*3+2] = z/len*1.2;
  }
  return out;
}

function buildStarPositions(count) {
  const out = new Float32Array(count * 3);
  for(let i=0;i<count;i++){
    const x=origPos[i*3], y=origPos[i*3+1], z=origPos[i*3+2];
    const r = Math.sqrt(x*x+z*z)||0.001;
    const ang = Math.atan2(z,x);
    const star = 0.7 + 0.5*Math.cos(5*ang);
    out[i*3]   = Math.cos(ang)*star;
    out[i*3+1] = y*1.1;
    out[i*3+2] = Math.sin(ang)*star;
  }
  return out;
}

const VC = cubeGeo.attributes.position.count;
const SHAPES = {
  cube:     origPos,
  sphere:   buildSpherePositions(VC),
  cone:     buildConePositions(VC),
  torus:    buildTorusPositions(VC),
  flat:     buildFlatPositions(VC),
  inflated: buildInflatedPositions(VC),
  star:     buildStarPositions(VC),
};

const shapeState = {
  current:  'cube',
  target:   'cube',
  progress: 1.0,
  fromPos:  origPos.slice(),
  autoRevertTimer: 0,
  autoRevertTo: 'cube',
};

function morphTo(targetName, revertAfter=0) {
  if(!SHAPES[targetName]) return;
  shapeState.fromPos.set(cubeGeo.attributes.position.array);
  shapeState.target   = targetName;
  shapeState.progress = 0;
  if(revertAfter>0){
    shapeState.autoRevertTimer = revertAfter;
    shapeState.autoRevertTo    = shapeState.current === targetName ? 'cube' : shapeState.current;
  } else {
    shapeState.autoRevertTimer = 0;
  }
  shapeState.current = targetName;
}

function updateMorph(dt) {
  if(shapeState.progress >= 1 && shapeState.autoRevertTimer <= 0) return;

  // Revert timer
  if(shapeState.autoRevertTimer > 0 && shapeState.progress >= 1) {
    shapeState.autoRevertTimer -= dt;
    if(shapeState.autoRevertTimer <= 0) {
      morphTo('cube');
    }
    return;
  }

  shapeState.progress = Math.min(1, shapeState.progress + dt * 1.8);
  const t   = easeInOut(shapeState.progress);
  const dst = SHAPES[shapeState.target];
  const src = shapeState.fromPos;
  const pos = cubeGeo.attributes.position;

  for(let i=0;i<VC;i++){
    pos.setXYZ(i,
      src[i*3]   + (dst[i*3]   - src[i*3])   * t,
      src[i*3+1] + (dst[i*3+1] - src[i*3+1]) * t,
      src[i*3+2] + (dst[i*3+2] - src[i*3+2]) * t
    );
  }
  pos.needsUpdate = true;
  cubeGeo.computeVertexNormals();
}

function easeInOut(t){ return t<0.5 ? 2*t*t : -1+(4-2*t)*t; }

/* ════════════════════════════════════════════════════════════
   ④ EmotionSystem
════════════════════════════════════════════════════════════ */

const EMOTIONS = {
  CALM:        { n:'calm',       icon:'😐', txt:'El Cubo te observa…',                 col:0x8844ff, em:0x220044, ei:0.3, glow:0.9  },
  HAPPY:       { n:'happy',      icon:'😄', txt:'¡El Cubo está MUY feliz!',             col:0xffdd00, em:0xff8800, ei:0.5, glow:1.5  },
  NERVOUS:     { n:'nervous',    icon:'😰', txt:'El Cubo está nervioso…',               col:0x00ffaa, em:0x00aa55, ei:0.4, glow:1.0  },
  ANGRY:       { n:'angry',      icon:'😡', txt:'¡¡¡EL CUBO ESTÁ FURIOSO!!!',          col:0xff2200, em:0xff0000, ei:0.8, glow:2.0  },
  SHY:         { n:'shy',        icon:'🙈', txt:'El Cubo se esconde…',                  col:0xff88cc, em:0x882244, ei:0.2, glow:0.6  },
  MELTING:     { n:'melting',    icon:'😩', txt:'El Cubo se derrite despacito…',        col:0xffaa00, em:0xff5500, ei:0.6, glow:1.2  },
  GLITCH:      { n:'glitch',     icon:'👾', txt:'DIMENSIÓN ALTERNATIVA DETECTADA',      col:0x00ff44, em:0x00ff00, ei:1.0, glow:2.2  },
  DANCING:     { n:'dancing',    icon:'🕺', txt:'¡El Cubo baila! Siente el ritmo.',     col:0xff00ff, em:0xaa00aa, ei:0.6, glow:1.6  },
  SLEEPING:    { n:'sleeping',   icon:'😴', txt:'Ssshh… el Cubo duerme. No molestes.',  col:0x2244aa, em:0x001133, ei:0.1, glow:0.3  },
  SUSPICIOUS:  { n:'suspicious', icon:'🤨', txt:'…¿Qué quieres? El Cubo sospecha.',     col:0xaaff00, em:0x334400, ei:0.3, glow:0.9  },
  ENLIGHTENED: { n:'enlightened',icon:'✨', txt:'El Cubo ha alcanzado la paz interior.', col:0xffffff, em:0xaaaaff, ei:0.9, glow:2.8  },
  SCARED:      { n:'scared',     icon:'😱', txt:'¡¡¡EL CUBO SE HA ASUSTADO!!!',        col:0xffffff, em:0xaaaaaa, ei:0.5, glow:1.8  },
  RAINBOW:     { n:'rainbow',    icon:'🌈', txt:'El Cubo es un prisma ahora.',          col:0xff0080, em:0x880040, ei:0.5, glow:2.0  },
  FROZEN:      { n:'frozen',     icon:'🧊', txt:'El Cubo… no puede moverse.',           col:0x88ddff, em:0x003366, ei:0.3, glow:0.7  },
  MYSTIC:      { n:'mystic',     icon:'🔮', txt:'Es medianoche. El Cubo despierta.',    col:0x7700ff, em:0x440088, ei:0.8, glow:2.5  },
  LONELY:      { n:'lonely',     icon:'🥺', txt:'El Cubo se siente solo… oye.',        col:0x4455aa, em:0x223366, ei:0.2, glow:0.4  },
  CHAOS:       { n:'chaos',      icon:'🌀', txt:'EL CUBO HA PERDIDO LA CORDURA',        col:0xff6600, em:0xff3300, ei:1.0, glow:2.4  },
  BURNING:     { n:'burning',    icon:'🔥', txt:'¡FUEGO! ¡EL CUBO ARDE!',              col:0xff3300, em:0xff6600, ei:1.0, glow:2.5  },
  VOID:        { n:'void',       icon:'🕳️', txt:'El Cubo desaparece en el vacío…',     col:0x111111, em:0x000000, ei:0.0, glow:0.1  },
};

const EL = { // Lights per emotion
  calm:        {fill:0xff00ff, rim:0x00ffff},
  happy:       {fill:0xff8800, rim:0xffff00},
  nervous:     {fill:0x00ff88, rim:0x00ffcc},
  angry:       {fill:0xff0000, rim:0xff5500},
  shy:         {fill:0xff88cc, rim:0xffaadd},
  melting:     {fill:0xff6600, rim:0xff3300},
  glitch:      {fill:0x00ff00, rim:0x00ffff},
  dancing:     {fill:0xff00ff, rim:0x8800ff},
  sleeping:    {fill:0x112244, rim:0x001133},
  suspicious:  {fill:0xaaff00, rim:0x88aa00},
  enlightened: {fill:0xffffff, rim:0xaaaaff},
  scared:      {fill:0xffffff, rim:0xddddff},
  rainbow:     {fill:0xff0088, rim:0x00ffff},
  frozen:      {fill:0x88ddff, rim:0x0066aa},
  mystic:      {fill:0x7700ff, rim:0xaa00ff},
  lonely:      {fill:0x334488, rim:0x224477},
  chaos:       {fill:0xff3300, rim:0x00ff88},
  burning:     {fill:0xff2200, rim:0xff8800},
  void:        {fill:0x110011, rim:0x110011},
};

const emoState = {
  current: EMOTIONS.CALM,
  previous: EMOTIONS.CALM,
  tp: 1,
  stress: 0,
  hoverCount: 0,
  clickCount: 0,
  lastClickTime: 0,
  rapidClickCount: 0,
  rapidClickTimer: 0,
  lastMouseMoveTime: Date.now(),
  mouseVelocity: 0,
  lastMouseX: 0,
  lastMouseY: 0,
  circleAngleAccum: 0,
  lastCircleDir: 0,
  zigzagCount: 0,
  idleTime: 0,
  totalIdleTime: 0,
  sessionStart: Date.now(),
  rainbowHue: 0,
  babyVisible: false,
  babyFused: false,
  hollowLayers: 0,
  gravityAxis: 'y',
  dragActive: false,
  dragStart: new THREE.Vector3(),
  stretchTrail: [],
};

const _ca = new THREE.Color(), _cb = new THREE.Color();

function setEmotion(emo, force=false) {
  if(!force && emoState.current === emo) return;
  emoState.previous = emoState.current;
  emoState.current  = emo;
  emoState.tp       = 0;
  updateMoodUI(emo);
}

function updateMoodUI(emo) {
  document.getElementById('mood-icon').textContent = emo.icon;
  const el = document.getElementById('mood-text');
  el.textContent = emo.txt;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
}

function updateEmotionTransition(dt) {
  if(emoState.tp >= 1) return;
  emoState.tp = Math.min(1, emoState.tp + dt * 3);
  const t = emoState.tp, c = emoState.current, p = emoState.previous;

  if(emoState.current === EMOTIONS.RAINBOW) {
    // Arcoíris: ciclo de hue
    emoState.rainbowHue = (emoState.rainbowHue + dt * 120) % 360;
    cubeMat.color.setHSL(emoState.rainbowHue/360, 1, 0.6);
    cubeMat.emissive.setHSL(emoState.rainbowHue/360, 1, 0.3);
  } else {
    _ca.setHex(p.col); _cb.setHex(c.col);
    cubeMat.color.lerpColors(_ca, _cb, t);
    _ca.setHex(p.em);  _cb.setHex(c.em);
    cubeMat.emissive.lerpColors(_ca, _cb, t);
    cubeMat.emissiveIntensity = THREE.MathUtils.lerp(p.ei, c.ei, t);
  }

  // Opacidad para VOID
  cubeMat.opacity = emoState.current === EMOTIONS.VOID
    ? Math.max(0.05, 1 - emoState.tp * 0.85)
    : Math.min(1, cubeMat.opacity + dt * 2);

  bloomPass.strength = THREE.MathUtils.lerp(p.glow, c.glow, t);

  const lp = EL[p.n]||EL.calm, lc = EL[c.n]||EL.calm;
  _ca.setHex(lp.fill); _cb.setHex(lc.fill);
  fillLight.color.lerpColors(_ca, _cb, t);
  _ca.setHex(lp.rim);  _cb.setHex(lc.rim);
  rimLight.color.lerpColors(_ca, _cb, t);
}

/* ════════════════════════════════════════════════════════════
   ⑤ DeformSystem — deformaciones suaves que conservan silueta
════════════════════════════════════════════════════════════ */

// deformScale: factor global de intensidad de deformación
const deform = {
  melt:   0,   // 0-1  derretimiento
  wave:   0,   // 0-1  ondas scroll
  shake:  0,   // 0-1  temblor
  squish: 0,   // -1..1 aplastamiento
  bounce: 0,   // 0-1  rebote
  worm:   0,   // 0-1  modo gusano
  rain:   0,   // 0-1  lluvia (vértices caen)
};

function applyVertexDeform(elapsed) {
  // Solo aplicamos sobre la geometría base actual; el morph se hace en updateMorph
  // Para no destruir el morph, tomamos la posición ya morfada como "base"
  const pos  = cubeGeo.attributes.position;
  const base = SHAPES[shapeState.current];  // posición target actual como referencia
  const t    = shapeState.progress;

  const m = deform.melt;
  const w = deform.wave;
  const s = deform.shake;
  const b = deform.bounce;
  const worm = deform.worm;

  let anyDeform = m>0.01||w>0.01||s>0.01||b>0.01||worm>0.01;
  if(!anyDeform && shapeState.progress>=1) {
    // Nada que deformar — no tocar los vértices del morph
    return;
  }

  for(let i=0;i<VC;i++){
    // Posición interpolada actual del morph
    const bx = shapeState.progress>=1 ? base[i*3]   : pos.getX(i);
    const by = shapeState.progress>=1 ? base[i*3+1] : pos.getY(i);
    const bz = shapeState.progress>=1 ? base[i*3+2] : pos.getZ(i);

    let nx=bx, ny=by, nz=bz;

    // ── Derretimiento (vértices de arriba caen) ──────────
    if(m>0.01){
      const fac = (by+0.9)/1.8;          // 0 en base, 1 en tope
      ny = by - m*fac*0.75;
      nx = bx * (1 + m*(1-fac)*0.4);
      nz = bz * (1 + m*(1-fac)*0.4);
    }

    // ── Ondas scroll ────────────────────────────────────
    if(w>0.01){
      const wv = Math.sin(elapsed*8 + by*5 + bx*2) * w*0.1;
      nx += wv; nz += wv;
    }

    // ── Temblor suave ────────────────────────────────────
    if(s>0.01){
      nx += Math.sin(elapsed*28+i*0.4) * s*0.022;
      ny += Math.cos(elapsed*22+i*0.7) * s*0.012;
      nz += Math.sin(elapsed*25+i*0.2) * s*0.018;
    }

    // ── Bounce elástico ──────────────────────────────────
    if(b>0.01){
      const bp = Math.abs(Math.sin(elapsed*4))*b*0.09;
      ny = ny*(1+bp*Math.sign(by)||1);
    }

    // ── Modo gusano elástico (W+S) ────────────────────────
    if(worm>0.01){
      const ww = Math.sin(elapsed*5 + by*4)*worm*0.18;
      nx += ww; nz += Math.cos(elapsed*4+bz*3)*worm*0.12;
    }

    pos.setXYZ(i, nx, ny, nz);
  }
  pos.needsUpdate = true;
  cubeGeo.computeVertexNormals();
}

/* ════════════════════════════════════════════════════════════
   ⑥ InteractionSystem — todos los eventos
════════════════════════════════════════════════════════════ */

const mouse2D  = new THREE.Vector2();
const raycaster= new THREE.Raycaster();

const iState = {
  isHovered:   false,
  isHolding:   false,
  holdStart:   0,
  holdTimer:   0,
  shiftHeld:   false,
  altHeld:     false,
  ctrlHeld:    false,
  altTimer:    0,
  wavePower:   0,
  rotSpeedBase:0.005,
  rotSpeedY:   0.005,
  rotSpeedX:   0.002,
  rotBoost:    0,
  autoRotate:  true,
  stretchX:    1, stretchY:1, stretchZ:1,
  tgtX:        1, tgtY:1,    tgtZ:1,
  floatY:      0,
  gravityDir:  new THREE.Vector3(0,-1,0),
  panicCount:  0,
  rightClickIce:false,
  moonwalkTimer:0,
  portalTimer: 0,
  // drag
  dragActive:  false,
  dragStart3:  new THREE.Vector3(),
  dragPlane:   new THREE.Plane(new THREE.Vector3(0,0,1), 0),
};

function checkHover(e) {
  const r = renderer.domElement.getBoundingClientRect();
  mouse2D.x =  ((e.clientX - r.left)/r.width  )*2 - 1;
  mouse2D.y = -((e.clientY - r.top )/r.height )*2 + 1;
  raycaster.setFromCamera(mouse2D, camera);
  return raycaster.intersectObject(cubeMesh, false);
}

// ── Seguimiento de velocidad del ratón ────────────────────
window.addEventListener('mousemove', (e) => {
  const now = Date.now();
  const dx  = e.clientX - emoState.lastMouseX;
  const dy  = e.clientY - emoState.lastMouseY;
  const dt2 = Math.max(1, now - emoState.lastMouseMoveTime);
  emoState.mouseVelocity = Math.sqrt(dx*dx+dy*dy)/dt2 * 16;
  emoState.lastMouseX    = e.clientX;
  emoState.lastMouseY    = e.clientY;
  emoState.lastMouseMoveTime = now;
  emoState.idleTime = 0;

  // Detección de movimiento circular (18)
  const angle = Math.atan2(dy, dx);
  const angDelta = angle - emoState.lastCircleDir;
  emoState.lastCircleDir = angle;
  emoState.circleAngleAccum += Math.abs(angDelta);
  if(emoState.circleAngleAccum > Math.PI * 6) {
    // Más de 3 vueltas → breakdance
    emoState.circleAngleAccum = 0;
    onCircleMotion();
  }

  // Zigzag (53): cambios bruscos de dirección horizontal
  if(Math.abs(dx) > 8 && Math.sign(dx) !== Math.sign(emoState.lastZigDir||0)) {
    emoState.zigzagCount++;
    emoState.lastZigDir = dx;
    if(emoState.zigzagCount >= 6) { emoState.zigzagCount=0; onZigzag(); }
  }
});

// ── Hover sobre el cubo ───────────────────────────────────
container.addEventListener('mousemove', (e) => {
  // No interferir con OrbitControls cuando hay botón pulsado
  if(iState.isHolding && !iState.dragActive) return;

  const hits = checkHover(e);
  const hit  = hits.length > 0;

  if(hit && !iState.isHovered) {
    iState.isHovered = true;
    emoState.hoverCount++;
    onHoverEnter(e, hits[0]);
  } else if(!hit && iState.isHovered && !iState.dragActive) {
    iState.isHovered = false;
    onHoverLeave();
  }

  // Drag — estirar como chicle (22)
  if(iState.dragActive) {
    const plane = new THREE.Plane(camera.getWorldDirection(new THREE.Vector3()).negate(), 0);
    const worldPt = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, worldPt);
    if(worldPt) {
      const dx3 = worldPt.x - iState.dragStart3.x;
      const dy3 = worldPt.y - iState.dragStart3.y;
      const stretch = 1 + Math.sqrt(dx3*dx3+dy3*dy3)*0.3;
      iState.tgtX = 1 + Math.abs(dx3)*0.4;
      iState.tgtY = 1 + Math.abs(dy3)*0.4;
      iState.tgtZ = 1 / Math.max(0.5, stretch*0.5);
    }
  }

  // Ratón quieto en el centro → lanza un beso (71)
  // (gestionado en idle system)
});

function onHoverEnter(e, hit) {
  deform.shake = 0.5;
  addStress(3);
  emoState.idleTime = 0;

  const vel = emoState.mouseVelocity;

  if(vel > 1.2) {
    // Hover rápido → tiembla de miedo (5)
    deform.shake = 1.0;
    setEmotion(EMOTIONS.SCARED);
    showHint('¡¡¡NO TAN RÁPIDO!!! El Cubo odia las sorpresas.');
    setTimeout(()=>{ if(emoState.current===EMOTIONS.SCARED) setEmotion(EMOTIONS.NERVOUS); }, 1500);
  } else if(vel < 0.15) {
    // Hover lento → guiño cómico (6)
    onSlowHover();
  } else if(emoState.hoverCount>=20) {
    setEmotion(EMOTIONS.SUSPICIOUS);
    showHint('…¿No tienes nada mejor que hacer?');
  } else if(emoState.hoverCount>=10) {
    setEmotion(EMOTIONS.HAPPY);
    showHint('¡10 hovers! El Cubo empieza a gustarte, ¿eh?');
  } else {
    setEmotion(EMOTIONS.NERVOUS);
  }

  iState.tgtX = 1.08; iState.tgtY = 0.93; iState.tgtZ = 1.08;

  // Aparición del cubo bebé si el ratón está en esquina (91)
  checkBabyCorner(e);
}

function onHoverLeave() {
  deform.shake = 0;
  iState.tgtX = 1; iState.tgtY = 1; iState.tgtZ = 1;
  if(emoState.current===EMOTIONS.NERVOUS) setEmotion(EMOTIONS.CALM);
}

function onSlowHover() {
  // Guiño: una esquina se mueve (6)
  showHint('El Cubo… ¿te acaba de guiñar un vértice?');
  const v = iState.tgtY; iState.tgtY=1.2;
  setTimeout(()=>{ iState.tgtY=v; }, 500);
}

function onCircleMotion() {
  // Breakdance (18)
  setEmotion(EMOTIONS.DANCING);
  showHint('¡BREAKDANCE! El Cubo no sabía que podía hacer esto.');
  iState.rotSpeedY = 0.12;
  iState.rotSpeedX = 0.08;
  triggerBurst(0xff00ff);
  setTimeout(()=>{
    iState.rotSpeedY = iState.rotSpeedBase;
    iState.rotSpeedX = 0.002;
    if(emoState.current===EMOTIONS.DANCING) setEmotion(EMOTIONS.CALM);
  }, 3000);
}

function onZigzag() {
  // Rayo (53)
  showHint('⚡ ¡ZAP! El Cubo ha detectado un zigzag.');
  triggerBurst(0xffff00, 0.5);
  deform.shake = 1.0;
  setTimeout(()=>{ deform.shake=0; }, 600);
}

// ── Mouse Down ────────────────────────────────────────────
container.addEventListener('mousedown', (e) => {
  const hits = checkHover(e);
  const hit  = hits.length>0;

  if(e.button === 2 && hit) {
    // Click derecho → cubo de hielo (38)
    e.preventDefault();
    onRightClick();
    return;
  }

  if(e.button === 0 && hit) {
    iState.isHolding = true;
    iState.holdStart = performance.now();
    addStress(10);

    // Drag start (22)
    if(hits[0]) {
      iState.dragActive = true;
      iState.dragStart3.copy(hits[0].point);
      // Deshabilitar OrbitControls mientras arrastramos
      controls.enabled = false;
    }
  }
});

container.addEventListener('mouseup', (e) => {
  if(!iState.isHolding) return;
  const hold = performance.now() - iState.holdStart;
  iState.isHolding = false;

  // Fin drag
  if(iState.dragActive) {
    iState.dragActive = false;
    controls.enabled  = true;
    iState.tgtX=1; iState.tgtY=1; iState.tgtZ=1;
    // Rebote al soltar (23)
    onDragRelease(hold);
  }

  if(hold < 300) {
    handleSingleClick(e);
  } else if(hold > 5000) {
    // Hold exacto de 5 seg → enojo con vapor (55)
    onLongHold5s();
  } else if(hold > 4800 && hold < 5000) {
    // 4.9 seg → se ríe (56)
    showHint('¡¡CASI!! 4.9 segundos. El Cubo se ríe de ti.');
    triggerBurst(0x00ffff);
    setEmotion(EMOTIONS.HAPPY);
  }

  // Recuperación de derretimiento
  if(deform.melt > 0) {
    deform.melt = 0;
    setEmotion(EMOTIONS.NERVOUS);
    triggerBurst(0x00ffff);
    iState.tgtY = 1.4;
    setTimeout(()=>{ iState.tgtY=1; }, 500);
  }
});

function onDragRelease(holdMs) {
  // Rebote físico simple (23)
  setEmotion(EMOTIONS.SCARED);
  deform.bounce = 1;
  setTimeout(()=>{ deform.bounce=0; }, 1200);
  triggerBurst(0xff8800, 0.4);
  showHint('El Cubo ha rebotado. Tiene dignidad, pero poca.');
  setTimeout(()=>{ if(emoState.current===EMOTIONS.SCARED) setEmotion(EMOTIONS.CALM); }, 1500);
}

function onLongHold5s() {
  setEmotion(EMOTIONS.ANGRY);
  triggerBurst(0xff0000, 0.5);
  showHint('5 SEGUNDOS. El Cubo está ROJO DE IRA. ¡Vapor incluido!');
  addStress(30);
  glitchPass.uniforms.amount.value = 0.4;
  setTimeout(()=>{ glitchPass.uniforms.amount.value=0; }, 1000);
}

function onRightClick() {
  iState.rightClickIce = true;
  setEmotion(EMOTIONS.FROZEN);
  cubeMat.roughness = 0.05;
  cubeMat.metalness = 0.1;
  showHint('El Cubo se ha convertido en HIELO. Y se está derritiendo...');
  triggerBurst(0x88ddff, 0.3);
  // Se derrite en 4s
  let prog = 0;
  const iv = setInterval(()=>{
    prog += 0.025;
    deform.melt = Math.min(1, prog);
    if(prog>=1){
      clearInterval(iv);
      deform.melt=0;
      iState.rightClickIce=false;
      cubeMat.roughness=0.12;
      setEmotion(EMOTIONS.CALM);
    }
  }, 100);
}

// ── Click simple ──────────────────────────────────────────
function handleSingleClick(e) {
  const now = Date.now();
  const since = now - emoState.lastClickTime;
  emoState.lastClickTime = now;
  emoState.clickCount++;

  // Detectar doble click
  if(since < 320) {
    handleDoubleClick(e);
    return;
  }

  // Rapid click counter (2, 47, 34)
  emoState.rapidClickCount++;
  emoState.rapidClickTimer = 1.5;

  // Interacciones con teclas modificadoras
  if(e.shiftKey) { onShiftClick(); return; }
  if(e.altKey)   { onAltClick();   return; }
  if(e.ctrlKey)  { onCtrlClick();  return; }

  // Click en cuadrant específico → si es esquina (21)
  const r = renderer.domElement.getBoundingClientRect();
  const nx = (e.clientX - r.left) / r.width;
  const ny = (e.clientY - r.top)  / r.height;
  const isCorner = (nx<0.25||nx>0.75) && (ny<0.25||ny>0.75);
  if(isCorner) { onCornerClick(); }

  // Click fuera del cubo (61)
  if(!iState.isHovered) {
    showHint('El Cubo: "Hey, ¡aquí estoy! Clickea donde está el cubo, no donde no estoy."');
    setEmotion(EMOTIONS.SUSPICIOUS);
    return;
  }

  // Click normal → salto
  const emo = emoState.current;
  if(emo===EMOTIONS.SLEEPING) {
    setEmotion(EMOTIONS.ANGRY);
    triggerBurst(0xff2200);
    showHint('¡¡LO HAS DESPERTADO!! El Cubo. NO. Perdona.');
  } else {
    jumpAnimation();
    setEmotion(EMOTIONS.HAPPY);
    triggerBurst(0xffdd00);
    addStress(12);
  }

  // 69 clicks → arcoíris + "nice" (34)
  if(emoState.clickCount === 69) {
    setEmotion(EMOTIONS.RAINBOW);
    showHint('NICE. El Cubo dice: "nice."');
    triggerBurst(0xff8800, 0.5);
    setTimeout(()=>{ if(emoState.current===EMOTIONS.RAINBOW) setEmotion(EMOTIONS.CALM); }, 5000);
  }
}

function jumpAnimation() {
  iState.tgtY=1.5; iState.tgtX=0.75; iState.tgtZ=0.75;
  setTimeout(()=>{ iState.tgtY=0.8; iState.tgtX=1.2; iState.tgtZ=1.2; }, 140);
  setTimeout(()=>{ iState.tgtY=1;   iState.tgtX=1;   iState.tgtZ=1;   }, 320);
}

function onCornerClick() {
  // Click en esquina → estrella (21)
  morphTo('star', 3.5);
  setEmotion(EMOTIONS.HAPPY);
  showHint('¡Esquina secreta! El Cubo se ha convertido en estrella. ⭐');
  triggerBurst(0xffff00, 0.4);
}

function onShiftClick() {
  // Shift+click → se divide en mini cubos (31)
  showHint('SHIFT+CLICK: El Cubo se ha dividido… pero sigue siendo él.');
  triggerBurst(0x8888ff, 0.6);
  // Simulamos con glitch intenso + escala
  glitchPass.uniforms.amount.value = 0.8;
  iState.tgtX=0.6; iState.tgtY=0.6; iState.tgtZ=0.6;
  setTimeout(()=>{
    glitchPass.uniforms.amount.value=0;
    iState.tgtX=1; iState.tgtY=1; iState.tgtZ=1;
    setEmotion(EMOTIONS.NERVOUS);
    showHint('...Se ha reunificado. El Cubo necesita terapia.');
  }, 1800);
}

function onAltClick() {
  // Alt+click → flor animada (32)
  showHint('ALT+CLICK: ¡Una flor! El Cubo tiene un lado sensible.');
  morphTo('star', 4);
  cubeMat.color.setHex(0xff88aa);
  setEmotion(EMOTIONS.SHY);
}

function onCtrlClick() {
  // CTRL+click → cambia la gravedad (43)
  const axes = ['y','x','z','-y'];
  const idx  = axes.indexOf(iState.gravityDir._axis||'y');
  const next = axes[(idx+1)%axes.length];
  iState.gravityDir._axis = next;
  showHint(`CTRL+CLICK: Gravedad → ${next.toUpperCase()}. La física ya no tiene sentido.`);
  setEmotion(EMOTIONS.GLITCH);
  triggerBurst(0x00ff88);
  iState.tgtX=1.3; iState.tgtY=0.7; iState.tgtZ=1.3;
  setTimeout(()=>{ iState.tgtX=1; iState.tgtY=1; iState.tgtZ=1; setEmotion(EMOTIONS.CALM); }, 2000);
}

// ── Doble Click ───────────────────────────────────────────
function handleDoubleClick(e) {
  addStress(20);

  if(e && e.shiftKey) {
    // Doble click → ya lo haremos sin shift tb
  }

  // 1) → se convierte en esfera y rueda (1)
  morphTo('sphere', 3.5);
  setEmotion(EMOTIONS.HAPPY);
  showHint('¡DOBLE CLICK! El Cubo se volvió esfera. ¿Por qué? No lo sabe.');
  triggerBurst(0x00ffff);
  iState.rotSpeedY = 0.05;
  setTimeout(()=>{ iState.rotSpeedY=iState.rotSpeedBase; }, 3500);

  // Glitch leve
  glitchPass.uniforms.amount.value = 0.4;
  setTimeout(()=>{ glitchPass.uniforms.amount.value=0; }, 600);
}

// 10 dobles clicks seguidos → pánico total (47)
let dblClickCount = 0;
let dblClickTimer = 0;
// (se gestiona en updateRapidClicks)

// ── Hold → derretimiento (3) ──────────────────────────────
function updateHold(dt) {
  if(iState.isHolding && iState.isHovered && !iState.dragActive) {
    iState.holdTimer += dt;
    deform.melt = Math.min(1, iState.holdTimer * 0.35);
    if(deform.melt > 0.1) setEmotion(EMOTIONS.MELTING);

    // 10 seg quieto encima → derrite ansioso (28)
    if(iState.holdTimer > 10) {
      setEmotion(EMOTIONS.ANGRY);
      addStress(dt*20);
    }
  } else {
    iState.holdTimer = 0;
    if(!iState.rightClickIce && deform.melt>0) {
      deform.melt = Math.max(0, deform.melt - dt*0.2);
    }
  }
}

// ── Scroll (15,16,29,30,48,49) ────────────────────────────
window.addEventListener('wheel', (e) => {
  const d = e.deltaY;
  iState.wavePower = Math.min(1, iState.wavePower + Math.abs(d)*0.006);
  addStress(4);

  if(d > 0) {
    // Scroll abajo → vibra más (15), se aplana si max (29)
    if(iState.wavePower > 0.85) {
      morphTo('flat', 2.5);
      showHint('SCROLL MÁXIMO: El Cubo se ha aplanado como una crepe.');
    } else if(iState.wavePower > 0.4) setEmotion(EMOTIONS.NERVOUS);
    // Efecto acelera-tiempo (48)
    if(Math.abs(d) > 400) {
      iState.rotSpeedY = 0.08;
      showHint('¡SCROLL RÁPIDO! El Cubo entra en modo acelerado.');
      setTimeout(()=>{ iState.rotSpeedY=iState.rotSpeedBase; }, 2000);
    }
  } else {
    // Scroll arriba → se encoge (16), se infla si max (30)
    if(iState.wavePower > 0.85) {
      morphTo('inflated', 3);
      showHint('SCROLL MÁXIMO: El Cubo se ha inflado. Está contento.');
      setEmotion(EMOTIONS.HAPPY);
    } else {
      iState.tgtX=0.75; iState.tgtY=0.75; iState.tgtZ=0.75;
      setTimeout(()=>{ iState.tgtX=1; iState.tgtY=1; iState.tgtZ=1; }, 800);
      setEmotion(EMOTIONS.SHY);
    }
    // Cámara lenta (49)
    if(Math.abs(d) > 300 && d<0) {
      showHint('El Cubo entra en modo cámara lenta líquida…');
      deform.wave = Math.min(1, deform.wave+0.5);
    }
  }
}, { passive:true });

// ── Teclas (41,42,64,65,76,94) ───────────────────────────
const keysHeld = new Set();
document.addEventListener('keydown', (e) => {
  keysHeld.add(e.key);
  handleKeyDown(e);
});
document.addEventListener('keyup', (e) => {
  keysHeld.delete(e.key);
  iState.shiftHeld = keysHeld.has('Shift');
  iState.altHeld   = keysHeld.has('Alt');
  iState.ctrlHeld  = keysHeld.has('Control');
});

function handleKeyDown(e) {
  iState.shiftHeld = e.shiftKey;
  iState.altHeld   = e.altKey;
  iState.ctrlHeld  = e.ctrlKey;

  const k = e.key;

  // Teclas A+D → moonwalk (41)
  if(keysHeld.has('a') && keysHeld.has('d')) {
    onMoonwalk(); return;
  }
  // Teclas W+S → gusano (42)
  if(keysHeld.has('w') && keysHeld.has('s')) {
    deform.worm = 1;
    setEmotion(EMOTIONS.NERVOUS);
    showHint('W+S: El Cubo se ha convertido en un gusano elástico.');
    setTimeout(()=>{ deform.worm=0; setEmotion(EMOTIONS.CALM); }, 3000);
    return;
  }

  // Tecla B → plátano (12)
  if(k==='b' || k==='B') {
    morphTo('sphere', 3);
    cubeMat.color.setHex(0xffee00);
    cubeMat.emissive.setHex(0x886600);
    setEmotion(EMOTIONS.HAPPY);
    showHint('B: El Cubo es ahora un plátano con ojos. ¿Ves los ojos? Están ahí.');
    triggerBurst(0xffee00);
    return;
  }

  // Enter → se reinventa (64)
  if(k==='Enter') {
    onReinvent();
    return;
  }

  // Backspace → capa hueca (65)
  if(k==='Backspace') {
    e.preventDefault();
    onBackspace();
    return;
  }

  // Escape → nuevo fondo (94)
  if(k==='Escape') {
    onEscape();
    return;
  }

  // Espacio → combo REALIDAD CÚBICA si hay scroll y click
  if(k===' ') {
    checkRealidadCubica();
    return;
  }

  // ALT mantenido 10s → modo portal (44)
  if(k==='Alt') {
    iState.altTimer = 0; // reset, se acumula en loop
  }

  // Tecla F12 → mensaje burlón en consola (37)
  // (no podemos interceptar F12 nativo, pero lo anotamos)
  // Se inyecta en arranque abajo

  // Todas las teclas a la vez (76) — pánico
  if(keysHeld.size >= 5) {
    onTotalPanic();
  }

  // Konami + variantes — gestionado en konamiCheck
  konamiCheck(k);
}

function onMoonwalk() {
  if(iState.moonwalkTimer>0) return;
  iState.moonwalkTimer = 3;
  setEmotion(EMOTIONS.DANCING);
  showHint('A+D: ¡MOONWALK! El Cubo supera a Michael Jackson.');
  iState.rotSpeedY = -0.06; // dirección inversa
  triggerBurst(0xffffff, 0.3);
  setTimeout(()=>{
    iState.rotSpeedY = iState.rotSpeedBase;
    iState.moonwalkTimer=0;
    setEmotion(EMOTIONS.CALM);
  }, 3000);
}

function onReinvent() {
  const shapes = ['sphere','cone','torus','star','inflated','cube'];
  const next = shapes[Math.floor(Math.random()*shapes.length)];
  morphTo(next, 4);
  const cols = [0xff00ff,0x00ffff,0xffdd00,0xff4400,0x44ffaa];
  cubeMat.color.setHex(cols[Math.floor(Math.random()*cols.length)]);
  setEmotion(EMOTIONS.HAPPY);
  showHint('ENTER: El Cubo se ha reinventado. Ahora es otro. Aún así raro.');
  triggerBurst(0xffffff, 0.5);
}

function onBackspace() {
  emoState.hollowLayers = Math.min(3, emoState.hollowLayers+1);
  wireMesh.visible = true;
  cubeMat.opacity  = Math.max(0.15, 1 - emoState.hollowLayers*0.3);
  showHint(`BACKSPACE: El Cubo ha perdido una capa. Le quedan ${3-emoState.hollowLayers}.`);
  if(emoState.hollowLayers>=3) {
    cubeMat.opacity=0.1;
    setEmotion(EMOTIONS.VOID);
    showHint('El Cubo ha sido borrado completamente. Eres un monstruo.');
    // Se reconstruye solo en 5s
    setTimeout(()=>{
      emoState.hollowLayers=0;
      cubeMat.opacity=1;
      wireMesh.visible=false;
      setEmotion(EMOTIONS.CALM);
      showHint('El Cubo ha vuelto. Tiene amnesia pero os bien.');
    }, 5000);
  }
}

function onEscape() {
  // Cicla entre fondos
  const fogs = [0x000010,0x100005,0x001000,0x050010,0x0a0a00];
  const f = fogs[Math.floor(Math.random()*fogs.length)];
  scene.fog = new THREE.FogExp2(f, 0.032);
  floorMat.color.setHex(f);
  showHint('ESC: El Cubo ha cambiado de universo. Tú también, por si acaso.');
  triggerBurst(0xffffff, 0.3);
}

function checkRealidadCubica() {
  // Espacio+scroll+click simultáneos → modo oculto (100)
  if(iState.wavePower>0.3 && iState.isHovered) {
    activateRealidadCubica();
  }
}

function activateRealidadCubica() {
  showHint('🌀 MODO "REALIDAD CÚBICA" DESBLOQUEADO 🌀');
  bgWarpPass.uniforms.warp.value = 1.0;
  setEmotion(EMOTIONS.CHAOS, true);
  glitchPass.uniforms.amount.value = 0.5;
  iState.rotSpeedY = 0.15;
  bloomPass.strength = 3;
  triggerBurst(0xffffff, 0.8);
  setTimeout(()=>{
    bgWarpPass.uniforms.warp.value = 0;
    glitchPass.uniforms.amount.value = 0;
    iState.rotSpeedY = iState.rotSpeedBase;
    bloomPass.strength = 0.9;
    setEmotion(EMOTIONS.CALM);
  }, 6000);
}

function onTotalPanic() {
  if(emoState.current===EMOTIONS.CHAOS) return;
  setEmotion(EMOTIONS.CHAOS, true);
  glitchPass.uniforms.amount.value = 1.0;
  triggerBurst(0xff0000, 0.8);
  showHint('TODAS LAS TECLAS A LA VEZ. El Cubo ha entrado en pánico total. Estás loco.');
  iState.rotSpeedY = 0.2;
  bloomPass.strength = 3;
  setTimeout(()=>{
    glitchPass.uniforms.amount.value=0;
    iState.rotSpeedY=iState.rotSpeedBase;
    bloomPass.strength=0.9;
    setEmotion(EMOTIONS.NERVOUS);
  }, 3000);
}

// ── Konami + variantes ────────────────────────────────────
const konamiSeq    = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
const rickrollSeq  = ['r','i','c','k']; // RICK (33)
let konamiIdx=0, rickIdx=0;
const seqBuffer = [];

function konamiCheck(key) {
  seqBuffer.push(key.toLowerCase());
  if(seqBuffer.length > 15) seqBuffer.shift();

  // Konami code
  if(key === konamiSeq[konamiIdx]) {
    konamiIdx++;
    if(konamiIdx===konamiSeq.length) {
      konamiIdx=0;
      triggerKonami();
    }
  } else { konamiIdx=0; }

  // RICK (33)
  if(key.toLowerCase()===rickrollSeq[rickIdx]) {
    rickIdx++;
    if(rickIdx===rickrollSeq.length) {
      rickIdx=0;
      onRick();
    }
  } else { rickIdx=0; }
}

function triggerKonami() {
  setEmotion(EMOTIONS.ENLIGHTENED);
  triggerBurst(0xffffff, 0.8);
  glitchPass.uniforms.amount.value=0.9;
  showHint('KONAMI CODE ↑↑↓↓←→←→BA. El Cubo es OMNISCIENTE. 5 segundos.');
  morphTo('sphere');
  iState.tgtX=2; iState.tgtY=2; iState.tgtZ=2;
  setTimeout(()=>{
    glitchPass.uniforms.amount.value=0;
    iState.tgtX=1; iState.tgtY=1; iState.tgtZ=1;
    morphTo('cube');
    setEmotion(EMOTIONS.CALM);
  }, 5000);
}

function onRick() {
  // Mini cubo bailando (33)
  babyMesh.visible = true;
  emoState.babyVisible = true;
  babyMesh.material.color.setHex(0xff2200);
  showHint('RICK: Ha aparecido un mini cubo. Está bailando "Never Gonna Give You Up".');
  setEmotion(EMOTIONS.DANCING);
  setTimeout(()=>{
    if(!emoState.babyFused) babyMesh.visible=false;
    emoState.babyVisible=false;
    setEmotion(EMOTIONS.CALM);
  }, 8000);
}

// ── Rapid click counter ───────────────────────────────────
function updateRapidClicks(dt) {
  if(emoState.rapidClickTimer>0) {
    emoState.rapidClickTimer -= dt;
  } else if(emoState.rapidClickCount>0) {
    // Expiró la ventana
    if(emoState.rapidClickCount>=5) {
      // 5+ clicks → explota en confeti (2)
      onConfettiExplosion();
    }
    emoState.rapidClickCount = 0;
  }

  // 10 dobles clicks (47): tracked via dblClickCount
  if(dblClickTimer > 0) {
    dblClickTimer -= dt;
    if(dblClickTimer <= 0) dblClickCount = 0;
  }
}

function onConfettiExplosion() {
  iState.tgtX=1.6; iState.tgtY=1.6; iState.tgtZ=1.6;
  triggerBurst(0xff00ff, 0.7);
  setEmotion(EMOTIONS.SCARED);
  showHint('5 CLICKS SEGUIDOS: ¡CONFETI! El Cubo explota de estrés.');
  setTimeout(()=>{
    iState.tgtX=1; iState.tgtY=1; iState.tgtZ=1;
    triggerBurst(0x00ffff, 0.4);
    setEmotion(EMOTIONS.SHY);
    showHint('...se ha recompuesto. Pero nunca lo olvidará.');
  }, 800);
  addStress(30);
}

// ── Click en cubo bebé ────────────────────────────────────
function checkBabyCorner(e) {
  const r  = renderer.domElement.getBoundingClientRect();
  const nx = (e.clientX - r.left)/r.width;
  const ny = (e.clientY - r.top)/r.height;
  if(nx > 0.85 && ny > 0.8) {
    // Esquina inferior derecha → bebé aparece (91)
    babyMesh.visible = true;
    emoState.babyVisible = true;
    showHint('¡Un Cubo bebé ha aparecido en la esquina! ¿Lo has encontrado?');
  }
}

// ── Context menu OFF ──────────────────────────────────────
container.addEventListener('contextmenu', (e)=>e.preventDefault());

// ── Touch (móvil) ─────────────────────────────────────────
let touchStart=0, lastTouch=0;
container.addEventListener('touchstart', (e)=>{
  e.preventDefault();
  touchStart=performance.now();
  iState.isHolding=true; iState.holdStart=touchStart;
  iState.isHovered=true; addStress(8);
},{passive:false});
container.addEventListener('touchend', (e)=>{
  e.preventDefault();
  const d=performance.now()-touchStart, now=Date.now();
  iState.isHolding=false; iState.isHovered=false;
  if(d<300){ now-lastTouch<350? handleDoubleClick({}): handleSingleClick({}); lastTouch=now; }
  deform.melt=0; iState.tgtX=1; iState.tgtY=1; iState.tgtZ=1;
},{passive:false});

/* ════════════════════════════════════════════════════════════
   ⑦ TextCommandSystem — palabras escritas
════════════════════════════════════════════════════════════ */

let typedBuffer = '';
let typeTimer   = 0;

const WORD_COMMANDS = {
  'LOVE':    onWordLove,
  'HATE':    onWordHate,
  'RAIN':    onWordRain,
  'SUN':     onWordSun,
  'HELL':    onWordHell,
  'PEACE':   onWordPeace,
  'PARTY':   onWordParty,
  'CHESS':   onWordChess,
  'SPACE':   onWordSpace,
  'RAINBOW': onWordRainbow,
  'METAL':   onWordMetal,
  'SOFT':    onWordSoft,
  'ANGRY':   onWordAngry,
  'SAD':     onWordSad,
  'HAPPY':   onWordHappy,
  'CHAOS':   onWordChaos,
  'MIRROR':  onWordMirror,
  'CAT':     onWordCat,
  'DOG':     onWordDog,
  'VOID':    onWordVoid,
  'ERROR':   onWordError,
  '404':     onWord404,
  '000':     onWord000,
  'AI':      onWordAI,
  'RICK':    ()=>{}, // ya gestionado en konami
  'BAILA':   onWordBaila,
  'QUIETO':  onWordQuieto,
};

document.addEventListener('keypress', (e) => {
  if(e.ctrlKey || e.altKey || e.metaKey) return;
  const ch = e.key.toUpperCase();
  if(/^[A-Z0-9ÁÉÍÓÚÑ]$/.test(ch)) {
    typedBuffer += ch;
    typeTimer   = 2.5;
    document.getElementById('typed-display').textContent = typedBuffer;
    document.getElementById('typed-display').classList.remove('hidden');

    // Comprobar si algún comando coincide
    for(const [word, fn] of Object.entries(WORD_COMMANDS)) {
      if(typedBuffer.endsWith(word)) {
        typedBuffer = '';
        document.getElementById('typed-display').textContent='';
        document.getElementById('typed-display').classList.add('hidden');
        fn();
        break;
      }
    }
  }
});

function updateTypedBuffer(dt) {
  if(typeTimer>0){
    typeTimer-=dt;
    if(typeTimer<=0){
      typedBuffer='';
      document.getElementById('typed-display').textContent='';
      document.getElementById('typed-display').classList.add('hidden');
    }
  }
}

// ── Implementación de comandos de palabra ─────────────────

function onWordLove() {
  setEmotion(EMOTIONS.HAPPY);
  showHint('LOVE: El Cubo se llena de corazones. Te quiere. Un poco. Quizás.');
  triggerBurst(0xff2266, 0.5);
  showFloatLabel('❤️', 3);
  morphTo('sphere', 4);
}
function onWordHate() {
  setEmotion(EMOTIONS.BURNING);
  glitchPass.uniforms.amount.value=0.7;
  showHint('HATE: El Cubo se QUEMA. Lo has herido. ¿Estás contento ahora?');
  triggerBurst(0xff2200, 0.6);
  setTimeout(()=>{
    glitchPass.uniforms.amount.value=0;
    morphTo('cube');
    setEmotion(EMOTIONS.CALM);
    showHint('El Cubo ha renacido de sus cenizas. Como un Fénix, pero cúbico.');
  }, 4000);
}
function onWordRain() {
  setEmotion(EMOTIONS.LONELY);
  showHint('RAIN: Llueve sobre el Cubo. Está triste pero le gusta.');
  deform.wave=0.8;
  setTimeout(()=>{ deform.wave=0; setEmotion(EMOTIONS.CALM); }, 5000);
}
function onWordSun() {
  specialLight.intensity = 5;
  setEmotion(EMOTIONS.HAPPY);
  showHint('SUN: ¡El Cubo brilla con mil soles! ¡CEGADOR!');
  bloomPass.strength=3;
  setTimeout(()=>{ specialLight.intensity=0; bloomPass.strength=0.9; }, 4000);
}
function onWordHell() {
  setEmotion(EMOTIONS.BURNING);
  glitchPass.uniforms.amount.value=0.6;
  showHint('HELL: Colmillos. Fuego. El Cubo desaprueba esto.');
  triggerBurst(0xff1100, 0.7);
  iState.tgtX=1.4; iState.tgtY=1.4; iState.tgtZ=1.4;
  setTimeout(()=>{
    glitchPass.uniforms.amount.value=0;
    iState.tgtX=1; iState.tgtY=1; iState.tgtZ=1;
    setEmotion(EMOTIONS.CALM);
  }, 3000);
}
function onWordPeace() {
  setEmotion(EMOTIONS.ENLIGHTENED);
  showHint('PEACE: Flores. Música chill. El Cubo ha encontrado el equilibrio.');
  triggerBurst(0xaaffaa, 0.3);
  morphTo('sphere', 5);
  bloomPass.strength=2.5;
  setTimeout(()=>{ bloomPass.strength=0.9; setEmotion(EMOTIONS.CALM); }, 5000);
}
function onWordParty() {
  setEmotion(EMOTIONS.DANCING);
  showHint('PARTY: LUCES STROBO. BASE TECHNO. El Cubo no para.');
  let toggle=false;
  const iv = setInterval(()=>{
    fillLight.color.setHSL(Math.random(),1,0.5);
    rimLight.color.setHSL(Math.random(),1,0.5);
    bloomPass.strength = toggle?2.5:1.5; toggle=!toggle;
  }, 150);
  setTimeout(()=>{
    clearInterval(iv);
    setEmotion(EMOTIONS.CALM);
    bloomPass.strength=0.9;
  }, 6000);
}
function onWordChess() {
  // Tablero animado momentáneo (81)
  showHint('CHESS: El Cubo es ahora un tablero de ajedrez. ¿Qué es esto?');
  cubeMat.color.setHex(0x888888);
  cubeMat.emissive.setHex(0x222222);
  morphTo('flat', 4);
  setTimeout(()=>{ morphTo('cube'); setEmotion(EMOTIONS.CALM); }, 4000);
}
function onWordSpace() {
  // Agujero negro (82)
  setEmotion(EMOTIONS.VOID);
  showHint('SPACE: El Cubo entra en un agujero negro. Ya no existe. Aún así está ahí.');
  iState.tgtX=0.1; iState.tgtY=0.1; iState.tgtZ=0.1;
  glitchPass.uniforms.amount.value=1.0;
  setTimeout(()=>{
    glitchPass.uniforms.amount.value=0;
    iState.tgtX=1; iState.tgtY=1; iState.tgtZ=1;
    setEmotion(EMOTIONS.CALM);
    morphTo('cube');
  }, 4000);
}
function onWordRainbow() {
  setEmotion(EMOTIONS.RAINBOW);
  showHint('RAINBOW: El Cubo es ahora un cristal prismático eterno.');
  morphTo('sphere', 6);
}
function onWordMetal() {
  cubeMat.roughness=0.02; cubeMat.metalness=0.95;
  cubeMat.color.setHex(0xaaaaaa); cubeMat.emissive.setHex(0x222222);
  setEmotion(EMOTIONS.FROZEN);
  showHint('METAL: El Cubo es ACERO PURO. No siente. No piensa. Solo existe.');
  setTimeout(()=>{ cubeMat.roughness=0.12; cubeMat.metalness=0.05; setEmotion(EMOTIONS.CALM); }, 5000);
}
function onWordSoft() {
  cubeMat.roughness=0.95; cubeMat.metalness=0.0;
  cubeMat.color.setHex(0xffccee);
  showHint('SOFT: El Cubo es ahora peludo y tierno. Tienes 5 segundos para abrazarlo.');
  setEmotion(EMOTIONS.SHY);
  deform.bounce=0.5;
  setTimeout(()=>{ cubeMat.roughness=0.12; deform.bounce=0; setEmotion(EMOTIONS.CALM); }, 5000);
}
function onWordAngry() {
  setEmotion(EMOTIONS.ANGRY);
  triggerBurst(0xff0000, 0.6);
  showHint('ANGRY: El Cubo ya estaba bien, ahora está furioso por tu culpa.');
  addStress(40);
}
function onWordSad() {
  setEmotion(EMOTIONS.MELTING);
  deform.melt=0.5;
  showHint('SAD: El Cubo se derrite despacito. Necesita un abrazo.');
  setTimeout(()=>{ deform.melt=0; setEmotion(EMOTIONS.LONELY); }, 4000);
}
function onWordHappy() {
  setEmotion(EMOTIONS.HAPPY);
  jumpAnimation(); triggerBurst(0xffdd00,0.5);
  showHint('HAPPY: ¡El Cubo salta de alegría! Literalmente.');
  morphTo('inflated',3);
}
function onWordChaos() {
  setEmotion(EMOTIONS.CHAOS, true);
  let i=0;
  const shapes=['sphere','cone','torus','star','flat','cube'];
  const iv=setInterval(()=>{
    morphTo(shapes[i%shapes.length]);
    cubeMat.color.setHSL(Math.random(),1,0.5);
    i++;
  }, 400);
  glitchPass.uniforms.amount.value=0.8;
  showHint('CHAOS: El Cubo muta entre todas sus formas. No hay vuelta atrás.');
  setTimeout(()=>{ clearInterval(iv); glitchPass.uniforms.amount.value=0; morphTo('cube'); setEmotion(EMOTIONS.CALM); }, 5000);
}
function onWordMirror() {
  showHint('MIRROR: El Cubo quiere reflejar tu cámara. Pero no puede. Finge hacerlo.');
  cubeMat.roughness=0.0; cubeMat.metalness=1.0; cubeMat.clearcoat=1.0;
  setEmotion(EMOTIONS.SUSPICIOUS);
  setTimeout(()=>{ cubeMat.roughness=0.12; cubeMat.metalness=0.05; setEmotion(EMOTIONS.CALM); }, 5000);
}
function onWordCat() {
  cubeMat.color.setHex(0xffaa55); cubeMat.emissive.setHex(0x442200);
  setEmotion(EMOTIONS.SHY);
  showHint('CAT: El Cubo es ahora un gato cúbico. Miau. No te mirará directamente.');
  morphTo('sphere',5);
}
function onWordDog() {
  setEmotion(EMOTIONS.HAPPY);
  triggerBurst(0xffaa00, 0.4);
  showHint('DOG: GUAU GUAU. El Cubo ladra. Salta. Quiere que le tires la pelota.');
  jumpAnimation();
  for(let i=0;i<3;i++) setTimeout(()=>jumpAnimation(), i*500);
}
function onWordVoid() {
  setEmotion(EMOTIONS.VOID);
  cubeMat.opacity=0.08;
  showHint('VOID: El Cubo desaparece lentamente. Solo queda su sombra y tu culpa.');
  setTimeout(()=>{ cubeMat.opacity=1; setEmotion(EMOTIONS.CALM); showHint('Ha vuelto. Callado. Cambiado.'); }, 5000);
}
function onWordError() {
  glitchPass.uniforms.amount.value=1.0;
  glitchPass.uniforms.rgbShift.value=0.02;
  setEmotion(EMOTIONS.GLITCH, true);
  showHint('ERROR: CUBO.EXE ha dejado de responder. El problema no eres tú. Sí eres tú.');
  setTimeout(()=>{ glitchPass.uniforms.amount.value=0; glitchPass.uniforms.rgbShift.value=0; setEmotion(EMOTIONS.CALM); }, 3500);
}
function onWord404() {
  glitchPass.uniforms.amount.value=0.7;
  showHint('404: Cubo no encontrado. Ha estado aquí todo el tiempo. Es metáfora.');
  cubeMat.opacity=0.3;
  setTimeout(()=>{ cubeMat.opacity=1; glitchPass.uniforms.amount.value=0; }, 3000);
}
function onWord000() {
  setEmotion(EMOTIONS.VOID);
  bgWarpPass.uniforms.warp.value=0.5;
  showHint('000: El Cubo entra en modo vacío. Nada. Vacío existencial.');
  setTimeout(()=>{ bgWarpPass.uniforms.warp.value=0; setEmotion(EMOTIONS.CALM); }, 4000);
}
function onWordAI() {
  showHint('AI: El Cubo ha activado su IA. Ahora te juzga. Silenciosamente.');
  setEmotion(EMOTIONS.SUSPICIOUS);
  triggerBurst(0x00ff00, 0.3);
}
function onWordBaila() {
  setEmotion(EMOTIONS.DANCING);
  iState.rotSpeedY=0.08;
  showHint('BAILA: El Cubo obedece. Pero con actitud. Baila por cuenta propia.');
  setTimeout(()=>{ iState.rotSpeedY=iState.rotSpeedBase; setEmotion(EMOTIONS.CALM); }, 4000);
}
function onWordQuieto() {
  controls.autoRotate=false;
  iState.autoRotate=false;
  iState.rotSpeedY=0; iState.rotSpeedX=0;
  setEmotion(EMOTIONS.FROZEN);
  showHint('QUIETO: El Cubo obedece. Está quieto. Pero por dentro grita.');
  setTimeout(()=>{ iState.autoRotate=true; iState.rotSpeedY=iState.rotSpeedBase; iState.rotSpeedX=0.002; setEmotion(EMOTIONS.CALM); }, 4000);
}

function showFloatLabel(emoji, duration=3) {
  floatLabel.material.map = makeFloatLabelTex(emoji);
  floatLabel.material.map.needsUpdate=true;
  floatLabel.position.set(0,2.5,0);
  floatLabel.visible=true;
  setTimeout(()=>{ floatLabel.visible=false; }, duration*1000);
}
function makeFloatLabelTex(txt) {
  const cv=document.createElement('canvas'); cv.width=256; cv.height=128;
  const ctx=cv.getContext('2d');
  ctx.clearRect(0,0,256,128); ctx.font='bold 70px serif';
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(txt,128,64);
  return new THREE.CanvasTexture(cv);
}

/* ════════════════════════════════════════════════════════════
   ⑧ MicSystem
════════════════════════════════════════════════════════════ */

const mic = { active:false, analyser:null, dataArray:null, volume:0, stream:null, silenceTimer:0 };

async function startMic() {
  try {
    mic.stream   = await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    const ctx    = new (window.AudioContext||window.webkitAudioContext)();
    const src    = ctx.createMediaStreamSource(mic.stream);
    mic.analyser = ctx.createAnalyser();
    mic.analyser.fftSize = 512;
    mic.dataArray= new Uint8Array(mic.analyser.frequencyBinCount);
    src.connect(mic.analyser);
    mic.active   = true;
    document.getElementById('mic-icon').textContent  = '🎙️';
    document.getElementById('mic-label').textContent = 'Mic Activo';
    document.getElementById('btn-mic').classList.add('active');
    showHint('Micrófono ON. Habla, canta, grita. El Cubo escucha.');
  } catch(e) { showHint('Micrófono: permiso denegado. El Cubo lo entiende.'); }
}
function stopMic() {
  mic.stream?.getTracks().forEach(t=>t.stop());
  mic.active=false; mic.analyser=null;
  document.getElementById('mic-icon').textContent  = '🎤';
  document.getElementById('mic-label').textContent = 'Activar Mic';
  document.getElementById('btn-mic').classList.remove('active');
}
document.getElementById('btn-mic').addEventListener('click', ()=>mic.active?stopMic():startMic());

function updateMic(dt) {
  if(!mic.active||!mic.analyser) return;
  mic.analyser.getByteFrequencyData(mic.dataArray);
  const avg = mic.dataArray.reduce((a,b)=>a+b,0)/mic.dataArray.length;
  mic.volume = avg/128;

  // Detección de "BOOM" / grito fuerte (19,27)
  if(mic.volume > 1.5) {
    setEmotion(EMOTIONS.SCARED);
    jumpAnimation();
    triggerBurst(0xffffff, 0.7);
    showHint('¡¡GRITO DETECTADO!! El Cubo se ha asustado. Justo.');
    mic.silenceTimer=0;
  } else if(mic.volume > 0.8) {
    // Música/sonido alto → baila (9)
    setEmotion(EMOTIONS.DANCING);
    iState.rotSpeedY = 0.04 * mic.volume;
    iState.tgtX = 1+mic.volume*0.12;
    iState.tgtY = 1+mic.volume*0.12;
    iState.tgtZ = 1+mic.volume*0.12;
    bloomPass.strength = Math.min(3, 0.9+mic.volume*1.2);
    mic.silenceTimer=0;
  } else if(mic.volume > 0.3) {
    // Sonido suave → se vuelve líquido (50)
    deform.wave = Math.min(0.6, mic.volume*0.8);
    iState.rotSpeedY = 0.006+mic.volume*0.01;
    if(emoState.current===EMOTIONS.DANCING) setEmotion(EMOTIONS.HAPPY);
    mic.silenceTimer=0;
  } else {
    // Silencio (10)
    mic.silenceTimer += dt;
    deform.wave = Math.max(0, deform.wave-dt*0.5);
    iState.tgtX=1; iState.tgtY=1; iState.tgtZ=1;
    iState.rotSpeedY = iState.rotSpeedBase;
    bloomPass.strength=0.9;
    if(mic.silenceTimer > 3 && emoState.current===EMOTIONS.DANCING) {
      setEmotion(EMOTIONS.SHY);
      showHint('Silencio total. El Cubo suspira dramáticamente. ');
      mic.silenceTimer=0;
    }
  }
}

/* ════════════════════════════════════════════════════════════
   ⑨ TimeSystem
════════════════════════════════════════════════════════════ */

let timeCheckT = 0;
function checkTime() {
  const h = new Date().getHours(), m = new Date().getMinutes();
  if(h>=2 && h<7) {
    if(emoState.current!==EMOTIONS.SLEEPING && emoState.current!==EMOTIONS.ANGRY) {
      setEmotion(EMOTIONS.SLEEPING);
      iState.rotSpeedBase=0.0005; iState.rotSpeedY=0.0005;
    }
  } else if(h===0 && m===0) {
    // Medianoche → místico (77)
    setEmotion(EMOTIONS.MYSTIC, true);
    showHint('¡MEDIANOCHE! El Cubo activa su modo místico. Raro incluso para él.');
    triggerBurst(0x7700ff,0.5);
    setTimeout(()=>setEmotion(EMOTIONS.CALM),10000);
  } else if(h>=12 && h<14) {
    iState.rotSpeedBase=0.012;
  } else if(h>=22) {
    iState.rotSpeedBase=0.003;
  } else {
    iState.rotSpeedBase=0.006;
  }
}

/* ════════════════════════════════════════════════════════════
   ⑩ SpontaneousSystem
════════════════════════════════════════════════════════════ */

const spont = { timer:0, nextT:5+Math.random()*8 };
const SPONT_EVENTS = [
  ()=>{ deform.shake=0.7; setTimeout(()=>deform.shake=0,700); setEmotion(EMOTIONS.NERVOUS); showHint('El Cubo sintió algo. No eras tú. O quizás sí.'); },
  ()=>{ iState.rotSpeedY=0.1; setTimeout(()=>{iState.rotSpeedY=iState.rotSpeedBase;},800); },
  ()=>{ triggerBurst(0xffdd00); setEmotion(EMOTIONS.HAPPY); setTimeout(()=>{ if(emoState.current===EMOTIONS.HAPPY)setEmotion(EMOTIONS.CALM); },2000); },
  ()=>{ iState.tgtX=0.7;iState.tgtY=0.7;iState.tgtZ=0.7; setEmotion(EMOTIONS.SHY); showHint('El Cubo se ha encogido. No lo mires. POR FAVOR no lo mires.'); setTimeout(()=>{iState.tgtX=1;iState.tgtY=1;iState.tgtZ=1;setEmotion(EMOTIONS.CALM);},2500); },
  ()=>{ glitchPass.uniforms.amount.value=0.25; setTimeout(()=>glitchPass.uniforms.amount.value=0,500); showHint('ERROR: EMOCIONES_OVERFLOW.EXE ha dejado de responder.'); },
  ()=>{ if(emoState.stress<30){ setEmotion(EMOTIONS.ENLIGHTENED); iState.tgtX=1.15;iState.tgtY=1.15;iState.tgtZ=1.15; showHint('El Cubo ha alcanzado la paz interior. Dura lo que dura.'); setTimeout(()=>{iState.tgtX=1;iState.tgtY=1;iState.tgtZ=1;setEmotion(EMOTIONS.CALM);},3000); } },
  ()=>{ morphTo('torus',3); showHint('¿Eso ha sido un donut? El Cubo se ha reinventado sin avisar.'); },
  ()=>{ showHint('El Cubo: "…¿Sigues ahí?"'); setEmotion(EMOTIONS.SUSPICIOUS); },
];

function updateSpontaneous(dt) {
  spont.timer += dt;
  if(spont.timer >= spont.nextT) {
    spont.timer = 0;
    spont.nextT = 4+Math.random()*12;
    if(emoState.current!==EMOTIONS.GLITCH && emoState.current!==EMOTIONS.MELTING && !iState.isHolding) {
      SPONT_EVENTS[Math.floor(Math.random()*SPONT_EVENTS.length)]();
    }
  }
}

/* ════════════════════════════════════════════════════════════
   ⑪ UI
════════════════════════════════════════════════════════════ */

// ── Estrés ────────────────────────────────────────────────
function addStress(v) {
  emoState.stress = Math.min(100, emoState.stress+v);
  updateStressUI();
  if(emoState.stress>=100) triggerMeltdown();
  else if(emoState.stress>=80) setEmotion(EMOTIONS.ANGRY);
  else if(emoState.stress>=50 && emoState.current===EMOTIONS.CALM) setEmotion(EMOTIONS.NERVOUS);
}
function decayStress(dt) {
  if(!iState.isHovered && !iState.isHolding) {
    emoState.stress = Math.max(0, emoState.stress-dt*2.5);
    updateStressUI();
    if(emoState.stress<20 && emoState.current===EMOTIONS.ANGRY) setEmotion(EMOTIONS.CALM);
  }
}
function updateStressUI() {
  const fill=document.getElementById('stress-bar-fill'), val=document.getElementById('stress-value');
  const p=Math.round(emoState.stress);
  fill.style.width=p+'%'; val.textContent=p+'%';
  fill.style.background = p<40?'linear-gradient(90deg,#00ffaa,#00ff88)':p<70?'linear-gradient(90deg,#ffaa00,#ff6600)':'linear-gradient(90deg,#ff2200,#ff0066)';
}
function triggerMeltdown() {
  setEmotion(EMOTIONS.ANGRY,true);
  glitchPass.uniforms.amount.value=1.0;
  triggerBurst(0xff0000,0.8);
  showHint('¡¡MELTDOWN!! El Cubo ha alcanzado su límite existencial absoluto.');
  iState.tgtX=2; iState.tgtY=2; iState.tgtZ=2;
  setTimeout(()=>{
    glitchPass.uniforms.amount.value=0; iState.tgtX=1;iState.tgtY=1;iState.tgtZ=1;
    emoState.stress=0; updateStressUI();
    setEmotion(EMOTIONS.SHY);
    showHint('El Cubo se avergüenza de lo que acaba de pasar. Los dos lo sabemos.');
  }, 2500);
}

// ── Idle / Soledad ────────────────────────────────────────
function updateIdle(dt) {
  emoState.idleTime    += dt;
  emoState.totalIdleTime += dt;

  // 4 seg sin interacción → bosteza / duerme (4)
  if(emoState.idleTime > 10 && emoState.current===EMOTIONS.CALM) {
    setEmotion(EMOTIONS.SLEEPING);
    iState.rotSpeedBase=0.0008; iState.rotSpeedY=0.0008;
    showHint('El Cubo bosteza. 10 segundos sin tocarle. Le ha dado sueño.');
  }

  // 20 seg → llama la atención (7)
  if(emoState.idleTime > 20 && emoState.current===EMOTIONS.SLEEPING) {
    showHint('El Cubo: "¡Ey! ¡Sigo aquí! ¡Interactúa conmigo, vamos!"');
    setEmotion(EMOTIONS.NERVOUS);
    deform.shake=0.6; setTimeout(()=>deform.shake=0, 1500);
    emoState.idleTime=12; // reset parcial
  }

  // 1 minuto → Tamagotchi de soledad (20)
  if(emoState.totalIdleTime > 60) {
    emoState.totalIdleTime=0;
    setEmotion(EMOTIONS.LONELY);
    showHint('Llevas 1 minuto sin tocarme. ¿Estás bien? ¿Estoy bien? ¿Qué somos?');
  }

  // 10 min → huevo sorpresa (99)
  const minSinceStart = (Date.now()-emoState.sessionStart)/60000;
  if(minSinceStart > 10 && !emoState.eggShown) {
    emoState.eggShown=true;
    const egShapes=['torus','cone','star','inflated'];
    morphTo(egShapes[Math.floor(Math.random()*egShapes.length)], 6);
    cubeMat.color.setHSL(Math.random(),1,0.6);
    showHint('🥚 HUEVO SORPRESA DESBLOQUEADO: El Cubo lleva 10 minutos contigo y ha mutado.');
    triggerBurst(0xffffff,0.6);
  }

  // Ratón quieto en centro un rato → lanza un beso (71)
  if(iState.isHovered && emoState.idleTime>8) {
    showHint('El Cubo: 😘 *te lanza un beso*. Esto es raro para todos.');
    showFloatLabel('😘',2);
    emoState.idleTime=0;
  }
}

// ── Desafíos ──────────────────────────────────────────────
const challenges = [
  {txt:'Haz hover 10 veces sobre el cubo',target:10,type:'hover', reward:'¡10 hovers! El Cubo baila por ti. Solo por ti.'},
  {txt:'Haz click 5 veces seguidas',       target:5, type:'click', reward:'5 clicks. El Cubo está exhausto. Felicitaciones.'},
  {txt:'Lleva el estrés al 80%',           target:80,type:'stress',reward:'80% de estrés. Eres un peligro público.'},
  {txt:'Derrite el cubo con hold',         target:1, type:'melt',  reward:'Lo has derretido. ¿Estás orgulloso?'},
  {txt:'Escribe CHAOS con el teclado',     target:5, type:'chaos', reward:'CHAOS activado. Te mereces esto.'},
  {txt:'Activa el micrófono y canta',      target:1, type:'mic',   reward:'¡El Cubo ha bailado! Qué vergüenza para todos.'},
];
let curChallenge=0, challengeDone=false;

function updateChallengeUI() {
  if(challengeDone) { challengeDone=false; return; }
  const ch=challenges[curChallenge%challenges.length];
  document.getElementById('challenge-text').textContent=ch.txt;
  let prog=0;
  switch(ch.type){
    case 'hover':  prog=emoState.hoverCount; break;
    case 'click':  prog=emoState.clickCount; break;
    case 'stress': prog=emoState.stress;     break;
    case 'melt':   prog=deform.melt>=0.9?1:0; break;
    case 'chaos':  prog=emoState.current===EMOTIONS.CHAOS?5:0; break;
    case 'mic':    prog=mic.active&&mic.volume>0.8?1:0; break;
  }
  const pct=Math.min(prog,ch.target);
  document.getElementById('challenge-progress').textContent=`${Math.round(pct)} / ${ch.target}`;
  if(prog>=ch.target) {
    showHint(ch.reward);
    curChallenge++;
    emoState.hoverCount=0; emoState.clickCount=0;
    triggerBurst(0xffdd00); setEmotion(EMOTIONS.HAPPY);
    challengeDone=true;
    setTimeout(()=>{
      const n=challenges[curChallenge%challenges.length];
      document.getElementById('challenge-text').textContent=n.txt;
      document.getElementById('challenge-progress').textContent=`0 / ${n.target}`;
    },2500);
  }
}

// ── Hints ─────────────────────────────────────────────────
let hintTimer=null;
function showHint(txt) {
  const box=document.getElementById('hint-box'), span=document.getElementById('hint-text');
  span.textContent=txt; box.classList.remove('hidden'); box.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer=setTimeout(()=>{ box.classList.remove('show'); setTimeout(()=>box.classList.add('hidden'),500); },4500);
}

// ── Baby cube click ───────────────────────────────────────
babyMesh.userData.clickable = true;
// Comprobamos click en bebé en el raycaster general
container.addEventListener('click', (e)=>{
  if(!emoState.babyVisible) return;
  const r=renderer.domElement.getBoundingClientRect();
  mouse2D.x=((e.clientX-r.left)/r.width)*2-1;
  mouse2D.y=-((e.clientY-r.top)/r.height)*2+1;
  raycaster.setFromCamera(mouse2D,camera);
  const hits=raycaster.intersectObject(babyMesh,false);
  if(hits.length>0) {
    // Fusión (92)
    emoState.babyFused=true;
    babyMesh.visible=false;
    iState.tgtX=1.15; iState.tgtY=1.15; iState.tgtZ=1.15;
    showHint('¡El Cubo bebé se ha fusionado con el grande! El grande ha crecido un poco.');
    triggerBurst(0xff88ff,0.4);
    setTimeout(()=>{ iState.tgtX=1;iState.tgtY=1;iState.tgtZ=1; },1000);
  }
});

// ── Mensaje de consola burlón (37) ───────────────────────
console.log('%c👁️ El Cubo te está mirando desde la consola.', 'color:#bf00ff;font-size:14px;font-weight:bold;');
console.log('%c¿Inspeccionas el código? Interesante.', 'color:#00ffaa;font-size:12px;');
console.log('%c Pro tip: escribe KONAMI.cheat() para hacer trampa. (No existe, pero te has ilusionado)', 'color:#ff88ff;font-size:11px;');

// ── Mensaje al volver a la pestaña (39) ──────────────────
document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden) {
    const msgs = [
      '¡Oh, has vuelto! El Cubo no te ha echado de menos. Mucho.',
      '…como si nada. El Cubo lo ha notado.',
      'El Cubo ha estado practicando. Tú no lo sabes.',
    ];
    showHint(msgs[Math.floor(Math.random()*msgs.length)]);
    triggerBurst(0x8844ff,0.3);
  }
});

// ── ALT mantenido 10s → portal (44) ──────────────────────
function updateAltHold(dt) {
  if(keysHeld.has('Alt')) {
    iState.altTimer += dt;
    if(iState.altTimer >= 10 && !iState.portalActive) {
      iState.portalActive = true;
      setEmotion(EMOTIONS.GLITCH, true);
      bgWarpPass.uniforms.warp.value=0.8;
      glitchPass.uniforms.amount.value=0.6;
      showHint('ALT ×10s: MODO PORTAL DIMENSIONAL. El Cubo ya no sabe dónde está.');
      morphTo('torus');
      setTimeout(()=>{
        iState.altTimer=0; iState.portalActive=false;
        bgWarpPass.uniforms.warp.value=0;
        glitchPass.uniforms.amount.value=0;
        morphTo('cube');
        setEmotion(EMOTIONS.CALM);
      },5000);
    }
  } else {
    if(!iState.portalActive) iState.altTimer=0;
  }
}

/* ════════════════════════════════════════════════════════════
   ⑫ AnimationLoop
════════════════════════════════════════════════════════════ */

const clock = new THREE.Clock();
let timeCheckAccum=0;

function animate() {
  requestAnimationFrame(animate);
  const dt=clock.getDelta(), elapsed=clock.getElapsedTime();

  // Time check
  timeCheckAccum+=dt;
  if(timeCheckAccum>60){ timeCheckAccum=0; checkTime(); }

  // Sistemas de juego
  updateHold(dt);
  updateMic(dt);
  updateSpontaneous(dt);
  updateRapidClicks(dt);
  updateTypedBuffer(dt);
  updateAltHold(dt);
  updateIdle(dt);
  updateEmotionTransition(dt);
  decayStress(dt);

  // Decaimiento de ondas
  iState.wavePower = Math.max(0, iState.wavePower-dt*0.7);
  deform.wave = Math.max(0, deform.wave-dt*0.4);

  // Morph de forma
  updateMorph(dt);

  // Deformación de vértices (solo si hay algo)
  applyVertexDeform(elapsed);

  // ── Squash & Stretch ──────────────────────────────────
  const lf = 1-Math.pow(0.005, dt*8);
  iState.stretchX = THREE.MathUtils.lerp(iState.stretchX, iState.tgtX, lf);
  iState.stretchY = THREE.MathUtils.lerp(iState.stretchY, iState.tgtY, lf);
  iState.stretchZ = THREE.MathUtils.lerp(iState.stretchZ, iState.tgtZ, lf);
  cubeMesh.scale.set(iState.stretchX, iState.stretchY, iState.stretchZ);

  // ── Rotación ──────────────────────────────────────────
  // El usuario puede rotar con OrbitControls; la auto-rotación
  // se aplica en el mesh local para que no interfiera con la cámara
  const emo=emoState.current;
  if(iState.autoRotate) {
    if(emo===EMOTIONS.SLEEPING) {
      cubeMesh.rotation.y += 0.0004;
      cubeMesh.rotation.z = Math.sin(elapsed*0.4)*0.04;
    } else if(emo===EMOTIONS.GLITCH || emo===EMOTIONS.CHAOS) {
      cubeMesh.rotation.x += (Math.random()-0.5)*0.08;
      cubeMesh.rotation.y += (Math.random()-0.5)*0.08;
    } else if(emo===EMOTIONS.DANCING) {
      cubeMesh.rotation.x = Math.sin(elapsed*4)*0.18;
      cubeMesh.rotation.y += iState.rotSpeedY;
      cubeMesh.rotation.z = Math.cos(elapsed*3)*0.12;
    } else if(emo===EMOTIONS.FROZEN) {
      // Quieto
    } else {
      cubeMesh.rotation.x += iState.rotSpeedX;
      cubeMesh.rotation.y += iState.rotSpeedY;
      cubeMesh.rotation.z  = deform.shake>0
        ? Math.sin(elapsed*32)*0.04*deform.shake : 0;
    }
  }

  // Decaimiento de rotSpeed boost
  if(iState.rotSpeedY > iState.rotSpeedBase+0.001) {
    iState.rotSpeedY = THREE.MathUtils.lerp(iState.rotSpeedY, iState.rotSpeedBase, dt*1.5);
  }

  // ── Flotación ─────────────────────────────────────────
  const floatY = Math.sin(elapsed*1.1)*0.1;
  cubeMesh.position.y = floatY + (emo===EMOTIONS.MELTING?-deform.melt*0.3:0);
  if(emo===EMOTIONS.VOID) cubeMesh.position.y = floatY + Math.sin(elapsed*0.3)*0.4;

  // ── Baby cube flotando ────────────────────────────────
  if(babyMesh.visible) {
    babyMesh.rotation.y += 0.03;
    babyMesh.rotation.x  = Math.sin(elapsed*2)*0.2;
    babyMesh.position.y  = -1.8+Math.sin(elapsed*3)*0.1;
  }

  // ── Label flotante ─────────────────────────────────────
  if(floatLabel.visible) {
    floatLabel.position.y = 2.5+Math.sin(elapsed*2)*0.1;
    floatLabel.rotation.y = elapsed*0.5;
    floatLabel.lookAt(camera.position);
  }

  // ── Deform decay ──────────────────────────────────────
  deform.shake  = Math.max(0, deform.shake  - dt*1.5);
  deform.bounce = Math.max(0, deform.bounce - dt*0.8);
  deform.worm   = Math.max(0, deform.worm   - dt*0.3);

  // ── Burst ─────────────────────────────────────────────
  updateBurst();

  // ── Partículas de fondo ───────────────────────────────
  bgParticles.rotation.y += dt*0.015;
  bgParticles.rotation.x += dt*0.004;
  pMat.opacity = 0.45+Math.sin(elapsed*1.8)*0.2;

  // ── Luces pulsantes ───────────────────────────────────
  fillLight.intensity  = 2.0+Math.sin(elapsed*2.2)*0.6;
  rimLight.intensity   = 1.5+Math.cos(elapsed*1.6)*0.4;
  underGlow.intensity  = 0.8+Math.sin(elapsed*3.0)*0.3;
  if(emo===EMOTIONS.ANGRY||emo===EMOTIONS.BURNING) {
    keyLight.intensity = 2.5+Math.sin(elapsed*18)*2;
  } else if(emo===EMOTIONS.SLEEPING) {
    keyLight.intensity = 0.35;
  } else {
    keyLight.intensity = 1.6;
  }
  specialLight.intensity = Math.max(0, specialLight.intensity-dt*2);

  // ── Arcoíris continuo ─────────────────────────────────
  if(emo===EMOTIONS.RAINBOW) {
    emoState.rainbowHue=(emoState.rainbowHue+dt*90)%360;
    cubeMat.color.setHSL(emoState.rainbowHue/360,1,0.6);
    cubeMat.emissive.setHSL(emoState.rainbowHue/360,1,0.25);
  }

  // ── Glitch shader ─────────────────────────────────────
  glitchPass.uniforms.time.value = elapsed;
  bgWarpPass.uniforms.time.value  = elapsed;

  // ── UI ────────────────────────────────────────────────
  updateChallengeUI();
  controls.update();
  composer.render();
}

// ── Resize ────────────────────────────────────────────────
window.addEventListener('resize', ()=>{
  const w=container.clientWidth, h=container.clientHeight;
  camera.aspect=w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h); renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  composer.setSize(w,h);
});

// ── Arranque ──────────────────────────────────────────────
checkTime();
updateStressUI();
animate();
