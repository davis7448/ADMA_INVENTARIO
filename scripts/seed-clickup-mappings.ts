/**
 * Seed de mapeos item de plataforma → cliente/producto desde el histórico de
 * tareas de ClickUp (ID PLATAFORMA + CORREO PRIVATIZACION + PRODUCTO).
 *
 * Uso: npx tsx scripts/seed-clickup-mappings.ts
 * Requiere CLICKUP_API_TOKEN en .env.local. Idempotente (merge por id).
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from '../src/lib/firebase';
import { doc, writeBatch } from 'firebase/firestore';

const LIST_ID = '901319185035';

async function main() {
    const token = process.env.CLICKUP_API_TOKEN;
    if (!token) throw new Error('CLICKUP_API_TOKEN no configurado');

    const tasks: any[] = [];
    for (let page = 0; page < 20; page++) {
        const res = await fetch(`https://api.clickup.com/api/v2/list/${LIST_ID}/task?include_closed=true&page=${page}`, {
            headers: { Authorization: token },
        });
        const data = await res.json();
        const batch = data.tasks || [];
        tasks.push(...batch);
        if (batch.length < 100) break;
    }
    console.log('Tareas de ClickUp:', tasks.length);

    const cf = (t: any, name: string) => {
        const f = (t.custom_fields || []).find((x: any) => x.name === name);
        if (!f || f.value === null || f.value === undefined) return undefined;
        if (f.type === 'drop_down' && typeof f.value === 'number') {
            return f.type_config?.options?.[f.value]?.name;
        }
        return f.value;
    };

    // Agrupar por itemId; la tarea más reciente manda
    const byItem = new Map<string, any>();
    for (const t of tasks) {
        const rawId = cf(t, 'ID PLATAFORMA');
        const itemId = String(rawId ?? '').replace(/\.0$/, '').trim();
        if (!/^\d{3,}$/.test(itemId)) continue;
        const plataforma = String(cf(t, 'PLATAFORMA') || '').toUpperCase();
        if (!plataforma.includes('DROPI')) continue; // por ahora solo Dropi
        const prev = byItem.get(itemId);
        if (!prev || Number(t.date_created) > Number(prev.date_created)) byItem.set(itemId, t);
    }
    console.log('Items únicos de Dropi con ID:', byItem.size);

    let written = 0;
    let batch = writeBatch(db);
    for (const [itemId, t] of byItem) {
        const correo = String(cf(t, 'CORREO PRIVATIZACION') || '').split(/[,;\s]+/)[0]?.trim().toLowerCase() || undefined;
        const comercial = cf(t, 'COMERCIAL');
        const stock = Number(cf(t, 'STOCK')) || undefined;
        const data: Record<string, any> = {
            platform: 'DROPI',
            itemId,
            visibility: correo ? 'privado' : 'desconocido',
            clientEmail: correo,
            productName: t.name,
            commercialName: comercial,
            assignedQty: stock,
            source: 'clickup',
        };
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
        batch.set(doc(db, 'platformItemMappings', `DROPI_${itemId}`), data, { merge: true });
        written++;
        if (written % 400 === 0) { await batch.commit(); batch = writeBatch(db); }
    }
    await batch.commit();
    console.log('Mapeos escritos:', written);
    process.exit(0);
}
main().catch(e => { console.error('FALLO:', e.message); process.exit(1); });
