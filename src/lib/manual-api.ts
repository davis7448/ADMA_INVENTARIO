import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import type { ManualGuia } from '@/lib/manual-types';

const COL = 'manuales';

export async function getGuias(): Promise<ManualGuia[]> {
    const snap = await getDocs(collection(db, COL));
    return snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) } as ManualGuia))
        .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

export async function getGuia(slug: string): Promise<ManualGuia | null> {
    const snap = await getDoc(doc(db, COL, slug));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) } as ManualGuia;
}

export async function saveGuia(guia: ManualGuia): Promise<void> {
    const { id, ...data } = guia;
    await setDoc(doc(db, COL, guia.slug), { ...data, updatedAt: Date.now() }, { merge: true });
}
