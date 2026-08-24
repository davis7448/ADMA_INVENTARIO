#!/bin/bash
# Vigila que todas las cuentas Dropi sigan importando. No toca tokens (ver
# docs/integraciones/dropi-mcp.md §2). Sale con código 1 si alguna lleva >48 h parada.
cd /opt/workspaces/ADMA_INVENTARIO || exit 1
mkdir -p logs
LOG=/opt/workspaces/ADMA_INVENTARIO/logs/salud-dropi.log

exec 9>/tmp/adma-salud-dropi.lock
flock -n 9 || exit 0

echo "[$(date '+%Y-%m-%d %H:%M:%S')] revisando cuentas…" >> "$LOG"
NODE_PATH=/opt/workspaces/ADMA_INVENTARIO/node_modules \
  /opt/workspaces/ADMA_INVENTARIO/node_modules/.bin/tsx \
  /opt/workspaces/ADMA_INVENTARIO/scripts/salud-dropi.ts >> "$LOG" 2>&1
echo "---" >> "$LOG"
