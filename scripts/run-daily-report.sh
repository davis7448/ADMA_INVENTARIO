#!/bin/bash
# Cron diario: sync precios x mayor + envio de correos
# Bogotá = UTC-5 → 7am Bogotá = 12:00 UTC

LOG=/var/log/adma-wholesale.log
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Iniciando sync wholesale..." >> "$LOG"

cd /opt/workspaces/ADMA_INVENTARIO || exit 1

/usr/bin/node scripts/send-wholesale-report.js >> "$LOG" 2>&1
EXIT_CODE=$?

echo "[$DATE] Finalizado con código: $EXIT_CODE" >> "$LOG"
echo "---" >> "$LOG"
