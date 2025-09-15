
/**
 * This is a script to seed the Firestore database with initial data.
 * Run it with `npm run seed`.
 * 
 * Make sure your Firebase project has a Firestore database created.
 * Also, ensure your Security Rules allow writes from a server environment,
 * or run this script with appropriate admin credentials.
 * For development, it's common to have open write rules.
 * 
 * Example Firestore security rule for development (DO NOT USE IN PRODUCTION):
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /{document=**} {
 *       allow read, write: if true;
 *     }
 *   }
 * }
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './firebase';

import products from './seed-data/products.json';
import suppliers from './seed-data/suppliers.json';
import categories from './seed-data/categories.json';
import users from './seed-data/users.json';
import inventoryMovements from './seed-data/inventory-movements.json';

// Initialize Firebase Admin SDK
const app = getApps().length
  ? getApps()[0]
  : initializeApp({ projectId: firebaseConfig.projectId });

const db = getFirestore(app);

async function seedCollection<T extends { id: string }>(collectionName: string, data: T[]) {
  console.log(`Seeding ${collectionName}...`);
  const collectionRef = db.collection(collectionName);
  const batch = db.batch();

  // Clear existing documents
  const snapshot = await collectionRef.get();
  if (!snapshot.empty) {
    console.log(`Deleting existing documents in ${collectionName}...`);
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`Deleted ${snapshot.size} documents.`);
  }

  // Add new documents with specified IDs
  const newBatch = db.batch();
  data.forEach((item) => {
    const { id, ...rest } = item;
    const docRef = collectionRef.doc(id);
    newBatch.set(docRef, rest);
  });
  
  await newBatch.commit();
  console.log(`Seeded ${data.length} documents into ${collectionName}.`);
}

async function seedInventoryMovements() {
    console.log('Seeding inventoryMovements...');
    const collectionRef = db.collection('inventoryMovements');
    const batch = db.batch();

    // Clear existing
    const snapshot = await collectionRef.get();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Add new with random dates
    const newBatch = db.batch();
    inventoryMovements.forEach((movement) => {
        const docRef = collectionRef.doc();
        const randomDaysAgo = Math.floor(Math.random() * 30);
        const date = new Date();
        date.setDate(date.getDate() - randomDaysAgo);

        newBatch.set(docRef, { ...movement, date });
    });

    await newBatch.commit();
    console.log(`Seeded ${inventoryMovements.length} documents into inventoryMovements.`);
}

async function main() {
  try {
    await seedCollection('products', products);
    await seedCollection('suppliers', suppliers);
    await seedCollection('categories', categories);
    await seedCollection('users', users);
    await seedInventoryMovements();
    
    console.log('\nDatabase seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

main();
