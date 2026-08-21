// Fusiona documentos duplicados de la colección `users`.
//
// EL PROBLEMA
// Existen dos familias de documentos por persona:
//   - CANÓNICO: el id del documento ES el UID de Firebase Auth.
//   - HUÉRFANO: id autogenerado por addDoc(), creado por el auto-alta de perfil de
//     use-auth.tsx cuando findUserByEmail no encontraba el canónico. Se reconocen
//     porque `name` es el prefijo del correo ("carol.perea", "bodega.adma0").
//
// findUserByEmail hace `docs[0]`, y Firestore ordena por id de documento: el rol con
// el que entra cada persona depende de qué id gane alfabéticamente. Por eso hay
// cuentas operando con permisos que nadie decidió.
//
// REGLA: gana el documento CANÓNICO (id = UID de Auth). El huérfano aporta los campos
// que al canónico le faltan (commercialCode, phone, salary, warehouseId…) y luego se
// elimina, después de repuntar hacia el canónico todas las referencias a su id.
//
// Los roles en conflicto NO se deciden por regla: están fijados en DECISIONES, tal
// como los confirmó el equipo.
//
// Uso:
//   npx tsx scripts/fusionar-usuarios-duplicados.ts             → dry-run (por defecto)
//   npx tsx scripts/fusionar-usuarios-duplicados.ts --aplicar   → ejecuta
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { writeFileSync } from 'node:fs';

const APLICAR = process.argv.includes('--aplicar');

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();

// Roles en conflicto entre el canónico y el huérfano. Sin entrada aquí, el rol del
// canónico se respeta tal cual.
const DECISIONES: Record<string, { role?: string; warehouseId?: string | null }> = {
    'cordinador.operaciones@adma.com.co': { role: 'admin' },
    'bodega.adma0@gmail.com': { role: 'logistics', warehouseId: 'wh-bog' },
    'camilouseche22@gmail.com': { role: 'admin' },
    // Ya aplicado a ambos documentos el 2026-08-21; queda fijado para que la fusión no
    // lo reinterprete.
    'directoracomercialadma@gmail.com': { role: 'admin' },
};

// Correos de datos semilla: se eliminan enteros (no tienen cuenta en Auth).
const SEMILLA = ['admin@example.com', 'logistics@example.com', 'commercial@example.com'];

// Campos que apuntan a un id de usuario y admiten consulta de igualdad directa.
const REFERENCIAS: { col: string; campo: string }[] = [
    { col: 'inventoryMovements', campo: 'userId' },
    { col: 'return_guides', campo: 'registeredBy' },
    { col: 'dispatchOrders', campo: 'createdBy.id' },
    { col: 'products', campo: 'createdBy.id' },
    { col: 'clients', campo: 'assigned_commercial_id' },
    { col: 'clients', campo: 'created_by' },
    { col: 'client_events', campo: 'created_by' },
    { col: 'client_tests', campo: 'created_by' },
    { col: 'cancellationRequests', campo: 'requestedBy.id' },
    { col: 'modificaciones', campo: 'solicitadoPor.id' },
    { col: 'importRequests', campo: 'requestedBy.id' },
    { col: 'externalStockSnapshots', campo: 'uploadedBy.id' },
    { col: 'productPromotions', campo: 'commercialId' },
    { col: 'task_notifications', campo: 'userId' },
    { col: 'task_rejection_tracker', campo: 'userId' },
    { col: 'user_gamification_profiles', campo: 'userId' },
    { col: 'user_missions', campo: 'userId' },
    { col: 'tasks', campo: 'createdBy' },
    { col: 'tasks', campo: 'assignedTo' },
    { col: 'tasks', campo: 'originalAssignee' },
];

// Ids dentro de arrays: no son consultables, hay que reescribir el array completo.
const REFERENCIAS_ARRAY: { col: string; campo: string; subcampo: string }[] = [
    { col: 'clients', campo: 'notes', subcampo: 'created_by' },
    { col: 'tasks', campo: 'history', subcampo: 'userId' },
];

