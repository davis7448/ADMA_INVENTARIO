// Mueve fichas del CRM de un comercial a otro, por lista explícita de ids.
//
// POR QUÉ EXISTE
// No hay forma de reasignar un cliente desde la UI: getClientsByCommercial
// (src/lib/commercial-api.ts) solo lee, y el único camino que había era
// importar-clientes-crm.ts --reasignar, que exige un Excel con columna COMERCIAL. Cuando
// lo que se pide es "pasa estos 15 clientes a fulano", armar un Excel para eso es peor.
//
// La lista va en un archivo versionado (scripts/lotes/*.txt) y no en la línea de comandos:
// así queda registrado exactamente qué se movió, sin depender de la memoria de nadie.
//
// Uso:
//   npx tsx scripts/transferir-cartera.ts --hasta=<userId> --archivo=<lista.txt>
//   npx tsx scripts/transferir-cartera.ts --hasta=<userId> --archivo=<lista.txt> --aplicar
//
// Opciones:
//   --lote=<nombre>        nombre del lote que queda en la ficha y el evento
//                          (default: transferencia-<fecha>)
//   --normalizar-nombre    además, reescribe assigned_commercial_name en TODAS las fichas
//                          del destino que estén firmadas con otro nombre. Arregla las
//                          carteras partidas por nombre ("marcela" vs "Marcela López"),
//                          que hacen que el mismo comercial salga dos veces en los conteos.
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const APLICAR = process.argv.includes('--aplicar');
const NORMALIZAR = process.argv.includes('--normalizar-nombre');
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const HASTA = arg('hasta');
const ARCHIVO = arg('archivo');
const LOTE = arg('lote') || `transferencia-${new Date().toISOString().slice(0, 10)}`;

if (!HASTA || !ARCHIVO) {
    console.error('Uso: npx tsx scripts/transferir-cartera.ts --hasta=<userId> --archivo=<lista.txt> [--aplicar] [--normalizar-nombre]');
    process.exit(1);
}

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();

// Un id por línea. Todo lo que va después de # es comentario (se usa para dejar escrito
// a qué cliente corresponde cada id, que si no la lista es ilegible).
function leerLista(ruta: string): string[] {
    const ids = readFileSync(ruta, 'utf8')
        .split('\n')
        .map(l => l.split('#')[0].trim())
        .filter(Boolean);
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (repetidos.length) throw new Error(`Ids repetidos en la lista: ${[...new Set(repetidos)].join(', ')}`);
    if (!ids.length) throw new Error('La lista está vacía.');
    return ids;
}

interface Ficha {
    id: string; nombre: string; comercialId: string; comercialNombre: string;
    categoria: string; ultimoEvento: number; previa: any;
}

