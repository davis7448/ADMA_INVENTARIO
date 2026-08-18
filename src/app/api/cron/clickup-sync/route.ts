import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { applyClickUpStatusToSolicitud, createClickUpTaskForSolicitud, getClickUpTaskStatus } from '@/lib/clickup';
import type { Modificacion } from '@/app/actions/modificaciones';

export const dynamic = 'force-dynamic';

// Estados en los que la solicitud sigue viva: son las únicas que vale la pena
// reintentar o consultar. 'creado' y 'rechazado' ya están cerradas.
const ESTADOS_ABIERTOS = ['pendiente', 'en_revision', 'aprobado'];

// Tope de creaciones por corrida, para no agotar el rate limit de ClickUp si se
// acumula un atasco grande (el volumen normal es ~84 solicitudes/semana).
const MAX_REINTENTOS = 20;

// Cron de respaldo del puente ClickUp:
// 1. Reintenta crear tareas de solicitudes que fallaron al sincronizar.
// 2. Consulta el estado en ClickUp de solicitudes abiertas (por si el webhook se perdió).
export async function GET(request: NextRequest) {
    const secret = request.nextUrl.searchParams.get('secret') || request.headers.get('authorization')?.replace('Bearer ', '');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 });
    }

    const summary = { retried: 0, polled: 0, updated: 0, errors: [] as string[] };

    try {
        // Una sola pasada por las solicitudes abiertas: las que no tienen tarea se
        // reintentan, las que sí la tienen se comparan contra el estado de ClickUp.
        for (const estado of ESTADOS_ABIERTOS) {
            const openSnap = await getDocs(query(
                collection(db, 'modificaciones'),
                where('estadoSolicitud', '==', estado),
                limit(50)
            ));
            for (const d of openSnap.docs) {
                const solicitud = d.data() as Modificacion;

                // Sin tarea espejo: el sync falló al crear la solicitud (token caído, red…).
                // El criterio es la AUSENCIA de clickupTaskId, no `clickupSync == 'error'`:
                // cuando el updateDoc del catch también falla, el documento queda sin marca
                // alguna y con el filtro anterior no se reintentaba nunca.
                if (!solicitud.clickupTaskId) {
                    if (summary.retried >= MAX_REINTENTOS) continue;
                    summary.retried++;
                    const result = await createClickUpTaskForSolicitud(d.id);
                    if (!result.success) summary.errors.push(`retry ${d.id}: ${result.error}`);
                    continue;
                }

                summary.polled++;
                const clickupStatus = await getClickUpTaskStatus(solicitud.clickupTaskId);
                if (!clickupStatus) continue;
                const result = await applyClickUpStatusToSolicitud(solicitud.clickupTaskId, clickupStatus);
                if (result.success && result.estado && result.estado !== estado) summary.updated++;
            }
        }

        return NextResponse.json({ success: true, ...summary });
    } catch (error) {
        console.error('Error en cron clickup-sync:', error);
        return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Error', ...summary }, { status: 500 });
    }
}
