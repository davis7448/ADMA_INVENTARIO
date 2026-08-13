// Fusiona fichas del mismo negocio DENTRO del mismo país.
//
// Complementa a scripts/fusionar-clientes-duplicados.ts, que solo agrupaba por teléfono.
// Aquí se agrupa por correo O clave de teléfono (principal y adicionales), en
// componentes conexas: si A y B comparten correo y B y C comparten teléfono, los tres
// son el mismo negocio. Es el mismo criterio que usa checkClientExists.
//
// Solo se fusiona dentro de un mismo país. Un mismo negocio en países distintos NO es un
// duplicado: le corresponde una ficha por país (ver scripts/enlazar-fichas-por-pais.ts).
//
// REGLA: gana la ficha MÁS ANTIGUA. Quien consiguió al cliente conserva la cartera.
//
// Uso:
//   npx tsx scripts/fusionar-fichas-mismo-pais.ts             → dry-run
//   npx tsx scripts/fusionar-fichas-mismo-pais.ts --aplicar   → ejecuta
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

const DEPENDIENTES = ['client_events', 'productPromotions'] as const;
const clavePais = (p?: string | null) => (p || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

const fecha = (v: any): number => {
    if (!v) return Number.MAX_SAFE_INTEGER;
    if (v instanceof Timestamp) return v.toMillis();
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
};
const iso = (v: any) => {
    const ms = fecha(v);
    return ms === Number.MAX_SAFE_INTEGER ? 'sin fecha' : new Date(ms).toISOString().slice(0, 10);
};

async function main() {
    const snap = await fs.collection('clients').get();
    const docs = new Map(snap.docs.map(d => [d.id, d]));

    // Agrupación por correo y por clave de teléfono
    const porClave = new Map<string, Set<string>>();
    const agrupar = (clave: string, id: string) => {
        if (!clave) return;
        if (!porClave.has(clave)) porClave.set(clave, new Set());
        porClave.get(clave)!.add(id);
    };
    for (const d of snap.docs) {
        for (const e of [d.get('email'), ...(d.get('additional_emails') || [])]) {
            agrupar('mail:' + String(e || '').trim().toLowerCase(), d.id);
        }
        const claves = [d.get('phone_key'), ...(d.get('additional_phone_keys') || [])]
            .map((k: any) => String(k || '').trim()).filter(Boolean);
        if (!claves.length) { const k = claveTelefono(String(d.get('phone') || '')); if (k) claves.push(k); }
        for (const k of claves) agrupar('tel:' + k, d.id);
    }
    porClave.delete('mail:');

    // Componentes conexas
    const padre = new Map<string, string>();
    const raiz = (x: string): string => {
        if (!padre.has(x)) padre.set(x, x);
        while (padre.get(x) !== x) { padre.set(x, padre.get(padre.get(x)!)!); x = padre.get(x)!; }
        return x;
    };
    const unir = (a: string, b: string) => { const ra = raiz(a), rb = raiz(b); if (ra !== rb) padre.set(ra, rb); };
    for (const ids of porClave.values()) {
        const lista = [...ids];
        for (let i = 1; i < lista.length; i++) unir(lista[0], lista[i]);
    }
    const componentes = new Map<string, string[]>();
    for (const id of docs.keys()) {
        const r = raiz(id);
        componentes.set(r, [...(componentes.get(r) || []), id]);
    }

    const respaldo: any[] = [];
    let eliminados = 0;
    let grupos = 0;

    for (const ids of componentes.values()) {
        if (ids.length < 2) continue;
        const paises = [...new Set(ids.map(id => clavePais(docs.get(id)!.get('country'))))];
        if (paises.length > 1) {
            console.log(`— grupo en países distintos (${paises.join(' ↔ ')}): no se fusiona, le toca una ficha por país`);
            continue;
        }

        grupos++;
        const ordenados = ids.map(id => docs.get(id)!).sort((a, b) => fecha(a.get('created_at')) - fecha(b.get('created_at')));
        const [ganador, ...perdedores] = ordenados;

        console.log(`\n--- ${paises[0]}`);
        console.log(`    CONSERVA  ${ganador.get('name')} (${iso(ganador.get('created_at'))}) · ${ganador.get('assigned_commercial_name') || '—'}`);

        const emails = new Set<string>((ganador.get('additional_emails') || []).map((e: string) => String(e).toLowerCase()));
        const telefonos = new Set<string>(ganador.get('additional_phones') || []);
        const emailPrincipal = String(ganador.get('email') || '').toLowerCase();
        const telPrincipal = String(ganador.get('phone') || '');
        const nuevosEmails: string[] = [];
        const nuevosTelefonos: string[] = [];
        const aMover: Array<{ col: string; id: string }> = [];

        for (const p of perdedores) {
            console.log(`    ELIMINA   ${p.get('name')} (${iso(p.get('created_at'))}) · ${p.get('assigned_commercial_name') || '—'}`);
            respaldo.push({ rol: 'eliminado', id: p.id, datos: p.data() });

            for (const e of [p.get('email'), ...(p.get('additional_emails') || [])]) {
                const valor = String(e || '').trim();
                if (valor && valor.toLowerCase() !== emailPrincipal && !emails.has(valor.toLowerCase())) {
                    emails.add(valor.toLowerCase()); nuevosEmails.push(valor);
                }
            }
            for (const t of [p.get('phone'), ...(p.get('additional_phones') || [])]) {
                const valor = String(t || '').trim();
                if (valor && valor !== telPrincipal && !telefonos.has(valor)) {
                    telefonos.add(valor); nuevosTelefonos.push(valor);
                }
            }
            for (const col of DEPENDIENTES) {
                const q = await fs.collection(col).where('clientId', '==', p.id).get();
                q.forEach(d => aMover.push({ col, id: d.id }));
            }
        }

        if (nuevosEmails.length) console.log(`    + correos:   ${nuevosEmails.join(', ')}`);
        if (nuevosTelefonos.length) console.log(`    + teléfonos: ${nuevosTelefonos.join(', ')}`);
        console.log(`    dependientes a reapuntar: ${aMover.length}`);

        if (!APLICAR) continue;

        respaldo.push({ rol: 'conservado', id: ganador.id, datos: ganador.data() });

        const additional_emails = [...(ganador.get('additional_emails') || []), ...nuevosEmails];
        const additional_phones = [...(ganador.get('additional_phones') || []), ...nuevosTelefonos];
        await fs.collection('clients').doc(ganador.id).update({
            additional_emails,
            additional_phones,
            phone_key: claveTelefono(telPrincipal),
            additional_phone_keys: clavesTelefono(additional_phones),
            updated_at: FieldValue.serverTimestamp(),
        });

        for (const dep of aMover) await fs.collection(dep.col).doc(dep.id).update({ clientId: ganador.id });

        const numeroEvento = (ganador.get('last_event_number') || 0) + 1;
        await fs.collection('client_events').add({
            clientId: ganador.id,
            type: 'edit',
            description: `Fusión de duplicados: se consolidó ${perdedores.map(p => `"${p.get('name')}"`).join(', ')} en esta ficha`,
            details: `Ids eliminados: ${perdedores.map(p => p.id).join(', ')}. Mismo correo o teléfono, mismo país.`,
            event_number: numeroEvento,
            created_at: FieldValue.serverTimestamp(),
            created_by: 'script',
            created_by_name: 'Fusión de duplicados',
        });
        await fs.collection('clients').doc(ganador.id).update({ last_event_number: numeroEvento });

        for (const p of perdedores) { await fs.collection('clients').doc(p.id).delete(); eliminados++; }
        console.log('    ✔ fusionado');
    }

    if (!grupos) { console.log('\n✅ No hay grupos que fusionar.'); return; }
    if (!APLICAR) { console.log(`\n(dry-run: ${grupos} grupo(s). Ejecuta con --aplicar)`); return; }

    const ruta = `docs/backups/fusion-mismo-pais-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(ruta, JSON.stringify(respaldo, null, 2));
    console.log(`\nRespaldo en ${ruta}`);
    console.log(`✅ ${eliminados} ficha(s) eliminada(s). Quedan ${snap.size - eliminados}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
