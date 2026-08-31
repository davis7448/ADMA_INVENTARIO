// Carga masiva de clientes al CRM comercial desde un Excel de base de datos de
// dropshippers (el export de la tabla dinámica de Dropi, con una fila por
// dropshipper y una columna COMERCIAL que dice a quién pertenece).
//
// Existe el importador de la UI (/commercial/crm/import), pero ese sube UN archivo
// por comercial y hay que seleccionarlo a mano. Estas bases vienen mezcladas: una
// sola hoja con varios comerciales. Este script hace el reparto solo, replicando
// exactamente la lógica de createClient/checkClientExists de src/lib/commercial-api.ts
// (claves de teléfono, evento 'registered', deduplicación por correo y teléfono).
//
// Todo lo que crea queda marcado con `import_batch`, para poder auditarlo o
// revertirlo después sin adivinar qué entró en esta corrida.
//
// Uso:
//   npx tsx scripts/importar-clientes-crm.ts --archivo=<ruta.xlsx> --dry-run   → solo informa
//   npx tsx scripts/importar-clientes-crm.ts --archivo=<ruta.xlsx>             → aplica
//
// Opciones:
//   --lote=<nombre>            nombre del import_batch (default: fecha del día)
//   --comercial=MAYI=<userId>  fija a mano el usuario de un comercial ambiguo
//                              (repetible; necesario si el nombre no resuelve solo)
//   --reasignar                además de crear, mueve al comercial que dice la base
//                              las fichas que ya existen y están con otro. Sin este
//                              flag las fichas existentes NO se tocan.
//   --listar-comerciales       lista los usuarios comerciales con su cartera y sale
//                              (para averiguar el userId de un nombre que no resuelve)
import { config } from 'dotenv'; config({ path: '.env.local' });
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { writeFileSync, mkdirSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { claveTelefono } from '../src/lib/telefono';

const DRY = process.argv.includes('--dry-run');
// Mover la cartera de un comercial a otro no es parte de "importar": es una decisión
// aparte y se pide aparte. Por defecto las fichas existentes se saltan y ya.
const REASIGNAR = process.argv.includes('--reasignar');
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const ARCHIVO = arg('archivo');
const LOTE = arg('lote') || `base-dropshippers-${new Date().toISOString().slice(0, 10)}`;

// Overrides --comercial=NOMBRE=userId
const OVERRIDES = new Map<string, string>();
for (const a of process.argv.filter(a => a.startsWith('--comercial='))) {
    const [, nombre, id] = a.split('=');
    if (nombre && id) OVERRIDES.set(nombre.trim().toUpperCase(), id.trim());
}

const LISTAR = process.argv.includes('--listar-comerciales');
const BUSCAR = arg('buscar-usuario');

if (!ARCHIVO && !LISTAR && !BUSCAR) {
    console.error('Falta --archivo=<ruta.xlsx>');
    process.exit(1);
}

// Valores que la base no trae y hay que fijar. Se dejan aquí arriba y no repartidos
// por el código porque son la decisión de negocio de esta carga, no un detalle técnico.
const CATEGORIA = 'chino';        // línea de producto importado
const TIPO = 'dropshipper';
const ESTADO = 'finding_winner';  // nadie sabe todavía en qué punto está cada uno
const PAIS = 'COLOMBIA';          // base de Dropi Colombia, celulares 3XXXXXXXXX
// La ciudad NO se inventa: la base no la trae y poner "Cali" a 475 fichas es un dato
// falso que después nadie distingue de uno real.
const CIUDAD = '';

if (!getApps().length) initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
});
const fs = getFirestore();

// ─── Lectura del Excel ─────────────────────────────────────────────────────

interface FilaCruda {
    fila: number;
    nombre: string;
    email: string;
    celular: string;
    telefonoTienda: string;
    comercial: string;
}

const limpiar = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = String(v).trim();
    // La tabla dinámica escribe "(en blanco)" donde no hay dato.
    return /^\(en blanco\)$/i.test(s) || s.toLowerCase() === 'none' ? '' : s;
};

// Los celulares llegan a veces como número: "3105342872.0". Se guardan solo los dígitos.
const limpiarTelefono = (v: unknown): string => limpiar(v).replace(/\.0$/, '').replace(/\D/g, '');

