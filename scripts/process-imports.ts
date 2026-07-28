// Procesa las importaciones grandes encoladas (pendingImports): baja el archivo de
// Storage, lo parsea con Node (SheetJS aguanta cientos de miles de filas) e importa
// con el motor. Corre en el VPS (sin límite HTTP ni navegador). Dispararlo por cron.
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { parseDropiRows, importPlatformSales } from '@/lib/platform-sales';

async function processOne(data: any): Promise<any> {
    const res = await fetch(data.downloadUrl);
    if (!res.ok) throw new Error(`descarga ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false });

    // Por ahora los archivos grandes son de estructura Dropi (marcas blancas incluidas).
    const { parsed, errors } = parseDropiRows(rows as any[][]);
    if (parsed.length === 0) throw new Error('Archivo no reconocido / sin filas: ' + errors.join(' ').slice(0, 200));
    console.log(`  ${parsed.length} filas parseadas. Importando…`);
    const result = await importPlatformSales(data.platform, parsed, 45, {
        bodega: data.bodega || undefined, pais: data.pais || undefined,
    }, m => process.stdout.write('\r  ' + m + '          '));
    return { filas: parsed.length, ...result };
}

async function main() {
    // Una a la vez (las grandes tardan); el lock del .sh evita solapamiento.
    const snap = await getDocs(query(collection(db, 'pendingImports'), where('status', '==', 'pending')));
    if (snap.empty) { console.log('Sin importaciones pendientes.'); process.exit(0); }
    const d = snap.docs.sort((a, b) => (a.data().createdAt || 0) - (b.data().createdAt || 0))[0];
    const data = d.data() as any;
    console.log(`== ${data.fileName} · ${data.platform}/${data.bodega || '?'}/${data.pais || '?'} · ${(data.fileSize / 1e6).toFixed(1)} MB ==`);
    await updateDoc(doc(db, 'pendingImports', d.id), { status: 'processing', startedAt: Date.now() });
    try {
        const t0 = Date.now();
        const r = await processOne(data);
        await updateDoc(doc(db, 'pendingImports', d.id), { status: 'done', finishedAt: Date.now(), summary: r });
        console.log(`\n  → OK ${JSON.stringify({ nuevas: r.nuevas, actualizadas: r.actualizadas, entregadas: r.entregadas, atribuidas: r.atribuidas })} en ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await updateDoc(doc(db, 'pendingImports', d.id), { status: 'error', error: msg.slice(0, 400), finishedAt: Date.now() });
        console.error('\n  → ERROR:', msg);
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
