// Copia los adjuntos de una tarea de ClickUp a otra.
//
// Para qué: cuando una solicitud llega al tablero sin imágenes (por ejemplo, las del
// 2026-08-19 que fallaron por el límite de 1 MB de las server actions), a veces existe
// una solicitud anterior del MISMO producto cuyas imágenes sirven. Esto las reutiliza en
// vez de pedirle al comercial que las vuelva a buscar.
//
// OJO: la API de ClickUp no permite borrar adjuntos. Si se copia una imagen equivocada,
// hay que quitarla a mano desde la interfaz. Por eso el dry-run es el modo por defecto.
//
// Uso:
//   npx tsx scripts/copiar-adjuntos-clickup.ts                → dry-run
//   npx tsx scripts/copiar-adjuntos-clickup.ts --aplicar
import { config } from 'dotenv'; config({ path: '.env.local' });

const APLICAR = process.argv.includes('--aplicar');
const API = 'https://api.clickup.com/api/v2';
const TOKEN = process.env.CLICKUP_API_TOKEN!;

// origen → destino, con el motivo para que quede por escrito de dónde salió cada imagen
const COPIAS = [
    { desde: '86ak2wdtr', hasta: '86ak2z4n0', nota: 'PROTECTOR DESECHABLE · misma comercial, mismo día' },
    { desde: '86ak10n7c', hasta: '86ak2yxh4', nota: 'GAFAS DE LECTURA · solicitud del 14 ago' },
];

async function adjuntos(taskId: string) {
    const r = await fetch(`${API}/task/${taskId}?include_attachments=true`, { headers: { Authorization: TOKEN } });
    if (!r.ok) throw new Error(`task ${taskId}: HTTP ${r.status}`);
    const t = await r.json() as any;
    return { nombre: t.name as string, lista: (t.attachments || []) as any[] };
}

async function main() {
    for (const c of COPIAS) {
        const origen = await adjuntos(c.desde);
        const destino = await adjuntos(c.hasta);
        console.log(`\n■ ${c.nota}`);
        console.log(`   origen  ${c.desde} "${origen.nombre}" · ${origen.lista.length} adjunto(s)`);
        console.log(`   destino ${c.hasta} "${destino.nombre}" · ${destino.lista.length} adjunto(s)`);

        // No duplicar si ya está por nombre
        const yaEsta = new Set(destino.lista.map(a => a.title));
        const pendientes = origen.lista.filter(a => !yaEsta.has(a.title));
        if (!pendientes.length) { console.log('   nada que copiar'); continue; }

        for (const a of pendientes) {
            if (!APLICAR) { console.log(`   · copiaría ${a.title}`); continue; }
            const d = await fetch(a.url, { headers: { Authorization: TOKEN } });
            if (!d.ok) { console.log(`   ✗ ${a.title}: no se pudo descargar (HTTP ${d.status})`); continue; }
            const buf = Buffer.from(await d.arrayBuffer());
            const form = new FormData();
            form.append('attachment', new Blob([buf]), a.title);
            const up = await fetch(`${API}/task/${c.hasta}/attachment`, {
                method: 'POST', headers: { Authorization: TOKEN }, body: form,
            });
            console.log(up.ok ? `   ✓ ${a.title} (${(buf.length / 1024).toFixed(0)} KB)` : `   ✗ ${a.title}: HTTP ${up.status}`);
        }
    }
    if (!APLICAR) console.log('\n(dry-run: no se copió nada. Ejecuta con --aplicar)');
}

main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
