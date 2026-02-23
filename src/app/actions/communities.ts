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
  return getFirestore(await getApp());
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

    // Buscar comunidad por código
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
      message: 'Código válido'
    };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error al validar código' };
  }
}

// ============================================
// ACTIONS: DASHBOARD MIEMBRO
// ============================================

export async function getMemberDashboard(
  memberId: string
): Promise<{
  success: boolean;
  data?: {
    member: {
      id: string;
      displayName: string;
      email: string;
      communityId: string;
    };
    community: {
      id: string;
      name: string;
      leaderName: string;
    };
    stats: {
      totalSales: number;
      totalCommission: number;
      rank: number;
    };
    activeChallenges: Array<{
      id: string;
      title: string;
      description: string;
      target: number;
      progress: number;
      reward: number;
      endsAt: Date;
    }>;
  };
  message?: string;
}> {
  try {
    const db = await getDb();

    // Get member data
    const memberRef = db.collection('community_members').doc(memberId);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      return { success: false, message: 'Miembro no encontrado' };
    }

    const memberData = memberDoc.data()!;

    // Get community data
    const communityRef = db.collection('communities').doc(memberData.communityId);
    const communityDoc = await communityRef.get();

    if (!communityDoc.exists) {
      return { success: false, message: 'Comunidad no encontrada' };
    }

    const communityData = communityDoc.data()!;

    // Get leader name
    const leaderRef = db.collection('community_leaders').doc(communityData.leaderId);
    const leaderDoc = await leaderRef.get();
    const leaderName = leaderDoc.exists ? leaderDoc.data()!.displayName : 'N/A';

    // Get active challenges
    const challengesSnapshot = await db.collection('community_challenges')
      .where('communityId', '==', memberData.communityId)
      .where('status', '==', 'active')
      .get();

    const activeChallenges = challengesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        target: data.target || 0,
        progress: data.progress || 0,
        reward: data.reward || 0,
        endsAt: data.endsAt?.toDate() || new Date(),
      };
    });

    return {
      success: true,
      data: {
        member: {
          id: memberDoc.id,
          displayName: memberData.displayName,
          email: memberData.email,
          communityId: memberData.communityId,
        },
        community: {
          id: communityDoc.id,
          name: communityData.name,
          leaderName,
        },
        stats: {
          totalSales: memberData.totalSales || 0,
          totalCommission: memberData.totalCommission || 0,
          rank: memberData.rank || 0,
        },
        activeChallenges,
      },
    };
  } catch (error: any) {
    console.error('Error getting member dashboard:', error);
    return { success: false, message: error.message };
  }
}

