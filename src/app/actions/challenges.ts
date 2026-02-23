"use server";

import { z } from 'zod';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';

// ============================================
// ESQUEMAS DE VALIDACIÓN
// ============================================

export const CreateChallengeSchema = z.object({
  title: z.string().min(3, 'Título muy corto'),
  description: z.string().min(10, 'Descripción muy corta'),
  type: z.enum(['individual', 'community']),
  communityId: z.string().optional(),
  targetMetric: z.string().min(1, 'Métrica requerida'),
  targetValue: z.number().positive('Valor debe ser positivo'),
  prize: z.string().min(1, 'Premio requerido'),
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
});

export const UpdateChallengeSchema = z.object({
  challengeId: z.string(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  prize: z.string().min(1).optional(),
});

// ============================================
// HELPERS
// ============================================

async function getDb() {
  return getFirestore(await getApp());
}

// ============================================
// ACTIONS
// ============================================

export async function createChallenge(
  data: z.infer<typeof CreateChallengeSchema>
): Promise<{ success: boolean; message: string; challengeId?: string }> {
  const validated = CreateChallengeSchema.safeParse(data);

  if (!validated.success) {
    return {
      success: false,
      message: validated.error.errors[0]?.message || 'Validation failed',
    };
  }

  const {
    title,
    description,
    type,
    communityId,
    targetMetric,
    targetValue,
    prize,
    startDate,
    endDate,
  } = validated.data;

  try {
    const db = await getDb();

    const challengeRef = await db.collection('challenges').add({
      title,
      description,
      type,
      communityId: communityId || null,
      targetMetric,
      targetValue,
      prize,
      startDate: Timestamp.fromDate(new Date(startDate)),
      endDate: Timestamp.fromDate(new Date(endDate)),
      status: 'active',
      createdBy: 'system', // Should come from session in real implementation
      createdAt: Timestamp.now(),
    });

    revalidatePath('/challenges');
    
    return {
      success: true,
      message: 'Reto creado correctamente',
      challengeId: challengeRef.id,
    };
  } catch (error: any) {
    console.error('Error creating challenge:', error);
    return {
      success: false,
      message: error.message || 'Error al crear reto',
    };
  }
}

export async function getActiveChallenges(): Promise<{
  success: boolean;
  challenges?: Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    communityId?: string;
    targetMetric: string;
    targetValue: number;
    prize: string;
    startDate: Date;
    endDate: Date;
    status: string;
  }>;
  message?: string;
}> {
  try {
    const db = await getDb();
    const now = Timestamp.now();

    const snapshot = await db.collection('challenges')
      .where('status', '==', 'active')
      .where('endDate', '>=', now)
      .orderBy('endDate', 'asc')
      .get();

    const challenges = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        type: data.type,
        communityId: data.communityId,
        targetMetric: data.targetMetric,
        targetValue: data.targetValue,
        prize: data.prize,
        startDate: data.startDate.toDate(),
        endDate: data.endDate.toDate(),
        status: data.status,
      };
    });

    return { success: true, challenges };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function getChallengeById(
  challengeId: string
): Promise<{
  success: boolean;
  challenge?: {
    id: string;
    title: string;
    description: string;
    type: string;
    communityId?: string;
    targetMetric: string;
    targetValue: number;
    prize: string;
    startDate: Date;
    endDate: Date;
    status: string;
    createdBy: string;
    createdAt: Date;
  };
  message?: string;
}> {
  try {
    const db = await getDb();
    const doc = await db.collection('challenges').doc(challengeId).get();

    if (!doc.exists) {
      return { success: false, message: 'Reto no encontrado' };
    }

    const data = doc.data()!;
    return {
      success: true,
      challenge: {
        id: doc.id,
        title: data.title,
        description: data.description,
        type: data.type,
        communityId: data.communityId,
        targetMetric: data.targetMetric,
        targetValue: data.targetValue,
        prize: data.prize,
        startDate: data.startDate.toDate(),
        endDate: data.endDate.toDate(),
        status: data.status,
        createdBy: data.createdBy,
        createdAt: data.createdAt.toDate(),
      },
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function updateChallengeStatus(
  challengeId: string,
  status: 'active' | 'completed' | 'cancelled'
): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getDb();
    await db.collection('challenges').doc(challengeId).update({ status });
    revalidatePath('/challenges');
    return { success: true, message: 'Estado actualizado' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function getChallengesByCommunity(
  communityId: string
): Promise<{
  success: boolean;
  challenges?: Array<any>;
  message?: string;
}> {
  try {
    const db = await getDb();
    const now = Timestamp.now();

    const snapshot = await db.collection('challenges')
      .where('communityId', '==', communityId)
      .where('status', '==', 'active')
      .where('endDate', '>=', now)
      .get();

    const challenges = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        type: data.type,
        targetMetric: data.targetMetric,
        targetValue: data.targetValue,
        prize: data.prize,
        endDate: data.endDate.toDate(),
        status: data.status,
      };
    });

    return { success: true, challenges };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