function leerExcel(ruta: string): FilaCruda[] {
    const wb = XLSX.readFile(ruta);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

    // El encabezado no está siempre en la primera fila: el export de tabla dinámica
    // mete filas de filtros arriba. Se busca la que tenga DROPSHIPPER.
    const iHdr = raw.findIndex(r => r?.some(c => limpiar(c).toUpperCase() === 'DROPSHIPPER'));
    if (iHdr === -1) throw new Error('No se encontró la fila de encabezados (falta la columna DROPSHIPPER)');

    const hdr = raw[iHdr].map(c => limpiar(c).toUpperCase());
    const col = (nombre: string) => hdr.indexOf(nombre);
    const iNombre = col('DROPSHIPPER'), iCel = col('CELULAR'), iMail = col('EMAIL'), iCom = col('COMERCIAL');
    const iTienda = col('TELEFONO TIENDA');
    for (const [n, i] of [['DROPSHIPPER', iNombre], ['CELULAR', iCel], ['EMAIL', iMail], ['COMERCIAL', iCom]] as const) {
        if (i === -1) throw new Error(`Falta la columna ${n} en el archivo`);
    }

    return raw.slice(iHdr + 1)
        .map((r, i) => ({
            fila: iHdr + 2 + i,
            nombre: limpiar(r?.[iNombre]),
            email: limpiar(r?.[iMail]).toLowerCase(),
            celular: limpiarTelefono(r?.[iCel]),
            telefonoTienda: iTienda === -1 ? '' : limpiarTelefono(r?.[iTienda]),
            comercial: limpiar(r?.[iCom]).toUpperCase(),
        }))
        .filter(f => f.nombre || f.email || f.celular);
}

// ─── Resolución de comerciales ─────────────────────────────────────────────

interface Comercial { id: string; nombre: string }

// El Excel trae el comercial por su nombre de pila en mayúsculas ("MAYI"). Hay que
// convertirlo al usuario real. No se adivina: si un nombre da 0 o varias opciones
// válidas, el script se detiene y las lista para resolverlo con --comercial=.
async function resolverComerciales(nombres: string[]): Promise<Map<string, Comercial>> {
    const snap = await fs.collection('users').get();
    const usuarios = snap.docs.map(d => ({
        id: d.id,
        nombre: String(d.get('name') || ''),
        email: String(d.get('email') || ''),
        rol: String(d.get('role') || ''),
    }));

    // Cuántos clientes tiene ya cada usuario: es el desempate cuando el mismo correo
    // tiene dos documentos de usuario (pasa, ver fusionar-usuarios-duplicados.ts).
    const clientes = await fs.collection('clients').get();
    const conClientes = new Map<string, number>();
    for (const d of clientes.docs) {
        const id = String(d.get('assigned_commercial_id') || '');
        if (id) conClientes.set(id, (conClientes.get(id) || 0) + 1);
    }

    const mapa = new Map<string, Comercial>();
    const problemas: string[] = [];

    for (const nombre of nombres) {
        const forzado = OVERRIDES.get(nombre);
        if (forzado) {
            const u = usuarios.find(x => x.id === forzado);
            if (!u) { problemas.push(`${nombre}: el userId forzado ${forzado} no existe`); continue; }
            mapa.set(nombre, { id: u.id, nombre: u.nombre || u.email });
            console.log(`  ${nombre.padEnd(10)} → ${u.nombre || u.email} (${u.id}) [forzado]`);
            continue;
        }

        const esComercial = (r: string) => r === 'commercial' || r === 'commercial_director';
        let candidatos = usuarios.filter(u =>
            esComercial(u.rol) &&
            (u.nombre.toUpperCase().split(/\s+/).includes(nombre) || u.email.toUpperCase().startsWith(nombre))
        );

        // Si hay varios, se prefiere el que ya tiene cartera: el duplicado sin clientes
        // es el documento muerto.
        if (candidatos.length > 1) {
            const conCartera = candidatos.filter(u => (conClientes.get(u.id) || 0) > 0);
            if (conCartera.length === 1) candidatos = conCartera;
        }

        if (candidatos.length !== 1) {
            const detalle = usuarios
                .filter(u => u.nombre.toUpperCase().includes(nombre) || u.email.toUpperCase().includes(nombre))
                .map(u => `      ${u.id} | ${u.nombre} | ${u.email} | rol=${u.rol} | clientes=${conClientes.get(u.id) || 0}`);
            problemas.push(
                `${nombre}: ${candidatos.length} coincidencias con rol comercial.\n` +
                (detalle.length ? `    Usuarios que contienen el nombre:\n${detalle.join('\n')}` : '    Ningún usuario contiene ese nombre.') +
                `\n    Resolver con --comercial=${nombre}=<userId>`
            );
            continue;
        }

        const u = candidatos[0];
        mapa.set(nombre, { id: u.id, nombre: u.nombre || u.email });
        console.log(`  ${nombre.padEnd(10)} → ${u.nombre || u.email} (${u.id}) | ya tiene ${conClientes.get(u.id) || 0} clientes`);
    }

    if (problemas.length) {
        console.error('\nNo se pudo resolver a qué usuario corresponde cada comercial:\n');
        problemas.forEach(p => console.error(`  - ${p}`));
        throw new Error('Comerciales sin resolver: no se importa nada hasta que estén todos.');
    }

    return mapa;
}

