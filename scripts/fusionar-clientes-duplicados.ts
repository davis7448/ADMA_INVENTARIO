// Fusiona clientes duplicados del CRM: el mismo teléfono registrado dos veces con
// distinto formato ("+57 317 6266322" y "3176266322").
//
// Los duplicados existen porque checkClientExists comparaba el teléfono como texto
// exacto. Eso ya se corrigió (src/lib/telefono.ts), pero los que se colaron antes hay
// que consolidarlos a mano.
//
// REGLA: gana el registro MÁS ANTIGUO. Quien consiguió al cliente conserva la cartera.
// El más nuevo aporta sus datos de contacto y se elimina.
//
// Uso:
//   npx tsx scripts/fusionar-clientes-duplicados.ts             → dry-run (por defecto)
//   npx tsx scripts/fusionar-clientes-duplicados.ts --aplicar   → ejecuta
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { writeFileSync } from 'node:fs';
import { claveTelefono, clavesTelefono } from '../src/lib/telefono';

const APLICAR = process.argv.includes('--aplicar');

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();

// Colecciones que apuntan a un cliente por id. Al fusionar hay que reapuntarlas al
// ganador, o su historial quedaría colgando de un documento eliminado.
const DEPENDIENTES = ['client_events', 'productPromotions'] as const;

const fecha = (v: any): number => {
    if (!v) return Number.MAX_SAFE_INTEGER; // sin fecha → se trata como el más nuevo
    if (v instanceof Timestamp) return v.toMillis();
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
};

const iso = (v: any): string => {
    const ms = fecha(v);
    return ms === Number.MAX_SAFE_INTEGER ? 'sin fecha' : new Date(ms).toISOString().slice(0, 10);
};

async function main() {
    const snap = await fs.collection('clients').get();

    // Agrupar por clave de teléfono
    const grupos = new Map<string, typeof snap.docs>();
    for (const d of snap.docs) {
        const k = claveTelefono(String(d.get('phone') || ''));
        if (!k) continue;
        grupos.set(k, [...(grupos.get(k) || []), d]);
    }

    const duplicados = [...grupos.entries()].filter(([, docs]) => docs.length > 1);
    console.log(`Clientes: ${snap.size} · grupos con teléfono repetido: ${duplicados.length}\n`);
    if (!duplicados.length) { console.log('✅ No hay duplicados.'); return; }

    const respaldo: any[] = [];
    let fusionados = 0;

    for (const [clave, docs] of duplicados) {
        // Más antiguo primero: es el que gana
        const ordenados = [...docs].sort((a, b) => fecha(a.get('created_at')) - fecha(b.get('created_at')));
        const [ganador, ...perdedores] = ordenados;

        console.log(`--- ${clave}`);
        console.log(`    CONSERVA  ${ganador.get('name')} (${iso(ganador.get('created_at'))}) · cartera de ${ganador.get('assigned_commercial_name') || '—'}`);

        // Datos de contacto del ganador, para no duplicar lo que ya tiene
        const emails = new Set<string>((ganador.get('additional_emails') || []).map((e: string) => e.toLowerCase()));
        const telefonos = new Set<string>(ganador.get('additional_phones') || []);
        const emailPrincipal = String(ganador.get('email') || '').toLowerCase();

        const nuevosEmails: string[] = [];
        const nuevosTelefonos: string[] = [];

        for (const p of perdedores) {
            console.log(`    ELIMINA   ${p.get('name')} (${iso(p.get('created_at'))}) · cartera de ${p.get('assigned_commercial_name') || '—'}`);
            respaldo.push({ grupo: clave, rol: 'eliminado', id: p.id, datos: p.data() });

            const email = String(p.get('email') || '').trim();
            if (email && email.toLowerCase() !== emailPrincipal && !emails.has(email.toLowerCase())) {
                emails.add(email.toLowerCase());
                nuevosEmails.push(email);
            }
            const tel = String(p.get('phone') || '').trim();
            // Solo se guarda si el texto difiere; la clave ya es la misma por definición
            if (tel && tel !== String(ganador.get('phone') || '') && !telefonos.has(tel)) {
                telefonos.add(tel);
                nuevosTelefonos.push(tel);
            }
        }

        if (nuevosEmails.length) console.log(`    + correos:   ${nuevosEmails.join(', ')}`);
        if (nuevosTelefonos.length) console.log(`    + teléfonos: ${nuevosTelefonos.join(', ')}`);

        // Documentos dependientes a reapuntar
        const aMover: Array<{ col: string; id: string }> = [];
        for (const col of DEPENDIENTES) {
            for (const p of perdedores) {
                const q = await fs.collection(col).where('clientId', '==', p.id).get();
                q.forEach(doc => aMover.push({ col, id: doc.id }));
            }
        }
        console.log(`    dependientes a reapuntar: ${aMover.length}`);

        if (!APLICAR) { console.log(''); continue; }

        respaldo.push({ grupo: clave, rol: 'conservado', id: ganador.id, datos: ganador.data() });

        const additional_emails = [...(ganador.get('additional_emails') || []), ...nuevosEmails];
        const additional_phones = [...(ganador.get('additional_phones') || []), ...nuevosTelefonos];

        await fs.collection('clients').doc(ganador.id).update({
            additional_emails,
            additional_phones,
            phone_key: claveTelefono(String(ganador.get('phone') || '')),
            additional_phone_keys: clavesTelefono(additional_phones),
            updated_at: FieldValue.serverTimestamp(),
        });

        for (const dep of aMover) {
            await fs.collection(dep.col).doc(dep.id).update({ clientId: ganador.id });
        }

        // Constancia de la fusión: la cartera es compartida y esto tiene que ser auditable
        const numeroEvento = (ganador.get('last_event_number') || 0) + 1;
        await fs.collection('client_events').add({
            clientId: ganador.id,
            type: 'edit',
            description: `Fusión de duplicados: se consolidó ${perdedores.map(p => `"${p.get('name')}"`).join(', ')} en esta ficha`,
            details: `Ids eliminados: ${perdedores.map(p => p.id).join(', ')}. Mismo teléfono en distinto formato.`,
            event_number: numeroEvento,
            created_at: FieldValue.serverTimestamp(),
            created_by: 'script',
            created_by_name: 'Fusión de duplicados',
        });
        await fs.collection('clients').doc(ganador.id).update({ last_event_number: numeroEvento });

        for (const p of perdedores) await fs.collection('clients').doc(p.id).delete();

        fusionados += perdedores.length;
        console.log('    ✔ fusionado\n');
    }

    if (!APLICAR) {
        console.log('(dry-run: no se escribió nada. Ejecuta con --aplicar para confirmar)');
        return;
    }

    const ruta = `docs/backups/fusion-clientes-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(ruta, JSON.stringify(respaldo, null, 2));
    console.log(`Respaldo completo en ${ruta}`);
    console.log(`✅ ${fusionados} cliente(s) eliminado(s) por fusión. Quedan ${snap.size - fusionados}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
