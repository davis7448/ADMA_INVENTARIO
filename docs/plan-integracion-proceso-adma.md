# Plan de integración — Proceso ADMA Company en ADMA Inventario

**Fecha:** 2026-07-18 · **Estado:** aprobado por el dueño, pendiente inicio de implementación
**Modo de trabajo:** implementación iterativa en **staging** (rama `test` → backend App Hosting `Studio-Staging`). Cada fase se despliega a staging, el dueño la prueba y se pule; el paso a producción (merge a `main`) requiere aprobación explícita. **Regla de oro:** todo cambio va con commit + push a GitHub para permitir reversiones controladas.

---

## 1. Objetivo

Digitalizar el proceso completo de la operación en un solo sistema (ADMA Inventario), con trazabilidad de punta a punta:

```
Documentación de mercancía por llegar (OC con SKU)
  → Recepción en bodega con verificación (cajas/unidades, fotos reales)
  → Almacenamiento (bodega + ubicación)
  → Liquidación de costos (landed cost)
  → Activación comercial (creación de items públicos en plataformas, migrando ClickUp a ADMA)
  → Difusión y remarketing (registro por producto × cliente)
  → Reportes (difusión, entradas, clientes)
```

## 2. Decisiones ya tomadas por el dueño

| Tema | Decisión |
|---|---|
| Origen de la OC | Digitada manualmente en Inventario por coordinación operativa (Xiomara). Groupack es solo referencia (campo `groupackRef`), sin integración API. |
| Fotos | Fotos de **inspección de China** se cargan ANTES del arribo (info que entrega Groupack). Al recibir, bodega (Kristal) carga las **fotos reales** del item. |
| Drive | Sigue siendo un link manual vinculado por producto/línea (sin API de Drive). Josué gestiona el contenido publicitario. |
| Costo estimado | Se calcula con la tarifa cliente: `costo de producto + $2.200.000 COP × m³`. La tarifa debe ser **configurable** (settings). |
| Liquidación | El costo final unitario se registra en Inventario (desde el Excel/Groupack) y alimenta `cost` → recálculo de precios. |
| Nuevo vs recarga | Flujos distintos: **nuevo** → contenido + activación + difusión completa; **reabastecimiento** → remarketing a clientes con historial + actualización de precios si cambió el costo. |
| Solicitud de items | "Creación de item" = crear una **modificación** (módulo existente) con tipo nuevo. "Actualización de plataforma" = procesarla (habilitar producto). **"Público no privado" se refiere al tipo de item en las plataformas externas (Dropi, etc.)**: los items se crean públicos (para todos los clientes) y no privados por correo; ese dato viaja en la modificación (campo PRIVADO_PUBLICO existente). Internamente NO se oculta ningún producto: el estado del proceso se lleva con `activationStatus` (borrador → solicitado → activo). |
| ClickUp | **Se migra completamente a ADMA.** Antes de la fase 4, análisis vía API de ClickUp (el dueño da el token) para inventariar los tipos de solicitudes reales. |
| Difusión | Solo **registro manual**: el comercial difunde por fuera (WhatsApp/IG/directo/grupos) y registra en la app a quién ofertó. Sin WhatsApp API. |
| Roles | Xiomara (coordinadora operativa) → rol nuevo `coordinacion` · Josué → rol nuevo `marketing` · Kristal → `logistics` (existente) · procesa activaciones → `plataformas`. |
| Variantes | Las OC pueden venir por variante con SKU o por producto general; **el detalle se confirma en bodega** al recibir. El modelo soporta ambos. |

## 2.1 Enfoque: flujo documentado + KPIs

Esto es un software de inventario: no hay "catálogo interno" ni vitrina. El objetivo de los módulos es **documentar el flujo real de la operación y conectarlo de punta a punta** para poder medirlo. KPIs que habilita el modelo de datos:

