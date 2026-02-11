import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

async function updateModificacionesWithPais() {
    console.log('🔄 Iniciando actualización de modificaciones con país...\n');

    const modificacionesRef = collection(db, 'modificaciones');
    const snapshot = await getDocs(modificacionesRef);
    
    console.log(`📊 Total de modificaciones encontradas: ${snapshot.size}\n`);

    let updated = 0;
    let skipped = 0;

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Verificar si PAIS está vacío o undefined
        if (!data.PAIS || data.PAIS === '' || data.PAIS === null || data.PAIS === undefined) {
            console.log(`✏️  Actualizando: ${docSnap.id} - ${data.PRODUCTO || 'Sin nombre'}`);
            
            await updateDoc(doc(modificacionesRef, docSnap.id), {
                PAIS: 'Colombia'
            });
            
            updated++;
        } else {
            skipped++;
        }
    }

    console.log(`\n✅ Actualización completada!`);
    console.log(`   - Modificaciones actualizadas: ${updated}`);
    console.log(`   - Modificaciones saltadas (ya tenían país): ${skipped}`);
}

updateModificacionesWithPais()
    .then(() => {
        console.log('\n🎉 Script finalizado exitosamente!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error ejecutando script:', error);
        process.exit(1);
    });
