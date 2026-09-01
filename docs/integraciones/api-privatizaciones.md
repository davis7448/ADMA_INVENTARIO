# API — Modificaciones y privatizaciones por cliente / por ID

Cómo consultar desde fuera de la app qué IDs de plataforma están privatizados a qué cliente
y qué modificaciones ha tenido cada uno.

Verificado el 2026-09-01. Endpoint implementado el 2026-09-01.

## 1. Dónde vive el dato

Una privatización no es una entidad propia: es un campo de la solicitud que la pidió.

| Colección | Qué guarda |
|---|---|
| `modificaciones` | Una fila por solicitud. El historial: quién pidió qué, para qué `ID` y qué correo, y cuándo. |
| `platformItemMappings` | Un doc por ID de plataforma (`{PLATAFORMA}_{itemId}`) con el dueño vigente. Derivado, e incompleto. |
| `clients` | Ficha del cliente: `email`, `additional_emails`, comercial asignado. |

**La llave que une cliente ↔ privatización es el correo (`CORREO_CODIGO`), no el id del cliente.**

### Campos relevantes de `modificaciones`

| Campo | Tipo | Qué es |
|---|---|---|
| `ID` | number \| null | ID del item en la plataforma. Eje de la consulta. |
| `CORREO_CODIGO` | string | Correo del cliente. Puede traer varios separados por coma. |
| `PRIVADO_PUBLICO` | `'Privado'` \| `'Publico'` | Estado en que queda el ID. |
| `ACCION_PRIVATIZACION` | `'privatizar'` \| `'quitar_privatizacion'` \| `'sin_cambio'` | Operación pedida (solo solicitudes nuevas). |
| `estadoSolicitud` | `pendiente`/`en_revision`/`aprobado`/`rechazado`/`creado`/`completado` | Solo `aprobado`, `creado`, `completado` tocaron la plataforma. |
| `FECHA` | number (epoch ms) | Ordena la línea de tiempo. Puede ser nula. |
| `PLATAFORMA` | string | DROPI, EFFI, VENNDELO… Un ID no es único entre plataformas. |
| `PRODUCTO`, `VARIABLE`, `SKU ` | string | Qué se privatizó. **`SKU ` lleva espacio final en la clave.** |
| `CANTIDAD SOLICITADA` | number | Unidades asignadas. |
| `COMERCIAL`, `solicitadoPor` | string / objeto | Quién lo pidió. |
| `tipoModificacion` | `RESERVA_INVENTARIO`/`AJUSTE_STOCK`/`BAJA_PLATAFORMA`/`CREACION_ITEM` | |

`platformItemMappings`: `visibility` (`privado`/`publico`/`desconocido`), `clientEmail`, `clientName`,
`productName`, `sku`, `commercialName`, `assignedQty`, `source`.

## 2. Estado real de `GET /api/modificaciones` — no sirve

Tres problemas, todos verificados:

1. **Devuelve vacío.** La ruta lee Firestore por REST **sin credenciales**. Funcionaba mientras
   `isAdminAccess()` dejaba pasar peticiones anónimas; esa regla ahora devuelve `false`. La misma
   petición responde hoy `403 PERMISSION_DENIED`. Como el código hace `data.documents || []`,
   el endpoint responde **200 con lista vacía** en vez de fallar (y 404 con `?id=`).
2. **Su control de acceso es falsificable.** Solo exige la cabecera `x-user-role` con cualquier valor.
   El middleware no pasa por `/api/`, así que esa cabecera la pone quien llama, no el servidor.
3. **No filtra por lo que hace falta.** `?id=` es el id del *documento de Firestore*, no el ID de plataforma.
   No hay filtro por correo, cliente, plataforma ni fecha.

Y el problema se extiende al resto de la infraestructura de tokens:

4. **`api_tokens` no tiene bloque `match` en `firestore.rules`**, así que cae en el deny por defecto.
   Leer la colección como la cuenta del servidor devuelve `403 PERMISSION_DENIED` (comprobado).
   Por eso `validateApiToken()` de `src/lib/api-tokens.ts` siempre responde inválido, `createApiToken()`
   falla en silencio y **la colección estaba vacía: nunca se creó un token**.
