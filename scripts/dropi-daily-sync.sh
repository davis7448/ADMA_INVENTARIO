#!/bin/bash
# Cron diario: sincroniza las cuentas Dropi vía MCP (últimos N días) e importa al
# motor. Corre LOCAL (sin el límite de 5 min de la request) por el rate limit del MCP.
# La ventana (días) se puede ajustar; más días = captura cambios de estado (entregas)
# de órdenes más viejas, pero más lento por el rate limit.
cd /opt/workspaces/ADMA_INVENTARIO || exit 1
mkdir -p logs
LOG=/opt/workspaces/ADMA_INVENTARIO/logs/dropi-sync.log
DAYS="${1:-10}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dropi MCP sync (ventana ${DAYS}d)…" >> "$LOG"
NODE_PATH=/opt/workspaces/ADMA_INVENTARIO/node_modules /opt/workspaces/ADMA_INVENTARIO/node_modules/.bin/tsx \
  /opt/workspaces/ADMA_INVENTARIO/scripts/dropi-sync.ts "$DAYS" >> "$LOG" 2>&1
echo "[$(date '+%Y-%m-%d %H:%M:%S')] fin Dropi MCP sync" >> "$LOG"
echo "---" >> "$LOG"
