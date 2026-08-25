// Diagnóstico temporal: composición de las órdenes PENDIENTES (no finales) por mes,
// estado, país y comercial. Foco en los meses viejos que no cierran.
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, startAfter, getDocs } from '@/lib/fs';
import { FINAL_STATES } from '@/lib/platform-sales';

type Row = { platform: string; month: string | null; estado: string; esFinal: boolean; pais?: string; commercialName?: string; bodega?: string; total?: number };
const VIEJO = '2026-07'; // meses ANTERIORES a este = ya no deberían moverse

async function main() {
    const viejosEstado = new Map<string, number>();
    const viejosMesEstado = new Map<string, Map<string, number>>();
    const viejosComercial = new Map<string, number>();
    const viejosPais = new Map<string, number>();
    const nuevosEstado = new Map<string, number>();
    const inc = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) || 0) + n);

    let last: any = null; let leidas = 0; let pend = 0; let viejos = 0;
    while (true) {
        const q = last
            ? query(collection(db, 'platformSales'), orderBy('__name__'), startAfter(last), limit(5000))
            : query(collection(db, 'platformSales'), orderBy('__name__'), limit(5000));
        const snap = await getDocs(q);
        if (snap.empty) break;
        for (const d of snap.docs) {
            leidas++;
            const s = d.data() as Row;
            if (s.esFinal) continue;
            pend++;
            const est = (s.estado || '').trim().toUpperCase() || '(sin estado)';
            const mes = s.month || '(sin mes)';
            if (mes < VIEJO) {
                viejos++;
                inc(viejosEstado, est);
                if (!viejosMesEstado.has(mes)) viejosMesEstado.set(mes, new Map());
                inc(viejosMesEstado.get(mes)!, est);
                inc(viejosComercial, (s.commercialName || '').trim() || '(sin comercial → Orgánicas)');
                inc(viejosPais, `${(s.pais || '(sin país)')} · ${s.bodega || '(sin bodega)'}`);
            } else {
                inc(nuevosEstado, est);
            }
        }
        last = snap.docs[snap.docs.length - 1];
        process.stdout.write(`\rleídas ${leidas} · pend ${pend} · viejos ${viejos}    `);
        if (snap.size < 5000) break;
    }
    const top = (m: Map<string, number>, n = 50) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
        .map(([k, v]) => `  ${String(v).padStart(6)}  ${k}`).join('\n');

    console.log(`\n\nEstados que cuentan como FINAL: ${FINAL_STATES.join(', ')}`);
    console.log(`PENDIENTES totales: ${pend} · de meses < ${VIEJO}: ${viejos} · de ${VIEJO} en adelante: ${pend - viejos}\n`);
    console.log('== MESES VIEJOS · por estado ==\n' + top(viejosEstado));
    console.log('\n== MESES VIEJOS · por comercial ==\n' + top(viejosComercial));
    console.log('\n== MESES VIEJOS · por país · bodega ==\n' + top(viejosPais));
    console.log('\n== MESES VIEJOS · mes × estado (top 8 por mes) ==');
    for (const mes of [...viejosMesEstado.keys()].sort()) console.log(`\n-- ${mes} --\n` + top(viejosMesEstado.get(mes)!, 8));
    console.log('\n== MESES RECIENTES (jul/ago) · por estado ==\n' + top(nuevosEstado, 20));
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
