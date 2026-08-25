// Corrige la bodega de las dos importaciones del 24/8/2026 que entraron como INGENIO
// por el valor por defecto del selector (el export de Dropi no trae columna BODEGA).
//   16:05:29 → 46.862 guías de 2026-01
//   16:26:51 → 37.883 guías de 2026-03
// Ambas debían ser LABORATORIO (los otros archivos de esa tanda sí lo eran).
//
// Uso:  tsx scripts/fix-bodega-24ago.ts            (dry-run: solo cuenta)
//       tsx scripts/fix-bodega-24ago.ts --apply    (escribe)
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, startAfter, writeBatch, doc } from '@/lib/fs';
import * as fsn from 'fs';

const APPLY = process.argv.includes('--apply');
const DESTINO = 'LABORATORIO';
const BACKUP = '/opt/workspaces/ADMA_INVENTARIO/logs/fix-bodega-24ago-backup.json';

// Ventanas ±60s alrededor del timestamp de cada corrida (hora Bogotá, UTC-5).
const CORRIDAS = [
    { nombre: '2026-01', mes: '2026-01', desde: Date.parse('2026-08-24T16:04:29-05:00'), hasta: Date.parse('2026-08-24T16:06:29-05:00'), esperado: 46862 },
    { nombre: '2026-03', mes: '2026-03', desde: Date.parse('2026-08-24T16:25:51-05:00'), hasta: Date.parse('2026-08-24T16:27:51-05:00'), esperado: 37883 },
];

async function recolectar(c: typeof CORRIDAS[number]) {
    const afectados: Array<{ id: string; bodegaPrevia: string; importedAt: number }> = [];
    const descartados = { mesDistinto: 0, noIngenio: 0, otraPlataforma: 0 };
    let last: any = null;
    while (true) {
        const base = [where('importedAt', '>=', c.desde), where('importedAt', '<=', c.hasta), orderBy('importedAt')] as any[];
        const q = last
            ? query(collection(db, 'platformSales'), ...base, startAfter(last), limit(5000))
            : query(collection(db, 'platformSales'), ...base, limit(5000));
        const snap = await getDocs(q);
        if (snap.empty) break;
        for (const d of snap.docs) {
            const s = d.data() as any;
            if (!d.id.startsWith('DROPI_')) { descartados.otraPlataforma++; continue; }
            if (s.month !== c.mes) { descartados.mesDistinto++; continue; }
            if (s.bodega !== 'INGENIO') { descartados.noIngenio++; continue; }
            afectados.push({ id: d.id, bodegaPrevia: s.bodega, importedAt: s.importedAt });
        }
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < 5000) break;
        process.stderr.write(`\r  ${c.nombre}: ${afectados.length}…`);
    }
    return { afectados, descartados };
}

async function main() {
    console.log(APPLY ? '== MODO ESCRITURA ==' : '== DRY-RUN (no escribe) ==');
    const backup: any[] = [];
    let totalOk = true;

    for (const c of CORRIDAS) {
        const { afectados, descartados } = await recolectar(c);
        const ok = afectados.length === c.esperado;
        if (!ok) totalOk = false;
        console.log(`\n${c.nombre}: ${afectados.length} guías INGENIO → ${DESTINO}  (esperadas ${c.esperado}) ${ok ? 'OK' : '⚠️ NO COINCIDE'}`);
        console.log(`   descartadas: mes distinto=${descartados.mesDistinto} no-INGENIO=${descartados.noIngenio} otra plataforma=${descartados.otraPlataforma}`);
        backup.push({ corrida: c.nombre, docs: afectados });

        if (APPLY && ok) {
            for (let i = 0; i < afectados.length; i += 400) {
                const lote = writeBatch(db);
                for (const a of afectados.slice(i, i + 400)) {
                    lote.update(doc(db, 'platformSales', a.id), { bodega: DESTINO });
                }
                await lote.commit();
                process.stderr.write(`\r   escribiendo ${Math.min(i + 400, afectados.length)}/${afectados.length}…`);
            }
            console.log(`\n   → ${afectados.length} actualizadas.`);
        }
    }

    // Solo se (re)escribe el backup si hay algo que respaldar: al re-ejecutar el script
    // en modo verificación ya no quedan guías INGENIO y un volcado vacío borraría el original.
    const aRespaldar = backup.reduce((n, b) => n + b.docs.length, 0);
    if (aRespaldar > 0) {
        fsn.mkdirSync('/opt/workspaces/ADMA_INVENTARIO/logs', { recursive: true });
        fsn.writeFileSync(BACKUP, JSON.stringify(backup));
        console.log(`\nBackup de IDs y bodega previa (${aRespaldar}): ${BACKUP}`);
    } else {
        console.log(`\nNada que respaldar (0 guías en INGENIO): se conserva el backup existente.`);
    }
    if (!totalOk) console.log('⚠️  Algún conteo no coincidió con lo esperado. Revisar antes de aplicar.');
    if (APPLY) console.log('\nSiguiente paso obligatorio: tsx scripts/reaggregate.ts (recalcula los resúmenes por bodega).');
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
