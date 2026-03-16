/**
 * main.js — El Cubo Sensible
 * ════════════════════════════════════════════════════════════
 * Un cubo 3D con emociones, personalidad y reacciones exageradas.
 *
 * Módulos:
 *  ① SceneSetup        — renderer, cámara, luces, loop
 *  ② CubeGeometry      — cubo con morph targets para deformación
 *  ③ EmotionSystem     — estados emocionales y transiciones
 *  ④ InteractionSystem — hover, click, hold, dblclick, scroll
 *  ⑤ MicSystem         — análisis de micrófono
 *  ⑥ TimeSystem        — comportamiento según hora del día
 *  ⑦ RandomBehavior    — acciones espontáneas para parecer vivo
 *  ⑧ UI                — DOM, barra de estrés, desafíos, easter eggs
 * ════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/* ════════════════════════════════════════════════════════════
   ① SceneSetup
════════════════════════════════════════════════════════════ */

const container = document.getElementById('canvas-container');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000010, 0.035);

const camera = new THREE.PerspectiveCamera(
  60,
  container.clientWidth / container.clientHeight,
  0.1, 100
);
camera.position.set(0, 0, 5.5);
camera.lookAt(0, 0, 0);

// ── Luces ──────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0x111122, 0.5);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
keyLight.position.set(3, 5, 4);
keyLight.castShadow = true;
scene.add(keyLight);

const fillLight = new THREE.PointLight(0xff00ff, 2, 15);
fillLight.position.set(-4, 2, 2);
scene.add(fillLight);

const rimLight = new THREE.PointLight(0x00ffff, 1.5, 15);
rimLight.position.set(3, -2, -3);
scene.add(rimLight);

const underGlow = new THREE.PointLight(0xff6600, 1, 8);
underGlow.position.set(0, -3, 0);
scene.add(underGlow);

// ── Post-processing: Bloom ─────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(container.clientWidth, container.clientHeight),
  0.8, 0.4, 0.2
);
composer.addPass(bloomPass);

