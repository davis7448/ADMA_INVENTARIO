#!/bin/bash
# Cron diario: sincroniza ventas de Venndelo (últimos 30 días) llamando al
# endpoint desplegado. Corre 7 AM Bogotá (CRON_TZ=America/Bogota en el crontab).

LOG=/opt/workspaces/ADMA_INVENTARIO/logs/venndelo-sync.log
DATE=$(date '+%Y-%m-%d %H:%M:%S')
mkdir -p /opt/workspaces/ADMA_INVENTARIO/logs

# URL del backend desplegado (staging por ahora; cambiar a main--… en producción)
BASE_URL="https://test--studio-9748962172-82b35.us-east4.hosted.app"

# CRON_SECRET desde el .env.local del proyecto
CRON_SECRET=$(grep -oP '^CRON_SECRET=\K.*' /opt/workspaces/ADMA_INVENTARIO/.env.local | tr -d '"'"'"' | tr -d '"')

echo "[$DATE] Iniciando sync Venndelo…" >> "$LOG"
RESPONSE=$(curl -s -m 280 "$BASE_URL/api/cron/venndelo-sync?secret=$CRON_SECRET&days=30")
echo "[$DATE] Respuesta: $RESPONSE" >> "$LOG"
echo "---" >> "$LOG"
