import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { applyClickUpStatusToSolicitud, createClickUpTaskForSolicitud, getClickUpTaskStatus } from '@/lib/clickup';
import type { Modificacion } from '@/app/actions/modificaciones';

export const dynamic = 'force-dynamic';

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
        // 1. Solicitudes sin tarea en ClickUp (sync fallido)
        const failedSnap = await getDocs(query(
            collection(db, 'modificaciones'),
            where('clickupSync', '==', 'error'),
            limit(20)
        ));
        for (const d of failedSnap.docs) {
            const result = await createClickUpTaskForSolicitud(d.id);
            summary.retried++;
            if (!result.success) summary.errors.push(`retry ${d.id}: ${result.error}`);
        }

        // 2. Solicitudes abiertas con tarea vinculada: comparar estado
        for (const estado of ['pendiente', 'en_revision', 'aprobado']) {
            const openSnap = await getDocs(query(
                collection(db, 'modificaciones'),
                where('estadoSolicitud', '==', estado),
                limit(50)
            ));
            for (const d of openSnap.docs) {
                const solicitud = d.data() as Modificacion;
                if (!solicitud.clickupTaskId) continue;
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
