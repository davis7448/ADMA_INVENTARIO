#!/bin/bash
# Cron nocturno (2:30 AM Bogotá): actualiza SOLO el estado de las guías de la cuenta
# de alto volumen (LABORATORIO) usando list_orders, sin pedir productos por orden.
# Sirve para que los meses se vayan cerrando entre carga y carga del Excel.
# Los productos y costos siguen llegando por el Excel.
cd /opt/workspaces/ADMA_INVENTARIO || exit 1
mkdir -p logs
LOG=/opt/workspaces/ADMA_INVENTARIO/logs/dropi-estados.log
DIAS="${1:-50}"
CUENTA="${2:-LABORATORIO}"

# flock: evita que dos corridas se solapen si una se alarga
exec 9>/tmp/adma-dropi-estados.lock
flock -n 9 || exit 0

echo "[$(date '+%Y-%m-%d %H:%M:%S')] estados ${CUENTA} (ventana ${DIAS}d)…" >> "$LOG"
NODE_OPTIONS="--max-old-space-size=5120" NODE_PATH=/opt/workspaces/ADMA_INVENTARIO/node_modules \
  /opt/workspaces/ADMA_INVENTARIO/node_modules/.bin/tsx \
  /opt/workspaces/ADMA_INVENTARIO/scripts/dropi-estados.ts "$DIAS" "$CUENTA" >> "$LOG" 2>&1
echo "[$(date '+%Y-%m-%d %H:%M:%S')] fin estados ${CUENTA}" >> "$LOG"
echo "---" >> "$LOG"