// Shader de glitch (activado durante estados especiales)
const GlitchShader = {
  uniforms: {
    tDiffuse: { value: null },
    time:     { value: 0 },
    amount:   { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float amount;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      if (amount > 0.01) {
        float sliceH = rand(vec2(floor(uv.y * 20.0), time)) * 2.0 - 1.0;
        uv.x += sliceH * amount * 0.08;
        float r = texture2D(tDiffuse, uv + vec2(amount * 0.015, 0.0)).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uv - vec2(amount * 0.015, 0.0)).b;
        gl_FragColor = vec4(r, g, b, 1.0);
      } else {
        gl_FragColor = texture2D(tDiffuse, uv);
      }
    }
  `,
};
const glitchPass = new ShaderPass(GlitchShader);
composer.addPass(glitchPass);

// ── Partículas de fondo ────────────────────────────────────
const PARTICLE_COUNT = 800;
const pPositions = new Float32Array(PARTICLE_COUNT * 3);
const pColors    = new Float32Array(PARTICLE_COUNT * 3);
const pSizes     = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  pPositions[i*3]   = (Math.random() - 0.5) * 30;
  pPositions[i*3+1] = (Math.random() - 0.5) * 30;
  pPositions[i*3+2] = (Math.random() - 0.5) * 30;
  pColors[i*3]   = Math.random();
  pColors[i*3+1] = Math.random();
  pColors[i*3+2] = 1;
  pSizes[i] = Math.random() * 0.05 + 0.01;
}

const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
pGeo.setAttribute('color',    new THREE.BufferAttribute(pColors, 3));

const pMat = new THREE.PointsMaterial({
  size: 0.06,
  vertexColors: true,
  transparent: true,
  opacity: 0.6,
  sizeAttenuation: true,
});
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

// ── Suelo reflectante ──────────────────────────────────────
const floorGeo = new THREE.CircleGeometry(10, 64);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x060618,
  roughness: 0.2,
  metalness: 0.8,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2.2;
floor.receiveShadow = true;
scene.add(floor);

/* ════════════════════════════════════════════════════════════
   ② CubeGeometry — cubo con deformaciones suaves
════════════════════════════════════════════════════════════ */

/**
 * Crea la geometría base del cubo con subdivisiones
 * para que las deformaciones sean suaves.
 */
function createSensibleCube() {
  const geo = new THREE.BoxGeometry(1.8, 1.8, 1.8, 8, 8, 8);

  // Material principal — MeshPhysicalMaterial para reflexiones bonitas
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x8844ff,
    emissive: 0x220044,
    emissiveIntensity: 0.3,
    roughness: 0.15,
    metalness: 0.05,
    transmission: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 1.0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Guardar posiciones originales para restaurar
  const originalPositions = geo.attributes.position.array.slice();

  return { mesh, mat, geo, originalPositions };
}

const cube = createSensibleCube();
scene.add(cube.mesh);

// ── Partículas de explosión (pool reutilizable) ────────────
const BURST_COUNT = 60;
const burstGeo = new THREE.BufferGeometry();
const burstPos = new Float32Array(BURST_COUNT * 3);
burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));

const burstMat = new THREE.PointsMaterial({
  color: 0xff88ff,
  size: 0.12,
  transparent: true,
  opacity: 0,
  sizeAttenuation: true,
});
const burstParticles = new THREE.Points(burstGeo, burstMat);
scene.add(burstParticles);

// Estado de la explosión
const burst = {
  active: false,
  velocities: Array.from({ length: BURST_COUNT }, () => ({
    x: (Math.random() - 0.5) * 0.25,
    y: (Math.random() - 0.5) * 0.25,
    z: (Math.random() - 0.5) * 0.25,
  })),
  life: 0,
};

function triggerBurst(color = 0xff88ff) {
  burstMat.color.setHex(color);
  burstMat.opacity = 1;
  burst.active = true;
  burst.life   = 1;

  for (let i = 0; i < BURST_COUNT; i++) {
    burstPos[i*3]   = (Math.random() - 0.5) * 0.3;
    burstPos[i*3+1] = (Math.random() - 0.5) * 0.3;
    burstPos[i*3+2] = (Math.random() - 0.5) * 0.3;
    burst.velocities[i] = {
      x: (Math.random() - 0.5) * 0.3,
      y: (Math.random() - 0.5) * 0.3,
      z: (Math.random() - 0.5) * 0.3,
    };
  }
  burstGeo.attributes.position.needsUpdate = true;
}

function updateBurst() {
  if (!burst.active) return;
  burst.life -= 0.018;
  burstMat.opacity = Math.max(0, burst.life);

  for (let i = 0; i < BURST_COUNT; i++) {
    burstPos[i*3]   += burst.velocities[i].x;
    burstPos[i*3+1] += burst.velocities[i].y - 0.003; // gravedad leve
    burstPos[i*3+2] += burst.velocities[i].z;
  }
  burstGeo.attributes.position.needsUpdate = true;

  if (burst.life <= 0) {
    burst.active = false;
    burstMat.opacity = 0;
  }
}

/* ════════════════════════════════════════════════════════════
   ③ EmotionSystem — estados y transiciones
════════════════════════════════════════════════════════════ */

const EMOTIONS = {
  CALM:        { name: 'calm',        icon: '😐', text: 'El Cubo te observa…',                       color: 0x8844ff, emissive: 0x220044, emissiveInt: 0.3,  glow: 0.8  },
  HAPPY:       { name: 'happy',       icon: '😄', text: '¡El Cubo está muy feliz!',                   color: 0xffdd00, emissive: 0xff8800, emissiveInt: 0.5,  glow: 1.4  },
  NERVOUS:     { name: 'nervous',     icon: '😰', text: 'El Cubo está nervioso…',                     color: 0x00ffaa, emissive: 0x00aa55, emissiveInt: 0.4,  glow: 1.0  },
  ANGRY:       { name: 'angry',       icon: '😡', text: '¡¡¡EL CUBO ESTÁ FURIOSO!!!',                color: 0xff2200, emissive: 0xff0000, emissiveInt: 0.8,  glow: 1.8  },
  SHY:         { name: 'shy',         icon: '🙈', text: 'El Cubo se esconde…',                        color: 0xff88cc, emissive: 0x882244, emissiveInt: 0.2,  glow: 0.6  },
  MELTING:     { name: 'melting',     icon: '😩', text: 'El Cubo se está derritiendo…',              color: 0xffaa00, emissive: 0xff5500, emissiveInt: 0.6,  glow: 1.2  },
  GLITCH:      { name: 'glitch',      icon: '👾', text: 'EL CUBO HA ENTRADO EN OTRA DIMENSIÓN',       color: 0x00ff00, emissive: 0x00ff00, emissiveInt: 1.0,  glow: 2.0  },
  DANCING:     { name: 'dancing',     icon: '🕺', text: '¡El Cubo baila! ¿Oyes la música?',           color: 0xff00ff, emissive: 0xaa00aa, emissiveInt: 0.6,  glow: 1.5  },
  SLEEPING:    { name: 'sleeping',    icon: '😴', text: 'Shhh… el Cubo duerme. Son las 3AM.',         color: 0x2244aa, emissive: 0x001133, emissiveInt: 0.1,  glow: 0.3  },
  SUSPICIOUS:  { name: 'suspicious',  icon: '🤨', text: '…El Cubo sospecha de ti.',                   color: 0xaaff00, emissive: 0x334400, emissiveInt: 0.3,  glow: 0.9  },
  ENLIGHTENED: { name: 'enlightened', icon: '✨', text: 'El Cubo ha alcanzado la iluminación.',        color: 0xffffff, emissive: 0xaaaaff, emissiveInt: 0.9,  glow: 2.5  },
};

const emotionState = {
  current: EMOTIONS.CALM,
  previous: EMOTIONS.CALM,
  transitionProgress: 1,
  stress: 0,           // 0–100
  hoverCount: 0,
  clickCount: 0,
  lastClickTime: 0,
  holdActive: false,
  holdTime: 0,
};

// Colores de las luces de relleno según emoción
const EMOTION_LIGHTS = {
  calm:        { fill: 0xff00ff, rim: 0x00ffff },
  happy:       { fill: 0xff8800, rim: 0xffff00 },
  nervous:     { fill: 0x00ff88, rim: 0x00ffcc },
  angry:       { fill: 0xff0000, rim: 0xff5500 },
  shy:         { fill: 0xff88cc, rim: 0xffaadd },
  melting:     { fill: 0xff6600, rim: 0xff3300 },
  glitch:      { fill: 0x00ff00, rim: 0x00ffff },
  dancing:     { fill: 0xff00ff, rim: 0x8800ff },
  sleeping:    { fill: 0x112244, rim: 0x001133 },
  suspicious:  { fill: 0xaaff00, rim: 0x88aa00 },
  enlightened: { fill: 0xffffff, rim: 0xaaaaff },
};

function setEmotion(emo) {
  if (emotionState.current === emo) return;
  emotionState.previous = emotionState.current;
  emotionState.current  = emo;
  emotionState.transitionProgress = 0;
  updateMoodUI(emo);
}

function updateMoodUI(emo) {
  document.getElementById('mood-icon').textContent = emo.icon;
  const textEl = document.getElementById('mood-text');
  textEl.textContent = emo.text;
  textEl.style.animation = 'none';
  // Force reflow to restart animation
  void textEl.offsetWidth;
  textEl.style.animation = '';
}

// Interpola los colores y parámetros del cubo durante transición de emoción
const _colorA = new THREE.Color();
const _colorB = new THREE.Color();

function updateEmotionTransition(dt) {
  if (emotionState.transitionProgress >= 1) return;
  emotionState.transitionProgress = Math.min(1, emotionState.transitionProgress + dt * 2.5);
  const t = emotionState.transitionProgress;

  const curr = emotionState.current;
  const prev = emotionState.previous;

  _colorA.setHex(prev.color);
  _colorB.setHex(curr.color);
  cube.mat.color.lerpColors(_colorA, _colorB, t);

  _colorA.setHex(prev.emissive);
  _colorB.setHex(curr.emissive);
  cube.mat.emissive.lerpColors(_colorA, _colorB, t);

  cube.mat.emissiveIntensity = THREE.MathUtils.lerp(prev.emissiveInt, curr.emissiveInt, t);
  bloomPass.strength = THREE.MathUtils.lerp(prev.glow, curr.glow, t);

  // Luces
  const lPrev = EMOTION_LIGHTS[prev.name] || EMOTION_LIGHTS.calm;
  const lCurr = EMOTION_LIGHTS[curr.name] || EMOTION_LIGHTS.calm;
  _colorA.setHex(lPrev.fill); _colorB.setHex(lCurr.fill);
  fillLight.color.lerpColors(_colorA, _colorB, t);
  _colorA.setHex(lPrev.rim);  _colorB.setHex(lCurr.rim);
  rimLight.color.lerpColors(_colorA, _colorB, t);
}

/* ════════════════════════════════════════════════════════════
   ④ InteractionSystem — deformaciones y respuestas
════════════════════════════════════════════════════════════ */

const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

// Estado de interacciones
const interact = {
  isHovered:        false,
  isHolding:        false,
  holdStartTime:    0,
  clickPending:     false,
  clickTimer:       null,
  wavePower:        0,    // para scroll
  shakeAmplitude:   0,    // para vibración
  stretchX:         1,    // escala X
  stretchY:         1,    // escala Y
  stretchZ:         1,    // escala Z
  targetStretchX:   1,
  targetStretchY:   1,
  targetStretchZ:   1,
  meltProgress:     0,    // 0=normal, 1=completamente derretido
  floatOffset:      0,    // desplazamiento vertical
  baseRotSpeed:     0.004,
  rotSpeedX:        0.004,
  rotSpeedY:        0.006,
  glitchTimer:      0,
  dimensionShift:   false,
};

// ── Deformación de vértices ────────────────────────────────

function applyVertexDeformation(elapsed) {
  const pos = cube.geo.attributes.position;
  const orig = cube.originalPositions;
  const melt = interact.meltProgress;
  const wave = interact.wavePower;
  const emo  = emotionState.current;

  for (let i = 0; i < pos.count; i++) {
    const ox = orig[i * 3];
    const oy = orig[i * 3 + 1];
    const oz = orig[i * 3 + 2];

    let nx = ox, ny = oy, nz = oz;

    // ── Derretimiento ──────────────────────────────────────
    if (melt > 0) {
      // La parte de arriba baja, la de abajo se ensancha
      const meltFactor = (oy + 0.9) / 1.8; // 0 en base, 1 en tope
      ny = oy - melt * meltFactor * 0.8;
      nx = ox * (1 + melt * (1 - meltFactor) * 0.5);
      nz = oz * (1 + melt * (1 - meltFactor) * 0.5);
    }

    // ── Ondas de scroll ────────────────────────────────────
    if (wave > 0.01) {
      const waveOffset = Math.sin(elapsed * 8 + oy * 4 + ox * 2) * wave * 0.12;
      nx += waveOffset;
      nz += waveOffset;
    }

    // ── Temblor nervioso ───────────────────────────────────
    if (emo === EMOTIONS.NERVOUS) {
      const tremble = Math.sin(elapsed * 25 + i * 0.3) * 0.025 * interact.shakeAmplitude;
      nx += tremble;
      ny += tremble * 0.5;
    }

    // ── Deformación feliz (squash & stretch suave) ─────────
    if (emo === EMOTIONS.HAPPY) {
      const bounce = Math.abs(Math.sin(elapsed * 3)) * 0.06;
      ny = ny * (1 + bounce * Math.sign(oy));
    }

    // ── Deformación baile ──────────────────────────────────
    if (emo === EMOTIONS.DANCING) {
      const dance = Math.sin(elapsed * 5 + oy * 3) * 0.07;
      nx += dance;
      nz += Math.cos(elapsed * 5 + ox * 3) * 0.05;
    }

    pos.setXYZ(i, nx, ny, nz);
  }
  pos.needsUpdate = true;
  cube.geo.computeVertexNormals();
}

// ── Raycasting con el cubo ─────────────────────────────────

function checkHover(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(cube.mesh, false);
  return hits.length > 0;
}

// ── Handlers de eventos ────────────────────────────────────

container.addEventListener('mousemove', (e) => {
  const hit = checkHover(e);
  if (hit && !interact.isHovered) {
    // Entró en hover
    interact.isHovered = true;
    interact.shakeAmplitude = 1.0;
    emotionState.hoverCount++;

    // Nervioso tras pocos hovers, sospechoso si son muchos
    if (emotionState.hoverCount >= 20) {
      setEmotion(EMOTIONS.SUSPICIOUS);
    } else if (emotionState.hoverCount >= 10) {
      setEmotion(EMOTIONS.HAPPY);
      showHint('¡Descubriste que el Cubo baila! Sigue el ritmo...');
    } else {
      setEmotion(EMOTIONS.NERVOUS);
    }

    interact.targetStretchX = 1.08;
    interact.targetStretchY = 0.93;
    interact.targetStretchZ = 1.08;
    addStress(3);
  } else if (!hit && interact.isHovered) {
    // Salió del hover
    interact.isHovered = false;
    interact.shakeAmplitude = 0;
    interact.targetStretchX = 1;
    interact.targetStretchY = 1;
    interact.targetStretchZ = 1;
    if (emotionState.current === EMOTIONS.NERVOUS) {
      setEmotion(EMOTIONS.CALM);
    }
  }
});

container.addEventListener('mousedown', (e) => {
  if (!interact.isHovered) return;
  interact.isHolding  = true;
  interact.holdStartTime = performance.now();
  addStress(10);
});

container.addEventListener('mouseup', (e) => {
  if (!interact.isHolding) return;
  const holdDuration = performance.now() - interact.holdStartTime;
  interact.isHolding = false;

  if (interact.meltProgress > 0) {
    // Recuperación del derretimiento
    interact.meltProgress = 0;
    setEmotion(EMOTIONS.NERVOUS);
    triggerBurst(0x00ffff);
    interact.targetStretchY = 1.3;
    setTimeout(() => { interact.targetStretchY = 1; }, 400);
  }

  // Click vs Hold
  if (holdDuration < 300) {
    handleClick();
  }
});

function handleClick() {
  emotionState.clickCount++;
  const now = Date.now();
  const timeSinceLast = now - emotionState.lastClickTime;
  emotionState.lastClickTime = now;

  if (timeSinceLast < 350) {
    // Doble click
    handleDoubleClick();
    return;
  }

  // Click simple
  const emo = emotionState.current;
  if (emo === EMOTIONS.SLEEPING) {
    setEmotion(EMOTIONS.ANGRY);
    triggerBurst(0xff2200);
    showHint('¡¡Lo has despertado!! El Cubo NO perdona.');
  } else if (emo === EMOTIONS.ANGRY) {
    setEmotion(EMOTIONS.CALM);
    triggerBurst(0xffffff);
  } else {
    // Reacción por defecto: salto
    interact.targetStretchY = 1.4;
    interact.targetStretchX = 0.8;
    interact.targetStretchZ = 0.8;
    setTimeout(() => {
      interact.targetStretchY = 0.85;
      interact.targetStretchX = 1.1;
      interact.targetStretchZ = 1.1;
      setTimeout(() => {
        interact.targetStretchY = 1;
        interact.targetStretchX = 1;
        interact.targetStretchZ = 1;
      }, 200);
    }, 150);
    setEmotion(EMOTIONS.HAPPY);
    triggerBurst(0xffdd00);
    addStress(15);
  }
}

function handleDoubleClick() {
  // Glitch — cambio de dimensión
  interact.glitchTimer = 2.5;
  interact.dimensionShift = true;
  setEmotion(EMOTIONS.GLITCH);
  glitchPass.uniforms.amount.value = 0.6;
  triggerBurst(0x00ff00);
  addStress(25);
  showHint('EL CUBO HA CRUZADO AL LADO B. Buena suerte.');

  // Restaurar
  setTimeout(() => {
    interact.dimensionShift = false;
    glitchPass.uniforms.amount.value = 0;
    setEmotion(emotionState.stress > 60 ? EMOTIONS.ANGRY : EMOTIONS.CALM);
  }, 2500);
}

// ── Hold — derretimiento ───────────────────────────────────
function updateHold(dt) {
  if (interact.isHolding && interact.isHovered) {
    interact.meltProgress = Math.min(1, interact.meltProgress + dt * 0.4);
    if (interact.meltProgress > 0.1) {
      setEmotion(EMOTIONS.MELTING);
    }
    if (interact.meltProgress > 0.8) {
      addStress(dt * 30);
    }
  } else if (!interact.isHolding && interact.meltProgress > 0) {
    // Auto-recuperación lenta
    interact.meltProgress = Math.max(0, interact.meltProgress - dt * 0.15);
    if (interact.meltProgress < 0.05) {
      interact.meltProgress = 0;
    }
  }
}

// ── Scroll — ondas ─────────────────────────────────────────
window.addEventListener('wheel', (e) => {
  interact.wavePower = Math.min(1, interact.wavePower + Math.abs(e.deltaY) * 0.005);
  addStress(5);
  if (interact.wavePower > 0.5) setEmotion(EMOTIONS.NERVOUS);
  // Decae automáticamente en el loop
});

// ── Touch events para móvil ────────────────────────────────
let touchStartTime = 0;
let lastTouchTime  = 0;

container.addEventListener('touchstart', (e) => {
  e.preventDefault();
  touchStartTime = performance.now();
  interact.isHolding  = true;
  interact.holdStartTime = touchStartTime;
  interact.isHovered  = true;
  addStress(8);
}, { passive: false });

container.addEventListener('touchend', (e) => {
  e.preventDefault();
  const holdDuration = performance.now() - touchStartTime;
  const now = Date.now();
  interact.isHolding = false;
  interact.isHovered = false;

  if (holdDuration < 300) {
    if (now - lastTouchTime < 350) {
      handleDoubleClick();
    } else {
      handleClick();
    }
    lastTouchTime = now;
  }

  interact.meltProgress = 0;
  interact.targetStretchX = 1;
  interact.targetStretchY = 1;
  interact.targetStretchZ = 1;
}, { passive: false });

/* ════════════════════════════════════════════════════════════
   ⑤ MicSystem — reacción al micrófono
════════════════════════════════════════════════════════════ */

const mic = {
  active: false,
  analyser: null,
  dataArray: null,
  volume: 0,
  stream: null,
};

async function startMic() {
  try {
    mic.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const src  = ctx.createMediaStreamSource(mic.stream);
    mic.analyser = ctx.createAnalyser();
    mic.analyser.fftSize = 256;
    mic.dataArray = new Uint8Array(mic.analyser.frequencyBinCount);
    src.connect(mic.analyser);
    mic.active = true;

    document.getElementById('mic-icon').textContent  = '🎙️';
    document.getElementById('mic-label').textContent = 'Mic Activo';
    document.getElementById('btn-mic').classList.add('active');
    showHint('Habla o pon música. El Cubo reaccionará...');
  } catch (err) {
    showHint('No se pudo activar el micrófono. ¿Permiso denegado?');
  }
}

function stopMic() {
  if (mic.stream) {
    mic.stream.getTracks().forEach(t => t.stop());
  }
  mic.active   = false;
  mic.analyser = null;
  document.getElementById('mic-icon').textContent  = '🎤';
  document.getElementById('mic-label').textContent = 'Activar Mic';
  document.getElementById('btn-mic').classList.remove('active');
}

document.getElementById('btn-mic').addEventListener('click', () => {
  if (!mic.active) startMic();
  else stopMic();
});

function updateMicReaction() {
  if (!mic.active || !mic.analyser) return;
  mic.analyser.getByteFrequencyData(mic.dataArray);
  const avg = mic.dataArray.reduce((a, b) => a + b, 0) / mic.dataArray.length;
  mic.volume = avg / 128; // 0–2 aprox

  if (mic.volume > 0.8) {
    // Sonido fuerte → baila
    const scaleBoost = 1 + mic.volume * 0.15;
    interact.targetStretchX = scaleBoost;
    interact.targetStretchY = scaleBoost;
    interact.targetStretchZ = scaleBoost;
    setEmotion(EMOTIONS.DANCING);
    interact.rotSpeedY = 0.04 * mic.volume;
    bloomPass.strength = Math.min(3, 0.8 + mic.volume * 1.2);
  } else if (mic.volume > 0.3) {
    // Sonido medio → pequeñas reacciones
    interact.rotSpeedY = 0.006 + mic.volume * 0.01;
    if (emotionState.current === EMOTIONS.DANCING) {
      setEmotion(EMOTIONS.HAPPY);
    }
  } else {
    // Silencio
    if (emotionState.current === EMOTIONS.DANCING) {
      setEmotion(EMOTIONS.SHY);
      showHint('El Cubo se ha avergonzado. No podías seguir el ritmo.');
    }
    interact.rotSpeedY = interact.baseRotSpeed;
  }
}

/* ════════════════════════════════════════════════════════════
   ⑥ TimeSystem — comportamiento según hora
════════════════════════════════════════════════════════════ */

function checkTimeBasedBehavior() {
  const hour = new Date().getHours();

  if (hour >= 2 && hour < 7) {
    // De noche: duerme
    if (emotionState.current !== EMOTIONS.SLEEPING &&
        emotionState.current !== EMOTIONS.ANGRY) {
      setEmotion(EMOTIONS.SLEEPING);
      interact.baseRotSpeed = 0.0005;
      interact.rotSpeedY    = 0.0005;
    }
  } else if (hour >= 7 && hour < 9) {
    // Mañana temprana: sospechoso
    interact.baseRotSpeed = 0.003;
  } else if (hour >= 12 && hour < 14) {
    // Mediodía: feliz (¡hora de comer!)
    interact.baseRotSpeed = 0.01;
  } else if (hour >= 22 || hour < 2) {
    // Noche tardía: misterioso
    interact.baseRotSpeed = 0.002;
    if (Math.random() < 0.001) {
      setEmotion(EMOTIONS.SUSPICIOUS);
      showHint('Son las ' + hour + 'h. El Cubo sabe lo que hiciste.');
    }
  } else {
    interact.baseRotSpeed = 0.005;
  }
}

/* ════════════════════════════════════════════════════════════
   ⑦ RandomBehavior — espontaneidad para parecer vivo
════════════════════════════════════════════════════════════ */

const spontaneous = {
  timer:          0,
  nextEventTime:  5 + Math.random() * 8,
};

const RANDOM_EVENTS = [
  () => {
    // Micro-temblor
    interact.shakeAmplitude = 0.8;
    setTimeout(() => { interact.shakeAmplitude = 0; }, 600);
    setEmotion(EMOTIONS.NERVOUS);
    showHint('El Cubo sintió algo. No eras tú. O sí.');
  },
  () => {
    // Giro brusco
    interact.rotSpeedY = 0.08;
    setTimeout(() => { interact.rotSpeedY = interact.baseRotSpeed; }, 800);
  },
  () => {
    // Flash de alegría
    triggerBurst(0xffdd00);
    setEmotion(EMOTIONS.HAPPY);
    setTimeout(() => {
      if (emotionState.current === EMOTIONS.HAPPY) setEmotion(EMOTIONS.CALM);
    }, 2000);
  },
  () => {
    // Se encoge de timidez
    interact.targetStretchX = 0.7;
    interact.targetStretchY = 0.7;
    interact.targetStretchZ = 0.7;
    setEmotion(EMOTIONS.SHY);
    showHint('El Cubo se ha vuelto pequeño. No lo mires.');
    setTimeout(() => {
      interact.targetStretchX = 1;
      interact.targetStretchY = 1;
      interact.targetStretchZ = 1;
      setEmotion(EMOTIONS.CALM);
    }, 2500);
  },
  () => {
    // Mini glitch
    glitchPass.uniforms.amount.value = 0.3;
    setTimeout(() => {
      glitchPass.uniforms.amount.value = 0;
    }, 400);
    showHint('ERROR: EMOCIONES_OVERFLOW.EXE ha dejado de responder');
  },
  () => {
    // Iluminación
    if (emotionState.stress < 30) {
      setEmotion(EMOTIONS.ENLIGHTENED);
      interact.targetStretchX = 1.2;
      interact.targetStretchY = 1.2;
      interact.targetStretchZ = 1.2;
      showHint('El Cubo ha alcanzado la paz interior. Por ahora.');
      setTimeout(() => {
        interact.targetStretchX = 1;
        interact.targetStretchY = 1;
        interact.targetStretchZ = 1;
        setEmotion(EMOTIONS.CALM);
      }, 3000);
    }
  },
];

function updateSpontaneous(dt) {
  spontaneous.timer += dt;
  if (spontaneous.timer >= spontaneous.nextEventTime) {
    spontaneous.timer = 0;
    spontaneous.nextEventTime = 4 + Math.random() * 10;

    // No interrumpir estados importantes
    if (
      emotionState.current !== EMOTIONS.GLITCH &&
      emotionState.current !== EMOTIONS.MELTING &&
      !interact.isHolding
    ) {
      const fn = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
      fn();
    }
  }
}

/* ════════════════════════════════════════════════════════════
   ⑧ UI — Barra de estrés, desafíos, hints, easter eggs
════════════════════════════════════════════════════════════ */

// ── Estrés ─────────────────────────────────────────────────
function addStress(amount) {
  emotionState.stress = Math.min(100, emotionState.stress + amount);
  updateStressUI();

  if (emotionState.stress >= 100) {
    triggerMeltdown();
  } else if (emotionState.stress >= 80) {
    setEmotion(EMOTIONS.ANGRY);
  } else if (emotionState.stress >= 50 && emotionState.current === EMOTIONS.CALM) {
    setEmotion(EMOTIONS.NERVOUS);
  }
}

function decayStress(dt) {
  if (!interact.isHovered && !interact.isHolding) {
    emotionState.stress = Math.max(0, emotionState.stress - dt * 3);
    updateStressUI();
    if (emotionState.stress < 20 && emotionState.current === EMOTIONS.ANGRY) {
      setEmotion(EMOTIONS.CALM);
    }
  }
}

function updateStressUI() {
  const fill = document.getElementById('stress-bar-fill');
  const val  = document.getElementById('stress-value');
  const pct  = Math.round(emotionState.stress);
  fill.style.width = pct + '%';
  val.textContent  = pct + '%';

  // Color de la barra según nivel
  if (pct < 40) {
    fill.style.background = 'linear-gradient(90deg, #00ffaa, #00ff88)';
  } else if (pct < 70) {
    fill.style.background = 'linear-gradient(90deg, #ffaa00, #ff6600)';
  } else {
    fill.style.background = 'linear-gradient(90deg, #ff2200, #ff0066)';
  }
}

// ── Meltdown total ─────────────────────────────────────────
function triggerMeltdown() {
  setEmotion(EMOTIONS.ANGRY);
  glitchPass.uniforms.amount.value = 1.0;
  triggerBurst(0xff0000);
  showHint('¡¡MELTDOWN!! El Cubo ha alcanzado su límite existencial.');

  // Escala explosiva
  interact.targetStretchX = 1.8;
  interact.targetStretchY = 1.8;
  interact.targetStretchZ = 1.8;

  setTimeout(() => {
    glitchPass.uniforms.amount.value = 0;
    interact.targetStretchX = 1;
    interact.targetStretchY = 1;
    interact.targetStretchZ = 1;
    emotionState.stress = 0;
    updateStressUI();
    setEmotion(EMOTIONS.SHY);
    showHint('El Cubo se avergüenza de lo que acaba de pasar.');
  }, 2000);
}

// ── Desafíos ───────────────────────────────────────────────
const challenges = [
  { text: 'Haz hover 10 veces sobre el cubo',  target: 10, type: 'hover',  reward: '¡Misión cumplida! El Cubo baila por ti.' },
  { text: 'Haz click 5 veces sin parar',        target: 5,  type: 'click',  reward: '¡Eres brutal! El Cubo está agotado.' },
  { text: 'Lleva el estrés al 80%',             target: 80, type: 'stress', reward: '¡Perturbador! El Cubo te recuerda.' },
  { text: 'Aguanta el hold hasta derretirlo',   target: 1,  type: 'melt',   reward: '¡Cruel! Pero el Cubo se recupera.' },
];

let currentChallenge = 0;
let challengeProgress = 0;

function updateChallengeUI() {
  const ch = challenges[currentChallenge % challenges.length];
  document.getElementById('challenge-text').textContent = ch.text;

  let progress = 0;
  switch (ch.type) {
    case 'hover':  progress = emotionState.hoverCount; break;
    case 'click':  progress = emotionState.clickCount; break;
    case 'stress': progress = emotionState.stress;     break;
    case 'melt':   progress = interact.meltProgress >= 0.9 ? 1 : 0; break;
  }

  const pct = Math.min(progress, ch.target);
  document.getElementById('challenge-progress').textContent = `${Math.round(pct)} / ${ch.target}`;

  if (progress >= ch.target) {
    // Desafío completado
    showHint(ch.reward);
    currentChallenge++;
    emotionState.hoverCount = 0;
    emotionState.clickCount = 0;
    triggerBurst(0xffdd00);
    setEmotion(EMOTIONS.HAPPY);

    setTimeout(() => {
      const next = challenges[currentChallenge % challenges.length];
      document.getElementById('challenge-text').textContent = next.text;
      document.getElementById('challenge-progress').textContent = `0 / ${next.target}`;
    }, 2000);
  }
}

// ── Hints / mensajes ───────────────────────────────────────
let hintTimer = null;

function showHint(text) {
  const box  = document.getElementById('hint-box');
  const span = document.getElementById('hint-text');
  span.textContent = text;
  box.classList.remove('hidden');
  box.classList.add('show');

  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    box.classList.remove('show');
    setTimeout(() => box.classList.add('hidden'), 500);
  }, 4000);
}

// ── Easter eggs ────────────────────────────────────────────
const easterEggs = {
  konami: { seq: ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'], idx: 0 },
};

document.addEventListener('keydown', (e) => {
  const egg = easterEggs.konami;
  if (e.key === egg.seq[egg.idx]) {
    egg.idx++;
    if (egg.idx === egg.seq.length) {
      egg.idx = 0;
      // Konami activado
      setEmotion(EMOTIONS.ENLIGHTENED);
      triggerBurst(0xffffff);
      glitchPass.uniforms.amount.value = 0.8;
      showHint('KONAMI CODE. El Cubo se ha vuelto OMNISCIENTE. Por 5 segundos.');
      interact.targetStretchX = 2;
      interact.targetStretchY = 2;
      interact.targetStretchZ = 2;
      setTimeout(() => {
        glitchPass.uniforms.amount.value = 0;
        interact.targetStretchX = 1;
        interact.targetStretchY = 1;
        interact.targetStretchZ = 1;
        setEmotion(EMOTIONS.CALM);
      }, 5000);
    }
  } else {
    egg.idx = 0;
  }
});

/* ════════════════════════════════════════════════════════════
   LOOP PRINCIPAL DE ANIMACIÓN
════════════════════════════════════════════════════════════ */

const clock = new THREE.Clock();
let   timeCheckInterval = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt      = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // ── Comprobación periódica de hora ─────────────────────
  timeCheckInterval += dt;
  if (timeCheckInterval > 60) {
    timeCheckInterval = 0;
    checkTimeBasedBehavior();
  }

  // ── Hold / derretimiento ───────────────────────────────
  updateHold(dt);

  // ── Reacción al micrófono ──────────────────────────────
  updateMicReaction();

  // ── Comportamiento espontáneo ──────────────────────────
  updateSpontaneous(dt);

  // ── Transición de emoción (color/luz) ─────────────────
  updateEmotionTransition(dt);

  // ── Decaimiento de stress ──────────────────────────────
  decayStress(dt);

  // ── Decaimiento de ondas scroll ───────────────────────
  interact.wavePower = Math.max(0, interact.wavePower - dt * 0.8);

  // ── Suavizado de escala (squash & stretch) ─────────────
  const lerpFactor = 1 - Math.pow(0.01, dt * 8);
  interact.stretchX = THREE.MathUtils.lerp(interact.stretchX, interact.targetStretchX, lerpFactor);
  interact.stretchY = THREE.MathUtils.lerp(interact.stretchY, interact.targetStretchY, lerpFactor);
  interact.stretchZ = THREE.MathUtils.lerp(interact.stretchZ, interact.targetStretchZ, lerpFactor);
  cube.mesh.scale.set(interact.stretchX, interact.stretchY, interact.stretchZ);

  // ── Rotación del cubo ──────────────────────────────────
  const emo = emotionState.current;
  if (emo === EMOTIONS.SLEEPING) {
    cube.mesh.rotation.y += 0.0005;
    // Leve inclinación de "dormido"
    cube.mesh.rotation.z = Math.sin(elapsed * 0.5) * 0.05;
  } else if (emo === EMOTIONS.GLITCH) {
    cube.mesh.rotation.x += (Math.random() - 0.5) * 0.1;
    cube.mesh.rotation.y += (Math.random() - 0.5) * 0.1;
  } else if (emo === EMOTIONS.DANCING) {
    cube.mesh.rotation.x = Math.sin(elapsed * 4) * 0.2;
    cube.mesh.rotation.y += interact.rotSpeedY;
    cube.mesh.rotation.z = Math.cos(elapsed * 3) * 0.15;
  } else {
    cube.mesh.rotation.x += 0.003;
    cube.mesh.rotation.y += interact.rotSpeedY;
    // Shake horizontal
    cube.mesh.rotation.z = interact.shakeAmplitude > 0
      ? Math.sin(elapsed * 30) * 0.04 * interact.shakeAmplitude
      : 0;
    interact.shakeAmplitude = Math.max(0, interact.shakeAmplitude - dt * 2);
  }

  // ── Flotación vertical ─────────────────────────────────
  interact.floatOffset = Math.sin(elapsed * 1.2) * 0.12;
  cube.mesh.position.y = interact.floatOffset + (emo === EMOTIONS.MELTING ? -interact.meltProgress * 0.3 : 0);

  // ── Deformación de vértices ────────────────────────────
  applyVertexDeformation(elapsed);

  // ── Explosión de partículas ────────────────────────────
  updateBurst();

  // ── Partículas de fondo ────────────────────────────────
  particles.rotation.y += dt * 0.02;
  particles.rotation.x += dt * 0.005;
  // Hacer parpadear partículas según emoción
  pMat.opacity = 0.4 + Math.sin(elapsed * 2) * 0.2;

  // ── Luces pulsantes ────────────────────────────────────
  fillLight.intensity  = 1.5 + Math.sin(elapsed * 2.3) * 0.5;
  rimLight.intensity   = 1.0 + Math.cos(elapsed * 1.7) * 0.4;
  underGlow.intensity  = 0.8 + Math.sin(elapsed * 3.1) * 0.3;

  if (emo === EMOTIONS.ANGRY) {
    keyLight.intensity = 2.5 + Math.sin(elapsed * 15) * 1.5; // parpadeo furioso
  } else if (emo === EMOTIONS.SLEEPING) {
    keyLight.intensity = 0.4;
  } else {
    keyLight.intensity = 1.5;
  }

  // ── Glitch shader ──────────────────────────────────────
  glitchPass.uniforms.time.value = elapsed;
  if (interact.glitchTimer > 0) {
    interact.glitchTimer -= dt;
    glitchPass.uniforms.amount.value = Math.max(0, interact.glitchTimer / 2.5) * 0.6;
    if (interact.glitchTimer <= 0) {
      glitchPass.uniforms.amount.value = 0;
      interact.glitchTimer = 0;
    }
  }

  // ── UI de desafíos ─────────────────────────────────────
  updateChallengeUI();

  composer.render();
}

// ── Resize ─────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(w, h);
});

// ── Arranque ────────────────────────────────────────────────
checkTimeBasedBehavior();
updateStressUI();
animate();
