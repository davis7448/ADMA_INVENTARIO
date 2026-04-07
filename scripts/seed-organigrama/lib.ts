/**
 * Utilidades para el seed de usuarios del organigrama
 */

/**
 * Genera un password temporal seguro
 * Formato: ADMA2026! + 8 caracteres aleatorios
 */
export function generateTempPassword(): string {
  // Generar random string sin dependencia de crypto
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random = '';
  for (let i = 0; i < 8; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ADMA2026!${random}`;
}

/**
 * Tipo para el resultado del seed
 */
export interface SeedResult {
  email: string;
  uid: string;
  password: string;
  status: 'created' | 'exists' | 'error';
  error?: string;
}

/**
 * Tipo para los datos del usuario a seedear
 */
export interface UsuarioSeed {
  nombre: string;
  email: string;
  area: 'COMERCIAL' | 'ADMINISTRATIVO' | 'AUDIOVISUALES' | 'BODEGA';
  cargo: string;
  nivel: number;
}

/**
 * Lista de usuarios a seedear según el plan
 */
export const USUARIOS_SEED: UsuarioSeed[] = [
  // AUDIOVISUALES
  { nombre: 'Josue Soto Bolivar', email: 'marketingadmacompany@gmail.com', area: 'AUDIOVISUALES', cargo: 'Diseñador Audiovisual', nivel: 2 },
  { nombre: 'Ana Maria Bedoya', email: 'ana.bedoya@adma.com.co', area: 'AUDIOVISUALES', cargo: 'Community Manager', nivel: 2 },
  
  // COMERCIAL
  { nombre: 'Maryori Victoria', email: 'directoracomercialadma@gmail.com', area: 'COMERCIAL', cargo: 'Comerciante', nivel: 2 },
  { nombre: 'Jhoan Motta', email: 'jhoanamotta@adma.com.co', area: 'COMERCIAL', cargo: 'Comerciante', nivel: 2 },
  { nombre: 'Jose Manuel Suarez', email: 'josemsuarez@adma.com.co', area: 'COMERCIAL', cargo: 'Comerciante', nivel: 2 },
  { nombre: 'Juan Jose Bedoya', email: 'gerente.comercial@admalab.com.co', area: 'COMERCIAL', cargo: 'Comerciante', nivel: 2 },
  { nombre: 'Andres Camilo Buchelly', email: 'andrescbuchelly@adma.com.co', area: 'COMERCIAL', cargo: 'Comerciante', nivel: 2 },
  { nombre: 'Jose David Aguirre', email: 'josedaguirre@adma.com.co', area: 'COMERCIAL', cargo: 'Comerciante', nivel: 2 },
  { nombre: 'Oscar Gomez', email: 'asesorgrow344@gmail.com', area: 'COMERCIAL', cargo: 'Comerciante', nivel: 2 },
  
  // ADMINISTRATIVO
  { nombre: 'Maria del Mar Garay', email: 'mariagaray_15@hotmail.com', area: 'ADMINISTRATIVO', cargo: 'Gerente Administrativo', nivel: 1 },
  { nombre: 'Camilo Useche', email: 'comercial1@gmail.com', area: 'ADMINISTRATIVO', cargo: 'TI', nivel: 2 },
  { nombre: 'Xiomara Reyna', email: 'cordinador.operaciones@adma.com.co', area: 'ADMINISTRATIVO', cargo: 'Coordinador Operativo', nivel: 1 },
  { nombre: 'Yurany Cuellar', email: 'admacontabilidad1@gmail.com', area: 'ADMINISTRATIVO', cargo: 'Contabilidad', nivel: 2 },
  { nombre: 'Viviana Aguirre', email: 'recursoshumanosadma@gmail.com', area: 'ADMINISTRATIVO', cargo: 'Recursos Humanos', nivel: 2 },
  { nombre: 'Martha Useche', email: 'admapedidos@gmail.com', area: 'ADMINISTRATIVO', cargo: 'Pedidos', nivel: 2 },
  
  // BODEGA
  { nombre: 'Carlos Andres Gonzales', email: 'bodega.adma0@gmail.com', area: 'BODEGA', cargo: 'Auxiliar de bodega', nivel: 2 },
  { nombre: 'Jairo Morales', email: 'admabodega@gmail.com', area: 'BODEGA', cargo: 'Auxiliar de bodega', nivel: 2 },
];

/**
 * Áreas a crear en Firestore
 */
export const AREAS_SEED = [
  { name: 'COMERCIAL', color: '#3B82F6', description: 'Área comercial y ventas' },
  { name: 'ADMINISTRATIVO', color: '#10B981', description: 'Área administrativa y financiera' },
  { name: 'AUDIOVISUALES', color: '#F59E0B', description: 'Área de marketing y contenido' },
  { name: 'BODEGA', color: '#EF4444', description: 'Área de bodega y logística' },
];
