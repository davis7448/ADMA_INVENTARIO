# Análisis de observaciones de solicitudes (ClickUp histórico) y estructuración

**Fecha:** 2026-07-18 · Muestra: **800 tareas** del tablero de solicitudes (vía API). 501 con observación real, 299 vacías o triviales ("ok").

## El problema

Las observaciones de texto libre cargaban la semántica real de la operación ("poner el stock que queda en privado para X", "privatizar 75 unds a la variante 1.5 y 75 a la 2.0", "dejar el ID en cero, no hay stock"). Texto libre = imposible de agregar en reportes con confianza.

## Taxonomía encontrada (sobre las 501 con texto)

| Comportamiento | Frecuencia | Ejemplo real |
|---|---|---|
| Menciones de privatización | 56% | "colocar 17 en privado a zentrix…, y dejar 25 en privado a…" |
| **Quitar/eliminar privatización** | **43%** | "dejar el ID en publico y eliminar privatizacion" |
| Instrucciones de cantidades | 31% | "dejar el ID con 48 und en publico" |
| Dejar público explícito | 20% | "por favor dejar el id publico con 100 unidades" |
| **Dejar ID en cero / archivar** | **19%** | "dejar en cero el id porque se agotó el inventario" |
| Precio (confirmación/justificación) | 14% | "precio aprobado", "es un fulfillment, por eso el precio" |
| Reparto a múltiples correos | 8% | dos o más correos en la misma observación |
| Distribución por variantes | 7% | "PRIVATIZAR 75 UNDS A LA VARIANTE 1.5 Y 75 A LA 2.0" |

**~90% del texto libre corresponde a 3 operaciones estructurables.**

## Solución implementada en el formulario de ADMA

1. **Tipo "Dejar ID en cero / retirar"** → `ES_RETIRO: true`, stock forzado a 0. Cubre el 19%.
2. **Acción de privatización** (para ajustes/sumas/retiros) → `ACCION_PRIVATIZACION: 'privatizar' | 'quitar_privatizacion' | 'sin_cambio'`. Cubre el 43% de "quitar privatización" + los privatizar simples.
3. **Distribución del stock** (repetible) → `DISTRIBUCION: [{cantidad, destino: publico|privado, correo?, variante?}]`. Cubre repartos a múltiples correos y por variantes.
4. **Variable/variante** ya tiene campo propio (separado de observaciones).
5. Las **observaciones quedan solo para notas humanas** residuales (~10%).

**El texto para plataformas se genera automáticamente** desde los campos estructurados (`buildObservacionesText` en `src/lib/clickup.ts`) y viaja a ClickUp en el campo de observaciones — el operador lee la misma instrucción de siempre, pero ADMA guarda el dato estructurado.

## Qué habilita para reportes (fase 6)

- Nº de retiros por producto/plataforma/periodo (señal de rotación muerta).
- Nº de privatizaciones vs liberaciones por comercial/cliente (correo) — mide el ciclo privado→público del dropshipping.
- Unidades distribuidas a privado vs público.
- Todo sin interpretar texto libre.

## Pendiente / recomendación

- El histórico de ClickUp (800 tareas) queda como texto libre; si se quiere incluir en reportes retroactivos, se puede correr una clasificación automática puntual (mismos patrones de este análisis) — no se hace por defecto.
- Si plataformas reporta que las observaciones siguen trayendo instrucciones repetidas no cubiertas, agregar la opción estructurada correspondiente en el formulario.
