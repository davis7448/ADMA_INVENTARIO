// El archivo de Guatemala del 25/8/2026 17:25 se importó con el selector de país en
// PANAMÁ (conserva el último valor usado), así que sus 63 órdenes quedaron con
// pais=PANAMA. Como la divisa se deriva del país, además estaban contando en dólares
// en vez de quetzales.
//
// Se identifican por la ventana de importación, no por el mes: Panamá también puede
// tener órdenes de julio y agosto.
//
// Uso:  tsx scripts/fix-guatemala-pais.ts            (dry-run)
//       tsx scripts/fix-guatemala-pais.ts --apply
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit, startAt, startAfter, writeBatch, doc } from '@/lib/fs';
import { monedaDePais } from '@/lib/paises';
import * as fsn from 'fs';

const APPLY = process.argv.includes('--apply');
const PAIS_MAL = 'PANAMA';
const PAIS_BIEN = 'GUATEMALA';
// El servidor registra importedAt en UTC (el log del cron va en la misma hora).
const DESDE = Date.parse('2026-08-25T17:20:00Z');
const HASTA = Date.parse('2026-08-25T17:35:00Z');
const BACKUP = `/opt/workspaces/ADMA_INVENTARIO/logs/fix-guatemala-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

async function main() {
    const moneda = monedaDePais(PAIS_BIEN);
    const afectados: Array<{ id: string; paisPrevio: string; monedaPrevia?: string; mes?: string }> = [];
    let last: any = null;
    while (true) {
        const q = last
            ? query(collection(db, 'platformSales'), orderBy('__name__'), startAfter(last), limit(5000))
            : query(collection(db, 'platformSales'), orderBy('__name__'), startAt('DROPI_'), limit(5000));
        const snap = await getDocs(q);
        if (snap.empty) break;
        let fuera = false;
        for (const d of snap.docs) {
            if (!d.id.startsWith('DROPI_')) { fuera = true; break; }
            const s: any = d.data();
            if (String(s.pais || '').toUpperCase() !== PAIS_MAL) continue;
            const t = Number(s.importedAt) || 0;
            if (t < DESDE || t > HASTA) continue;
            afectados.push({ id: d.id, paisPrevio: s.pais, monedaPrevia: s.moneda, mes: s.month });
        }
        if (fuera) break;
        last = snap.docs[snap.docs.length - 1];
    }

    const porMes = new Map<string, number>();
    for (const a of afectados) porMes.set(a.mes || '?', (porMes.get(a.mes || '?') || 0) + 1);
    console.log(`\n${afectados.length} órdenes: pais "${PAIS_MAL}" → "${PAIS_BIEN}", moneda → "${moneda}"`);
    for (const [k, v] of [...porMes.entries()].sort()) console.log(`   ${k}: ${v}`);

    if (afectados.length === 0) { console.log('\nNada que hacer.'); process.exit(0); }
    if (!APPLY) { console.log('\nDRY-RUN. Nada se escribió. Relanza con --apply.'); process.exit(0); }

    fsn.writeFileSync(BACKUP, JSON.stringify(afectados, null, 2));
    console.log(`\nBackup en ${BACKUP}`);

    let n = 0;
    for (let i = 0; i < afectados.length; i += 400) {
        const batch = writeBatch(db);
        for (const a of afectados.slice(i, i + 400)) {
            batch.set(doc(db, 'platformSales', a.id), { pais: PAIS_BIEN, moneda }, { merge: true });
            n++;
        }
        await batch.commit();
    }
    console.log(`\n✔ ${n} órdenes corregidas. Falta: tsx scripts/reaggregate.ts`);
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
