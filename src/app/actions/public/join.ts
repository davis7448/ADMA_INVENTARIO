"use server";

import { z } from 'zod';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';
import { nanoid } from 'nanoid';

// ============================================
// ESQUEMAS DE VALIDACIÓN
// ============================================

// Validar código de invitación de líder
export const ValidateLeaderInviteSchema = z.object({
  code: z.string().min(8, 'Código muy corto').max(20),
});

// Validar código de invitación de miembro
export const ValidateMemberInviteSchema = z.object({
  code: z.string().min(8, 'Código muy corto').max(20),
});

// Registrar líder con código de invitación
export const RegisterLeaderWithInviteSchema = z.object({
  code: z.string().min(8),
  email: z.string().email('Email inválido'),
  displayName: z.string().min(2, 'Nombre muy corto'),
  phone: z.string().optional(),
  communityName: z.string().min(2, 'Nombre de comunidad muy corto'),
  communityDescription: z.string().optional(),
});

// Registrar miembro con código de invitación
export const RegisterMemberWithInviteSchema = z.object({
  code: z.string().min(8),
  email: z.string().email('Email inválido'),
  displayName: z.string().min(2, 'Nombre muy corto'),
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
// ACTIONS: VALIDACIÓN PÚBLICA DE CÓDIGOS
// ============================================

/**
 * Validar código de invitación de líder
 * Público - no requiere auth
 */
export async function validateLeaderInviteCode(
  code: string
): Promise<{
  valid: boolean;
  message: string;
  communityId?: string;
  expiresAt?: Date;
}> {
  const validated = ValidateLeaderInviteSchema.safeParse({ code });

  if (!validated.success) {
    return {
      valid: false,
      message: validated.error.errors[0]?.message || 'Código inválido',
    };
  }

  try {
    const db = await getDb();

    // Buscar código de invitación activo
    const snapshot = await db
      .collection('community_invite_codes')
      .where('code', '==', code)
      .where('type', '==', 'leader')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return {
        valid: false,
        message: 'Código de invitación inválido o expirado',
      };
    }

    const inviteDoc = snapshot.docs[0];
    const inviteData = inviteDoc.data();

    // Verificar expiración
    const expiresAt = inviteData.expiresAt.toDate();
    if (expiresAt < new Date()) {
      return {
        valid: false,
        message: 'El código de invitación ha expirado',
      };
    }

    // Verificar usos máximos
    if (inviteData.maxUses && inviteData.usedCount >= inviteData.maxUses) {
      return {
        valid: false,
        message: 'El código de invitación ha alcanzado el límite de usos',
      };
    }

    return {
      valid: true,
      message: 'Código válido',
      communityId: inviteData.communityId,
      expiresAt,
    };
  } catch (error) {
    console.error('Error validating leader invite code:', error);
    return {
      valid: false,
      message: 'Error al validar el código',
    };
  }
}

/**
 * Validar código de invitación de miembro
 * Público - no requiere auth
 */
export async function validateMemberInviteCode(
  code: string
): Promise<{
  valid: boolean;
  message: string;
  communityId?: string;
  leaderId?: string;
  expiresAt?: Date;
}> {
  const validated = ValidateMemberInviteSchema.safeParse({ code });

  if (!validated.success) {
    return {
      valid: false,
      message: validated.error.errors[0]?.message || 'Código inválido',
    };
  }

  try {
    const db = await getDb();

    // Buscar código de invitación activo
    const snapshot = await db
      .collection('community_member_invites')
      .where('code', '==', code)
      .where('isUsed', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return {
        valid: false,
        message: 'Código de invitación inválido o ya usado',
      };
    }

    const inviteDoc = snapshot.docs[0];
    const inviteData = inviteDoc.data();

    // Verificar expiración
    const expiresAt = inviteData.expiresAt.toDate();
    if (expiresAt < new Date()) {
      return {
        valid: false,
        message: 'El código de invitación ha expirado',
      };
    }

    return {
      valid: true,
      message: 'Código válido',
      communityId: inviteData.communityId,
      leaderId: inviteData.leaderId,
      expiresAt,
    };
  } catch (error) {
    console.error('Error validating member invite code:', error);
    return {
      valid: false,
      message: 'Error al validar el código',
    };
  }
}

// ============================================
// ACTIONS: REGISTRO PÚBLICO
// ============================================

/**
 * Registrar líder con código de invitación
 * Público - no requiere auth
 */
export async function registerLeaderWithInvite(
  data: z.infer<typeof RegisterLeaderWithInviteSchema>
): Promise<{ success: boolean; message: string; leaderId?: string }> {
  const validated = RegisterLeaderWithInviteSchema.safeParse(data);

  if (!validated.success) {
    return {
      success: false,
      message: validated.error.errors[0]?.message || 'Validation failed',
    };
  }

  const { code, email, displayName, phone, communityName, communityDescription } = validated.data;

  try {
    const auth = await getAuthAdmin();
    const db = await getDb();

    // Primero validar el código
    const validation = await validateLeaderInviteCode(code);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.message,
      };
    }

    // Generate invite code
    const inviteCode = nanoid(8);

    // Create Firebase Auth user (temporary password - should be reset)
    const tempPassword = nanoid(12);
    const userRecord = await auth.createUser({
      email,
      displayName,
      password: tempPassword,
    });

    // Set custom claims for community leader
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'community_leader',
    });

    const now = Timestamp.now();

    // Crear documento de líder
    const leaderRef = db.collection('community_leaders').doc(userRecord.uid);
    await leaderRef.set({
      email,
      displayName,
      phone: phone || null,
      communityId: validation.communityId,
      verified: false,
      commissionRate: 0.05, // 5% default
      totalCommission: 0,
      rank: 0,
      inviteCode,
      registeredAt: now,
      status: 'active',
      createdAt: now,
    });

    // Crear la comunidad
    const communityRef = db.collection('communities').doc();
    await communityRef.set({
      id: communityRef.id,
      name: communityName,
      leaderId: userRecord.uid,
      description: communityDescription || null,
      inviteCode,
      memberCount: 0,
      totalSales: 0,
      totalCommission: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Actualizar el líder con la comunidad
    await leaderRef.update({
      communityId: communityRef.id,
    });

    // Marcar código de invitación como usado
    const inviteSnapshot = await db
      .collection('community_invite_codes')
      .where('code', '==', code)
      .where('type', '==', 'leader')
      .limit(1)
      .get();

    if (!inviteSnapshot.empty) {
      const inviteDoc = inviteSnapshot.docs[0];
      await inviteDoc.ref.update({
        usedCount: 1,
        isActive: false,
        leaderId: userRecord.uid,
      });
    }

    return {
      success: true,
      message: 'Líder registrado exitosamente',
      leaderId: userRecord.uid,
    };
  } catch (error: any) {
    console.error('Error registering leader with invite:', error);

    // Handle specific errors
    if (error.code === 'auth/email-already-exists') {
      return {
        success: false,
        message: 'El email ya está registrado',
      };
    }

    return {
      success: false,
      message: 'Error al registrar el líder',
    };
  }
}

