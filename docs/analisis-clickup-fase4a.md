# Fase 4a — Análisis del tablero de solicitudes en ClickUp

**Fecha:** 2026-07-18 · Análisis vía API de ClickUp (workspace ADMALAB SAS, lista de solicitudes del espacio GESTION, id `901319185035`).

## Qué es el tablero hoy

- Las solicitudes se crean por **formulario de ClickUp** (todas las tareas las crea "ClickBot" — automatización del form).
- Muestra analizada: **600 tareas** entre 2026-05-28 y 2026-07-18 → **~84 solicitudes/semana**.
- Flujo de estados: `pendientes → en revision → aprobados → creados` (+ `rechazado`). En la muestra: 573 creados, 27 rechazados (los estados intermedios se procesan rápido y quedan vacíos).

## Campos del formulario y su mapeo al módulo de modificaciones de ADMA

| Campo ClickUp | Valores reales | Campo en `modificaciones` (ADMA) | Estado |
|---|---|---|---|
| Nombre de la tarea | nombre del producto | `PRODUCTO` | ✅ ya existe |
| TIPO DE STOCK | AJUSTE 91% · SUMA 9% | `SOLICITUD` (SUMA/AJUSTE) | ✅ ya existe |
| PLATAFORMA | 22 opciones (DROPI LABORATORIO 56%, DROPI INGENIO 42%, ADMA, VENNDELO, EFFI, DROPLATAM, ELITE, WIMPY, HOKO, SEVENTY, ACADROP, FOGOSHIPY…) | `PLATAFORMA` | ✅ ya existe (validar catálogo `platforms`) |
| BODEGA | LABORATORIO / INGENIO | `BODEGA` | ✅ ya existe |
| PAIS | COLOMBIA 91%, GUATEMALA 6%, ECUADOR 3% (+MEXICO, PARAGUAY, ARGENTINA) | `PAIS` | ✅ ya existe |
| STOCK | número | `CANTIDAD SOLICITADA` | ✅ ya existe |
| PRECIO | moneda | `PRECIO` | ✅ ya existe |
| CORREO PRIVATIZACION | 100% de las tareas lo llevan | `CORREO_CODIGO` + `PRIVADO_PUBLICO` | ✅ ya existe |
| ID PLATAFORMA | 100% de las tareas lo llevan | `ID` | ✅ ya existe |
| COMERCIAL | 15 opciones (J.D. Aguirre 57%, Marcela 32%, Maryori 6%…) | `COMERCIAL` / `CODIGO COMERCIAL` | ✅ ya existe |
| **ENLACE DRIVE** | url (o "notiene.com") | — | ❌ **falta** |
| **TIPO DE PRECIO** | DROPSHIPPING 99.7% / ESPECIAL | — | ❌ **falta** |
| **OBSERVACIONES O VARIANTES** | texto libre | — | ❌ **falta** (hoy va implícito) |
| Estado de la tarea | pendientes/en revision/aprobados/creados/rechazado | `CREADO` (SI/NO) + `estadoSolicitud` (pendiente/completado) | ⚠️ **más pobre en ADMA** |

## Conclusiones para la Fase 4

1. **El módulo `modificaciones` de ADMA ya cubre ~80% del formulario de ClickUp.** La migración es viable y de bajo riesgo estructural.
2. **Faltan 3 campos**: `ENLACE_DRIVE` (url), `TIPO_PRECIO` (dropshipping|especial), `OBSERVACIONES` (texto). Se agregan al tipo `Modificacion`.
3. **El flujo de estados debe enriquecerse**: pasar de `pendiente|completado` a `pendiente → en_revision → aprobado → creado` + `rechazado` (con motivo). `CREADO: SI` equivale al estado `creado`.
4. **Quién crea las solicitudes**: hoy los comerciales usan el formulario ClickUp; en ADMA necesitan una pantalla de solicitud (el módulo actual solo deja crear a admin/plataformas). → Gate por tipo: `commercial` puede crear solicitudes, `plataformas` las procesa.
5. **Tipos de solicitud detectados** (todo por el mismo formulario, distinguidos por campos):
   - **Ajuste de stock** (91%): item existente (`ID PLATAFORMA`), TIPO=AJUSTE.
   - **Suma de stock / recarga** (9%): item existente, TIPO=SUMA.
   - **Creación de item nuevo**: mismo form; el `ID PLATAFORMA` lo asigna plataformas al crear (estado `creados`).
   - **Privatización**: el 100% lleva correo de privatización → items privados por cliente es la norma operativa del dropshipping actual; la creación "pública" aplica al alta de catálogo general.
6. **Volumen** (~84/semana, 2 plataformas concentran 98%) confirma que el módulo debe ser ágil: formulario corto, valores por defecto (comercial = usuario logueado, fecha auto).
7. La lista "Cotizaciones" (espacio ADMA LAB) es **otro proceso** (sourcing de productos por cotizar) — se relaciona con `importRequests`/Groupack, NO con la migración de la fase 4.

## Alcance propuesto de la implementación (Fase 4)

1. `Modificacion` += `ENLACE_DRIVE?`, `TIPO_PRECIO?`, `OBSERVACIONES?`, `estadoSolicitud: 'pendiente'|'en_revision'|'aprobado'|'rechazado'|'creado'`, `motivoRechazo?`, `tipoModificacion: 'CREACION_ITEM'` nuevo.
2. Pantalla `/commercial/solicitudes`: formulario equivalente al de ClickUp (producto desde inventario → SKU/nombre/drive auto; plataforma, bodega, país, tipo stock, stock, precio, tipo precio, correo privatización, observaciones) + lista "mis solicitudes" con estado.
3. `/modificaciones` (plataformas): procesar con los estados nuevos; al marcar `creado` en una `CREACION_ITEM` → producto `activationStatus: 'activo'` + línea de OC → `activada` + webhook n8n `ACTIVACION`.
4. Transición: se deja de usar el formulario ClickUp cuando el equipo valide el flujo en staging.

**Nota de seguridad:** el token de API usado para este análisis no queda guardado en el repositorio; se recomienda rotarlo en ClickUp cuando termine la migración.