// ─── Deduplicación ─────────────────────────────────────────────────────────
// Mismo criterio que checkClientExists: coincide por correo (principal o adicional)
// o por clave de teléfono (principal o adicional). Se arma un índice en memoria de
// una sola pasada porque son ~475 consultas y hacerlas sueltas es una lectura por fila.

interface FichaExistente {
    id: string; nombre: string; comercial: string; comercialId: string;
    categoria: string; estado: string; ultimoEvento: number;
}
interface Indice {
    porEmail: Map<string, FichaExistente>;
    porTelefono: Map<string, FichaExistente>;
}

async function construirIndice(): Promise<Indice> {
    const snap = await fs.collection('clients').get();
    const porEmail: Indice['porEmail'] = new Map();
    const porTelefono: Indice['porTelefono'] = new Map();

    for (const d of snap.docs) {
        const ref: FichaExistente = {
            id: d.id,
            nombre: String(d.get('name') || ''),
            comercial: String(d.get('assigned_commercial_name') || 'sin comercial'),
            comercialId: String(d.get('assigned_commercial_id') || ''),
            // La categoría de la ficha existente es lo que dice si el cliente ya está
            // en el CRM por la línea de laboratorio o por la de importado.
            categoria: String(d.get('category') || 'sin categoria'),
            estado: String(d.get('status') || ''),
            ultimoEvento: Number(d.get('last_event_number') || 0),
        };
        const correos = [String(d.get('email') || ''), ...(d.get('additional_emails') || [])];
        for (const c of correos) {
            const k = String(c || '').trim().toLowerCase();
            if (k && !porEmail.has(k)) porEmail.set(k, ref);
        }
        const claves = [d.get('phone_key'), ...(d.get('additional_phone_keys') || [])];
        for (const c of claves) {
            const k = String(c || '').trim();
            if (k && !porTelefono.has(k)) porTelefono.set(k, ref);
        }
    }
    console.log(`Índice de duplicados: ${snap.size} clientes | ${porEmail.size} correos | ${porTelefono.size} claves de teléfono`);
    return { porEmail, porTelefono };
}

// ─── Principal ─────────────────────────────────────────────────────────────

type Estado = 'crear' | 'reasignar' | 'duplicado' | 'descartado';
interface Resultado {
    fila: number; nombre: string; email: string; comercial: string; estado: Estado; motivo: string;
    // Solo para los duplicados: cómo está hoy la ficha que ya existe.
    fichaId?: string; fichaComercial?: string; fichaCategoria?: string; coincidioPor?: string;
}

// Lista los usuarios comerciales con su cartera. Es lo que hace falta para completar
// un --comercial=NOMBRE=<userId> cuando el nombre del Excel no coincide con ninguno.
async function listarComerciales() {
    const [usuarios, clientes] = await Promise.all([
        fs.collection('users').get(),
        fs.collection('clients').get(),
    ]);
    const cartera = new Map<string, number>();
    for (const d of clientes.docs) {
        const id = String(d.get('assigned_commercial_id') || '');
        if (id) cartera.set(id, (cartera.get(id) || 0) + 1);
    }
    const filas = usuarios.docs
        .filter(d => ['commercial', 'commercial_director'].includes(String(d.get('role') || '')))
        .map(d => ({ id: d.id, nombre: String(d.get('name') || ''), email: String(d.get('email') || ''), rol: String(d.get('role') || ''), clientes: cartera.get(d.id) || 0 }))
        .sort((a, b) => b.clientes - a.clientes);

    console.log(`\nUsuarios con rol comercial: ${filas.length}\n`);
    for (const f of filas) console.log(`  ${f.id.padEnd(30)} | ${f.nombre.padEnd(28)} | ${f.email.padEnd(38)} | ${f.rol.padEnd(20)} | ${f.clientes} clientes`);

    // Las fichas guardan el nombre del comercial denormalizado. Si el mismo id aparece
    // con dos nombres, o un nombre con dos ids, la cartera está partida y hay que
    // saberlo ANTES de importar: si no, la carga la parte todavía más.
    const pares = new Map<string, number>();
    for (const d of clientes.docs) {
        const k = `${String(d.get('assigned_commercial_id') || '(sin id)')}\t${String(d.get('assigned_commercial_name') || '(sin nombre)')}`;
        pares.set(k, (pares.get(k) || 0) + 1);
    }
    console.log(`\nCómo están firmadas las fichas existentes (id + nombre guardado):\n`);
    for (const [k, n] of [...pares].sort((a, b) => b[1] - a[1])) {
        const [id, nombre] = k.split('\t');
        const existe = usuarios.docs.some(d => d.id === id);
        console.log(`  ${String(n).padStart(4)}  ${id.padEnd(30)} | ${nombre}${existe ? '' : '   ← ese usuario ya no existe'}`);
    }
}

