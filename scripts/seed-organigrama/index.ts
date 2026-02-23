/**
 * Seed script para usuarios del organigrama
 * 
 * Uso: npx tsx scripts/seed-organigrama/index.ts
 * 
 * Este script:
 * 1. Crea las áreas en Firestore (si no existen)
 * 2. Crea usuarios en Firebase Auth (si no existen)
 * 3. Asigna posiciones en el organigrama
 * 4. Genera un reporte de credenciales
 */
import { config } from 'dotenv';
config(); // Load environment variables from .env file

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { USUARIOS_SEED, AREAS_SEED, generateTempPassword, SeedResult } from './lib';

// Constantes
const AREAS_COLLECTION = 'areas';
const USERS_COLLECTION = 'users';
const USER_POSITIONS_COLLECTION = 'user_positions';
const CREDENTIALS_DIR = path.join(process.cwd(), 'scripts', 'output');

// Inicializar Firebase Admin
function initFirebase() {
  if (getApps().length === 0) {
    // Usar las credenciales del proyecto
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    initializeApp({
      credential: cert({
        projectId: 'studio-9748962172-82b35',
        clientEmail: 'firebase-adminsdk-fbsvc@studio-9748962172-82b35.iam.gserviceaccount.com',
        privateKey: privateKey,
      }),
    });
  }
}

/**
 * Obtiene o crea un área en Firestore
 */
async function getOrCreateArea(db: ReturnType<typeof getFirestore>, name: string, color: string, description: string): Promise<string> {
  const areasRef = db.collection(AREAS_COLLECTION);
  
  // Buscar por nombre
  const snapshot = await areasRef.where('name', '==', name).limit(1).get();
  
  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    console.log(`  ✓ Área "${name}" ya existe (ID: ${doc.id})`);
    return doc.id;
  }
  
  // Crear nueva área
  const docRef = await areasRef.add({
    name,
    color,
    description,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  
  console.log(`  ✓ Área "${name}" creada (ID: ${docRef.id})`);
  return docRef.id;
}

/**
 * Verifica si un usuario existe en Firebase Auth por email
 * Retorna el UID si existe, null si no
 */
async function getUserByEmail(auth: ReturnType<typeof getAuth>, email: string): Promise<string | null> {
  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return null;
    }
    throw error;
  }
}

/**
 * Crea un usuario en Firebase Auth
 */
async function createUser(auth: ReturnType<typeof getAuth>, email: string, password: string, displayName: string): Promise<string> {
  const userRecord = await auth.createUser({
    email,
    password,
    displayName,
  });
  
  console.log(`  ✓ Usuario creado en Auth: ${email} (UID: ${userRecord.uid})`);
  return userRecord.uid;
}

/**
 * Obtiene o crea un perfil de usuario en Firestore
 */
async function getOrCreateUserProfile(db: ReturnType<typeof getFirestore>, uid: string, email: string, name: string): Promise<void> {
  const userRef = db.collection(USERS_COLLECTION).doc(uid);
  const doc = await userRef.get();
  
  if (!doc.exists) {
    await userRef.set({
      id: uid,
      name,
      email,
      role: 'commercial', // Rol por defecto
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log(`  ✓ Perfil creado en Firestore: ${email}`);
  } else {
    console.log(`  ✓ Perfil ya existe en Firestore: ${email}`);
  }
}

/**
 * Crea o actualiza la posición del usuario en el organigrama
 */
async function setUserPosition(
  db: ReturnType<typeof getFirestore>,
  userId: string,
  areaId: string,
  cargo: string,
  nivel: number
): Promise<void> {
  const positionRef = db.collection(USER_POSITIONS_COLLECTION).doc(userId);
  
  await positionRef.set({
    id: userId,
    userId,
    areaId,
    cargo,
    nivel,
    posicionX: 50, // Posición por defecto
    posicionY: 50,
    updatedAt: Timestamp.now(),
  });
  
  console.log(`  ✓ Posición creada en organigrama: ${cargo} (nivel ${nivel})`);
}

/**
 * Función principal de seed
 */
async function seed() {
  console.log('\n🚀 Iniciando seed de usuarios del organigrama...\n');
  
  // Inicializar Firebase
  initFirebase();
  const auth = getAuth();
  const db = getFirestore();
  
  const results: SeedResult[] = [];
  const areaIds: Record<string, string> = {};
  
  // 1. Crear/verificar áreas
  console.log('📁 Creando áreas en Firestore...');
  for (const area of AREAS_SEED) {
    const areaId = await getOrCreateArea(db, area.name, area.color, area.description);
    areaIds[area.name] = areaId;
  }
  console.log('✓ Todas las áreas listas\n');
  
  // 2. Procesar usuarios
  console.log('👥 Procesando usuarios...');
  for (const usuario of USUARIOS_SEED) {
    console.log(`\n  Usuario: ${usuario.nombre} (${usuario.email})`);
    
    try {
      // Verificar si existe en Auth
      let uid = await getUserByEmail(auth, usuario.email);
      
      if (uid) {
        // Usuario ya existe
        console.log(`  ℹ Usuario ya existe en Auth (UID: ${uid})`);
        results.push({
          email: usuario.email,
          uid,
          password: '',
          status: 'exists',
        });
      } else {
        // Crear usuario
        const password = generateTempPassword();
        uid = await createUser(auth, usuario.email, password, usuario.nombre);
        
        results.push({
          email: usuario.email,
          uid,
          password,
          status: 'created',
        });
      }
      
      // Crear/verificar perfil en Firestore
      await getOrCreateUserProfile(db, uid!, usuario.email, usuario.nombre);
      
      // Asignar posición en organigrama
      const areaId = areaIds[usuario.area];
      await setUserPosition(db, uid!, areaId, usuario.cargo, usuario.nivel);
      
    } catch (error: any) {
      console.error(`  ✗ Error: ${error.message}`);
      results.push({
        email: usuario.email,
        uid: '',
        password: '',
        status: 'error',
        error: error.message,
      });
    }
  }
  
  // 3. Guardar reporte de credenciales
  console.log('\n💾 Guardando reporte de credenciales...');
  
  // Crear directorio si no existe
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }
  
  const date = new Date().toISOString().split('T')[0];
  const filename = `credenciales-${date}.json`;
  const filepath = path.join(CREDENTIALS_DIR, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`  ✓ Reporte guardado: ${filepath}`);
  
  // 4. Resumen
  console.log('\n📊 RESUMEN:');
  const created = results.filter(r => r.status === 'created').length;
  const exists = results.filter(r => r.status === 'exists').length;
  const errors = results.filter(r => r.status === 'error').length;
  
  console.log(`  ✓ CREADOS: ${created}`);
  console.log(`  ℹ YA EXISTÍAN: ${exists}`);
  console.log(`  ✗ ERRORES: ${errors}`);
  console.log('\n✅ Seed completado!\n');
}

// Ejecutar
seed().catch(console.error);
