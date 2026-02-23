"use server";

import { z } from 'zod';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { nanoid } from 'nanoid';

// ============================================
// ESQUEMAS DE VALIDACIÓN
// ============================================

export const RegisterLeaderSchema = z.object({
  email: z.string().email('Email inválido'),
  displayName: z.string().min(2, 'Nombre muy corto'),
  phone: z.string().optional(),
  communityName: z.string().min(2, 'Nombre de comunidad muy corto'),
  communityDescription: z.string().optional(),
});

export const RegisterMemberSchema = z.object({
  email: z.string().email('Email inválido'),
  displayName: z.string().min(2, 'Nombre muy corto'),
  inviteCode: z.string().length(8, 'Código de invitación inválido'),
});

export const VerifyLeaderSchema = z.object({
  leaderId: z.string(),
});

export const UpdateCommissionSchema = z.object({
  leaderId: z.string(),
  amount: z.number().positive('Monto debe ser positivo'),
});

// ============================================
// HELPERS
// ============================================

async function getDb() {
  return getFirestore();
}

async function getAuthAdmin() {
  return getAuth(await getApp());
}

// ============================================
// ACTIONS: LÍDERES DE COMUNIDAD
// ============================================

export async function registerCommunityLeader(
  data: z.infer<typeof RegisterLeaderSchema>
): Promise<{ success: boolean; message: string; leaderId?: string }> {
  const validated = RegisterLeaderSchema.safeParse(data);

  if (!validated.success) {
    return {
      success: false,
      message: validated.error.errors[0]?.message || 'Validation failed',
    };
  }

  const { email, displayName, phone, communityName, communityDescription } = validated.data;

  try {
    const auth = await getAuthAdmin();
    const db = await getDb();

    // Generate invite code
    const inviteCode = nanoid(8);

    // Create Firebase Auth user (temporary password - should be reset)
    const tempPassword = nanoid(12);
    const userRecord = await auth.createUser({
      email,
      displayName,
      password: tempPassword,
    });

    // Create leader document
    const leaderRef = db.collection('community_leaders').doc(userRecord.uid);
    await leaderRef.set({
      email,
      displayName,
      phone: phone || null,
      verified: false, // Requires admin approval
      commissionRate: 10, // Default 10%
      totalCommission: 0,
      rank: 0,
      createdAt: Timestamp.now(),
    });

    // Create community document
    const communityRef = db.collection('communities').doc();
    await communityRef.set({
      name: communityName,
      description: communityDescription || null,
      leaderId: userRecord.uid,
      inviteCode,
      memberCount: 0,
      totalSales: 0,
      totalCommission: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    // Link leader to community
    await leaderRef.update({ communityId: communityRef.id });

    revalidatePath('/communities');
    
    return {
      success: true,
      message: 'Líder registrado. Espera aprobación del admin.',
      leaderId: userRecord.uid,
    };
  } catch (error: any) {
    console.error('Error registering community leader:', error);
    return {
      success: false,
      message: error.message || 'Error al registrar líder',
    };
  }
}

export async function verifyCommunityLeader(
  data: z.infer<typeof VerifyLeaderSchema>
): Promise<{ success: boolean; message: string }> {
  const validated = VerifyLeaderSchema.safeParse(data);

  if (!validated.success) {
    return { success: false, message: 'Invalid data' };
  }

  const { leaderId } = validated.data;

  try {
    const db = await getDb();
    const leaderRef = db.collection('community_leaders').doc(leaderId);
    
    const leaderDoc = await leaderRef.get();
    if (!leaderDoc.exists) {
      return { success: false, message: 'Líder no encontrado' };
    }

    await leaderRef.update({ verified: true });
    revalidatePath('/communities/admin');

    return { success: true, message: 'Líder verificado correctamente' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error al verificar líder' };
  }
}

// ============================================
// ACTIONS: INVITE CODES
// ============================================

export async function generateInviteCode(
  leaderId: string
): Promise<{ success: boolean; message: string; code?: string }> {
  try {
    const db = await getDb();

    // Find community by leader
    const communitySnapshot = await db.collection('communities')
      .where('leaderId', '==', leaderId)
      .limit(1)
      .get();

    if (communitySnapshot.empty) {
      return { success: false, message: 'Comunidad no encontrada' };
    }

    const communityDoc = communitySnapshot.docs[0];
    const newCode = nanoid(8);

    await communityDoc.ref.update({
      inviteCode: newCode,
      updatedAt: Timestamp.now(),
    });

    revalidatePath('/communities');
    
    return { success: true, message: 'Código generado', code: newCode };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error al generar código' };
  }
}

export async function validateInviteCode(
  code: string
): Promise<{ success: boolean; leaderId?: string; communityId?: string; message: string }> {
  if (!code || code.length !== 8) {
    return { success: false, message: 'Código inválido' };
  }

  try {
    const db = await getDb();

    const communitySnapshot = await db.collection('communities')
      .where('inviteCode', '==', code)
      .limit(1)
      .get();

    if (communitySnapshot.empty) {
      return { success: false, message: 'Código de invitación no válido' };
    }

    const communityDoc = communitySnapshot.docs[0];
    const communityData = communityDoc.data();

    return {
      success: true,
      leaderId: communityData.leaderId,
      communityId: communityDoc.id,
      message: 'Código válido',
    };
  } catch (error: any) {
    return { success: false, message: 'Error al validar código' };
  }
}

// ============================================
// ACTIONS: MIEMBROS
// ============================================

export async function assignMemberToCommunity(
  data: z.infer<typeof RegisterMemberSchema>
): Promise<{ success: boolean; message: string }> {
  const validated = RegisterMemberSchema.safeParse(data);

  if (!validated.success) {
    return {
      success: false,
      message: validated.error.errors[0]?.message || 'Validation failed',
    };
  }

  const { email, displayName, inviteCode } = validated.data;

  try {
    // Validate invite code first
    const validation = await validateInviteCode(inviteCode);
    if (!validation.success || !validation.leaderId || !validation.communityId) {
      return { success: false, message: validation.message };
    }

    const db = await getDb();
    const auth = await getAuthAdmin();

    // Create user in Firebase Auth
    const tempPassword = nanoid(12);
    const userRecord = await auth.createUser({
      email,
      displayName,
      password: tempPassword,
    });

    // Create member document
    await db.collection('community_members').doc(userRecord.uid).set({
      email,
      displayName,
      leaderId: validation.leaderId,
      communityId: validation.communityId,
      referredBy: validation.leaderId,
      joinedAt: Timestamp.now(),
    });

    // Update member count in community
    await db.collection('communities').doc(validation.communityId).update({
      memberCount: FieldValue.increment(1),
      updatedAt: Timestamp.now(),
    });

    revalidatePath('/communities');
    
    return {
      success: true,
      message: 'Miembro asignado a la comunidad',
    };
  } catch (error: any) {
    console.error('Error assigning member:', error);
    return {
      success: false,
      message: error.message || 'Error al asignar miembro',
    };
  }
}

// ============================================
// ACTIONS: RANKING
// ============================================

export async function getCommunityRanking(): Promise<{
  success: boolean;
  ranking?: Array<{
    leaderId: string;
    leaderName: string;
    communityName: string;
    totalCommission: number;
    memberCount: number;
    rank: number;
  }>;
  message?: string;
}> {
  try {
    const db = await getDb();

    const leadersSnapshot = await db.collection('community_leaders')
      .where('verified', '==', true)
      .orderBy('totalCommission', 'desc')
      .limit(50)
      .get();

    const ranking: Array<{
      leaderId: string;
      leaderName: string;
      communityName: string;
      totalCommission: number;
      memberCount: number;
      rank: number;
    }> = [];

    let rank = 1;
    for (const leaderDoc of leadersSnapshot.docs) {
      const leaderData = leaderDoc.data();

      // Get community name
      const communitySnapshot = await db.collection('communities')
        .where('leaderId', '==', leaderDoc.id)
        .limit(1)
        .get();

      const communityName = communitySnapshot.empty 
        ? 'Sin comunidad' 
        : communitySnapshot.docs[0].data().name;

      ranking.push({
        leaderId: leaderDoc.id,
        leaderName: leaderData.displayName,
        communityName,
        totalCommission: leaderData.totalCommission || 0,
        memberCount: 0, // Would need separate query
        rank: rank++,
      });
    }

    return { success: true, ranking };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ============================================
// ACTIONS: COMISIONES
// ============================================

export async function updateLeaderCommission(
  data: z.infer<typeof UpdateCommissionSchema>
): Promise<{ success: boolean; message: string }> {
  const validated = UpdateCommissionSchema.safeParse(data);

  if (!validated.success) {
    return { success: false, message: 'Invalid data' };
  }

  const { leaderId, amount } = validated.data;

  try {
    const db = await getDb();

    // Update leader commission
    const leaderRef = db.collection('community_leaders').doc(leaderId);
    await leaderRef.update({
      totalCommission: FieldValue.increment(amount),
    });

    // Update community total
    const leaderDoc = await leaderRef.get();
    const leaderData = leaderDoc.data();
    if (leaderData?.communityId) {
      await db.collection('communities').doc(leaderData.communityId).update({
        totalCommission: FieldValue.increment(amount),
      });
    }

    revalidatePath('/communities/admin');
    
    return { success: true, message: 'Comisión actualizada' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