async function main() {
    console.log(`\n${APLICAR ? '' : '[DRY-RUN] '}Transferencia de cartera`);
    console.log(`Archivo: ${ARCHIVO}`);
    console.log(`Lote:    ${LOTE}\n`);

    // ── Destino ──
    const destinoDoc = await fs.collection('users').doc(HASTA!).get();
    if (!destinoDoc.exists) throw new Error(`El usuario destino ${HASTA} no existe en la colección users.`);
    const rol = String(destinoDoc.get('role') || '');
    if (!['commercial', 'commercial_director'].includes(rol)) {
        throw new Error(`El usuario destino ${HASTA} tiene rol "${rol}", no es comercial. Si es a propósito, cámbiale el rol primero.`);
    }
    const destino = { id: HASTA!, nombre: String(destinoDoc.get('name') || destinoDoc.get('email') || '') };
    console.log(`Destino: ${destino.nombre} (${destino.id}) · ${destinoDoc.get('email')} · rol ${rol}\n`);

    // ── Fichas ──
    const ids = leerLista(ARCHIVO!);
    console.log(`Ids en la lista: ${ids.length}\n`);

    const aMover: Ficha[] = [];
    const yaSuyas: Ficha[] = [];
    const faltantes: string[] = [];

    for (const id of ids) {
        const d = await fs.collection('clients').doc(id).get();
        if (!d.exists) { faltantes.push(id); continue; }
        const f: Ficha = {
            id,
            nombre: String(d.get('name') || '(sin nombre)'),
            comercialId: String(d.get('assigned_commercial_id') || ''),
            comercialNombre: String(d.get('assigned_commercial_name') || 'sin comercial'),
            categoria: String(d.get('category') || ''),
            ultimoEvento: Number(d.get('last_event_number') || 0),
            previa: d.get('reasignacion_previa') ?? null,
        };
        (f.comercialId === destino.id ? yaSuyas : aMover).push(f);
    }

    // Una ficha que no existe casi siempre es un id mal copiado, y seguir sin avisar deja
    // un cliente sin mover que nadie va a echar de menos hasta dentro de un mes.
    if (faltantes.length) {
        console.error(`❌ ${faltantes.length} ids no existen en clients:`);
        faltantes.forEach(id => console.error(`     ${id}`));
        throw new Error('No se transfiere nada hasta que la lista esté correcta.');
    }

    for (const f of aMover) {
        console.log(`  mover      ${f.id}  ${f.nombre.padEnd(28)} · de ${f.comercialNombre}` +
                    (f.previa ? `  (ya tenía reasignacion_previa del lote "${f.previa.lote ?? '?'}")` : ''));
    }
    for (const f of yaSuyas) console.log(`  ya es suya ${f.id}  ${f.nombre}`);

    console.log(`\n─────────────────────────────────────────`);
    console.log(`Por mover:   ${aMover.length}`);
    console.log(`Ya del destino: ${yaSuyas.length}`);
    console.log(`─────────────────────────────────────────\n`);

    // ── Normalización de nombre (solo informe en dry-run) ──
    const desalineadas: { id: string; nombre: string; firmadaComo: string }[] = [];
    if (NORMALIZAR) {
        const snap = await fs.collection('clients').where('assigned_commercial_id', '==', destino.id).get();
        for (const d of snap.docs) {
            const firmada = String(d.get('assigned_commercial_name') || '');
            if (firmada !== destino.nombre) {
                desalineadas.push({ id: d.id, nombre: String(d.get('name') || ''), firmadaComo: firmada || '(vacío)' });
            }
        }
        const porNombre = new Map<string, number>();
        for (const f of desalineadas) porNombre.set(f.firmadaComo, (porNombre.get(f.firmadaComo) || 0) + 1);
        console.log(`Fichas del destino firmadas con otro nombre: ${desalineadas.length}`);
        for (const [n, c] of porNombre) console.log(`    "${n}" → "${destino.nombre}"  (${c})`);
        console.log('');
    }

    if (!APLICAR) {
        console.log('Dry-run: no se escribió nada en Firestore.');
        return escribirReporte(aMover, yaSuyas, destino);
    }

    // ── Respaldo ──
    mkdirSync('scripts/output', { recursive: true });
    const respaldo = `scripts/output/transferencia-${LOTE}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeFileSync(respaldo, JSON.stringify({
        fecha: new Date().toISOString(), lote: LOTE, destino,
        fichas: [...aMover, ...yaSuyas], normalizadas: desalineadas,
    }, null, 2));
    console.log(`Respaldo del estado previo: ${respaldo}\n`);

    // ── Escritura ──
    // Cada ficha son 2 escrituras (update + evento); el batch admite 500.
    const TAMANO = 200;
    let movidos = 0;
    for (let i = 0; i < aMover.length; i += TAMANO) {
        const trozo = aMover.slice(i, i + TAMANO);
        const batch = fs.batch();

        for (const f of trozo) {
            const evento = f.ultimoEvento + 1;
            batch.update(fs.collection('clients').doc(f.id), {
                assigned_commercial_id: destino.id,
                assigned_commercial_name: destino.nombre,
                // reasignacion_previa ya viene ocupada en las fichas que movió la carga
                // masiva del 31/8. Pisarla sin más borra el rastro de aquella y deja de
                // poder revertirse, así que el valor anterior se guarda antes.
                ...(f.previa ? { historial_reasignaciones: FieldValue.arrayUnion(f.previa) } : {}),
                reasignacion_previa: {
                    lote: LOTE,
                    comercial_id: f.comercialId,
                    comercial_nombre: f.comercialNombre,
                    categoria: f.categoria,
                    // serverTimestamp() no es válido dentro de un array, y este objeto
                    // termina en uno la próxima vez que se mueva la ficha.
                    fecha: Timestamp.now(),
                },
                last_event_number: evento,
                updated_at: FieldValue.serverTimestamp(),
            });

            batch.set(fs.collection('client_events').doc(), {
                clientId: f.id,
                type: 'edit',
                description: `Reasignado de ${f.comercialNombre} a ${destino.nombre}`,
                details: `Transferencia manual de cartera (lote ${LOTE})`,
                event_number: evento,
                created_at: FieldValue.serverTimestamp(),
                created_by: `transferencia:${LOTE}`,
                created_by_name: 'TRANSFERENCIA DE CARTERA',
            });
        }

        await batch.commit();
        movidos += trozo.length;
        console.log(`  ${movidos}/${aMover.length} transferidas`);
    }
    if (movidos) console.log(`\nTransferidas: ${movidos} fichas a ${destino.nombre}.`);

    // ── Normalización ──
    if (NORMALIZAR && desalineadas.length) {
        // Las recién movidas ya quedaron con el nombre correcto; aquí solo las viejas.
        const pendientes = desalineadas.filter(d => !aMover.some(f => f.id === d.id));
        let n = 0;
        for (let i = 0; i < pendientes.length; i += 400) {
            const batch = fs.batch();
            for (const d of pendientes.slice(i, i + 400)) {
                batch.update(fs.collection('clients').doc(d.id), {
                    assigned_commercial_name: destino.nombre,
                    updated_at: FieldValue.serverTimestamp(),
                });
            }
            await batch.commit();
            n += Math.min(400, pendientes.length - i);
        }
        console.log(`Nombre normalizado a "${destino.nombre}" en ${n} fichas que ya eran suyas.`);
    }

    escribirReporte(aMover, yaSuyas, destino);
}

function escribirReporte(aMover: Ficha[], yaSuyas: Ficha[], destino: { id: string; nombre: string }) {
    mkdirSync('logs', { recursive: true });
    const salida = `logs/transferencia-${LOTE}${APLICAR ? '' : '-dryrun'}.csv`;
    const csv = ['client_id,nombre,estado,comercial_anterior,comercial_nuevo,categoria,evento']
        .concat([
            ...aMover.map(f => [f.id, f.nombre, 'transferida', f.comercialNombre, destino.nombre, f.categoria, f.ultimoEvento + 1]),
            ...yaSuyas.map(f => [f.id, f.nombre, 'ya era del destino', f.comercialNombre, destino.nombre, f.categoria, f.ultimoEvento]),
        ].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')))
        .join('\n');
    writeFileSync(salida, csv);
    console.log(`Reporte: ${salida}`);
}

main().then(() => process.exit(0)).catch(e => { console.error('\n' + (e instanceof Error ? e.message : e)); process.exit(1); });