export async function getMemberChallenges(
  memberId: string
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    title: string;
    description: string;
    target: number;
    progress: number;
    reward: number;
    status: 'active' | 'completed' | 'expired';
    endsAt: Date;
  }>;
  message?: string;
}> {
  try {
    const db = await getDb();

    // Get member community
    const memberRef = db.collection('community_members').doc(memberId);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      return { success: false, message: 'Miembro no encontrado' };
    }

    const memberData = memberDoc.data()!;

    // Get challenges for community
    const challengesSnapshot = await db.collection('community_challenges')
      .where('communityId', '==', memberData.communityId)
      .orderBy('createdAt', 'desc')
      .get();

    const challenges = challengesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        target: data.target || 0,
        progress: data.progress || 0,
        reward: data.reward || 0,
        status: data.status || 'active',
        endsAt: data.endsAt?.toDate() || new Date(),
      };
    });

    return { success: true, data: challenges };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function getDropshippingRequests(
  leaderId: string
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    memberId: string;
    memberName: string;
    productName: string;
    quantity: number;
    price: number;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: Date;
  }>;
  message?: string;
}> {
  try {
    const db = await getDb();

    // Get community by leader
    const communitySnapshot = await db.collection('communities')
      .where('leaderId', '==', leaderId)
      .limit(1)
      .get();

    if (communitySnapshot.empty) {
      return { success: false, message: 'Comunidad no encontrada' };
    }

    const communityId = communitySnapshot.docs[0].id;

    // Get dropshipping requests
    const requestsSnapshot = await db.collection('dropshipping_requests')
      .where('communityId', '==', communityId)
      .orderBy('createdAt', 'desc')
      .get();

    const requests = await Promise.all(requestsSnapshot.docs.map(async doc => {
      const data = doc.data();
      
      // Get member name
      const memberRef = db.collection('community_members').doc(data.memberId);
      const memberDoc = await memberRef.get();
      const memberName = memberDoc.exists ? memberDoc.data()!.displayName : 'Unknown';

      return {
        id: doc.id,
        memberId: data.memberId,
        memberName,
        productName: data.productName,
        quantity: data.quantity,
        price: data.price,
        status: data.status || 'pending',
        createdAt: data.createdAt?.toDate() || new Date(),
      };
    }));

    return { success: true, data: requests };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function getLeaderDashboard(
  leaderId: string
): Promise<{
  success: boolean;
  data?: {
    leader: {
      id: string;
      displayName: string;
      email: string;
      verified: boolean;
      commissionRate: number;
      totalCommission: number;
    };
    community: {
      id: string;
      name: string;
      description: string | null;
      memberCount: number;
      totalSales: number;
      totalCommission: number;
    };
    recentMembers: Array<{
      id: string;
      displayName: string;
      email: string;
      createdAt: Date;
    }>;
    topPerformers: Array<{
      id: string;
      displayName: string;
      totalSales: number;
    }>;
  };
  message?: string;
}> {
  try {
    const db = await getDb();

    // Get leader data
    const leaderRef = db.collection('community_leaders').doc(leaderId);
    const leaderDoc = await leaderRef.get();

    if (!leaderDoc.exists) {
      return { success: false, message: 'Líder no encontrado' };
    }

    const leaderData = leaderDoc.data()!;

    // Get community data
    const communityId = leaderData.communityId;
    if (!communityId) {
      return { success: false, message: 'Comunidad no asignada' };
    }

    const communityRef = db.collection('communities').doc(communityId);
    const communityDoc = await communityRef.get();

    if (!communityDoc.exists) {
      return { success: false, message: 'Comunidad no encontrada' };
    }

    const communityData = communityDoc.data()!;

    // Get recent members
    const membersSnapshot = await db.collection('community_members')
      .where('communityId', '==', communityId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const recentMembers = membersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        displayName: data.displayName,
        email: data.email,
        createdAt: data.createdAt?.toDate() || new Date(),
      };
    });

    // Get top performers (mock - would need sales data)
    const topPerformers = recentMembers.slice(0, 3).map(m => ({
      id: m.id,
      displayName: m.displayName,
      totalSales: Math.floor(Math.random() * 10000),
    }));

    return {
      success: true,
      data: {
        leader: {
          id: leaderDoc.id,
          displayName: leaderData.displayName,
          email: leaderData.email,
          verified: leaderData.verified,
          commissionRate: leaderData.commissionRate || 10,
          totalCommission: leaderData.totalCommission || 0,
        },
        community: {
          id: communityDoc.id,
          name: communityData.name,
          description: communityData.description,
          memberCount: communityData.memberCount || 0,
          totalSales: communityData.totalSales || 0,
          totalCommission: communityData.totalCommission || 0,
        },
        recentMembers,
        topPerformers,
      },
    };
  } catch (error: any) {
    console.error('Error getting leader dashboard:', error);
    return { success: false, message: error.message };
  }
}

export async function generateMemberInviteCode(
  leaderId: string,
  expiresInDays: number = 30
): Promise<{ success: boolean; message: string; inviteCode?: string; inviteUrl?: string }> {
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
    const communityId = communityDoc.id;

    // Generate unique code
    const code = nanoid(8).toUpperCase();

    // Store invite code
    const inviteRef = db.collection('community_invite_codes').doc();
    await inviteRef.set({
      id: inviteRef.id,
      code,
      communityId,
      leaderId,
      type: 'member',
      maxUses: 10,
      uses: 0,
      createdAt: Timestamp.now(),
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/join/member/${code}`;

    return {
      success: true,
      message: 'Código de invitación generado',
      inviteCode: code,
      inviteUrl,
    };
  } catch (error: any) {
    console.error('Error generating member invite code:', error);
    return { success: false, message: error.message };
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
