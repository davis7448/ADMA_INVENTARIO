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

## WhatsApp del laboratorio (Chatwoot)

Además de ClickUp, cada cotización llega al WhatsApp de Lab a través de Chatwoot
(`src/lib/chatwoot-cotizaciones.ts`), sin gastar plantillas de Meta:

1. Al guardarse, el servidor busca o crea el contacto del cliente (por teléfono, luego por
   correo) en el buzón 5 **WhatsApp Adma Company Lab Proyectos** (+57 312 8736234), abre o
   reutiliza su conversación y deja una **nota privada** con el resumen y el enlace a la
   bandeja. Los agentes del buzón (Juliana, Isabella) la ven como una conversación más; al
   cliente no le llega nada todavía.
2. La confirmación del formulario muestra el botón **"Escribir por WhatsApp con mi
   referencia"**: un enlace `wa.me` al mismo número con la referencia en el texto. Cuando el
   cliente escribe, su mensaje cae en esa misma conversación y abre la ventana de 24 h.
3. Al sincronizar con ClickUp se añade otra nota con la URL de la tarea.
4. La bandeja interna muestra el enlace a la conversación de Chatwoot.

Sin teléfono del cliente no hay conversación (WhatsApp lo exige); queda el aviso por correo.
Token: secreto `CHATWOOT_API_TOKEN` en Secret Manager (App Hosting lo pinnea por revisión:
un token nuevo exige redesplegar). Flujo esperado: comercial revisa → aprueba si pasa a
pruebas o a cotización real → responde al cliente por la conversación.

## Pendiente de configuración

En `CONTACTO_COTIZADOR` siguen vacíos el correo comercial y la dirección para muestras: el
prototipo traía valores de ejemplo y no se copiaron. Al rellenarlos aparecen el botón "Enviar
por Email" y la dirección en el paso de muestra.

## Fuentes

- Prototipo y capturas del smoke: `/opt/workspaces/adma-inventario/docs-cotizador/` en el VPS.
- Lista de funciones CoSIng: `COSING_Functions.pdf` (Comisión Europea), misma carpeta.