| KPI | Fuente |
|---|---|
| Tiempo de tránsito (documentada → recibida) y tiempo total (documentada → activada) | timestamps de estados en `purchaseOrderItems` |
| Exactitud de recepción: % líneas con discrepancia, unidades esperadas vs contadas | `receptionItems` (match, counted vs expected) |
| Precisión del costeo: costo estimado (tarifa × CBM) vs costo final liquidado | `unitCostEstimated` vs `unitCostFinal` |
| Velocidad de contenido: líneas con contenido listo antes del arribo | `contentStatus` vs fecha de recepción |
| Tiempo de activación: recibido → item creado en plataforma | `activationStatus`/modificaciones `CREACION_ITEM` |
| Entradas por tipo: unidades nuevas vs reabastecimiento (por periodo, por proveedor) | `inventoryMovements.entryType` |
| Difusión: ofertas por producto/categoría/comercial/canal y su outcome | `productPromotions` |
| Comportamiento de clientes: activados nuevos, reactivados, sin oferta reciente | `client_events` + `productPromotions` |

## 3. Fases

### Fase 0 — Fundamentos (prerequisito corto) ✅ implementada

- **Roles nuevos** en `UserRole` (`src/lib/types.ts`): `coordinacion` (Coordinación Operativa), `marketing`. Actualizar menú (`main-nav.tsx`) y gestión de usuarios.
- **Estado de activación de producto** — `Product` +=
  - `activationStatus?: 'borrador' | 'solicitado' | 'activo'` (estado de activación en plataformas externas; ausente = histórico/ya activo), `activatedAt?`, `activationModificacionId?`
  - `inspectionPhotos?: string[]`, `realPhotos?: string[]`
  - Nota: NO se oculta ningún producto internamente — el catálogo comercial muestra todo. Lo "público/privado" es el tipo de item en la plataforma externa y va en la modificación.
- **Trazabilidad de entradas** — `InventoryMovement` += `entryType?: 'nuevo' | 'reabastecimiento'`, `purchaseOrderId?`, `receptionId?`.
- **Tarifa de importación** configurable en `settings` (COP por m³, hoy $2.200.000).

### Fase 1 — Mercancía por llegar (módulo Compras)

Xiomara documenta lo que viene; Josué gestiona la cola de contenido; todos ven el pipeline de mercancía en tránsito.

**Colecciones nuevas:**

`purchaseOrders`: `orderNumber` (consecutivo vía `counters`), `supplierId?`, `groupackRef?`, `warehouseId`, `status: documentada → en_transito → recibida_parcial → recibida → liquidada → cerrada`, `estimatedArrivalDate?`, `createdBy`, timestamps.

`purchaseOrderItems` (colección plana, no array embebido — permite consultar líneas por producto/SKU cruzando OCs):
- `purchaseOrderId`, `sku`, `productName`, `productId?` (null = producto por crear en recepción), `variantId?`
- `entryType: 'nuevo' | 'reabastecimiento'` (prellenado: con productId → reabastecimiento)
- `expectedUnits`, `expectedBoxes`, `unitsPerBox?`
- `cbmPerUnit?`, `productCost?` → `unitCostEstimated` **auto-calculado** = productCost + tarifa × cbmPerUnit
- `inspectionPhotos: string[]` (Storage, fotos de China pre-arribo)
- `contentLink?` (Drive manual), `contentStatus: 'pendiente' | 'en_proceso' | 'listo'` (cola de Josué)
- `unitCostFinal?` (fase 3)
- `status: documentada → en_transito → recibida → almacenada → liquidada → activada` ← **espina dorsal del flujo; las fases 2–4 solo lo avanzan**

**UI/código nuevo:** `src/app/compras/ordenes/` (lista pipeline + detalle con líneas, galería de inspección, links Drive) + `src/app/actions/purchase-orders.ts`. Menú "Compras" para `admin, coordinacion, marketing, plataformas, logistics (lectura), consulta`. Rol `marketing` solo edita `contentLink`/`contentStatus`. Badge "Por llegar" en el detalle de producto.

