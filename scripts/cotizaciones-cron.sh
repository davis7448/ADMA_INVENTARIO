#!/bin/bash
# Envía los avisos de cotizaciones nuevas encoladas en quoteOutbox.
cd /opt/workspaces/ADMA_INVENTARIO || exit 1
mkdir -p logs
LOG=/opt/workspaces/ADMA_INVENTARIO/logs/cotizaciones.log

exec 9>/tmp/adma-cotizaciones.lock
flock -n 9 || exit 0   # ya hay una corrida activa

echo "[$(date '+%Y-%m-%d %H:%M:%S')] revisando avisos…" >> "$LOG"
NODE_PATH=/opt/workspaces/ADMA_INVENTARIO/node_modules \
  /opt/workspaces/ADMA_INVENTARIO/node_modules/.bin/tsx \
  /opt/workspaces/ADMA_INVENTARIO/scripts/procesar-cotizaciones.ts >> "$LOG" 2>&1