/**
 * Registrar miembro con código de invitación
 * Público - no requiere auth
 */
export async function registerMemberWithInvite(
  data: z.infer<typeof RegisterMemberWithInviteSchema>
): Promise<{ success: boolean; message: string; memberId?: string }> {
  const validated = RegisterMemberWithInviteSchema.safeParse(data);

  if (!validated.success) {
    return {
      success: false,
      message: validated.error.errors[0]?.message || 'Validation failed',
    };
  }

  const { code, email, displayName } = validated.data;

  try {
    const auth = await getAuthAdmin();
    const db = await getDb();

    // Primero validar el código
    const validation = await validateMemberInviteCode(code);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.message,
      };
    }

    if (!validation.communityId || !validation.leaderId) {
      return {
        success: false,
        message: 'Código de invitación inválido',
      };
    }

    // Create Firebase Auth user
    const tempPassword = nanoid(12);
    const userRecord = await auth.createUser({
      email,
      displayName,
      password: tempPassword,
    });

    // Set custom claims for community member
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'community_member',
    });

    const now = Timestamp.now();

    // Crear documento de miembro
    const memberRef = db.collection('community_members').doc(userRecord.uid);
    await memberRef.set({
      email,
      displayName,
      leaderId: validation.leaderId,
      communityId: validation.communityId,
      userId: userRecord.uid,
      joinedAt: now,
      status: 'active',
    });

    // Actualizar contador de miembros en la comunidad
    const communityRef = db.collection('communities').doc(validation.communityId);
    await communityRef.update({
      memberCount: FieldValue.increment(1),
      updatedAt: now,
    });

    // Marcar código de invitación como usado
    const inviteSnapshot = await db
      .collection('community_member_invites')
      .where('code', '==', code)
      .limit(1)
      .get();

    if (!inviteSnapshot.empty) {
      const inviteDoc = inviteSnapshot.docs[0];
      await inviteDoc.ref.update({
        isUsed: true,
        memberId: userRecord.uid,
      });
    }

    return {
      success: true,
      message: 'Miembro registrado exitosamente',
      memberId: userRecord.uid,
    };
  } catch (error: any) {
    console.error('Error registering member with invite:', error);

    if (error.code === 'auth/email-already-exists') {
      return {
        success: false,
        message: 'El email ya está registrado',
      };
    }

    return {
      success: false,
      message: 'Error al registrar el miembro',
    };
  }
}
