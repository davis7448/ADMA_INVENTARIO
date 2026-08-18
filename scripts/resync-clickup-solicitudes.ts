/**
 * Resincroniza con ClickUp las solicitudes que se quedaron sin tarea espejo.
 *
 * El puente ADMA → ClickUp falla en silencio cuando el token de API caduca: la
 * solicitud se guarda en Firestore pero la tarea nunca se crea. Este script busca
 * esas solicitudes y las reenvía.
 *
 * Criterio: solicitudes en un estado ABIERTO (pendiente / en revisión / aprobado)
 * que no tienen `clickupTaskId`. A propósito NO se filtra por `clickupSync == 'error'`
 * (que es lo que hace el cron): cuando el `updateDoc` del catch también falla, el
 * documento queda sin marca alguna y ningún reintento lo recogería.
 *
 * Uso:
 *   npx tsx scripts/resync-clickup-solicitudes.ts                 # dry-run: solo lista
 *   npx tsx scripts/resync-clickup-solicitudes.ts --apply         # crea las tareas
 *   npx tsx scripts/resync-clickup-solicitudes.ts --apply --skip=177
 *   npx tsx scripts/resync-clickup-solicitudes.ts --apply --limit=1   # probar con una
 *
 * Requiere CLICKUP_API_TOKEN en .env.local. Idempotente: createClickUpTaskForSolicitud
 * retorna sin crear nada si el documento ya tiene tarea.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from '../src/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { createClickUpTaskForSolicitud } from '../src/lib/clickup';
import type { Modificacion } from '../src/app/actions/modificaciones';

// Estados en los que la solicitud sigue viva y por tanto necesita su tarea en ClickUp.
// 'creado' y 'rechazado' ya están cerrados: crear la tarea ahora solo sería ruido.
const ESTADOS_ABIERTOS = ['pendiente', 'en_revision', 'aprobado'];

// Pausa entre tareas. El volumen real del tablero es ~84 solicitudes/semana, así que
// no hay ninguna prisa por acercarse al rate limit de ClickUp (100 req/min).
const PAUSA_MS = 400;

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const skip = new Set(
    (args.find(a => a.startsWith('--skip='))?.slice('--skip='.length) || '')
        .split(',').map(s => s.trim()).filter(Boolean)
);
// Para probar el mapeo de campos con una sola tarea antes de soltar el lote entero.
const limit = Number(args.find(a => a.startsWith('--limit='))?.slice('--limit='.length) || 0) || Infinity;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    if (!process.env.CLICKUP_API_TOKEN) throw new Error('CLICKUP_API_TOKEN no configurado en .env.local');

    const pendientes: { id: string; consecutivo: string; solicitud: Modificacion }[] = [];
    for (const estado of ESTADOS_ABIERTOS) {
        const snap = await getDocs(query(collection(db, 'modificaciones'), where('estadoSolicitud', '==', estado)));
        for (const d of snap.docs) {
            const solicitud = d.data() as Modificacion;
            if (solicitud.clickupTaskId) continue;
            pendientes.push({ id: d.id, consecutivo: String(solicitud['ID CONSECUTIVO'] ?? '—'), solicitud });
        }
    }
    pendientes.sort((a, b) => Number(a.consecutivo) - Number(b.consecutivo));

    const aProcesar = pendientes.filter(p => !skip.has(p.consecutivo)).slice(0, limit);
    const omitidas = pendientes.filter(p => skip.has(p.consecutivo));

    console.log(`Solicitudes abiertas sin tarea en ClickUp: ${pendientes.length}`);
    for (const p of aProcesar) {
        const s = p.solicitud;
        console.log(`  #${p.consecutivo} · ${s.estadoSolicitud} · ${s.PLATAFORMA}/${s.BODEGA} · ${s.PRODUCTO} · ${s.COMERCIAL}`);
    }
    for (const p of omitidas) console.log(`  #${p.consecutivo} · OMITIDA por --skip`);

    if (!apply) {
        console.log(`\nDry-run: no se creó nada. Se crearían ${aProcesar.length} tarea(s). Repite con --apply.`);
        return;
    }

    console.log(`\nCreando ${aProcesar.length} tarea(s) en ClickUp…`);
    const fallidas: string[] = [];
    let creadas = 0;
    for (const p of aProcesar) {
        const result = await createClickUpTaskForSolicitud(p.id);
        if (result.success) {
            creadas++;
            console.log(`  ✓ #${p.consecutivo} → tarea ${result.taskId}`);
        } else {
            fallidas.push(`#${p.consecutivo}: ${result.error}`);
            console.log(`  ✗ #${p.consecutivo} → ${result.error}`);
        }
        await sleep(PAUSA_MS);
    }

    console.log(`\nCreadas: ${creadas} · Fallidas: ${fallidas.length}`);
    for (const f of fallidas) console.log(`  ${f}`);
}

main()
    .then(() => process.exit(0))
    .catch(e => { console.error('FALLO:', e instanceof Error ? e.message : e); process.exit(1); });
