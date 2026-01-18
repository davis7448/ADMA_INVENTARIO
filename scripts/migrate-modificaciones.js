const admin = require('firebase-admin');
const serviceAccount = require('../studio-9748962172-82b35-firebase-adminsdk-fbsvc-0ab934a6b7.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://adma-inventario.firebaseio.com'
});

const db = admin.firestore();

async function migrateModificaciones() {
  const collectionRef = db.collection('modificaciones');
  const snapshot = await collectionRef.get();

  const batchSize = 500;
  let batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let needsUpdate = false;
    const newData = { ...data };

    if (data['PRIVADO/PUBLICO'] !== undefined) {
      delete newData['PRIVADO/PUBLICO'];
      newData['PRIVADO_PUBLICO'] = data['PRIVADO/PUBLICO'];
      needsUpdate = true;
    }

    if (data['CORREO/CODIGO'] !== undefined) {
      delete newData['CORREO/CODIGO'];
      newData['CORREO_CODIGO'] = data['CORREO/CODIGO'];
      needsUpdate = true;
    }

    if (needsUpdate) {
      batch.set(doc.ref, newData);
      count++;

      if (count % batchSize === 0) {
        await batch.commit();
        batch = db.batch();
        console.log(`Migrated ${count} documents`);
      }
    }
  }

  if (count % batchSize !== 0) {
    await batch.commit();
  }

  console.log(`Migration completed. Total documents migrated: ${count}`);
}

migrateModificaciones().catch(console.error);