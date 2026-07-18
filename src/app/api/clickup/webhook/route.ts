import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { applyClickUpStatusToSolicitud } from '@/lib/clickup';

export const dynamic = 'force-dynamic';

// Webhook de ClickUp (taskStatusUpdated): sincroniza el estado de la tarea
// con la solicitud (modificación) vinculada en ADMA.
// Firma: header X-Signature = HMAC-SHA256(body) con el secret del webhook.
// CLICKUP_WEBHOOK_SECRETS admite varios secrets separados por coma
// (uno por webhook registrado: staging y producción).
export async function POST(request: NextRequest) {
    const rawBody = await request.text();

    const secrets = (process.env.CLICKUP_WEBHOOK_SECRETS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    if (secrets.length > 0) {
        const signature = request.headers.get('x-signature') || '';
        const valid = secrets.some(secret =>
            crypto.createHmac('sha256', secret).update(rawBody).digest('hex') === signature
        );
        if (!valid) {
            return NextResponse.json({ success: false, message: 'Firma inválida' }, { status: 401 });
        }
    } else {
        console.warn('CLICKUP_WEBHOOK_SECRETS no configurado: webhook sin verificación de firma.');
    }

    try {
        const payload = JSON.parse(rawBody);
        if (payload.event !== 'taskStatusUpdated' || !payload.task_id) {
            return NextResponse.json({ success: true, message: 'Evento ignorado' });
        }

        const statusChange = (payload.history_items || []).find((h: any) => h.field === 'status');
        const newStatus = statusChange?.after?.status;
        if (!newStatus) {
            return NextResponse.json({ success: true, message: 'Sin cambio de estado en el payload' });
        }

        const result = await applyClickUpStatusToSolicitud(String(payload.task_id), String(newStatus));
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error procesando webhook de ClickUp:', error);
        return NextResponse.json({ success: false, message: 'Error interno' }, { status: 500 });
    }
}
