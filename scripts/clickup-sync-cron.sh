#!/bin/bash
# Cron de respaldo del puente ClickUp: reintenta las solicitudes que se quedaron sin
# tarea espejo y arrastra los cambios de estado que el webhook se haya perdido.
#
# Existía el endpoint pero no había nada que lo llamara: por eso las solicitudes del
# 2026-08-18 se quedaron un día entero atascadas cuando caducó el token de ClickUp.
LOG=/opt/workspaces/ADMA_INVENTARIO/logs/clickup-sync.log
mkdir -p /opt/workspaces/ADMA_INVENTARIO/logs

# URL del backend desplegado
BASE_URL="https://main--studio-9748962172-82b35.us-east4.hosted.app"

# CRON_SECRET desde el .env.local del proyecto (se quitan comillas simples y dobles)
CRON_SECRET=$(grep -oP '^CRON_SECRET=\K.*' /opt/workspaces/ADMA_INVENTARIO/.env.local | tr -d '"' | tr -d "'")

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando sync ClickUp…" >> "$LOG"
RESPONSE=$(curl -s -m 280 "${BASE_URL}/api/cron/clickup-sync?secret=${CRON_SECRET}")
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Respuesta: ${RESPONSE}" >> "$LOG"
echo "---" >> "$LOG"