5. Consecuencia: `POST /api/dispatch/search-guides`, que usa ese módulo, responde 401 a todo el mundo.
   (No está en el alcance de este manual, pero se arregla igual que lo de abajo: leyendo con el Admin SDK.)

→ Para consultar a mano: Firestore directamente y autenticado (§3).
→ Para integrar un sistema: `GET /api/privatizaciones` (§6), que ya resuelve todo esto.

## 3. Autenticarse

Las reglas exigen `isInterno()` (autenticado y con rol distinto de `cliente`).

### Vía A — cuenta de servicio (servidor a servidor)

```ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert({
    projectId:   process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore();
```

### Vía B — usuario interno (curl, n8n, Sheets, Postman)

```bash
API_KEY=AIzaSyAFrZ4jvO5fIF9koe0cMUUwO1r_b5fdBRk   # clave web pública del proyecto

ID_TOKEN=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMA_EMAIL\",\"password\":\"$ADMA_PASSWORD\",\"returnSecureToken\":true}" \
  | jq -r .idToken)

FS=https://firestore.googleapis.com/v1/projects/studio-9748962172-82b35/databases/'(default)'/documents
```

El `idToken` dura una hora. Lo secreto son correo y contraseña, no la API key.

## 4. Las cuatro consultas

### 4.1 De un cliente a sus correos

```bash
curl -s -H "Authorization: Bearer $ID_TOKEN" "$FS/clients/CLIENT_ID" | jq '.fields | {
  nombre: .name.stringValue,
  correo: .email.stringValue,
  otros:  [.additional_emails.arrayValue.values[]?.stringValue],
  comercial: .assigned_commercial_name.stringValue }'
```

### 4.2 Privatizaciones de un cliente

```bash
curl -s -X POST "$FS:runQuery" \
  -H "Authorization: Bearer $ID_TOKEN" -H 'Content-Type: application/json' \
  -d '{"structuredQuery":{
        "from":[{"collectionId":"modificaciones"}],
        "where":{"fieldFilter":{"field":{"fieldPath":"CORREO_CODIGO"},
                 "op":"EQUAL","value":{"stringValue":"cliente@ejemplo.com"}}},
        "orderBy":[{"field":{"fieldPath":"FECHA"},"direction":"DESCENDING"}],
        "limit":500}}'
```

> Igualdad sobre `CORREO_CODIGO` + `orderBy FECHA` requiere un índice compuesto que **no está declarado**
> en `firestore.indexes.json`. La primera llamada falla con el enlace para crearlo; o se quita el `orderBy`
> y se ordena en el cliente.

### 4.3 Historial de un ID

```bash
curl -s -X POST "$FS:runQuery" \
  -H "Authorization: Bearer $ID_TOKEN" -H 'Content-Type: application/json' \
  -d '{"structuredQuery":{
        "from":[{"collectionId":"modificaciones"}],
        "where":{"fieldFilter":{"field":{"fieldPath":"ID"},
                 "op":"EQUAL","value":{"integerValue":"1234567"}}},
        "limit":200}}'
```

Ordenado por `FECHA` ascendente da la línea de tiempo del ID (mismo criterio que `ownerAtDate()`
en `src/lib/platform-sales.ts`: cada venta se atribuye al dueño vigente a la fecha de la venta).

### 4.4 Dueño actual de un ID

```bash
curl -s -H "Authorization: Bearer $ID_TOKEN" "$FS/platformItemMappings/DROPI_1234567" | jq '.fields | {
  visibilidad: .visibility.stringValue,
  cliente:     .clientEmail.stringValue,
  producto:    .productName.stringValue,
  unidades:    .assignedQty.integerValue }'
```

Un 404 aquí no significa "no privatizado": significa que ese ID aún no se cruzó con un reporte de ventas.

### 4.5 Resolución del estado vigente (Admin SDK)

