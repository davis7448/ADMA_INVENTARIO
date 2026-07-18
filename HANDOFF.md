# Handoff — ADMA Inventario

**Fecha:** 2026-06-02  
**Rama activa:** `test` (staging)  
**Firestore:** `studio-9748962172-82b35` (compartido staging/prod)  
**Producción:** rama `main` — NO se ha pusheado nada a main en esta sesión.

---

## Estado del proyecto

Next.js 14 App Router + Firebase (Firestore + Admin SDK). Módulo de costos y precios completado en esta sesión. Rama `test` está adelantada de `main`.

---

## Cambios de esta sesión (todos en rama `test`)

### 1. Módulo de Costos y Precios — `CostPriceUpdateDialog`

**Archivo:** `src/components/cost-price-update-dialog.tsx`

- Auto-detección de fila de encabezados en el Excel (escanea primeras 15 filas buscando columna `sku`).
- Corrección de celdas con error Excel (`cell.t === 'e'`): antes `#N/A` se leía como costo `42`.
- **Regla de liquidación automática:** si el Excel tiene columna de año/fecha de compra y el año ≤ 2023 + costo > 0 → fija `priceDropshipping = costo` y `priceWholesale = costo` (precio al costo, margen 0%). Filas afectadas se resaltan en azul con badge `liq.` en el preview.
- Columnas de año reconocidas: `ano`, `anodecompra`, `anocompra`, `anopedido`, `year`, `purchaseyear`, etc.
- Columnas de fecha reconocidas: `fecha`, `fechacompra`, `fechadecompra`, `purchasedate`, etc.
- Reconocimiento ampliado de columnas de precio dropshipping: `preciodropshipping`, `preciomaria`, `preciodrop`, `drop`, `dropshipping`.
- Reconocimiento ampliado de columnas de precio mayorista: `preciomayor`, `preciomayorista`, `mayorista`, `mayor`, `wholesale`.
- Descarga de SKU duplicados del sistema (botón ámbar cuando hay duplicados).
- Nueva columna `X Mayor` en el preview del dialog.
- Reporte Excel descargable incluye columnas `Precio Mayor actual/nuevo` y `Liquidación`.

**Archivo:** `src/app/actions/products.ts`

- `CostPriceUpdateInput` extendido: `priceWholesale?: number | null`, `isLiquidation?: boolean`.
- `CostPriceUpdatePreviewRow` extendido: `currentPriceWholesale?: number | null`.
- `buildCostPricePreview`: indexa solo SKU de productos simples (no el SKU padre de productos variables → fix falsos duplicados).
- `applyCostPriceUpdateAction`: ahora también escribe `priceWholesale` en productos y variantes.
- `SkuConflict` type y campo `conflicts?: SkuConflict[]` para diagnóstico de duplicados.

### 2. Calculadora de Precio x Mayor — `WholesalePricingDialog`

**Archivo:** `src/components/wholesale-pricing-dialog.tsx`

- Reescritura completa: checkboxes por fila, `Set<string>` para SKUs seleccionados.
- Auto-selección al cambiar parámetros de margen (`useEffect`).
- Filas con cambio seleccionadas en ámbar; botón "Aplicar X seleccionados".

### 3. Formularios de Alta/Edición de Variantes

**Archivos:** `src/components/add-product-form.tsx`, `src/components/edit-product-form.tsx`

- Layout de tarjeta de variante en 2 líneas: Línea 1 (SKU/Nombre/Stock/eliminar), Línea 2 (5 campos de precio).
- Nuevos inputs `priceMinSale` y `priceOptimalSale` por variante (con masking igual que `cost`).
- Import por texto: 8 columnas (`SKU, Nombre, PrecioDropshipping, PrecioMayor, Costo, PrecioMin, PrecioOpt, Stock`).

### 4. Reportes de Productos Sin Datos

**Archivo:** `src/components/products-content.tsx`

- "Productos sin costo" → Excel `productos-sin-costo-YYYY-MM-DD.xlsx`.
- "Productos sin precio dropshipping" → Excel `productos-sin-precio-drop-YYYY-MM-DD.xlsx`.
- Roles: visible solo para `admin` y `plataformas` (`canCostPriceUpdate`).

### 5. Migración de Costo 42 → 0

**Archivo:** `scripts/reset-cost-42.js`

- **YA EJECUTADO** en producción (mismo Firestore): 83 productos + 58 variantes reseteados.
- El costo 42 era el código interno de Excel para `#N/A`, cargado por error como costo real.

### 6. Índices Firestore

**Archivos:** `firebase.json`, `firestore.indexes.json`

- `firebase.json` no tenía `"indexes": "firestore.indexes.json"` → los 97 índices compuestos nunca se habían desplegado.
- Corregido y desplegado con `firebase deploy --only firestore:indexes`.
- **Pendiente:** el usuario reporta que aún siguen errores de índices — los índices se construyen en background y pueden tardar varios minutos. Si persiste después de 10 min, necesita investigarse qué query específica falla (ver URL del error en consola del navegador).

---

## Pendiente / Issues abiertos

| # | Descripción | Estado |
|---|---|---|
| 1 | Errores de índices Firestore en página de historial | Desplegados pero construyéndose. Verificar en ~10 min. Si persiste, obtener URL del error de Firestore en consola del browser. |
| 2 | Push a `main` (producción) | Pendiente confirmación explícita del usuario. |

---

## Arquitectura relevante

```
src/
├── app/
│   ├── actions/products.ts         ← server actions: costos, precios, wholesale
│   ├── api/history/
│   │   ├── movements/route.ts      ← GET inventoryMovements con filtros
│   │   └── orders/route.ts         ← GET dispatchOrders con filtros
│   └── products/page.tsx           ← gating por rol
├── components/
│   ├── cost-price-update-dialog.tsx  ← carga masiva Excel + regla liquidación
│   ├── wholesale-pricing-dialog.tsx  ← calculadora precio x mayor
│   ├── products-content.tsx          ← dropdown acciones + reportes
│   ├── add-product-form.tsx          ← alta producto (variantes con priceMin/Opt)
│   └── edit-product-form.tsx         ← edición producto
├── lib/
│   ├── types.ts                    ← Product, ProductVariant (cost/priceMinSale/priceOptimalSale)
│   └── definitions.ts              ← schemas Zod
scripts/
└── reset-cost-42.js                ← migración one-time (ya ejecutada)
firestore.indexes.json              ← ~97 índices compuestos
firebase.json                       ← ahora incluye "indexes" key
```

## Roles del sistema

| Rol | Puede ver costos | Puede actualizar costos/precios |
|---|---|---|
| `admin` | ✓ | ✓ |
| `plataformas` | ✓ | ✓ |
| `commercial_director` | ✓ | ✗ |
| `commercial`, `logistics`, `consulta`, `mercado_libre` | ✗ | ✗ |

## Comandos útiles

```bash
# Correr en local
cd /opt/workspaces/ADMA_INVENTARIO
npm run dev

# Build
npm run build

# Desplegar índices Firestore
firebase deploy --only firestore:indexes

# Push a producción (solo con confirmación del usuario)
git checkout main && git merge test && git push origin main
```

---

## Para investigar errores de índices persistentes

Si después de 10 minutos siguen los errores de índices en el historial:

1. Abrir DevTools en el browser → pestaña Console o Network.
2. El error de Firestore incluye una URL del tipo:
   `https://console.firebase.google.com/project/studio-9748962172-82b35/firestore/indexes?create_composite=...`
3. Copiar esa URL y abrirla → crea el índice faltante directamente.
4. O compartir el mensaje de error completo para agregar el índice al JSON y redeploy.
