# Three.js Demo 3D

Proyecto de demostración interactiva 3D construido con **Three.js** puro (sin frameworks ni bundlers).
Listo para abrirse localmente y publicarse en **GitHub Pages** sin configuración extra.

---

## Características

| Función | Detalle |
|---|---|
| Escena 3D | Cubo metálico con material PBR |
| Iluminación | Ambiental + direccional + relleno + punto de acento |
| Cámara | Perspectiva con OrbitControls |
| Interacción ratón | Rotar · Zoom · Pan |
| Click/Tap | Cambia el color del cubo (paleta de 8 colores) + animación de pulso |
| Fondo | Campo de partículas (estrellas) + niebla volumétrica |
| Responsive | Redimensiona correctamente en cualquier pantalla |
| Sombras | PCFSoft shadow map |

---

## Estructura del proyecto

```
threejs-demo/
├── index.html   # Página principal, importa Three.js desde CDN via importmap
├── style.css    # Estilos globales, UI overlay, responsive
├── main.js      # Toda la lógica Three.js (escena, luces, objeto, animación)
└── README.md    # Este archivo
```

---

## Ejecutar localmente

Abre el archivo `index.html` directamente en el navegador **no funciona** porque
los módulos ES6 (`type="module"`) requieren un servidor HTTP.

### Opción A — VS Code Live Server (recomendado)

1. Instala la extensión **Live Server** en VS Code.
2. Abre la carpeta `threejs-demo/` en VS Code.
3. Click derecho sobre `index.html` → **Open with Live Server**.
4. Se abrirá automáticamente en `http://localhost:5500`.

### Opción B — Node.js (sin instalar nada extra)

```bash
npx serve .
# Abre http://localhost:3000
```

### Opción C — Python

```bash
# Python 3
python -m http.server 8080
# Abre http://localhost:8080
```

---

## Publicar en GitHub Pages

### Paso 1 — Crear el repositorio

1. Ve a [github.com/new](https://github.com/new).
2. Pon un nombre, p. ej. `threejs-demo`.
3. Deja el repositorio **público**.
4. **No** marques "Initialize this repository with a README" (ya tenemos uno).
5. Haz click en **Create repository**.

### Paso 2 — Subir el código

```bash
# Entra en la carpeta del proyecto
cd threejs-demo

# Inicializa git (solo la primera vez)
git init
git add .
git commit -m "feat: initial Three.js demo"

# Conecta con tu repositorio de GitHub (sustituye <usuario> y <repo>)
git remote add origin https://github.com/<usuario>/threejs-demo.git

# Sube el código
git push -u origin main
```

> Si tu rama local se llama `master` en lugar de `main`, usa `git push -u origin master`.

### Paso 3 — Activar GitHub Pages

1. En el repositorio de GitHub ve a **Settings → Pages**.
2. En *Source* selecciona **Deploy from a branch**.
3. Rama: **main** (o master) / carpeta: **/ (root)**.
4. Haz click en **Save**.

En menos de un minuto tu demo estará disponible en:

```
https://<tu-usuario>.github.io/threejs-demo/
```

> GitHub Pages sirve los archivos estáticos con un servidor HTTP, por lo que
> los módulos ES6 funcionan sin problemas.

---

## Sustituir el cubo por un modelo GLB de Blender

### Exportar desde Blender

1. Abre tu modelo en Blender.
2. **File → Export → glTF 2.0 (.glb/.gltf)**.
3. En el panel de exportación:
   - Format: **GLB** (binario, un solo archivo).
   - Activa: *Selected Objects* si quieres exportar solo lo seleccionado.
   - Activa: *Apply Modifiers* para que los modificadores se apliquen.
4. Guarda el archivo como `model.glb` dentro de la carpeta `threejs-demo/`.

### Adaptar el código en `main.js`

1. **Descomenta** la importación del `GLTFLoader` al inicio del archivo:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
```

2. **Elimina** (o comenta) el bloque del cubo:

```js
// const geometry = new THREE.BoxGeometry(...)
// const material = new THREE.MeshStandardMaterial(...)
// const cube = new THREE.Mesh(geometry, material)
// scene.add(cube)
// ...
```

3. **Añade** el loader en su lugar:

```js
const loader = new GLTFLoader();
let model;

loader.load('./model.glb', (gltf) => {
  model = gltf.scene;

  // Activar sombras en todos los meshes del modelo
  model.traverse((node) => {
    if (node.isMesh) {
      node.castShadow    = true;
      node.receiveShadow = true;
    }
  });

  scene.add(model);
});
```

4. En el loop de animación, cambia la referencia al cubo:

```js
// Antes:
cube.rotation.y += delta * 0.35;

// Después:
if (model) model.rotation.y += delta * 0.35;
```

5. Para el **raycasting** (detección de clicks):

```js
// Antes:
const intersects = raycaster.intersectObject(cube);

// Después:
const intersects = raycaster.intersectObject(model, true); // true = busca en hijos
```

---

## Personalización rápida

| Qué cambiar | Dónde | Cómo |
|---|---|---|
| Colores de la paleta | `main.js` | Array `COLOR_PALETTE` |
| Velocidad de rotación | `main.js` | `delta * 0.35` → aumenta/disminuye el multiplicador |
| Geometría del objeto | `main.js` | Cambia `BoxGeometry` por `SphereGeometry`, `TorusKnotGeometry`, etc. |
| Intensidad de luces | `main.js` | Segundo parámetro de cada `DirectionalLight` / `PointLight` |
| Colores de luces | `main.js` | Primer parámetro hexadecimal de cada luz |
| Fondo CSS | `style.css` | `background` en `#canvas-container` |
| Niebla | `main.js` | `scene.fog = new THREE.FogExp2(color, densidad)` |

---

## Tecnologías usadas

- [Three.js r163](https://threejs.org/) — motor 3D WebGL
- [OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls) — control de cámara con ratón/touch
- HTML5 · CSS3 · ES2022 Modules — sin frameworks ni bundlers

---

## Licencia

MIT — libre para usar, modificar y distribuir.
