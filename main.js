/**
 * main.js — Escena 3D con Three.js
 *
 * Estructura:
 *  1. Importaciones
 *  2. Configuración de la escena (renderer, cámara, controles)
 *  3. Iluminación
 *  4. Objeto 3D (cubo con material PBR)
 *  5. Partículas de fondo (estrellas)
 *  6. Detección de clicks (raycasting)
 *  7. Animación principal (loop)
 *  8. Resize handler
 *
 * Para sustituir el cubo por un modelo GLB de Blender,
 * ver la sección "CÓMO USAR UN MODELO GLB" al final del archivo.
 */

// ─────────────────────────────────────────────
// 1. IMPORTACIONES
// ─────────────────────────────────────────────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// Descomentar si usas modelo GLB:
// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─────────────────────────────────────────────
// 2. CONFIGURACIÓN BASE
// ─────────────────────────────────────────────

/** Contenedor donde Three.js insertará el <canvas> */
const container = document.getElementById('canvas-container');

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({
  antialias: true,       // suavizado de bordes
  alpha: false,          // sin transparencia (usamos fondo CSS)
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // max 2x para rendimiento
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;                            // sombras activadas
renderer.shadowMap.type = THREE.PCFSoftShadowMap;             // sombras suaves
renderer.toneMapping = THREE.ACESFilmicToneMapping;           // look cinematográfico
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

// --- Escena ---
const scene = new THREE.Scene();
// Niebla sutil para profundidad
scene.fog = new THREE.FogExp2(0x0a0a1a, 0.035);

// --- Cámara ---
const camera = new THREE.PerspectiveCamera(
  60,                                            // campo de visión (FOV)
  container.clientWidth / container.clientHeight, // aspect ratio
  0.1,                                           // near clipping plane
  100                                            // far clipping plane
);
camera.position.set(0, 1.5, 4.5); // posición inicial de la cámara

// --- OrbitControls ---
// Permite rotar, hacer pan y zoom con el ratón / touch
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;       // inercia suave al soltar el ratón
controls.dampingFactor = 0.06;
controls.minDistance = 2;            // zoom mínimo
controls.maxDistance = 12;           // zoom máximo
controls.maxPolarAngle = Math.PI * 0.85; // limita la rotación vertical

// ─────────────────────────────────────────────
// 3. ILUMINACIÓN
// ─────────────────────────────────────────────

// Luz ambiental — ilumina toda la escena de forma uniforme
const ambientLight = new THREE.AmbientLight(0x334488, 0.6);
scene.add(ambientLight);

// Luz direccional principal — simula el sol, genera sombras
const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
sunLight.position.set(5, 8, 5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);     // resolución del mapa de sombra
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 30;
sunLight.shadow.camera.left = -6;
sunLight.shadow.camera.right = 6;
sunLight.shadow.camera.top = 6;
sunLight.shadow.camera.bottom = -6;
scene.add(sunLight);

// Luz de relleno azulada — contraluz para dar volumen
const fillLight = new THREE.DirectionalLight(0x4488ff, 1.0);
fillLight.position.set(-4, 2, -4);
scene.add(fillLight);

// Luz puntual de acento — efecto de brillo localizado
const pointLight = new THREE.PointLight(0xff9933, 2.0, 8);
pointLight.position.set(0, -1.5, 2);
scene.add(pointLight);

// ─────────────────────────────────────────────
// 4. OBJETO 3D — CUBO CON MATERIAL PBR
// ─────────────────────────────────────────────

// Paleta de colores que se irán aplicando al hacer click
const COLOR_PALETTE = [
  0x4a90e2, // azul (color inicial)
  0xe24a4a, // rojo
  0x4ae29a, // verde esmeralda
  0xe2c44a, // dorado
  0xb44ae2, // violeta
  0xe24ab4, // rosa
  0x4ae2e2, // cyan
  0xffffff, // blanco puro
];
let currentColorIndex = 0;

// Geometría — caja con bordes levemente biselados usando IcosahedronGeometry
// (puedes cambiarla por BoxGeometry, TorusKnotGeometry, SphereGeometry, etc.)
const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6, 2, 2, 2);

// Material físico (MeshStandardMaterial) con propiedades PBR
const material = new THREE.MeshStandardMaterial({
  color: COLOR_PALETTE[currentColorIndex],
  roughness: 0.25,      // superficie relativamente pulida
  metalness: 0.7,       // aspecto metálico
  envMapIntensity: 1.0,
});

const cube = new THREE.Mesh(geometry, material);
cube.castShadow = true;
cube.receiveShadow = true;
scene.add(cube);

// Plano invisible para recibir sombra del cubo
const groundGeo = new THREE.PlaneGeometry(20, 20);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.2;
ground.receiveShadow = true;
scene.add(ground);

// Wireframe sobre el cubo — efecto visual de bordes
const wireframe = new THREE.LineSegments(
  new THREE.EdgesGeometry(geometry),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12 })
);
cube.add(wireframe); // lo añadimos como hijo del cubo para que rote con él

// ─────────────────────────────────────────────
// 5. PARTÍCULAS DE FONDO — CAMPO DE ESTRELLAS
// ─────────────────────────────────────────────
const STAR_COUNT = 1800;
const starPositions = new Float32Array(STAR_COUNT * 3);