// Busca un usuario por nombre o correo SIN filtrar por rol: sirve para encontrar a
// alguien que trabaja como comercial pero tiene otro rol en su ficha de usuario.
async function buscarUsuario(texto: string) {
    const t = texto.toLowerCase();
    const [usuarios, clientes] = await Promise.all([
        fs.collection('users').get(),
        fs.collection('clients').get(),
    ]);
    const cartera = new Map<string, number>();
    for (const d of clientes.docs) {
        const id = String(d.get('assigned_commercial_id') || '');
        if (id) cartera.set(id, (cartera.get(id) || 0) + 1);
    }
    console.log(`\nUsuarios que coinciden con "${texto}":\n`);
    for (const d of usuarios.docs) {
        const n = String(d.get('name') || ''), e = String(d.get('email') || '');
        if (!n.toLowerCase().includes(t) && !e.toLowerCase().includes(t)) continue;
        console.log(`  ${d.id.padEnd(30)} | ${n.padEnd(26)} | ${e.padEnd(38)} | rol=${String(d.get('role') || '(sin rol)').padEnd(20)} | ${cartera.get(d.id) || 0} clientes`);
    }
}

async function main() {
    if (BUSCAR) return buscarUsuario(BUSCAR);
    if (LISTAR) return listarComerciales();

    console.log(`\n${DRY ? '[DRY-RUN] ' : ''}Importación de clientes al CRM`);
    console.log(`Archivo: ${ARCHIVO}`);
    console.log(`Lote:    ${LOTE}\n`);

    const filas = leerExcel(ARCHIVO!);
    console.log(`Filas leídas: ${filas.length}\n`);

    const resultados: Resultado[] = [];
    const utiles = filas.filter(f => {
        const motivo =
            !f.comercial ? 'sin comercial asignado en la base'
            : /^TOTAL GENERAL$/i.test(f.nombre) ? 'fila de totales de la tabla dinámica'
            : !f.nombre ? 'sin nombre'
            : !f.email ? 'sin correo'
            : !f.celular ? 'sin celular'
            : '';
        if (motivo) {
            resultados.push({ fila: f.fila, nombre: f.nombre, email: f.email, comercial: f.comercial, estado: 'descartado', motivo });
            return false;
        }
        return true;
    });

    console.log('Comerciales encontrados en la base:');
    const nombresComerciales = [...new Set(utiles.map(f => f.comercial))].sort();
    const comerciales = await resolverComerciales(nombresComerciales);
    console.log('');

    const indice = await construirIndice();

    // Duplicados dentro del propio archivo: la segunda aparición no se crea.
    const vistosEmail = new Set<string>();
    const vistosTel = new Set<string>();

    const aCrear: Array<{ f: FilaCruda; com: Comercial }> = [];
    const aReasignar: Array<{ f: FilaCruda; com: Comercial; ficha: FichaExistente }> = [];
    for (const f of utiles) {
        const clave = claveTelefono(f.celular);
        const yaEmail = indice.porEmail.get(f.email);
        const yaTel = clave ? indice.porTelefono.get(clave) : undefined;
        const ya = yaEmail || yaTel;

        if (ya) {
            const destino = comerciales.get(f.comercial)!;
            const comun = {
                fila: f.fila, nombre: f.nombre, email: f.email, comercial: f.comercial,
                fichaId: ya.id, fichaComercial: ya.comercial, fichaCategoria: ya.categoria,
                coincidioPor: (yaEmail ? 'correo' : 'teléfono') as string,
            };
            const yaEsSuyo = ya.comercialId === destino.id;

            if (!yaEsSuyo && REASIGNAR) {
                aReasignar.push({ f, com: destino, ficha: ya });
                resultados.push({
                    ...comun, estado: 'reasignar',
                    motivo: `pasa de ${ya.comercial} a ${destino.nombre}` +
                        (ya.categoria !== CATEGORIA ? ` y de categoría ${ya.categoria || 'sin categoría'} a ${CATEGORIA}` : ''),
                });
            } else {
                resultados.push({
                    ...comun, estado: 'duplicado',
                    motivo: yaEsSuyo ? `ya existe como "${ya.nombre}" y ya es de este comercial`
                                     : `ya existe como "${ya.nombre}" con otro comercial (usar --reasignar para moverla)`,
                });
            }
            continue;
        }
        if (vistosEmail.has(f.email) || (clave && vistosTel.has(clave))) {
            resultados.push({
                fila: f.fila, nombre: f.nombre, email: f.email, comercial: f.comercial, estado: 'duplicado',
                motivo: 'repetido dentro del mismo archivo',
            });
            continue;
        }

        vistosEmail.add(f.email);
        if (clave) vistosTel.add(clave);
        aCrear.push({ f, com: comerciales.get(f.comercial)! });
        resultados.push({ fila: f.fila, nombre: f.nombre, email: f.email, comercial: f.comercial, estado: 'crear', motivo: '' });
    }

    // ── Resumen ──
    const porComercial = new Map<string, number>();
    for (const { f } of aCrear) porComercial.set(f.comercial, (porComercial.get(f.comercial) || 0) + 1);

    console.log('\n─────────────────────────────────────────');
    console.log(`Por crear:    ${aCrear.length}`);
    for (const [c, n] of [...porComercial].sort()) console.log(`    ${c.padEnd(10)} ${n}`);
    if (REASIGNAR) {
        const porCom = new Map<string, number>();
        for (const { f } of aReasignar) porCom.set(f.comercial, (porCom.get(f.comercial) || 0) + 1);
        console.log(`Por reasignar: ${aReasignar.length}`);
        for (const [c, n] of [...porCom].sort()) console.log(`    ${c.padEnd(10)} ${n}`);
        const cambianCategoria = aReasignar.filter(r => r.ficha.categoria !== CATEGORIA).length;
        console.log(`    (${cambianCategoria} de ellas además cambian de categoría a "${CATEGORIA}")`);
    }
    console.log(`Duplicados:   ${resultados.filter(r => r.estado === 'duplicado').length}`);
    console.log(`Descartados:  ${resultados.filter(r => r.estado === 'descartado').length}`);
    for (const r of resultados.filter(r => r.estado === 'descartado')) {
        console.log(`    fila ${r.fila}: ${r.nombre || '(sin nombre)'} — ${r.motivo}`);
    }
    console.log('─────────────────────────────────────────\n');

    // ── Escritura ──
    if (DRY) {
        console.log('Dry-run: no se escribió nada en Firestore.');
    } else if (aCrear.length || aReasignar.length) {
        // Cada cliente son 2 escrituras (ficha + evento 'registered'); el batch de
        // Firestore admite 500, así que se cortan de a 200 fichas.
        const TAMANO = 200;
        let creados = 0;
        for (let i = 0; i < aCrear.length; i += TAMANO) {
            const trozo = aCrear.slice(i, i + TAMANO);
            const batch = fs.batch();

            for (const { f, com } of trozo) {
                const ref = fs.collection('clients').doc();
                // El teléfono de la tienda entra como adicional solo si es otro número.
                const adicionales = f.telefonoTienda && f.telefonoTienda !== f.celular ? [f.telefonoTienda] : [];

                batch.set(ref, {
                    name: f.nombre,
                    email: f.email,
                    additional_emails: [],
                    phone: f.celular,
                    additional_phones: adicionales,
                    phone_key: claveTelefono(f.celular),
                    additional_phone_keys: adicionales.map(claveTelefono).filter(Boolean),
                    birthday: null,
                    category: CATEGORIA,
                    type: TIPO,
                    status: ESTADO,
                    avg_sales: 0,
                    city: CIUDAD,
                    country: PAIS,
                    assigned_commercial_id: com.id,
                    assigned_commercial_name: com.nombre,
                    // Se marca como carga masiva y NO como alta de un comercial: si se
                    // atribuyera a una persona, las métricas de "clientes agregados"
                    // contarían 475 altas que nadie hizo.
                    created_by: `import:${LOTE}`,
                    created_by_name: 'IMPORTACIÓN MASIVA',
                    import_batch: LOTE,
                    import_source: ARCHIVO!.split('/').pop(),
                    last_event_number: 1,
                    created_at: FieldValue.serverTimestamp(),
                    updated_at: FieldValue.serverTimestamp(),
                });

                batch.set(fs.collection('client_events').doc(), {
                    clientId: ref.id,
                    type: 'registered',
                    description: `Cliente cargado desde la base de datos de dropshippers (lote ${LOTE})`,
                    details: `Comercial asignado: ${com.nombre}`,
                    event_number: 1,
                    created_at: FieldValue.serverTimestamp(),
                    created_by: `import:${LOTE}`,
                    created_by_name: 'IMPORTACIÓN MASIVA',
                });
            }

            await batch.commit();
            creados += trozo.length;
            console.log(`  ${creados}/${aCrear.length} creados`);
        }
        if (creados) console.log(`\nCreados: ${creados} clientes con import_batch="${LOTE}".`);

        // ── Reasignaciones ──
        // Se guarda de dónde venía cada ficha (comercial y categoría anteriores) en el
        // mismo documento. Sin eso, revertir esto sería reconstruirlo de memoria.
        let movidos = 0;
        for (let i = 0; i < aReasignar.length; i += TAMANO) {
            const trozo = aReasignar.slice(i, i + TAMANO);
            const batch = fs.batch();

            for (const { f, com, ficha } of trozo) {
                const ref = fs.collection('clients').doc(ficha.id);
                const evento = ficha.ultimoEvento + 1;
                const cambiaCategoria = ficha.categoria !== CATEGORIA;

                batch.update(ref, {
                    assigned_commercial_id: com.id,
                    assigned_commercial_name: com.nombre,
                    ...(cambiaCategoria ? { category: CATEGORIA } : {}),
                    reasignacion_previa: {
                        lote: LOTE,
                        comercial_id: ficha.comercialId,
                        comercial_nombre: ficha.comercial,
                        categoria: ficha.categoria,
                        fecha: FieldValue.serverTimestamp(),
                    },
                    last_event_number: evento,
                    updated_at: FieldValue.serverTimestamp(),
                });

                batch.set(fs.collection('client_events').doc(), {
                    clientId: ficha.id,
                    type: 'edit',
                    description: `Reasignado de ${ficha.comercial} a ${com.nombre} según la base de dropshippers (lote ${LOTE})`,
                    details: cambiaCategoria
                        ? `Categoría cambiada de "${ficha.categoria || 'sin categoría'}" a "${CATEGORIA}". Fila ${f.fila} del archivo.`
                        : `Fila ${f.fila} del archivo.`,
                    event_number: evento,
                    created_at: FieldValue.serverTimestamp(),
                    created_by: `import:${LOTE}`,
                    created_by_name: 'IMPORTACIÓN MASIVA',
                });
            }

            await batch.commit();
            movidos += trozo.length;
            console.log(`  ${movidos}/${aReasignar.length} reasignados`);
        }
        if (movidos) console.log(`Reasignados: ${movidos} clientes (los valores anteriores quedaron en el campo reasignacion_previa).`);
    } else {
        console.log('No hay nada que crear.');
    }

    // ── Reporte ──
    mkdirSync('logs', { recursive: true });
    const salida = `logs/import-clientes-${LOTE}${DRY ? '-dryrun' : ''}.csv`;
    const csv = ['fila,nombre,email,base_dice_comercial,estado,motivo,ficha_id,ficha_comercial,ficha_categoria,coincidio_por']
        .concat(resultados
            .sort((a, b) => a.fila - b.fila)
            .map(r => [r.fila, r.nombre, r.email, r.comercial, r.estado, r.motivo,
                       r.fichaId ?? '', r.fichaComercial ?? '', r.fichaCategoria ?? '', r.coincidioPor ?? '']
                .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')))
        .join('\n');
    writeFileSync(salida, csv);
    console.log(`Reporte fila por fila: ${salida}`);
}

main().then(() => process.exit(0)).catch(e => { console.error('\n' + e.message); process.exit(1); });
