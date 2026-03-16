# Modelo de Monetización — El Cubo Sensible Widget

## Resumen ejecutivo

Cobro por dominio integrado, con tres tramos de precio:
precio bajo de entrada + plan Pro con extras + licencia lifetime para quien odia las suscripciones.
Validación silenciosa en cada carga del widget contra tu API.
Sin complejidad técnica para el cliente.

---

## Planes y precios

| Plan       | Precio              | Para quién                        |
|------------|---------------------|-----------------------------------|
| Starter    | 9 €/mes · 1 dominio | Portfolios, webs personales       |
| Pro        | 19 €/mes · 1 dominio| Agencias, tiendas, webs de empresa|
| Lifetime   | 49 € pago único · 3 dominios | Quien odia suscripciones |

**Referencia de mercado:** Hotjar empieza en 32 €/mes, widgets de chat como Crisp tienen plan gratis y pasan a 25 €/mes. Tu precio de 9–19 €/mes está muy por debajo y es más fácil de vender.

---

## Cómo funciona la validación técnica

### Flujo al cargar el widget

```
Cliente carga la página
  └─► cubo-widget.min.js ejecuta boot()
        └─► GET /cubo/validate?siteId=abc123&domain=cliente.com
              ├─► { status: "active",  plan: "pro"     } → carga completa
              ├─► { status: "demo",    plan: null       } → watermark "DEMO"
              ├─► { status: "expired", plan: "starter"  } → mensaje de renovación
              └─► { status: "invalid", plan: null       } → no se monta nada
```

La llamada tiene un timeout de 4 segundos.
Si falla la red → modo "demo" por defecto (no penalizas al cliente por tus errores de servidor).

### Endpoint de validación (lo construyes tú)

```
GET https://api.tudominio.com/cubo/validate
  ?siteId=abc123
  &domain=cliente.com
  &v=1.0.0

Response 200:
{
  "status":        "active",
  "plan":          "pro",
  "allowedDomain": "cliente.com",
  "expiresAt":     "2026-12-31T00:00:00Z"
}
```

---

## Esquema de base de datos

### Tabla: `licencias`

```sql
CREATE TABLE licencias (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       VARCHAR(32)  NOT NULL UNIQUE, -- el data-cubo-site-id del cliente
  email         VARCHAR(255) NOT NULL,        -- contacto del cliente
  domain        VARCHAR(255) NOT NULL,        -- dominio autorizado (sin protocolo, sin /)
  plan          VARCHAR(20)  NOT NULL,        -- 'starter' | 'pro' | 'lifetime'
  status        VARCHAR(20)  NOT NULL DEFAULT 'active', -- 'active' | 'expired' | 'suspended'
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,                  -- NULL para lifetime
  stripe_sub_id VARCHAR(255),                 -- ID de suscripción en Stripe (planes mensuales)
  metadata      JSONB                         -- opciones extra: color, label, etc.
);

-- Índices para búsquedas rápidas (el endpoint de validación las hace en cada carga)
CREATE INDEX idx_licencias_site_id ON licencias(site_id);
CREATE INDEX idx_licencias_domain  ON licencias(domain);
```

### Tabla: `eventos_analytics` (solo plan Pro/Lifetime)

```sql
CREATE TABLE eventos_analytics (
  id         BIGSERIAL PRIMARY KEY,
  site_id    VARCHAR(32) NOT NULL REFERENCES licencias(site_id),
  event      VARCHAR(50) NOT NULL,   -- 'page_view' | 'panel_open' | 'interaction'
  domain     VARCHAR(255),
  path       VARCHAR(1024),
  ts         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data       JSONB                   -- payload extra del evento
);

CREATE INDEX idx_analytics_site_ts ON eventos_analytics(site_id, ts DESC);
```

---

## Lógica del endpoint de validación

