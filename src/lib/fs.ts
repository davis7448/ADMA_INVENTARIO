// Envoltorio de `firebase/firestore` que garantiza que el SERVIDOR esté autenticado
// antes de cualquier operación.
//
// Por qué existe: server actions, rutas de API y crons comparten la capa de datos con el
// navegador, que usa el SDK de cliente. En el servidor no hay sesión, así que hoy esas
// consultas funcionan solo porque la regla `isAdminAccess()` deja pasar a quien NO se
// identifica — el agujero que deja la base abierta a internet.
//
// La alternativa era añadir `await ensureServerAuth()` al principio de las 87 funciones
// exportadas de los 28 archivos que consultan Firestore. Esto lo resuelve en un punto y,
// a diferencia de lanzar el login al cargar el módulo, no deja ninguna carrera: la sesión
// se espera dentro de la propia operación.
//
// En el navegador `ensureServerAuth()` no hace nada: ahí la sesión es la del usuario.
//
// Uso: sustituir `from 'firebase/firestore'` por `from '@/lib/fs'` en los módulos que
// consulten datos. Los tipos y helpers (where, query, orderBy, Timestamp…) se re-exportan
// tal cual; solo se envuelven las funciones que tocan la red.
import * as FS from 'firebase/firestore';
import { ensureServerAuth } from './firebase-server-auth';

const conSesion = <T extends (...args: any[]) => any>(fn: T): T =>
    (async (...args: any[]) => {
        await ensureServerAuth();
        return (fn as any)(...args);
    }) as unknown as T;

export const getDoc = conSesion(FS.getDoc);
export const getDocs = conSesion(FS.getDocs);
export const setDoc = conSesion(FS.setDoc);
export const addDoc = conSesion(FS.addDoc);
export const updateDoc = conSesion(FS.updateDoc);
export const deleteDoc = conSesion(FS.deleteDoc);
export const runTransaction = conSesion(FS.runTransaction);
export const getCountFromServer = conSesion(FS.getCountFromServer);

// writeBatch no toca la red al crearse (lo hace en .commit()), pero se envuelve igual
// para que la sesión esté lista antes de encadenar operaciones.
export const writeBatch = conSesion(FS.writeBatch);

// El resto (query, where, orderBy, limit, doc, collection, Timestamp, tipos…) sin cambios.
export * from 'firebase/firestore';