const vacio = (v: any) => v === undefined || v === null || v === '';

type Grupo = { email: string; canonicoId: string; crearCanonico: boolean; datos: any; huerfanos: string[] };

async function planificar(): Promise<{ grupos: Grupo[]; borrarSemilla: string[] }> {
    const uidPorEmail = new Map<string, string>();
    let token: string | undefined;
    do {
        const page = await getAuth().listUsers(1000, token);
        for (const u of page.users) if (u.email) uidPorEmail.set(u.email.toLowerCase(), u.uid);
        token = page.pageToken;
    } while (token);

    const snap = await fs.collection('users').get();
    const porEmail = new Map<string, { id: string; data: any }[]>();
    for (const d of snap.docs) {
        const email = ((d.data() as any).email || '').toLowerCase().trim();
        if (!porEmail.has(email)) porEmail.set(email, []);
        porEmail.get(email)!.push({ id: d.id, data: d.data() });
    }

    const borrarSemilla: string[] = [];
    for (const correo of SEMILLA) for (const d of porEmail.get(correo) || []) borrarSemilla.push(d.id);

    const grupos: Grupo[] = [];
    for (const [email, docs] of porEmail) {
        if (docs.length < 2 || SEMILLA.includes(email)) continue;
        const uid = uidPorEmail.get(email);
        if (!uid) throw new Error(`${email} está duplicado y no tiene cuenta en Auth: decidir a mano.`);

        const canonico = docs.find(d => d.id === uid);
        const huerfanos = docs.filter(d => d.id !== uid);

        // El canónico manda; el huérfano solo rellena huecos. Si no hay canónico
        // (nadie coincide con el UID) se crea a partir del primer huérfano.
        const base: any = { ...(canonico?.data ?? huerfanos[0].data) };
        for (const h of huerfanos) {
            for (const [k, v] of Object.entries(h.data)) {
                if (k === 'id' || vacio(v)) continue;
                if (vacio(base[k])) base[k] = v;
            }
        }
        const decision = DECISIONES[email];
        if (decision?.role) base.role = decision.role;
        if (decision && 'warehouseId' in decision) base.warehouseId = decision.warehouseId;
        base.id = uid; // varios docs guardan su propio id dentro; que quede coherente

        grupos.push({ email, canonicoId: uid, crearCanonico: !canonico, datos: base, huerfanos: huerfanos.map(h => h.id) });
    }
    return { grupos, borrarSemilla };
}

// Cada repunte se registra como (colección, doc, campo, valor anterior) para poder
// deshacer la migración documento a documento si algo sale mal.
const bitacora: string[] = [];

async function repuntar(viejo: string, nuevo: string, writer: any): Promise<number> {
    let total = 0;
    for (const { col, campo } of REFERENCIAS) {
        let ultimo: any = null;
        for (;;) {
            let q = fs.collection(col).where(campo, '==', viejo).limit(500);
            if (ultimo) q = q.startAfter(ultimo);
            const snap = await q.get();
            if (snap.empty) break;
            for (const d of snap.docs) {
                total++;
                bitacora.push([col, d.id, campo, viejo, nuevo].join('\t'));
                if (APLICAR) writer.update(d.ref, { [campo]: nuevo });
            }
            ultimo = snap.docs[snap.docs.length - 1];
            if (snap.size < 500) break;
            // Sin --aplicar la consulta devuelve siempre lo mismo: hay que paginar igual,
            // pero como no se escribe nada, startAfter sobre el último doc avanza bien.
        }
    }
    for (const { col, campo, subcampo } of REFERENCIAS_ARRAY) {
        const snap = await fs.collection(col).get();
        for (const d of snap.docs) {
            const arr = (d.data() as any)[campo];
            if (!Array.isArray(arr)) continue;
            let tocado = false;
            const nuevoArr = arr.map((el: any) => {
                if (el && typeof el === 'object' && el[subcampo] === viejo) { tocado = true; return { ...el, [subcampo]: nuevo }; }
                return el;
            });
            if (tocado) {
                total++;
                bitacora.push([col, d.id, campo + '[].' + subcampo, viejo, nuevo].join('\t'));
                if (APLICAR) writer.update(d.ref, { [campo]: nuevoArr });
            }
        }
    }
    return total;
}

