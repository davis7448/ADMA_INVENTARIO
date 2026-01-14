const admin = require('firebase-admin');
const serviceAccount = require('../studio-9748962172-82b35-firebase-adminsdk-fbsvc-0ab934a6b7.json');
const data = require('../src/data/modificaciones-data.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://adma-inventario.firebaseio.com'
});

const db = admin.firestore();

async function seedModificaciones() {
  const batchSize = 500;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = db.batch();
    const chunk = data.slice(i, i + batchSize);
    chunk.forEach((item) => {
      const docRef = db.collection('modificaciones').doc();
      batch.set(docRef, item);
    });
    await batch.commit();
    console.log(`Seeded ${i + chunk.length} records`);
  }
  console.log('Data seeded successfully');
}

seedModificaciones().catch(console.error);