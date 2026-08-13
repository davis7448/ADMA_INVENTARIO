// Enlaza fichas ya existentes que son el mismo negocio en países distintos.
//
// El vínculo (related_client_ids) solo se crea al registrar un cliente nuevo cuando el
// sistema detecta que ya existe en otro país. Las fichas creadas antes de esa función
// quedaron sueltas: cada comercial gestiona la suya sin saber que la otra existe.
//
// Criterio de "mismo negocio": comparten el correo (principal o adicional) o la clave
// de teléfono (ver src/lib/telefono.ts, últimos 9 dígitos). Es el mismo criterio que usa
// checkClientExists, así que no inventa relaciones que la app no reconocería.
//
// Qué hace con cada grupo:
//   · países distintos → los enlaza en ambas direcciones
//   · mismo país       → NO los toca; los reporta como posibles duplicados, que es una
//                        decisión de negocio (fusionar borra una ficha) y no de script
//
// Uso:
//   npx tsx scripts/enlazar-fichas-por-pais.ts             → dry-run (por defecto)
//   npx tsx scripts/enlazar-fichas-por-pais.ts --aplicar   → escribe los vínculos
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { writeFileSync } from 'node:fs';
import { claveTelefono } from '../src/lib/telefono';

const APLICAR = process.argv.includes('--aplicar');

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();

const clavePais = (p?: string | null) =>
    (p || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

type Ficha = { id: string; nombre: string; pais: string; comercial: string; correo: string; tel: string };

async function main() {
    const snap = await fs.collection('clients').get();

    const fichas = new Map<string, Ficha>();
    // clave de agrupación → ids
    const porCorreo = new Map<string, Set<string>>();
    const porTelefono = new Map<string, Set<string>>();

    for (const d of snap.docs) {
        const f: Ficha = {
            id: d.id,
            nombre: String(d.get('name') || ''),
            pais: clavePais(d.get('country')) || '(sin país)',
            comercial: String(d.get('assigned_commercial_name') || '—'),
            correo: String(d.get('email') || ''),
            tel: String(d.get('phone') || ''),
        };
        fichas.set(d.id, f);

        const correos = [d.get('email'), ...(d.get('additional_emails') || [])]
            .map((e: any) => String(e || '').trim().toLowerCase()).filter(Boolean);
        for (const c of correos) {
            if (!porCorreo.has(c)) porCorreo.set(c, new Set());
            porCorreo.get(c)!.add(d.id);
        }

        const claves = [d.get('phone_key'), ...(d.get('additional_phone_keys') || [])]
            .map((k: any) => String(k || '').trim()).filter(Boolean);
        // Si aún no tiene phone_key (fichas muy viejas), se calcula al vuelo
        if (!claves.length) {
            const k = claveTelefono(f.tel);
            if (k) claves.push(k);
        }
        for (const k of claves) {
            if (!porTelefono.has(k)) porTelefono.set(k, new Set());
            porTelefono.get(k)!.add(d.id);
        }
    }

    // Componentes conexas: si A y B comparten correo, y B y C comparten teléfono, los
    // tres son el mismo negocio.
    const padre = new Map<string, string>();
    const raiz = (x: string): string => {
        if (!padre.has(x)) padre.set(x, x);
        while (padre.get(x) !== x) { padre.set(x, padre.get(padre.get(x)!)!); x = padre.get(x)!; }
        return x;
    };
    const unir = (a: string, b: string) => { const ra = raiz(a), rb = raiz(b); if (ra !== rb) padre.set(ra, rb); };

    for (const grupos of [porCorreo, porTelefono]) {
        for (const ids of grupos.values()) {
            const lista = [...ids];
            for (let i = 1; i < lista.length; i++) unir(lista[0], lista[i]);
        }
    }

    const componentes = new Map<string, string[]>();
    for (const id of fichas.keys()) {
        const r = raiz(id);
        componentes.set(r, [...(componentes.get(r) || []), id]);
    }

    const aEnlazar: Array<{ ids: string[]; paises: string[] }> = [];
    const posiblesDuplicados: Array<{ ids: string[]; pais: string }> = [];

    for (const ids of componentes.values()) {
        if (ids.length < 2) continue;
        const paises = [...new Set(ids.map(id => fichas.get(id)!.pais))];
        if (paises.length > 1) aEnlazar.push({ ids, paises });
        else posiblesDuplicados.push({ ids, pais: paises[0] });
    }

    console.log(`Clientes: ${snap.size}\n`);

    console.log(`Mismo negocio en PAÍSES DISTINTOS (se enlazan): ${aEnlazar.length}`);
    for (const g of aEnlazar) {
        console.log(`  · ${g.paises.join(' ↔ ')}`);
        for (const id of g.ids) {
            const f = fichas.get(id)!;
            console.log(`      ${f.pais.padEnd(22)} ${f.nombre.padEnd(30)} ${f.tel.padEnd(18)} ${f.comercial}`);
        }
    }
    if (!aEnlazar.length) console.log('  (ninguno)');

    console.log(`\nMismo negocio en el MISMO país (posibles duplicados, NO se tocan): ${posiblesDuplicados.length}`);
    for (const g of posiblesDuplicados) {
        console.log(`  · ${g.pais}`);
        for (const id of g.ids) {
            const f = fichas.get(id)!;
            console.log(`      ${f.nombre.padEnd(30)} ${f.correo.padEnd(34)} ${f.tel.padEnd(18)} ${f.comercial}`);
        }
    }
    if (!posiblesDuplicados.length) console.log('  (ninguno)');

    if (!aEnlazar.length) { console.log('\n✅ No hay nada que enlazar.'); return; }
    if (!APLICAR) { console.log('\n(dry-run: no se escribió nada. Ejecuta con --aplicar)'); return; }

    const ruta = `docs/backups/enlaces-fichas-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(ruta, JSON.stringify(aEnlazar, null, 2));
    console.log(`\nRespaldo escrito en ${ruta}`);

    for (const g of aEnlazar) {
        for (const id of g.ids) {
            const otros = g.ids.filter(x => x !== id);
            await fs.collection('clients').doc(id).update({
                related_client_ids: FieldValue.arrayUnion(...otros),
            });
        }
    }
    console.log(`✅ ${aEnlazar.length} grupo(s) enlazado(s).`);
}

main().catch(e => { console.error(e); process.exit(1); });
