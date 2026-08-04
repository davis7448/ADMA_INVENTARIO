#!/bin/bash
# Cron diario (7:30 AM Bogotá): trae las ventas de HOKO de ambas cuentas
# (IMPORTACIONES y LABORATORIO) y las importa como plataforma HOKO.
# Nota: HOKO no expone el valor de la venta al proveedor; el ingreso llega por Excel.
cd /opt/workspaces/ADMA_INVENTARIO || exit 1
mkdir -p logs
LOG=/opt/workspaces/ADMA_INVENTARIO/logs/hoko-sync.log
DIAS="${1:-30}"

exec 9>/tmp/adma-hoko.lock
flock -n 9 || exit 0

echo "[$(date '+%Y-%m-%d %H:%M:%S')] HOKO sync (ventana ${DIAS}d)…" >> "$LOG"
set -a; . /opt/workspaces/ADMA_INVENTARIO/.env.local; set +a
NODE_OPTIONS="--max-old-space-size=4096" NODE_PATH=/opt/workspaces/ADMA_INVENTARIO/node_modules \
  /opt/workspaces/ADMA_INVENTARIO/node_modules/.bin/tsx \
  /opt/workspaces/ADMA_INVENTARIO/scripts/hoko-sync.ts "$DIAS" >> "$LOG" 2>&1
echo "[$(date '+%Y-%m-%d %H:%M:%S')] fin HOKO sync" >> "$LOG"
echo "---" >> "$LOG"
