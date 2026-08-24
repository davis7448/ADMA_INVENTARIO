#!/bin/bash
# Recalcula el agregado diario de pedidos (colección dailyOrders) que alimenta la pestaña
# "Por país y bodega" de /movimiento-diario.
#
# Corre DESPUÉS del sync de Dropi: si corriera antes, agregaría los datos de ayer.
cd /opt/workspaces/ADMA_INVENTARIO || exit 1
mkdir -p logs
LOG=/opt/workspaces/ADMA_INVENTARIO/logs/agregar-pedidos.log

exec 9>/tmp/adma-agregar-pedidos.lock
flock -n 9 || exit 0   # ya hay una corrida activa

echo "[$(date '+%Y-%m-%d %H:%M:%S')] recalculando agregado de pedidos…" >> "$LOG"
NODE_PATH=/opt/workspaces/ADMA_INVENTARIO/node_modules \
  /opt/workspaces/ADMA_INVENTARIO/node_modules/.bin/tsx \
  /opt/workspaces/ADMA_INVENTARIO/scripts/agregar-pedidos-diarios.ts >> "$LOG" 2>&1