```ts
const ESTADOS_EFECTIVOS = new Set(['aprobado', 'creado', 'completado']);

async function privatizacionesDe(correo: string) {
  const snap = await db.collection('modificaciones')
    .where('CORREO_CODIGO', '==', correo.toLowerCase()).get();

  const porId = new Map<string, any>();
  for (const doc of snap.docs) {
    const m = doc.data();
    const itemId = String(m.ID ?? '').replace(/\.0$/, '');
    if (!itemId) continue;
    if (m.estadoSolicitud && !ESTADOS_EFECTIVOS.has(m.estadoSolicitud)) continue;
    const previa = porId.get(itemId);
    if (!previa || (m.FECHA ?? 0) > (previa.FECHA ?? 0)) porId.set(itemId, m);
  }

  return [...porId.entries()]
    .filter(([, m]) => m.ACCION_PRIVATIZACION === 'privatizar' ||
      (m.ACCION_PRIVATIZACION !== 'quitar_privatizacion' && m.PRIVADO_PUBLICO === 'Privado'))
    .map(([itemId, m]) => ({
      itemId,
      plataforma: m.PLATAFORMA,
      producto:   m.PRODUCTO,
      sku:        m['SKU '],
      unidades:   Number(m['CANTIDAD SOLICITADA']) || 0,
      comercial:  m.solicitadoPor?.name ?? m.COMERCIAL ?? null,
      fecha:      m.FECHA ? new Date(m.FECHA).toISOString() : null,
    }));
}
```

## 5. Trampas del dato

1. **El correo puede ser varios.** `CORREO_CODIGO` admite `"a@x.com, b@x.com"`; la app toma el primero en
   minúsculas. Firestore no busca "contiene" → la igualdad exacta pierde esas filas.
2. **Mayúsculas y espacios.** No hay campo normalizado de correo en `modificaciones`.
3. **El ID a veces es texto** (`"1234567.0"` de importaciones antiguas). Filtrar solo por `integerValue`
   deja fuera esos documentos.
4. **Un ID no es único entre plataformas.** Filtrar también por `PLATAFORMA`.
5. **Solicitud pedida ≠ privatización aplicada.** Descartar `pendiente`, `en_revision`, `rechazado`.
   Los históricos sin `estadoSolicitud` cuentan como efectivos.
6. **El estado vigente es la última fila, no la suma.** Un ID puede privatizarse, liberarse y reasignarse.
   `FECHA` nula rompe el orden.

Sobre unidades: `CANTIDAD SOLICITADA` se acumula **por dueño**, no por ID. En combos, las unidades base son
`paquetes × COMBO.unidadesPorCombo`; si el ID agrupa varios productos, ver `COMPONENTES`.

## 6. `GET /api/privatizaciones` — el endpoint

Implementado. Resuelve las seis trampas de §5 en un solo sitio, se autentica con token y lee con el
Admin SDK (no pasa por las reglas, así que no depende de `isAdminAccess()` ni de `api_tokens` en las reglas).

```
GET /api/privatizaciones
Header: X-API-Token: tk_adma_…
```

| Parámetro | Qué hace |
|---|---|
| `correo` | Correo del cliente. Resuelve su ficha en `clients` y consulta por **todos** sus correos. |
| `clientId` | Id del documento de cliente. Alternativa a `correo`. 404 si no existe. |
| `id` | ID de plataforma. Acepta `1234567` y `1234567.0`. |
| `plataforma` | Filtra por plataforma (sin distinguir mayúsculas ni tildes). |
| `desde` / `hasta` | Acotan el **historial**. `YYYY-MM-DD` o fecha ISO. `hasta` incluye el día completo. |
| `historial=0` | Omite el historial y devuelve solo el estado vigente. |

Hace falta al menos uno de `correo`, `clientId` o `id`.

```bash
curl -H "X-API-Token: $TOKEN" \
  "$BASE_URL/api/privatizaciones?correo=cliente@ejemplo.com"
```

```jsonc
{
  "success": true,
  "clientName": "SISTEMA AUDITORIA",          // a quién pertenece el token
  "timestamp": "2026-09-01T20:55:00.000Z",
  "consulta": { "clientId": null, "correo": "cliente@ejemplo.com", "id": null, "plataforma": null },
  "cliente": { "id": "abc123", "nombre": "…", "correos": ["…"], "comercial": "…" },
  "vigentes": [{
    "itemId": "2102764", "plataforma": "Dropi", "producto": "VISION COMPLETE 180CAP",
    "variante": null, "sku": "94080000", "unidades": 8000,
    "correo": "cliente@ejemplo.com", "comercial": "…",
    "desde": "2026-09-01T16:21:46.420Z", "modificacionId": "RRMMcNSdtEqlL9vDrouU"
  }],
  "historial": [{
    "modificacionId": "…", "itemId": "2102764", "fecha": "…", "accion": "privatizar",
    "visibilidad": "Privado", "correo": "…", "estado": "aprobado", "tipo": "AJUSTE_STOCK",
    "plataforma": "Dropi", "producto": "…", "sku": "…", "unidades": 500,
    "solicitadoPor": "…", "efectiva": true
  }],
  "total": { "vigentes": 36, "unidades": 40083, "eventos": 187 },
  "rateLimit": { "remaining": 26, "resetTime": "2026-09-01T20:56:21.535Z" }
}
```

