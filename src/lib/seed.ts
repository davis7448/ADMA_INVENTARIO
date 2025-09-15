

/**
 * This is a script to seed the Firestore database with initial data.
 * Run it with `npm run seed`.
 * 
 * IMPORTANT: Before running, ensure you have enabled:
 * 1. Firestore in your Firebase project.
 * 2. Firebase Authentication with the "Email/Password" sign-in method.
 */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
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
const auth = getAuth(app);

async function seedAuthenticationUsers() {
    console.log('Seeding authentication users...');
    let seededCount = 0;

    for (const user of users) {
        try {
            // Use a simple, default password for all seeded users
            const defaultPassword = 'password123';
            
            // Check if user already exists
            try {
                await auth.getUserByEmail(user.email);
                console.log(`User ${user.email} already exists in Auth. Updating...`);
                // Optionally update user, or just ensure they exist. For seeding, we can just skip.
                // For this case, we will delete and recreate to ensure consistency.
                await auth.deleteUser(user.id);
                console.log(`Deleted existing user ${user.email} to recreate.`);
            } catch (error: any) {
                if (error.code !== 'auth/user-not-found') {
                    throw error; // Re-throw unexpected errors
                }
                // If user not found, proceed to create
            }

            await auth.createUser({
                uid: user.id,
                email: user.email,
                password: defaultPassword,
                displayName: user.name,
                photoURL: user.avatarUrl,
            });
            seededCount++;
        } catch (error: any) {
            if (error.code === 'auth/uid-already-exists') {
                 // This is expected if we run seed multiple times, we can ignore it or update the user.
                 // Forcing a recreate by deleting first is a more reliable seeding strategy.
                console.log(`User with UID ${user.id} already exists, skipping creation.`);
            } else if (error.code === 'auth/email-already-exists') {
                console.log(`User with email ${user.email} already exists, skipping creation.`);
            } else {
                console.error(`Error creating auth user ${user.email}:`, error.message);
            }
        }
    }
    console.log(`Seeded ${seededCount} new authentication users.`);
}


async function seedCollection<T extends { id: string }>(collectionName: string, data: T[]) {
  console.log(`Seeding ${collectionName}...`);
  const collectionRef = db.collection(collectionName);
  const batch = db.batch();

  // We will upsert data instead of deleting. This is safer.
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

    // For simplicity, we just add new ones each time.
    // In a real scenario, you might want to avoid duplicates.
    const batch = db.batch();
    inventoryMovements.forEach((movement) => {
        const docRef = collectionRef.doc(); // Create new doc with random ID
        const randomDaysAgo = Math.floor(Math.random() * 30);
        const date = new Date();
        date.setDate(date.getDate() - randomDaysAgo);

        batch.set(docRef, { ...movement, date });
    });

    await batch.commit();
    console.log(`Seeded ${inventoryMovements.length} new documents into inventoryMovements.`);
}

async function main() {
  try {
    console.log('Starting to seed the database...');
    
    // Seed auth users first, as other things might depend on them.
    await seedAuthenticationUsers();
    
    // Seed Firestore collections
    await seedCollection('users', users);
    await seedCollection('products', products);
    await seedCollection('suppliers', suppliers);
    await seedCollection('categories', categories);
    await seedInventoryMovements();
    
    console.log('\nDatabase seeded successfully!');
    console.log('Default password for all users is "password123"');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

main();