for (let i = 0; i < STAR_COUNT; i++) {
  // Distribuir estrellas en una esfera grande alrededor de la cámara
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const r     = 20 + Math.random() * 30;

  starPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPositions[i * 3 + 2] = r * Math.cos(phi);
}

const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

const starMaterial = new THREE.PointsMaterial({
  color: 0xaabbff,
  size: 0.08,
  sizeAttenuation: true, // las partículas lejanas se ven más pequeñas
  transparent: true,
  opacity: 0.85,
});

const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// ─────────────────────────────────────────────
// 6. DETECCIÓN DE CLICKS — RAYCASTING
// ─────────────────────────────────────────────

/** Actualiza el swatch de color en la UI */
function updateColorUI(hexColor) {
  const swatch = document.getElementById('color-swatch');
  if (swatch) {
    swatch.style.background = `#${hexColor.toString(16).padStart(6, '0')}`;
    swatch.style.boxShadow  = `0 0 12px #${hexColor.toString(16).padStart(6, '0')}`;
  }
}

// Inicializar el swatch con el color de partida
updateColorUI(COLOR_PALETTE[currentColorIndex]);

const raycaster  = new THREE.Raycaster();
const pointer    = new THREE.Vector2();

/** Estado de la animación de "pulso" al hacer click */
let isPulsing    = false;
let pulseTime    = 0;
const PULSE_DURATION = 0.5; // segundos

/** Maneja el click / tap sobre el canvas */
function onPointerDown(event) {
  // Normalizar coordenadas a rango [-1, +1]
  const rect = renderer.domElement.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;

  pointer.x =  ((clientX - rect.left)  / rect.width)  * 2 - 1;
  pointer.y = -((clientY - rect.top)   / rect.height)  * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObject(cube);

  if (intersects.length > 0) {
    // Avanzar al siguiente color de la paleta
    currentColorIndex = (currentColorIndex + 1) % COLOR_PALETTE.length;
    const newColor = COLOR_PALETTE[currentColorIndex];

    material.color.setHex(newColor);
    updateColorUI(newColor);

    // Iniciar animación de pulso
    isPulsing = true;
    pulseTime = 0;
  }
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);
renderer.domElement.addEventListener('touchstart',  onPointerDown, { passive: true });

// ─────────────────────────────────────────────
// 7. LOOP DE ANIMACIÓN
// ─────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // — Rotación automática suave del cubo —
  cube.rotation.y += delta * 0.35;
  cube.rotation.x  = Math.sin(elapsed * 0.3) * 0.12; // balanceo vertical suave

  // — Animación de pulso al hacer click —
  if (isPulsing) {
    pulseTime += delta;
    const t = pulseTime / PULSE_DURATION;

    if (t < 1) {
      // Escala que crece y vuelve a su tamaño: sin(π·t) da un arco
      const scale = 1 + Math.sin(Math.PI * t) * 0.22;
      cube.scale.setScalar(scale);
    } else {
      cube.scale.setScalar(1);
      isPulsing = false;
    }
  }

  // — Movimiento orbital suave de la luz de acento —
  pointLight.position.x = Math.sin(elapsed * 0.7) * 2.5;
  pointLight.position.z = Math.cos(elapsed * 0.7) * 2.5;

  // — Rotación lenta del campo de estrellas —
  stars.rotation.y += delta * 0.008;

  // — Actualizar controles (necesario con damping activado) —
  controls.update();

  renderer.render(scene, camera);
}

animate();

// ─────────────────────────────────────────────
// 8. RESIZE HANDLER — mantenemos el aspecto correcto
// ─────────────────────────────────────────────
function onResize() {
  const w = container.clientWidth;
  const h = container.clientHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener('resize', onResize);

// ─────────────────────────────────────────────
// CÓMO USAR UN MODELO GLB (exportado desde Blender)
// ─────────────────────────────────────────────
//
// 1. En Blender: File → Export → glTF 2.0 → selecciona "GLB"
//    Guarda el archivo como "model.glb" dentro de la carpeta /threejs-demo/
//
// 2. Descomenta la importación al inicio del archivo:
//    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
//
// 3. Elimina o comenta el bloque "OBJETO 3D — CUBO" de este archivo.
//
// 4. Añade el siguiente código en su lugar:
//
//    const loader = new GLTFLoader();
//    let model;
//
//    loader.load(
//      './model.glb',                    // ruta relativa al archivo
//      (gltf) => {
//        model = gltf.scene;
//        model.traverse((node) => {
//          if (node.isMesh) {
//            node.castShadow    = true;
//            node.receiveShadow = true;
//          }
//        });
//        scene.add(model);
//      },
//      (progress) => {
//        console.log(`Cargando: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
//      },
//      (error) => {
//        console.error('Error al cargar el GLB:', error);
//      }
//    );
//
// 5. En el loop de animación cambia "cube.rotation.y" por "model?.rotation.y".
//
// 6. Para el raycasting, cambia:
//    raycaster.intersectObject(cube)
//    por:
//    raycaster.intersectObject(model, true)   // true = recorre hijos
//
// Nota: Si sirves el proyecto con Live Server o similar no habrá problema
// con los archivos locales. En GitHub Pages simplemente sube el .glb al repo.