`vigentes` responde "¿qué tiene privatizado este cliente ahora?"; `historial` responde "¿qué le ha pasado
a esto?". `efectiva: false` marca los eventos que se pidieron pero no llegaron a aplicarse.

**`vigentes` se calcula sobre todas las modificaciones del ID, no solo sobre las del cliente**: si otro
cliente se quedó el ID después, deja de aparecer aunque este lo tuviera antes.

### Códigos de respuesta

| Código | Cuándo |
|---|---|
| 400 | Sin parámetros de búsqueda, o fechas inválidas |
| 401 | Falta `X-API-Token`, o el token no existe o está revocado |
| 403 | El `Origin` del navegador no está en `allowedOrigins` del token |
| 404 | `clientId` que no existe |
| 429 | Cupo por minuto superado (trae `retryAfter` en segundos) |

### Crear un token

`src/lib/api-tokens.ts` y la UI de `/api/admin/api-tokens` no pueden crear tokens (§2, punto 4).
Mientras eso no se arregle, se crean con el script:

```bash
npx tsx scripts/crear-api-token.ts "NOMBRE CLIENTE" cliente-id 60 "https://mi-app.web.app"
npx tsx scripts/crear-api-token.ts --listar
npx tsx scripts/crear-api-token.ts --revocar tk_adma_xxxxx
```

El tercer argumento es el límite por minuto (por defecto 60) y el cuarto la lista de orígenes permitidos
separados por coma; sin orígenes, no se restringe por `Origin` (las llamadas servidor a servidor no lo mandan).
El token se muestra **una sola vez**.

### Implementación

| Archivo | Qué hace |
|---|---|
| `src/app/api/privatizaciones/route.ts` | La ruta: token, cupo, parámetros, respuesta |
| `src/lib/privatizaciones.ts` | Las seis reglas de §5 y la consulta a Firestore |
| `src/lib/api-tokens-admin.ts` | Validación de token y cupo por minuto, con Admin SDK |
| `src/lib/__tests__/privatizaciones.test.ts` | 19 tests de la lógica de resolución |
| `scripts/crear-api-token.ts` | Alta, listado y revocación de tokens |

La colección `modificaciones` se trae entera (~6.700 documentos) y se cachea 5 minutos en memoria del
proceso: es la única forma de aplicar las reglas 1 y 2, porque Firestore no sabe buscar "contiene" y una
igualdad sobre `CORREO_CODIGO` se deja fuera las filas con varios correos o con mayúsculas.

## 7. Seguridad — pendientes

- **No usar `x-user-role` como control de acceso** en rutas nuevas: el middleware no pasa por `/api/`.
- **`/api/modificaciones` sigue publicada** y sigue sin control de acceso real. Ahora que existe
  `/api/privatizaciones`, conviene retirarla.
- **Las credenciales de la cuenta de servicio están en claro** en `.env.local`. Para dar acceso externo,
  emitir un token de `api_tokens`, nunca esas credenciales.
- **El remote de git lleva un token de GitHub incrustado** en la URL de `origin` (`git remote -v` lo muestra).
  Conviene rotarlo y pasarlo a un credential helper.

## Fuentes en el repo

- `src/app/actions/modificaciones.ts` — modelo y flujo de solicitudes
- `src/lib/platform-sales.ts` — línea de tiempo y dueño por ID (`ownerAtDate`, `buildMappingsFromSolicitudes`)
- `src/lib/crm-product-metrics.ts` — métricas por cliente
- `src/app/api/modificaciones/route.ts` — endpoint legacy
- `src/lib/api-tokens.ts` — tokens de API
- `firestore.rules` — permisos (`isInterno`, `isAdminAccess`)