**Se reutiliza:** `uploadImageAndGetURL` (`src/lib/api.ts`), consecutivos con `counters`, `suppliers`, buscador de productos/SKU de los formularios existentes.

**Deprecación:** `importRequests` (`/alianzas/importaciones`, módulo huérfano sin SKU/cantidades) queda congelado; confirmar que nadie lo usa antes de eliminarlo.

### Fase 2 — Recepción de mercancía (Kristal)

**Colecciones nuevas:**

`receptions`: `receptionNumber`, `purchaseOrderId`, `warehouseId`, `receivedBy` (logistics/Kristal), `verifiedBy?` (coordinacion/Xiomara — segunda firma), `status: en_conteo | con_discrepancia | verificada | cargada`, `notes?`.

`receptionItems`: `receptionId`, `purchaseOrderItemId`, `sku`, `productId?`, `countedUnits`, `countedBoxes`, `expectedUnits/expectedBoxes` (snapshot para auditoría), `match: boolean`, `discrepancyNotes?`, `realPhotos: string[]`, `locationId?`, `inventoryLoaded`, `movementId?`.

**Flujo (wizard):**
1. Lista de OCs `en_transito` → "iniciar recepción".
2. Conteo de cajas/unidades por línea → el sistema marca `match` contra lo esperado. Discrepancia exige nota y **verificación de `coordinacion`** antes de continuar.
3. Fotos reales por línea (alimentan `realPhotos` del producto — el "item real").
4. Ubicación: selector de `locations` (códigos `A-1-1-A`… ya cargados) + bodega.
5. Cargue: si `productId` existe → **reabastecimiento** vía `registerInventoryEntry` (extendido con `meta { entryType, purchaseOrderId, receptionId }` — cambio retrocompatible); si no → **alta** con `addProductAction` precargada (nombre/SKU/fotos/link de la línea), nace con `activationStatus: 'borrador'`. Aquí se confirma o detalla el desglose por variantes.
6. Avanza estados: línea → `almacenada`, OC → `recibida`/`recibida_parcial`.

**UI/código nuevo:** `src/app/logistics/recepciones/` + `src/app/actions/receptions.ts`.

### Fase 3 — Liquidación (landed cost) — la más barata, ~90 % reuso

- Pantalla `/compras/ordenes/[id]/liquidacion` (roles `admin`, `coordinacion`): tabla SKU × costo final digitado desde el Excel de Groupack; muestra el **delta vs `unitCostEstimated`**.
- Al confirmar: `unitCostFinal` en líneas, estados → `liquidada`, y alimenta `previewCostPriceUpdateAction` / `applyCostPriceUpdateAction` (`src/app/actions/products.ts`) que ya actualizan `cost` y recalculan precios con preview de conflictos.
- Si el costo cambió en un reabastecimiento, el delta de precios queda como insumo del remarketing (fase 5).

### Fase 4 — Activación de producto (migración de ClickUp)

- **4a (análisis previo):** con el token de API de ClickUp del dueño, inventariar los tipos de solicitudes reales del tablero actual y mapearlos al catálogo definitivo de `tipoModificacion` (no solo creación de item — pueden aparecer más tipos a migrar).
- Pantalla `/commercial/activaciones` (roles comerciales): productos `privados` con checklist de listo-para-activar (fotos reales ✓, contenido `listo` ✓, costo final ✓ — todo derivable de la línea de OC). El comercial **solicita activación** → crea modificación tipo nuevo `CREACION_ITEM` (`src/app/actions/modificaciones.ts`), con gate por tipo en `assertModificacionesRole`: el comercial puede crear **solo** ese tipo; el resto sigue restringido a `admin`/`plataformas`.
- `plataformas` procesa en `/modificaciones` como hoy. Al marcar `CREADO='SI'` sobre una `CREACION_ITEM`: producto → `publico`/`activo`, línea de OC → `activada`, y se dispara el webhook n8n existente (`src/app/api/webhook/route.ts` → `/webhook/ACTIVACION`) para refrescar el catálogo externo.

