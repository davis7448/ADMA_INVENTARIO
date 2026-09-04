# Cotizador de maquila V5

Rediseño del formulario público `/cotizador` (2026-09-04) para que coincida con el prototipo
`adma-v5-profesional-correcciones.html` que aprobó el laboratorio, más las correcciones que
envió el equipo por WhatsApp ese día.

## Qué cambió

| Paso | Cambio |
|---|---|
| Fabricación | Título "Modalidad de fabricación". Primero el rol de ADMA (maquilador, envasador, acondicionador, fabricante) y después Full Service / Mixta. |
| Formulación · Aporto fórmula | Adjuntar fórmula y estudios de estabilidad. Si no los tiene, casilla explícita con aviso de costo adicional. Texto de mejora sin "ingenieros". |
| Formulación · Desarrollamos | En cosméticos, selector de funciones CoSIng traducidas (`src/lib/cosing-funciones.ts`, 83 funciones del PDF, 42 visibles al cliente). Ingredientes en INCI (se guardan en mayúsculas). Proclamas deseadas con "Otra" + descripción y aviso de estudios. |
| Formulación | Aviso del proceso de estabilidad acelerada y natural + microbiología externa. |
| Detalles | Marca, variantes de color, envase (material y tipo), bloque NSO (número, vigencia, titularidad, adicionar a ADMA, quién tramita). Placeholder de presentación sin "cápsulas". |
| Confirmación | Ficha completa con el consecutivo real del servidor. |

Los campos anteriores no cambian de nombre: las cotizaciones guardadas antes siguen leyéndose.

## Dónde vive cada cosa

- Catálogo de opciones: `src/lib/cotizador-catalogo.ts`.
- Reglas de validación (cliente y servidor): `src/lib/cotizador-schema.ts`, con tests en
  `src/lib/__tests__/cotizador-schema.test.ts`.
- Componentes: `src/components/cotizador/` (un archivo por paso, `cotizador-ui.tsx` con las
  piezas visuales, `cotizador-shell.tsx` con cabecera y ruta lateral).
- Descripción de la tarea en ClickUp: `descripcionCotizacion` en `src/lib/clickup-cotizaciones.ts`.
  El custom field CLIENTE ahora toma la marca si la dio el cliente.
- Archivos (fórmula, estabilidad, inspiración, referencias) viajan por Storage a ClickUp con el
  prefijo del grupo en el nombre (`FORMULA__`, `ESTABILIDAD__`, `INSPIRACION__`, `REFERENCIA__`).

## Pendiente de configuración

`CONTACTO_COTIZADOR` en el catálogo está vacío a propósito: el prototipo traía un número de
WhatsApp, un correo y una dirección de ejemplo. Al rellenarlo aparecen los botones "Enviar por
WhatsApp" / "Enviar por Email" de la confirmación y la dirección para muestras.

## Fuentes

- Prototipo y capturas del smoke: `/opt/workspaces/adma-inventario/docs-cotizador/` en el VPS.
- Lista de funciones CoSIng: `COSING_Functions.pdf` (Comisión Europea), misma carpeta.
