#!/bin/bash
# Procesa importaciones grandes encoladas (pendingImports). Cron cada 5 min.
# flock evita solapamiento (una importación de 160k tarda varios minutos).
cd /opt/workspaces/ADMA_INVENTARIO || exit 1
mkdir -p logs
LOG=/opt/workspaces/ADMA_INVENTARIO/logs/process-imports.log

exec 9>/tmp/adma-process-imports.lock
flock -n 9 || exit 0   # ya hay una corrida activa

echo "[$(date '+%Y-%m-%d %H:%M:%S')] revisando cola…" >> "$LOG"
NODE_OPTIONS="--max-old-space-size=4096" NODE_PATH=/opt/workspaces/ADMA_INVENTARIO/node_modules \
  /opt/workspaces/ADMA_INVENTARIO/node_modules/.bin/tsx \
  /opt/workspaces/ADMA_INVENTARIO/scripts/process-imports.ts >> "$LOG" 2>&1
