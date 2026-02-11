import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cargar credenciales de Firebase
const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, '../studio-9748962172-82b35-firebase-adminsdk-fbsvc-0ab934a6b7.json'), 'utf8')
);

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function updateModificacionesWithPais() {
    console.log('🔄 Iniciando actualización de modificaciones con país...\n');

    const modificacionesRef = db.collection('modificaciones');
    const snapshot = await modificacionesRef.get();
    
    console.log(`📊 Total de modificaciones encontradas: ${snapshot.size}\n`);

    let updated = 0;
    let skipped = 0;
    let batchCount = 0;
    let batch = db.batch();

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Verificar si PAIS está vacío o undefined
        if (!data.PAIS || data.PAIS === '' || data.PAIS === null || data.PAIS === undefined) {
            console.log(`✏️  Actualizando: ${docSnap.id} - ${data.PRODUCTO || 'Sin nombre'}`);
            
            batch.update(docSnap.ref, { PAIS: 'Colombia' });
            updated++;
            batchCount++;
        } else {
            skipped++;
        }

        // Ejecutar batch cada 500 operaciones
        if (batchCount >= 500) {
            try {
                await batch.commit();
                console.log(`   📦 Batch de ${batchCount} operaciones ejecutado`);
            } catch (error) {
                console.error(`   ❌ Error en batch:`, error);
            }
            batch = db.batch();
            batchCount = 0;
        }
    }

    // Ejecutar batch final si hay cambios pendientes
    if (batchCount > 0) {
        try {
            await batch.commit();
            console.log(`   📦 Batch final de ${batchCount} operaciones ejecutado`);
        } catch (error) {
            console.error(`   ❌ Error en batch final:`, error);
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
