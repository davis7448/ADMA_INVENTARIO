// Encola un archivo grande para procesarse en el servidor/VPS. El navegador SOLO
// sube el archivo a Storage (transferencia, no lo parsea → no colapsa) y registra
// la importación pendiente. El procesador del VPS la baja, parsea e importa.
import { db } from '@/lib/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from '@/lib/fs';
import { v4 as uuidv4 } from 'uuid';

export async function queueLargeImport(
    file: File,
    meta: { platform: string; bodega?: string; pais?: string; uploadedBy?: string },
): Promise<string> {
    const storage = getStorage();
    const ext = file.name.split('.').pop() || 'xlsx';
    const path = `imports/${meta.platform.toLowerCase().replace(/[^a-z0-9]+/g, '_')}/${uuidv4()}.${ext}`;
    const r = ref(storage, path);
    await uploadBytes(r, file, { contentType: file.type || 'application/octet-stream' });
    const downloadUrl = await getDownloadURL(r);
    const docRef = await addDoc(collection(db, 'pendingImports'), {
        platform: meta.platform,
        bodega: meta.bodega || null,
        pais: meta.pais || null,
        storagePath: path,
        downloadUrl,
        fileName: file.name,
        fileSize: file.size,
        status: 'pending',
        createdAt: Date.now(),
        uploadedBy: meta.uploadedBy || null,
    });
    return docRef.id;
}
