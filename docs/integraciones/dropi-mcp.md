# Dropi por MCP — cómo funciona y cómo se rompe

Integración con Dropi a través de su servidor MCP (`https://mcp.dropi.co/mcp`).
Se montó por nuestra cuenta porque el conector oficial admite **una sola cuenta** y ADMA
opera varias (dos bodegas × varios países).

Código: `src/lib/dropi-mcp.ts` · Sincronización: `scripts/dropi-sync.ts` (cron 7:15) y
`scripts/dropi-estados.ts` (cron 2:30).

---

## 1. Los tres fallos que ya nos costaron días

Esta sección va primero a propósito: son errores reales, con síntoma y causa, y los tres
se manifestaron como "no pasa nada" en vez de como un error.

### 1.1 "0 órdenes" cuando en realidad hay miles

**Síntoma.** La sincronización corre, renueva el token, no da error, y reporta
`0 órdenes · 0 entregadas`. Igual que un día sin ventas.

**Causa (agosto 2026).** Dropi cambió el formato de respuesta de `list_orders` y lo
desplegó **de forma progresiva**: una cuenta seguía recibiendo el formato antiguo tipo
YAML mientras otra ya recibía CSV. El parser solo entendía el antiguo, devolvía lista
vacía, y eso se traducía en cero.

LABORATORIO estuvo diez días sin importar nada. Nadie lo notó porque INGENIO —que seguía
con el formato viejo— funcionaba con normalidad.

**Formatos que hay que soportar:**

```
# Antiguo (YAML)
orders:
  - order_id: "12345"
    status: ENTREGADO

# Nuevo (CSV con cabecera). Ojo: hay comas DENTRO de comillas.
items[100]{order_id,status,customer_name,customer_phone,city,total,...}:
  "86892858",PENDIENTE,Wuilliam Rengifo,"3136803839",BALBOA (C),118900,...
  "86884336",ENTREGADO,"Molina, Leonor","3216710552",RIONEGRO (ANT),49990,...
```

**Protección actual.** `parseListOrders` entiende ambos, y si llega texto que no reconoce
**registra una muestra en el log** en vez de devolver cero en silencio. Ese aviso es lo
que permitió encontrar el problema; si vuelve a aparecer, mirar la muestra antes que nada.

**Regla:** que un parser devuelva vacío nunca puede ser indistinguible de "no hay datos".

### 1.2 Comprobar la salud de una cuenta la mata

**Síntoma.** Se ejecuta un chequeo para ver si el token sirve. Responde que sí. A los
minutos, la cuenta da `401` y hay que reconectarla.

**Causa.** Los `refresh_token` de Dropi son **de un solo uso**: cada renovación devuelve
uno nuevo e invalida el anterior. Un chequeo que llama a `refreshAccess()` sin guardar el
token nuevo deja la cuenta con uno muerto.

**Regla:** usar SIEMPRE `refrescarYGuardar()`, nunca `refreshAccess()` suelto.

### 1.3 Reintentar con el token viejo revoca toda la cadena

**Síntoma.** Una cuenta recién reconectada vuelve a dar `401` sin que nadie la haya tocado.

**Causa.** Dropi aplica **detección de reutilización**: si se presenta un `refresh_token`
ya rotado, revoca la familia entera, incluido el nuevo que sí estaba bien guardado. Pasa
sin querer al reutilizar un objeto de cuenta en memoria que aún tiene el token anterior:

```ts
const cuenta = await listDropiAccounts()...;
await fetchDropiOrders(cuenta, 7);   // rota el token y guarda el nuevo
await fetchDropiOrders(cuenta, 30);  // ⛔ `cuenta` tiene el viejo → revoca la cadena
```

**Regla:** una renovación por proceso. Si hace falta otra llamada, releer la cuenta desde
Firestore.

---

## 2. Cómo diagnosticar sin romper nada

Cualquier prueba que renueve un token puede dejar la cuenta fuera de servicio. Por orden
de preferencia:

1. **Mirar los datos, no la cuenta.** ¿Cuándo fue la última importación de esa
   bodega+país en `platformSales`? Si es de hace días, hay problema. No consume nada.
2. **Leer `dropiAccounts.updatedAt`.** Dice cuándo se guardó el token por última vez.
   Tampoco consume nada. Ojo: reciente **no** significa sano — puede haberse guardado uno
   que luego se revocó.
3. **Leer el log de la última corrida** (`logs/dropi-sync.log`).
4. **Ejecutar la sincronización real** (`scripts/dropi-daily-sync.sh`). Hace una sola
   renovación por cuenta y la guarda. Es la única prueba "en vivo" segura.

**Nunca** escribir sondas sueltas que llamen a `refreshAccess()`.

---

## 3. Autenticación

OAuth 2.0 + PKCE contra `oauth.dropi.co`, cliente propio `adma-inventario-a51a3a3c`.

- **`resource` es obligatorio** (RFC 8707) apuntando a `https://mcp.dropi.co/mcp`. Sin
  ese parámetro el token se emite con otra audiencia y el MCP responde *invalid audience*.
- **El `redirect_uri` debe estar registrado.** Solo lo están los dominios de App Hosting.
  Entrar por el dominio propio (`inv.admacompany.com`) daba `invalid_redirect_uri`, así
  que `/api/dropi/oauth/start` **fuerza el origen registrado** (`origenRegistrado()`).
  Si algún día se registra el dominio propio, añadirlo a `ORIGENES_REGISTRADOS`.
  Cuidado: re-registrar el cliente puede emitir un `client_id` nuevo y **obligaría a
  reconectar todas las cuentas**.

Conectar una cuenta: abrir con la sesión de ESA cuenta de Dropi activa en el navegador

```
/api/dropi/oauth/start?label=NOMBRE&pais=PAIS&bodega=BODEGA
```

---

## 4. Límites de la API y por qué el código es así

- **Rango máximo 90 días** por consulta.
- **504 en paginación profunda** → se pide en trozos de 20 días (`CHUNK_DAYS`) para que
  cada trozo tenga pocas páginas.
- **`get_order` está limitado por tasa** y es una petición por orden. Por eso solo se
  llama para las **entregadas**, que son las únicas que necesitan el detalle de items
  para el ingreso y la atribución por cupo. Las demás se guardan a nivel orden.
- `skipGuias` evita repetir las entregadas ya importadas: el cron diario solo trae las
  nuevas.
- `soloEstados` no llama a `get_order` en absoluto. Para cuentas de mucho volumen.
- Reintentos: 429 y 5xx se reintentan con espera creciente; los 4xx se lanzan, porque
  reintentar un error de cliente no arregla nada.

## 5. Configuración por cuenta (`dropiAccounts`)

| Campo | Para qué |
|---|---|
| `bodega` / `pais` | Con qué bodega y país se guardan sus ventas |
| `maxDias` | Tope de ventana. LABORATORIO Colombia usa 3 por volumen |
| `syncMode` | `completo`, `excel` (solo estados) u `off` |
| `refreshToken` | De un solo uso — ver 1.2 y 1.3 |

## 6. Si una cuenta deja de traer datos

1. Comprobar la última importación en `platformSales` (paso 1 de la sección 2).
2. Mirar `logs/dropi-sync.log`: ¿aparece el aviso de "texto que el parser no entiende"?
   → cambió el formato: adaptar `parseListOrders` con la muestra del log.
3. ¿Dice `0 órdenes` sin aviso? → puede ser real; contrastar con Dropi en el navegador.
4. ¿`401`? → reconectar por OAuth, y revisar que nadie haya ejecutado una sonda que
   consuma tokens.
