

/**
 * This is a script to seed the Firestore database with initial data.
 * Run it with `npm run seed`.
 * 
 * IMPORTANT: This script ONLY seeds the Firestore database. You must create
 * users manually in the Firebase Authentication console.
 */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './firebase';

import products from './seed-data/products.json';
import suppliers from './seed-data/suppliers.json';
import categories from './seed-data/categories.json';
import users from './seed-data/users.json';
import inventoryMovements from './seed-data/inventory-movements.json';
import rotationCategories from './seed-data/rotation-categories.json';

// Initialize Firebase Admin SDK
const app: App = getApps().length
  ? getApps()[0]!
  : initializeApp();

const db = getFirestore(app);

async function seedCollection<T extends { id: string }>(collectionName: string, data: T[]) {
  console.log(`Seeding ${collectionName}...`);
  const collectionRef = db.collection(collectionName);
  const batch = db.batch();

  data.forEach((item) => {
    const { id, ...rest } = item;
    const docRef = collectionRef.doc(id);
    batch.set(docRef, rest);
  });
  
  await batch.commit();
  console.log(`Seeded/Updated ${data.length} documents in ${collectionName}.`);
}

async function seedInventoryMovements() {
    console.log('Seeding inventoryMovements...');
    const collectionRef = db.collection('inventoryMovements');
    const counterRef = db.collection('counters').doc('inventoryMovements');
    const batch = db.batch();
    
    let currentId = 1000;

    inventoryMovements.forEach((movement) => {
        const docRef = collectionRef.doc(); // Create new doc with random ID
        const randomDaysAgo = Math.floor(Math.random() * 30);
        const date = new Date();
        date.setDate(date.getDate() - randomDaysAgo);

        batch.set(docRef, { ...movement, date, movementId: currentId++ });
    });

    batch.set(counterRef, { currentId: currentId -1 });

    await batch.commit();
    console.log(`Seeded ${inventoryMovements.length} new documents into inventoryMovements.`);
    console.log(`Set inventoryMovements counter to ${currentId - 1}.`);
}

async function main() {
  try {
    console.log('Starting to seed the Firestore database...');
    
    // Seed Firestore collections
    await seedCollection('users', users);
    await seedCollection('products', products);
    await seedCollection('suppliers', suppliers);
    await seedCollection('categories', categories);
    await seedCollection('rotationCategories', rotationCategories);
    await seedInventoryMovements();
    
    console.log('\nDatabase seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

main();