async function referenciasRestantes(id: string): Promise<number> {
    let n = 0;
    for (const { col, campo } of REFERENCIAS) n += (await fs.collection(col).where(campo, '==', id).count().get()).data().count;
    return n;
}

(async () => {
    console.log(APLICAR ? '=== APLICANDO CAMBIOS ===' : '=== DRY-RUN (usa --aplicar para ejecutar) ===\n');
    const sello = new Date().toISOString().replace(/[:.]/g, '-');

    // Respaldo íntegro de `users` antes de tocar nada: es la colección que se reescribe
    // y se borra, y son 63 documentos.
    const respaldo = (await fs.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() }));
    const rutaRespaldo = `scripts/output/users-respaldo-${sello}.json`;
    writeFileSync(rutaRespaldo, JSON.stringify(respaldo, null, 2));
    console.log(`Respaldo de users (${respaldo.length} docs): ${rutaRespaldo}\n`);

    const { grupos, borrarSemilla } = await planificar();
    const informe: string[] = [];
    const writer = fs.bulkWriter();

    for (const g of grupos) {
        console.log(`\n--- ${g.email}`);
        console.log(`    canónico: ${g.canonicoId}${g.crearCanonico ? '  (SE CREA: ningún doc coincidía con el UID)' : ''}`);
        console.log(`    rol final: ${g.datos.role}${DECISIONES[g.email] ? '  (decisión manual)' : ''}`);
        console.log(`    campos: ${Object.entries(g.datos).filter(([, v]) => !vacio(v)).map(([k]) => k).join(', ')}`);

        if (APLICAR) writer.set(fs.collection('users').doc(g.canonicoId), g.datos, { merge: true });

        for (const h of g.huerfanos) {
            const n = await repuntar(h, g.canonicoId, writer);
            console.log(`    huérfano ${h}: ${n} referencias repuntadas`);
            informe.push(`${g.email}\t${h} -> ${g.canonicoId}\t${n} refs`);
        }
    }

    if (APLICAR) {
        await writer.close();
        console.log('\nReferencias repuntadas. Verificando antes de borrar huérfanos…');
    }

    const writer2 = fs.bulkWriter();
    for (const g of grupos) {
        for (const h of g.huerfanos) {
            const restantes = APLICAR ? await referenciasRestantes(h) : 0;
            if (restantes > 0) { console.log(`    ⚠️  ${h} conserva ${restantes} referencias: NO se borra`); continue; }
            console.log(`    borrar huérfano ${h}`);
            if (APLICAR) writer2.delete(fs.collection('users').doc(h));
        }
    }
    console.log('\n--- Datos semilla (@example.com) ---');
    for (const id of borrarSemilla) {
        const restantes = await referenciasRestantes(id);
        if (restantes > 0) { console.log(`    ⚠️  ${id} tiene ${restantes} referencias: NO se borra`); continue; }
        console.log(`    borrar ${id}`);
        if (APLICAR) writer2.delete(fs.collection('users').doc(id));
    }
    if (APLICAR) await writer2.close();

    const rutaBitacora = `scripts/output/fusion-usuarios-${sello}.tsv`;
    writeFileSync(rutaBitacora, ['coleccion\tdoc\tcampo\tvalorAnterior\tvalorNuevo', ...bitacora].join('\n'));
    console.log(`\nBitácora de ${bitacora.length} repuntes: ${rutaBitacora}`);
    console.log(`Resumen:\n  ${informe.join('\n  ')}`);
    console.log(APLICAR ? '\n✅ Hecho.' : '\n(dry-run: no se escribió nada)');
})().catch(e => { console.error('ERROR:', e.message, e.stack); process.exit(1); });