### Fase 5 — Difusión comercial y remarketing (solo registro)

**Colección nueva** `productPromotions`: `productId/productName/productSku/categoryId` (denormalizados para reportes), `clientId/clientName`, `channel: whatsapp | estado_instagram | directo | grupo | otro`, `promotionType: nuevo_producto | reabastecimiento | remarketing | cambio_precio`, `outcome?: sin_respuesta | interesado | pedido | rechazado`, `date` (default hoy), `commercialId/commercialName` (default sesión), `notes?`.

- Registro multi-cliente: producto → selección de clientes (reusa `getAllClients`/`getClientsByCommercial`) → canal → guarda N promociones.
- Cada registro crea un `client_event` con **tipo nuevo `'promotion'`** (`addClientEvent`, `src/lib/commercial-api.ts`) → visible en la línea de tiempo del cliente.
- **Remarketing asistido:** al elegir un producto reabastecido, prelista clientes con historial de ese producto (`products_testing`/`products_selling`, eventos `order`), separando activos vs desactivados por `status`.
- Seguimiento: edición de `outcome` en la lista `/commercial/difusion`.

**UI/código nuevo:** `src/app/commercial/difusion/` + `src/app/actions/promotions.ts`.

### Fase 6 — Reportes

- **Difusión:** por producto / categoría / comercial / canal / outcome (sobre `productPromotions`; patrón de `reporte-despachos`).
- **Entradas:** unidades nuevas vs reabastecimiento vs activaciones (`inventoryMovements.entryType` + modificaciones `CREACION_ITEM`).
- **Clientes:** nuevos activados (transiciones de `status` en `client_events`), comportamiento de existentes (eventos `order`/`promotion`), productos para reactivación (rotación baja + clientes con historial sin promoción reciente).

## 4. Dependencias entre fases

```
F0 (roles + visibility + entryType + tarifa)  → habilita todo
F1 Mercancía por llegar                       → desbloquea F2 y F3
F2 Recepción                                  → desbloquea F4 y F5 (remarketing recarga)
F3 Liquidación (paralela a F2 tras F1)        → alimenta precios de F4/F5
F4 Activación (con 4a análisis ClickUp)       → desbloquea F5
F5 Difusión                                   → desbloquea la mitad de F6
F6 Reportes                                   → cierre
```

Cadena crítica: F0 → F1 → F2. F3 es la fase más corta. F5 puede adelantarse en modo "difusión del catálogo actual" si se quiere valor comercial temprano.

## 5. Riesgos y pendientes

1. **Firestore compartido staging/prod** (`studio-9748962172-82b35`): las fases son aditivas (colecciones/campos nuevos, flags retrocompatibles), pero los datos de prueba de staging son visibles en producción → usar datos de prueba identificables o acordar una base secundaria.
2. **Seguridad:** `isRole()` está deshabilitado en `firestore.rules` (la autorización real vive en cliente/actions). Los módulos nuevos heredan esa debilidad → se recomienda una fase de hardening aparte (custom claims / verificación server-side).
3. **Webhook n8n:** hoy solo envía `{message:'ACTUALIZAR'}`; si el catálogo externo necesita saber *qué* producto se activó, acordar payload con quien mantiene n8n.
4. **Token de ClickUp:** necesario antes de la fase 4a.
5. **Recepciones parciales / múltiples contenedores por OC:** el modelo las soporta (`recibida_parcial`, varias `receptions` por OC); confirmar con la operación real.
6. **Deprecación de `/alianzas/importaciones`:** confirmar que nadie lo usa antes de retirarlo.
7. **Permiso de comerciales en modificaciones:** abrir la creación de `CREACION_ITEM` a `commercial` cambia una regla vigente (hoy solo admin/plataformas crean) — ya avalado por el dueño, pero comunicarlo al equipo de plataformas.
