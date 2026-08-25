// Recalcula el campo `esFinal` de las ventas ya guardadas con la lista vigente de
// FINAL_STATES. Necesario tras ampliarla: los documentos guardan el valor calculado
// en su día, y scripts/dropi-sync.ts decide la ventana de sincronización mirando la
// orden ABIERTA más vieja (con órdenes muertas marcadas como abiertas, la ventana se
// iba siempre al tope de 95 días).
//
// Uso: npx tsx scripts/backfill-es-final.ts [--dry]
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, startAfter, getDocs, writeBatch, doc } from '@/lib/fs';
import { esEstadoFinal } from '@/lib/platform-sales';

async function main() {
    const dry = process.argv.includes('--dry');
    let leidas = 0, cambios = 0;
    const porEstado = new Map<string, number>();
    let batch = writeBatch(db), n = 0;
    let last: any = null;

    while (true) {
        const q = last
            ? query(collection(db, 'platformSales'), orderBy('__name__'), startAfter(last), limit(5000))
            : query(collection(db, 'platformSales'), orderBy('__name__'), limit(5000));
        const snap = await getDocs(q);
        if (snap.empty) break;
        for (const d of snap.docs) {
            leidas++;
            const s = d.data() as { estado?: string; esFinal?: boolean };
            const final = esEstadoFinal(s.estado);
            if (final === !!s.esFinal) continue;
            cambios++;
            const est = (s.estado || '(sin estado)').toUpperCase();
            porEstado.set(est, (porEstado.get(est) || 0) + 1);
            if (!dry) {
                batch.update(doc(db, 'platformSales', d.id), { esFinal: final });
                if (++n >= 400) { await batch.commit(); batch = writeBatch(db); n = 0; }
            }
        }
        last = snap.docs[snap.docs.length - 1];
        process.stdout.write(`\rleídas ${leidas} · a corregir ${cambios}   `);
        if (snap.size < 5000) break;
    }
    if (!dry && n > 0) await batch.commit();

    console.log(`\n\n${dry ? '[dry-run] ' : ''}${cambios} de ${leidas} ventas ${dry ? 'se corregirían' : 'corregidas'}:`);
    for (const [est, c] of [...porEstado.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(6)}  ${est}`);
    console.log('\nSiguiente paso: npx tsx scripts/reaggregate.ts (recalcula los resúmenes por mes).');
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
