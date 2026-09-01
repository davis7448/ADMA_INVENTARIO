// Imágenes de referencia que sube el cliente en el formulario público.
//
// Storage es aquí un BUZÓN DE PASO, no el archivo final: los ficheros esperan a que
// alguien mande la cotización a ClickUp, se adjuntan a la tarea y se borran de Storage.
// Así acaban donde ya viven los demás adjuntos del equipo y no se quedan en un bucket
// cuyas reglas hoy son de lectura pública (storage.rules: `allow read: if true`).
//
// Se escribe con el ADMIN SDK, que no pasa por esas reglas: quien sube es un visitante
// anónimo y no debe tener permiso de escritura sobre el bucket.
import { getStorage } from 'firebase-admin/storage';
import { getApp } from '@/lib/firebase-admin';

const BUCKET = 'studio-9748962172-82b35.firebasestorage.app';
const PREFIJO = 'quoteReferences';

// Límites: la ruta es pública y sin sesión, así que no puede aceptar lo que sea.
export const MAX_ARCHIVOS = 5;
export const MAX_BYTES = 8 * 1024 * 1024;
export const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'application/pdf'];

export type Referencia = { path: string; nombre: string; tipo: string };

// Un nombre de fichero del cliente no puede decidir la ruta en el bucket.
function nombreSeguro(nombre: string): string {
    return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'archivo';
}

async function bucket() {
    return getStorage(await getApp()).bucket(BUCKET);
}

export async function guardarReferencias(cotizacionId: string, archivos: File[]): Promise<Referencia[]> {
    const b = await bucket();
    const guardadas: Referencia[] = [];
    for (const [i, archivo] of archivos.entries()) {
        const path = `${PREFIJO}/${cotizacionId}/${i}-${nombreSeguro(archivo.name)}`;
        const buffer = Buffer.from(await archivo.arrayBuffer());
        await b.file(path).save(buffer, { contentType: archivo.type, resumable: false });
        guardadas.push({ path, nombre: archivo.name, tipo: archivo.type });
    }
    return guardadas;
}

// Las devuelve como File para poder pasarlas tal cual a uploadAttachmentsToTask().
export async function leerReferencias(referencias: Referencia[]): Promise<File[]> {
    const b = await bucket();
    const archivos: File[] = [];
    for (const r of referencias) {
        try {
            const [buffer] = await b.file(r.path).download();
            archivos.push(new File([new Uint8Array(buffer)], r.nombre, { type: r.tipo }));
        } catch (e) {
            console.error(`[referencias] no se pudo leer ${r.path}:`, e);
        }
    }
    return archivos;
}

// Se llama tras adjuntarlas en ClickUp. Un fallo aquí no es grave —queda un fichero
// huérfano— así que no interrumpe la sincronización.
export async function borrarReferencias(referencias: Referencia[]): Promise<void> {
    const b = await bucket();
    await Promise.all(referencias.map(r =>
        b.file(r.path).delete().catch(e => console.error(`[referencias] no se pudo borrar ${r.path}:`, e))
    ));
}
