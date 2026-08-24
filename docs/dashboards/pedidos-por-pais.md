# Tablero de pedidos por país y bodega

Pestaña **«Por país y bodega»** en `/movimiento-diario`. Responde cuántos pedidos salen por
día, semana y mes de cada país, desglosado por bodega.

---

## 1. Lo que hay que saber antes de leer una cifra

### 1.1 No es la fecha de despacho

**Dropi no entrega fecha de despacho.** Su `list_orders` devuelve `created_at` y el estado
*actual* de la orden; `platformSales` guarda `orderDate` (creación) y `estado`.

Por eso «despachados» significa: **pedidos creados el día X que a día de hoy ya salieron de
bodega**. No son los que salieron el día X.

Consecuencia práctica: **los últimos días siempre se ven bajos**, porque una parte de esos
pedidos todavía está en bodega. No es un fallo del tablero. La pantalla lo advierte.

Si algún día hace falta la fecha real de salida, la única fuente sería la interna de ADMA
(`dispatchOrders` / `inventoryMovements`, que sí tienen fecha y bodega), pero se descartó a
propósito: cubre solo las bodegas propias de Colombia y no tiene dimensión de país.

### 1.2 Las unidades no se muestran

Solo el **30%** de los pedidos de Dropi trae `quantity` (1.765 de 5.804 en 30 días): el CSV
de `list_orders` no incluye cantidad, solo la traen los pedidos enriquecidos con
`get_order`. Una métrica de unidades mostraría un número con pinta de total midiendo un
tercio de los datos, así que no se ofrece en la interfaz. El agregado sí la guarda, y en el
Excel aparece marcada como «dato parcial».

### 1.3 Solo Dropi

El tablero cuenta únicamente `platform == 'DROPI'`. Quedan fuera HOKO (las tres bodegas
FULFILLMENT de Medellín, Bogotá y Cali), EFFI y Venndelo. La pantalla lo dice.

### 1.4 Los estados cambian, y eso obliga a recalcular

Un pedido creado ayer aparece hoy como DESPACHADA. Si el agregado solo sumara lo nuevo,
quedaría congelado con el estado que tenía el día que se calculó. Por eso el cron
**rehace los últimos 30 días completos** en cada corrida, en vez de acumular.

---

## 2. Cómo diagnosticar cuando algo no cuadra

En este orden:

1. **¿Corrió el cron?** → `tail -20 logs/agregar-pedidos.log`
2. **¿Hay estados nuevos sin clasificar?** El log lo avisa, y se puede revisar a fondo con:
   ```bash
   npx tsx scripts/agregar-pedidos-diarios.ts --estados --dias 400
   ```
   Un estado desconocido se cuenta como NO despachado: el error siempre es por defecto,
   nunca infla las cifras. Al aparecer uno, hay que decidir si salió de bodega y añadirlo a
   `src/lib/estados-dropi.ts`. **Esta fue la causa real de la primera discrepancia**: 27
   estados sin clasificar, entre ellos `RECHAZADO` con 2.393 pedidos.
3. **¿Cuadra el agregado con el crudo?** Contar un día a mano en `platformSales` filtrando
   por `platform == 'DROPI'` y comparar con el documento `dailyOrders/{YYYY-MM-DD}`.
4. **¿Un país sale vacío?** Comprobar antes que su cuenta de Dropi haya importado algo.
   Panamá, Ecuador y Guatemala están conectadas pero pueden no haber sincronizado aún.

---

## 3. Estados: qué cuenta como «salió de bodega»

La lista vive en `src/lib/estados-dropi.ts`, en dos conjuntos explícitos
(`ESTADOS_DESPACHADOS` y `ESTADOS_NO_DESPACHADOS`). Se listan los dos a propósito: así queda
escrito que `CANCELADO` se excluye por decisión y no por olvido, y cualquier estado que no
esté en ninguno de los dos se detecta como nuevo.

Criterio: cuenta como salido todo lo que ya estaba en manos del transportador, **incluidas
las devoluciones, los siniestros y las indemnizaciones** — para volver o perderse, el pedido
tuvo que salir primero.

Casos que se decidieron a mano al clasificarlos, por si hay que revisarlos:

| Estado | Decisión | Razón |
|---|---|---|
| `RECHAZADO` | Salió | El cliente lo rechazó al recibirlo |
| `EN DESPACHO` | No salió | Alistamiento, aún en bodega |
| `GUIA_ANULADA` | No salió | La guía se anuló antes de despachar |
| `RECOGIDA FALLIDA` | No salió | La transportadora no logró recogerlo |
| `TELEMERCADEO` | No salió | Gestión comercial previa |
| `FACTURADO` | Salió | Estado de facturación posterior a la entrega |

---

## 4. Piezas

| Archivo | Qué hace |
|---|---|
| `src/lib/estados-dropi.ts` | Qué estados significan «salió». Compartido por script y lectura. |
| `src/lib/periodos.ts` | Agrupación por día/semana/mes. Puro, sin Firebase. |
| `scripts/agregar-pedidos-diarios.ts` | Construye `dailyOrders`. |
| `scripts/agregar-pedidos-cron.sh` | Envoltorio del cron, con `flock`. |
| `src/app/actions/pedidos-por-pais.ts` | Lee el agregado y agrupa por periodo. |
| `src/components/movimiento/pedidos-content.tsx` | La pestaña. |

### Colección `dailyOrders`

Un documento por día, id = `YYYY-MM-DD`:

```
{ fecha: "2026-08-20",
  plataforma: "DROPI",
  porPaisBodega: { "COLOMBIA|LABORATORIO": { creados, salidos, entregados, unidades, ingreso } },
  actualizadoAt }
```

Solo lo escribe el cron, con el admin SDK. Las reglas lo dejan de **solo lectura** desde la
aplicación para que nadie lo desincronice.

**Por qué agregar en vez de consultar al vuelo**: un año de `platformSales` son 270.000
documentos y más de 20 segundos. Agregado son ~230 documentos diminutos, y día, semana y
mes salen de agrupar los mismos cubos, así que las tres vistas leen exactamente lo mismo y
no pueden contradecirse.

---

## 5. Operación

```bash
# Recalcular los últimos 30 días (lo que hace el cron, 7:45 hora Bogotá)
npx tsx scripts/agregar-pedidos-diarios.ts

# Reconstruir todo el histórico (tras un backfill de ventas o un cambio de estados)
npx tsx scripts/agregar-pedidos-diarios.ts --backfill

# Ver qué haría, sin escribir
npx tsx scripts/agregar-pedidos-diarios.ts --dry-run
```

**Después de tocar `src/lib/estados-dropi.ts` hay que correr `--backfill`**, o el histórico
seguirá con la clasificación vieja y no cuadrará con los días recientes.
