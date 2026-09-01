import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { applyClickUpStatusToSolicitud } from '@/lib/clickup';
import { aplicarEstadoClickUp } from '@/lib/clickup-cotizaciones';

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

        // La misma ruta atiende dos listas: solicitudes y cotizaciones de maquila. Se
        // prueba primero la solicitud y, si la tarea no está vinculada a ninguna, se
        // intenta como cotización. No se puede decidir por el list_id porque el payload
        // de ClickUp no siempre lo trae.
        const taskId = String(payload.task_id);
        const enSolicitudes = await applyClickUpStatusToSolicitud(taskId, String(newStatus));
        if (enSolicitudes.success) return NextResponse.json(enSolicitudes);

        const enCotizaciones = await aplicarEstadoClickUp(taskId, String(newStatus));
        if (enCotizaciones.success) return NextResponse.json(enCotizaciones);

        // Ninguna de las dos la reconoce: no es un error del webhook, la tarea
        // simplemente no tiene espejo en ADMA.
        return NextResponse.json({
            success: true,
            message: `Tarea ${taskId} sin vínculo en ADMA (${enSolicitudes.error}; ${enCotizaciones.error})`,
        });
    } catch (error) {
        console.error('Error procesando webhook de ClickUp:', error);
        return NextResponse.json({ success: false, message: 'Error interno' }, { status: 500 });
    }
}
