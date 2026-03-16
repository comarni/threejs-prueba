/**
 * cubo-widget.js  —  El Cubo Sensible · Widget Embebible
 * ═══════════════════════════════════════════════════════════════
 * Arquitectura de producción para un widget JS de terceros.
 * Versión legible (pre-minificación).
 *
 * Uso del cliente:
 *   <script
 *     src="https://cdn.cubowidget.com/v1/cubo-widget.min.js"
 *     data-cubo-site-id="abc123"
 *     data-position="bottom-right"
 *     data-theme="dark"
 *     async
 *   ></script>
 *
 * Módulos internos:
 *  [A] Config       — lee atributos data-* del <script>
 *  [B] Validate     — llama a la API para verificar licencia
 *  [C] DOM          — crea el contenedor flotante aislado
 *  [D] ThreeScene   — punto de enganche para tu escena Three.js
 *  [E] Events       — toggle open/close del panel
 *  [F] Analytics    — ping ligero de métricas (plan Pro)
 *  [G] Boot         — orquesta el arranque
 * ═══════════════════════════════════════════════════════════════
 */

;(function (global) {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     CONSTANTES GLOBALES
  ═══════════════════════════════════════════════════════════ */
  const WIDGET_VERSION  = '1.0.0';
  const API_BASE        = 'https://api.cubowidget.com';
  const CDN_BASE        = 'https://cdn.cubowidget.com/v1';
  const THREE_CDN       = 'https://cdn.jsdelivr.net/npm/three@0.163.0/build/three.module.js';

  // Tamaños del botón flotante
  const BTN_SIZE        = 64;   // px — cuadrado
  const PANEL_W         = 320;  // px — panel expandido
  const PANEL_H         = 380;  // px

  /* ═══════════════════════════════════════════════════════════
     [A] CONFIG — Lee los data-* del <script> actual
  ═══════════════════════════════════════════════════════════ */

  /**
   * Detecta el <script> que cargó este archivo.
   * document.currentScript funciona en todos los navegadores modernos
   * y es la forma estándar para widgets JS de terceros.
   */
  const _scriptTag = document.currentScript;

  const Config = (function () {
    const VALID_POSITIONS = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
    const VALID_THEMES    = ['dark', 'light'];

    function read(attr, fallback) {
      return _scriptTag ? (_scriptTag.getAttribute(attr) || fallback) : fallback;
    }

    return {
      siteId:   read('data-cubo-site-id',  ''),
      position: VALID_POSITIONS.includes(read('data-position', ''))
                  ? read('data-position', 'bottom-right')
                  : 'bottom-right',
      theme:    VALID_THEMES.includes(read('data-theme', ''))
                  ? read('data-theme', 'dark')
                  : 'dark',
      // Opciones extra (plan Pro):
      color:    read('data-color',   '#9b3dff'),   // color base del cubo
      label:    read('data-label',   ''),          // texto de bienvenida opcional
      size:     parseInt(read('data-size', String(BTN_SIZE)), 10) || BTN_SIZE,
      // Modo debug: data-debug="true" imprime logs en consola
      debug:    read('data-debug', 'false') === 'true',
    };
  })();

  function log(...args) {
    if (Config.debug) console.log('[CuboWidget]', ...args);
  }

  /* ═══════════════════════════════════════════════════════════
     [B] VALIDATE — Verifica licencia contra la API
  ═══════════════════════════════════════════════════════════ */

  /**
   * Estados de licencia posibles que devuelve la API:
   *   'active'   → carga completa
   *   'demo'     → carga con watermark
   *   'expired'  → carga degradada (mensaje de renovación)
   *   'invalid'  → no se carga nada
   */
  const LicenseState = {
    status: null,   // se rellena tras la llamada
    plan:   null,   // 'starter' | 'pro' | 'lifetime'
  };

  /**
   * Hace una llamada GET ligera al endpoint de validación.
   * Responde en JSON: { status, plan, allowedDomain }
   *
   * Si la llamada falla (red, timeout) → modo demo para no
   * penalizar al cliente por errores de servidor.
   */
  async function validateLicense(siteId) {
    if (!siteId) {
      log('No site-id found → demo mode');
      return { status: 'demo', plan: null };
    }

    const url = `${API_BASE}/cubo/validate?siteId=${encodeURIComponent(siteId)}&domain=${encodeURIComponent(location.hostname)}&v=${WIDGET_VERSION}`;

    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const res  = await fetch(url, {
        method:  'GET',
        headers: { 'Accept': 'application/json' },
        signal:  controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        log('API responded with', res.status, '→ demo mode');
        return { status: 'demo', plan: null };
      }

      const data = await res.json();
      log('License:', data);
      return data;

    } catch (err) {
      // Red caída o timeout → no penalizamos al cliente
      log('Validation network error → fallback demo mode:', err.message);
      return { status: 'demo', plan: null };
    }
  }

  /* ═══════════════════════════════════════════════════════════
     [C] DOM — Crea el contenedor flotante aislado
  ═══════════════════════════════════════════════════════════ */

  /**
   * Usamos Shadow DOM para aislar completamente los estilos
   * del widget de los CSS del sitio cliente.
   * Esto evita conflictos de z-index, font-size, reset, etc.
   */

  let shadowRoot  = null;
  let hostElement = null;
  let btnElement  = null;
  let panelEl     = null;
  let canvasEl    = null;
  let isOpen      = false;

  function buildPositionCSS(position, size) {
    const offset = 20; // margen respecto al borde
    const map = {
      'bottom-right': `bottom:${offset}px; right:${offset}px;`,
      'bottom-left':  `bottom:${offset}px; left:${offset}px;`,
      'top-right':    `top:${offset}px;    right:${offset}px;`,
      'top-left':     `top:${offset}px;    left:${offset}px;`,
    };
    return map[position] || map['bottom-right'];
  }

  function createWidgetDOM() {
    const pos  = Config.position;
    const size = Config.size;
    const col  = Config.color;

    // ── Host element (nodo en el DOM del cliente) ──
    hostElement = document.createElement('div');
    hostElement.id = 'cubo-widget-host';
    hostElement.style.cssText = [
      'position: fixed',
      buildPositionCSS(pos, size),
      'z-index: 2147483647',  // máximo z-index posible
      'display: block',
      'pointer-events: none',  // el shadow DOM manejará los eventos
    ].join('; ');

    document.body.appendChild(hostElement);

    // ── Shadow DOM para aislamiento ──
    shadowRoot = hostElement.attachShadow({ mode: 'open' });

    // ── Estilos internos del widget ──
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      :host { all: initial; }

      /* ── Botón flotante ── */
      #cubo-btn {
        position: absolute;
        ${buildPositionCSS(pos, size)}
        width:  ${size}px;
        height: ${size}px;
        border-radius: 16px;
        background: linear-gradient(135deg, #1a0a2e, #0d0718);
        border: 2px solid ${col}55;
        box-shadow: 0 4px 24px ${col}33, 0 0 0 0 ${col}44;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        pointer-events: all;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      #cubo-btn:hover {
        transform: scale(1.08) translateY(-2px);
        border-color: ${col}bb;
        box-shadow: 0 8px 32px ${col}55, 0 0 0 4px ${col}18;
      }
      #cubo-btn:active { transform: scale(0.96); }
      #cubo-btn.open   { border-color: ${col}; box-shadow: 0 8px 32px ${col}66; }

      /* Canvas 3D dentro del botón */
      #cubo-btn-canvas {
        width:  100%;
        height: 100%;
        display: block;
        border-radius: 14px;
      }

      /* Watermark modo demo */
      #demo-badge {
        position: absolute;
        bottom: 2px;
        right: 4px;
        font-size: 8px;
        font-family: system-ui, sans-serif;
        color: rgba(255,255,255,0.4);
        pointer-events: none;
        letter-spacing: 0.04em;
      }

      /* ── Panel expandido ── */
      #cubo-panel {
        position: absolute;
        ${buildPanelPosition(pos, size)}
        width:  ${PANEL_W}px;
        background: #0a0618;
        border: 1px solid ${col}44;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${col}22;
        overflow: hidden;
        pointer-events: all;
        transform-origin: ${getPanelOrigin(pos)};
        transform: scale(0.85) translateY(10px);
        opacity: 0;
        transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), opacity 0.2s ease;
        pointer-events: none;
      }
      #cubo-panel.open {
        transform: scale(1) translateY(0);
        opacity: 1;
        pointer-events: all;
      }

      /* Cabecera del panel */
      #panel-header {
        padding: 16px 20px 12px;
        border-bottom: 1px solid ${col}22;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      #panel-title {
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        font-weight: 700;
        color: #fff;
      }
      #panel-close {
        width: 24px; height: 24px;
        background: rgba(255,255,255,0.06);
        border: none;
        border-radius: 50%;
        color: rgba(255,255,255,0.5);
        font-size: 14px;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s;
      }
      #panel-close:hover { background: rgba(255,255,255,0.14); color:#fff; }

      /* Área del canvas grande */
      #cubo-canvas-wrap {
        width: 100%;
        height: ${PANEL_H}px;
        background: radial-gradient(ellipse at 50% 50%, #1a0a2e 0%, #04020a 70%);
        position: relative;
        overflow: hidden;
      }
      #cubo-canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      /* Barra inferior con estado emocional */
      #panel-footer {
        padding: 10px 20px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        border-top: 1px solid ${col}18;
      }
      #mood-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: ${col};
        box-shadow: 0 0 8px ${col};
        animation: moodPulse 2s ease-in-out infinite;
      }
      @keyframes moodPulse {
        0%,100%{ opacity:1; } 50%{ opacity:0.4; }
      }
      #mood-label {
        font-family: system-ui, sans-serif;
        font-size: 12px;
        color: rgba(200,185,255,0.6);
        flex: 1;
      }
      #branding {
        font-family: system-ui, sans-serif;
        font-size: 10px;
        color: rgba(200,185,255,0.25);
        letter-spacing: 0.05em;
      }
      #branding a { color: inherit; text-decoration: none; }
      #branding a:hover { color: rgba(200,185,255,0.5); }
    `;
    shadowRoot.appendChild(style);

    // ── Botón flotante ──
    btnElement = document.createElement('div');
    btnElement.id   = 'cubo-btn';
    btnElement.setAttribute('role', 'button');
    btnElement.setAttribute('aria-label', 'Abrir Cubo Sensible');
    btnElement.setAttribute('tabindex', '0');

    // Canvas pequeño dentro del botón (mini scene)
    const btnCanvas = document.createElement('canvas');
    btnCanvas.id = 'cubo-btn-canvas';
    btnElement.appendChild(btnCanvas);

    // Watermark demo
    if (LicenseState.status === 'demo' || LicenseState.status === 'expired') {
      const badge = document.createElement('span');
      badge.id = 'demo-badge';
      badge.textContent = LicenseState.status === 'expired' ? 'EXPIRED' : 'DEMO';
      btnElement.appendChild(badge);
    }

    shadowRoot.appendChild(btnElement);

    // ── Panel expandido ──
    panelEl = document.createElement('div');
    panelEl.id = 'cubo-panel';
    panelEl.setAttribute('aria-hidden', 'true');
    panelEl.innerHTML = `
      <div id="panel-header">
        <span id="panel-title">${Config.label || 'El Cubo Sensible'}</span>
        <button id="panel-close" aria-label="Cerrar">✕</button>
      </div>
      <div id="cubo-canvas-wrap">
        <canvas id="cubo-canvas"></canvas>
      </div>
      <div id="panel-footer">
        <div id="mood-dot"></div>
        <span id="mood-label">El Cubo te observa…</span>
        <span id="branding"><a href="https://cubowidget.com" target="_blank" rel="noopener">cubowidget.com</a></span>
      </div>
    `;
    shadowRoot.appendChild(panelEl);

    // Referencia al canvas principal
    canvasEl = panelEl.querySelector('#cubo-canvas');

    log('DOM created. Shadow root attached.');
  }

  /** Calcula la posición CSS del panel según la esquina elegida */
  function buildPanelPosition(pos, size) {
    const offset = 20;
    const gap    = 8;
    const bottom = `bottom: ${offset + size + gap}px;`;
    const top    = `top: ${offset + size + gap}px;`;
    const right  = `right: ${offset}px;`;
    const left   = `left: ${offset}px;`;
    const map = {
      'bottom-right': `${bottom} ${right}`,
      'bottom-left':  `${bottom} ${left}`,
      'top-right':    `${top} ${right}`,
      'top-left':     `${top} ${left}`,
    };
    return map[pos] || map['bottom-right'];
  }

  function getPanelOrigin(pos) {
    const map = {
      'bottom-right': 'bottom right',
      'bottom-left':  'bottom left',
      'top-right':    'top right',
      'top-left':     'top left',
    };
    return map[pos] || 'bottom right';
  }

  /* ═══════════════════════════════════════════════════════════
     [D] ThreeScene — punto de enganche para tu escena Three.js
  ═══════════════════════════════════════════════════════════ */

  /**
   * API pública del widget.
   * El código de tu escena Three.js se engancha aquí.
   *
   * global.CuboWidget expone dos métodos:
   *   initScene(canvas, options)  → inicializa el canvas grande (panel)
   *   initButton(canvas, options) → inicializa el mini canvas del botón
   *   setMood(text)               → actualiza el texto de estado emocional
   *   destroy()                   → limpia todo (útil para SPAs)
   */
  global.CuboWidget = {

    /**
     * initScene — inicializa la escena 3D en el panel expandido.
     *
     * @param {HTMLCanvasElement} canvas  - el <canvas> dentro del panel
     * @param {Object}            options - { theme, color, plan, siteId }
     *
     * ─── AQUÍ VA TU CÓDIGO DE THREE.JS ───────────────────────
     * Cuando tengas la escena del Cubo lista, haz algo como:
     *
     *   import { initCuboScene } from './cubo-scene.js';
     *   initCuboScene(canvas, options);
     *
     * o, si cargas Three.js dinámicamente:
     *
     *   loadScript(THREE_CDN).then(() => {
     *     initCuboScene(canvas, options);
     *   });
     * ─────────────────────────────────────────────────────────
     */
    initScene(canvas, options) {
      log('initScene called', { canvas, options });

      // TODO: inicializar escena Three.js aquí
      // Ejemplo:
      //   const scene    = new THREE.Scene();
      //   const camera   = new THREE.PerspectiveCamera(60, canvas.width/canvas.height, 0.1, 100);
      //   const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      //   ... (tu lógica del Cubo Sensible) ...

      // Placeholder visual mientras no hay escena real
      _renderPlaceholder(canvas, options);
    },

    /**
     * initButton — inicializa la mini escena en el botón flotante.
     * Normalmente es una versión simplificada del cubo (sin postpro).
     */
    initButton(canvas, options) {
      log('initButton called', { canvas, options });
      // TODO: mini escena Three.js para el botón
      _renderPlaceholderBtn(canvas, options);
    },

    /**
     * setMood — actualiza el texto de estado emocional en el panel.
     * Llámalo desde tu animLoop cuando cambie la emoción.
     *
     * @param {string} text  - ej: "El Cubo está nervioso…"
     * @param {string} color - ej: "#00ffaa"
     */
    setMood(text, color) {
      if (!shadowRoot) return;
      const label = shadowRoot.getElementById('mood-label');
      const dot   = shadowRoot.getElementById('mood-dot');
      if (label) label.textContent = text;
      if (dot && color) dot.style.background = color;
    },

    /**
     * destroy — limpia el widget del DOM.
     * Útil en SPAs (React, Vue) cuando la página se desmonta.
     */
    destroy() {
      if (hostElement && hostElement.parentNode) {
        hostElement.parentNode.removeChild(hostElement);
      }
      hostElement = null;
      shadowRoot  = null;
      log('Widget destroyed.');
    },
  };

  /* ── Placeholders visuales (mientras no hay Three.js real) ── */
  function _renderPlaceholder(canvas, options) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width  = PANEL_W;
    canvas.height = PANEL_H;

    let angle = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fondo degradado
      const bg = ctx.createRadialGradient(
        canvas.width/2, canvas.height/2, 0,
        canvas.width/2, canvas.height/2, canvas.height/2
      );
      bg.addColorStop(0, '#1a0a2e');
      bg.addColorStop(1, '#04020a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cubo 2D rotando (placeholder visual)
      ctx.save();
      ctx.translate(canvas.width/2, canvas.height/2);
      ctx.rotate(angle);
      ctx.strokeStyle = options.color || '#9b3dff';
      ctx.lineWidth   = 2;
      ctx.shadowColor = options.color || '#9b3dff';
      ctx.shadowBlur  = 12;
      const s = 60;
      ctx.strokeRect(-s, -s, s*2, s*2);
      ctx.restore();

      angle += 0.012;
      requestAnimationFrame(draw);
    }
    draw();
  }

  function _renderPlaceholderBtn(canvas, options) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = Config.size;
    canvas.width  = size;
    canvas.height = size;

    let angle = 0;
    function draw() {
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size/2, size/2);
      ctx.rotate(angle);
      ctx.strokeStyle = options.color || '#9b3dff';
      ctx.lineWidth   = 2;
      ctx.shadowColor = options.color || '#9b3dff';
      ctx.shadowBlur  = 8;
      const s = size * 0.28;
      ctx.strokeRect(-s, -s, s*2, s*2);
      ctx.restore();
      angle += 0.018;
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ═══════════════════════════════════════════════════════════
     [E] EVENTS — toggle open/close + accesibilidad
  ═══════════════════════════════════════════════════════════ */

  function bindEvents() {
    if (!btnElement || !panelEl) return;

    // Abrir/cerrar al hacer click en el botón
    btnElement.addEventListener('click', togglePanel);

    // Accesibilidad: espacio/enter activan el botón
    btnElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        togglePanel();
      }
    });

    // Cerrar con el botón X del panel
    const closeBtn = shadowRoot.getElementById('panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    // Cerrar al hacer click fuera del widget
    document.addEventListener('click', (e) => {
      if (isOpen && !hostElement.contains(e.target)) {
        closePanel();
      }
    });

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) closePanel();
    });
  }

  function togglePanel() {
    isOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    isOpen = true;
    panelEl.classList.add('open');
    panelEl.setAttribute('aria-hidden', 'false');
    btnElement.classList.add('open');
    btnElement.setAttribute('aria-label', 'Cerrar Cubo Sensible');
    log('Panel opened');
    Analytics.track('panel_open');
  }

  function closePanel() {
    isOpen = false;
    panelEl.classList.remove('open');
    panelEl.setAttribute('aria-hidden', 'true');
    btnElement.classList.remove('open');
    btnElement.setAttribute('aria-label', 'Abrir Cubo Sensible');
    log('Panel closed');
  }

  /* ═══════════════════════════════════════════════════════════
     [F] ANALYTICS — métricas ligeras (plan Pro)
  ═══════════════════════════════════════════════════════════ */

  const Analytics = {
    /**
     * Envía un evento ligero a la API de métricas.
     * Solo activo en licencias Pro/Lifetime.
     * No bloquea el hilo principal (fire-and-forget).
     *
     * Eventos posibles: 'panel_open', 'interaction', 'page_view'
     */
    track(event, data = {}) {
      if (LicenseState.plan !== 'pro' && LicenseState.plan !== 'lifetime') return;

      const payload = {
        siteId:  Config.siteId,
        event,
        domain:  location.hostname,
        path:    location.pathname,
        ts:      Date.now(),
        ...data,
      };

      // Usamos sendBeacon para no bloquear y garantizar entrega
      // incluso si el usuario cierra la pestaña
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(`${API_BASE}/cubo/analytics`, blob);
      } else {
        // Fallback: fetch sin await (fire-and-forget)
        fetch(`${API_BASE}/cubo/analytics`, {
          method:    'POST',
          headers:   { 'Content-Type': 'application/json' },
          body:      JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {}); // silencia errores
      }

      log('Analytics:', event, payload);
    },

    /**
     * Registra una visita de página al cargar el widget.
     */
    pageView() {
      this.track('page_view');
    },
  };

  /* ═══════════════════════════════════════════════════════════
     [G] BOOT — Orquesta el arranque completo
  ═══════════════════════════════════════════════════════════ */

  /**
   * Carga un script externo dinámicamente.
   * Se usa para cargar Three.js bajo demanda (solo cuando el
   * usuario abre el panel, para no impactar el tiempo de carga).
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s    = document.createElement('script');
      s.src      = src;
      s.type     = 'module';
      s.onload   = resolve;
      s.onerror  = reject;
      document.head.appendChild(s);
    });
  }

  /**
   * Inicializa Three.js de forma lazy (solo cuando el panel se abre
   * por primera vez), para no penalizar el LCP de la página cliente.
   */
  let threeLoaded = false;

  function lazyInitThree() {
    if (threeLoaded) return;
    threeLoaded = true;

    log('Lazy-loading Three.js…');

    /*
     * ── OPCIÓN A: cargar Three.js desde CDN ────────────────
     *
     * loadScript(THREE_CDN)
     *   .then(() => {
     *     global.CuboWidget.initScene(canvasEl, {
     *       theme:  Config.theme,
     *       color:  Config.color,
     *       plan:   LicenseState.plan,
     *       siteId: Config.siteId,
     *     });
     *   })
     *   .catch(err => log('Three.js failed to load:', err));
     *
     * ── OPCIÓN B: Three.js ya bundleado en cubo-widget.min.js ─
     * (recomendado para producción para evitar CORS y latencia)
     *
     * import { initCuboScene } from './cubo-scene.js';
     * initCuboScene(canvasEl, { ... });
     */

    // Mientras tanto, usa el placeholder visual
    global.CuboWidget.initScene(canvasEl, {
      theme:  Config.theme,
      color:  Config.color,
      plan:   LicenseState.plan,
      siteId: Config.siteId,
    });
  }

  /**
   * Punto de entrada principal.
   * Se ejecuta cuando el DOM está listo.
   */
  async function boot() {
    log('Booting… version', WIDGET_VERSION, '| siteId:', Config.siteId || '(none)');

    // 1. Validar licencia
    const licenseData  = await validateLicense(Config.siteId);
    LicenseState.status = licenseData.status || 'demo';
    LicenseState.plan   = licenseData.plan   || null;

    // Si es inválido → no montamos nada
    if (LicenseState.status === 'invalid') {
      log('Invalid license. Widget will not load.');
      return;
    }

    // 2. Construir DOM
    createWidgetDOM();

    // 3. Inicializar mini cubo en el botón
    const btnCanvas = shadowRoot.getElementById('cubo-btn-canvas');
    global.CuboWidget.initButton(btnCanvas, {
      theme:  Config.theme,
      color:  Config.color,
      plan:   LicenseState.plan,
      siteId: Config.siteId,
    });

    // 4. Vincular eventos
    bindEvents();

    // 5. Lazy-init Three.js cuando se abra el panel por primera vez
    const origOpen = openPanel;
    // Monkey-patch openPanel para interceptar la primera apertura
    const _openPanel = function () {
      lazyInitThree();
      origOpen();
    };
    // Reemplazar el listener del botón
    btnElement.removeEventListener('click', togglePanel);
    btnElement.addEventListener('click', () => {
      isOpen ? closePanel() : _openPanel();
    });

    // 6. Registrar page view en métricas (plan Pro)
    Analytics.pageView();

    log('Widget mounted. License:', LicenseState.status, '| Plan:', LicenseState.plan);
  }

  /* ── Arranca cuando el DOM esté disponible ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    // El script se ha cargado con async, el DOM ya está listo
    boot();
  }

})(window);
