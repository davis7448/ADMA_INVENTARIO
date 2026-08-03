#!/bin/bash
# Cron diario: sincroniza ventas de Venndelo (últimos 30 días) llamando al
# endpoint desplegado. Corre 7 AM Bogotá (CRON_TZ=America/Bogota en el crontab).
LOG=/opt/workspaces/ADMA_INVENTARIO/logs/venndelo-sync.log
mkdir -p /opt/workspaces/ADMA_INVENTARIO/logs

# URL del backend desplegado
BASE_URL="https://main--studio-9748962172-82b35.us-east4.hosted.app"

# CRON_SECRET desde el .env.local del proyecto (se quitan comillas simples y dobles)
CRON_SECRET=$(grep -oP '^CRON_SECRET=\K.*' /opt/workspaces/ADMA_INVENTARIO/.env.local | tr -d '"' | tr -d "'")

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando sync Venndelo…" >> "$LOG"
RESPONSE=$(curl -s -m 280 "${BASE_URL}/api/cron/venndelo-sync?secret=${CRON_SECRET}&days=30")
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Respuesta: ${RESPONSE}" >> "$LOG"
echo "---" >> "$LOG"