```js
// Pseudocódigo del endpoint GET /cubo/validate

async function validateHandler(req, res) {
  const { siteId, domain } = req.query;

  // 1. Buscar licencia por site_id
  const licencia = await db.query(
    'SELECT * FROM licencias WHERE site_id = $1 LIMIT 1',
    [siteId]
  );

  if (!licencia) {
    return res.json({ status: 'invalid', plan: null });
  }

  // 2. Verificar que el dominio coincide
  // (comparación flexible: ignorar www, ignorar puerto)
  const cleanDomain = normalizeDomain(domain);
  if (!domainsMatch(licencia.domain, cleanDomain)) {
    return res.json({ status: 'invalid', plan: null });
  }

  // 3. Verificar estado
  if (licencia.status !== 'active') {
    return res.json({ status: licencia.status, plan: licencia.plan });
  }

  // 4. Verificar expiración (para planes mensuales)
  if (licencia.expires_at && new Date(licencia.expires_at) < new Date()) {
    await db.query("UPDATE licencias SET status='expired' WHERE id=$1", [licencia.id]);
    return res.json({ status: 'expired', plan: licencia.plan });
  }

  // 5. Licencia OK → devolver datos
  return res.json({
    status:        'active',
    plan:          licencia.plan,
    allowedDomain: licencia.domain,
    expiresAt:     licencia.expires_at,
    options:       licencia.metadata,  // color, label, etc. (plan Pro)
  });
}
```

---

## Flujo de alta de un cliente nuevo

```
1. Cliente rellena el formulario en tu landing
   POST /api/request-widget { name, email, domain, plan }

2. Tu backend:
   a. Genera un site_id único (ej: nanoid(12) → "k3mX9pQzR4vL")
   b. Inserta en tabla licencias con status='pending'
   c. Crea checkout en Stripe (para planes mensuales)
      O marca como active directamente (para prueba gratuita de 7 días)
   d. Envía email al cliente con:
      - El site_id
      - El snippet de integración listo para copiar
      - El enlace de pago (si aplica)

3. Cliente pega el snippet → el widget valida → funciona
```

---

## Ampliabilidad del modelo

### A corto plazo (sin esfuerzo extra)

- **Multi-dominio:** añadir campo `domains TEXT[]` en la tabla y permitir hasta N por plan.
- **Trial automático:** insertar con `expires_at = NOW() + INTERVAL '7 days'` y `status='active'`.
- **Cupones de descuento:** columna `promo_code` + lógica en Stripe.

### A medio plazo

- **Panel de cliente en tu web:** muestra métricas de la tabla `eventos_analytics`.
  Clicks por día, sesiones, hora de mayor actividad.
- **Webhooks de Stripe:** actualizar `status` y `expires_at` automáticamente cuando
  Stripe cobra o cuando una suscripción falla.
- **Personalización remota:** el endpoint de validación ya devuelve `options` (JSONB),
  el widget los lee y aplica colores/textos sin que el cliente toque nada.

### A largo plazo

- **White-label:** permitir que agencias revendan el widget bajo su marca.
- **API de configuración:** panel web donde el cliente cambia color/posición sin tocar código.
- **Versión SaaS completa:** panel de analytics, A/B testing de posición, etc.

---

## Resumen financiero estimado

| Escenario    | Clientes activos | Ingreso mensual |
|--------------|-----------------|-----------------|
| Inicio       | 20 × Starter    | ~180 €/mes      |
| Crecimiento  | 50 × mix        | ~650 €/mes      |
| Consolidado  | 200 × mix       | ~2.800 €/mes    |

Con el modelo Lifetime (49 €), cada venta financia el desarrollo del producto sin presión de churn. A partir de ~50 clientes activos, el modelo mensual supera al lifetime en valor de por vida.

**Recomendación:** empieza con Lifetime como gancho de lanzamiento (FOMO + precio bajo), y cuando tengas tracción, enfoca las ventas en el plan Pro mensual.

---

## Stack mínimo para el backend

No necesitas nada exótico:

- **Node.js + Express** (o cualquier framework) para los endpoints
- **PostgreSQL** (Supabase te lo da gratis para empezar)
- **Stripe** para cobros y gestión de suscripciones
- **Resend o Postmark** para el email transaccional con el Site ID
- **Vercel / Railway / Fly.io** para el servidor (< 5 €/mes al inicio)

Total coste técnico inicial: ~0–10 €/mes.
```
