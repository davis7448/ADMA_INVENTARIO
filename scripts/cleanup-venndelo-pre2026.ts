// Elimina ventas y agregados de VENNDELO anteriores a 2026 (deja solo 2026+).
// Confirmado por el usuario. Reversible: re-importar con backfill-venndelo.ts.
// Solo afecta VENNDELO; Dropi intacto.
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, writeBatch } from 'firebase/firestore';

const CUTOFF = '2026-01'; // se elimina todo mes < CUTOFF

async function main() {
    const snap = await getDocs(query(collection(db, 'platformSales'), where('platform', '==', 'VENNDELO')));
    const toDelete = snap.docs.filter(d => { const m = (d.data() as any).month; return m && m < CUTOFF; });
    console.log(`Ventas VENNDELO total: ${snap.size} · pre-2026 a eliminar: ${toDelete.length}`);
    let batch = writeBatch(db); let n = 0; let total = 0;
    for (const d of toDelete) {
        batch.delete(d.ref);
        if (++n >= 400) { await batch.commit(); total += n; process.stdout.write(`\r  ${total}…`); batch = writeBatch(db); n = 0; }
    }
    if (n > 0) { await batch.commit(); total += n; }
    console.log(`\nVentas eliminadas: ${total}`);

    const rmSnap = await getDocs(query(collection(db, 'platformReportMonths'), where('platform', '==', 'VENNDELO')));
    let rb = writeBatch(db); let rn = 0;
    for (const d of rmSnap.docs) {
        const m = (d.data() as any).month as string;
        if (m && m < CUTOFF) { rb.delete(d.ref); rn++; }
    }
    if (rn > 0) await rb.commit();
    console.log(`Meses (agregados) eliminados: ${rn}`);
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
