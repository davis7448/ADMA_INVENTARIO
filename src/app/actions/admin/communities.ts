"use server";

import { z } from 'zod';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getApp } from '@/lib/firebase-admin';
import { nanoid } from 'nanoid';

// ============================================
// ESQUEMAS DE VALIDACIÓN
// ============================================

// Generar código de invitación para líder
export const GenerateLeaderInviteSchema = z.object({
  communityId: z.string().min(1, 'Community ID requerido'),
  maxUses: z.number().int().positive().optional(),
  expiresInDays: z.number().int().positive().default(30),
});

// Generar código de invitación para miembro
export const GenerateMemberInviteSchema = z.object({
  leaderId: z.string().min(1, 'Leader ID requerido'),
  expiresInDays: z.number().int().positive().default(30),
});

// ============================================
// HELPERS
// ============================================

async function getDb() {
  try {
    const app = await getApp();
    console.log('getApp returned:', app ? 'app instance' : 'undefined');
    return getFirestore(app);
  } catch (error) {
    console.error('Error getting Firestore:', error);
    throw error;
  }
}

async function getAuthAdmin() {
  return getAuth(await getApp());
}

// ============================================
// ACTIONS: ADMIN - GESTIÓN DE CÓDIGOS DE INVITACIÓN
// ============================================

/**
 * Generar código de invitación para líder
 * Solo admin
 */
export async function generateLeaderInviteCode(
  communityId: string,
  maxUses: number = 1,
  expiresInDays: number = 30
): Promise<{
  success: boolean;
  message: string;
  inviteCode?: string;
  inviteUrl?: string;
}> {
  const validated = GenerateLeaderInviteSchema.safeParse({
    communityId,
    maxUses,
    expiresInDays,
  });

  if (!validated.success) {
    return {
      success: false,
      message: validated.error.errors[0]?.message || 'Validation failed',
    };
  }

  try {
    const db = await getDb();
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Generate unique code
    const code = nanoid(8).toUpperCase();

    const inviteRef = db.collection('community_invite_codes').doc();
    await inviteRef.set({
      id: inviteRef.id,
      code,
      communityId,
      maxUses,
      usedCount: 0,
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: Timestamp.now(),
      createdBy: 'admin',
      isActive: true,
      type: 'leader',
    });

    // Get the base URL from environment or use default
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://adma.app';

    return {
      success: true,
      message: 'Código de invitación generado',
      inviteCode: code,
      inviteUrl: `${baseUrl}/join/${code}`,
    };
  } catch (error) {
    console.error('Error generating leader invite code:', error);
    return {
      success: false,
      message: 'Error al generar el código de invitación',
    };
  }
}

/**
 * Generar código de invitación para miembro
 * Solo líder autenticado
 */
export async function generateMemberInviteCode(
  leaderId: string,
  expiresInDays: number = 30
): Promise<{
  success: boolean;
  message: string;
  inviteCode?: string;
  inviteUrl?: string;
}> {
  const validated = GenerateMemberInviteSchema.safeParse({
    leaderId,
    expiresInDays,
  });

  if (!validated.success) {
    return {
      success: false,
      message: validated.error.errors[0]?.message || 'Validation failed',
    };
  }

  try {
    const db = await getDb();
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Get leader's community
    const leaderDoc = await db.collection('community_leaders').doc(leaderId).get();
    if (!leaderDoc.exists) {
      return {
        success: false,
        message: 'Líder no encontrado',
      };
    }

    const leaderData = leaderDoc.data();
    const communityId = leaderData?.communityId;

    if (!communityId) {
      return {
        success: false,
        message: 'El líder no tiene una comunidad asignada',
      };
    }

    // Generate unique code
    const code = nanoid(8).toUpperCase();

    const inviteRef = db.collection('community_member_invites').doc();
    await inviteRef.set({
      id: inviteRef.id,
      code,
      communityId,
      leaderId,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt),
      isUsed: false,
      type: 'member',
    });

    // Get the base URL from environment or use default
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://adma.app';

    return {
      success: true,
      message: 'Código de invitación generado',
      inviteCode: code,
      inviteUrl: `${baseUrl}/join/member/${code}`,
    };
  } catch (error) {
    console.error('Error generating member invite code:', error);
    return {
      success: false,
      message: 'Error al generar el código de invitación',
    };
  }
}

/**
 * Obtener dashboard de comunidades (para admin)
 */
export async function getCommunitiesDashboard(): Promise<{
  success: boolean;
  message: string;
  data?: {
    totalCommunities: number;
    totalLeaders: number;
    totalMembers: number;
    communities: Array<{
      id: string;
      name: string;
      leaderName: string;
      memberCount: number;
      totalSales: number;
      totalCommission: number;
      createdAt: Date;
    }>;
  };
}> {
  try {
    const db = await getDb();

    // Get all communities
    const communitiesSnapshot = await db.collection('communities').get();

    const communities = await Promise.all(
      communitiesSnapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Get leader info
        let leaderName = 'Sin líder';
        if (data.leaderId) {
          const leaderDoc = await db.collection('community_leaders').doc(data.leaderId).get();
          if (leaderDoc.exists) {
            leaderName = leaderDoc.data()?.displayName || 'Sin nombre';
          }
        }

        return {
          id: doc.id,
          name: data.name,
          leaderName,
          memberCount: data.memberCount || 0,
          totalSales: data.totalSales || 0,
          totalCommission: data.totalCommission || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      })
    );

    // Get counts
    const leadersSnapshot = await db.collection('community_leaders').count().get();
    const membersSnapshot = await db.collection('community_members').count().get();

    return {
      success: true,
      message: 'Dashboard obtenido',
      data: {
        totalCommunities: communitiesSnapshot.size,
        totalLeaders: leadersSnapshot.data().count || 0,
        totalMembers: membersSnapshot.data().count || 0,
        communities,
      },
    };
  } catch (error) {
    console.error('Error getting communities dashboard:', error);
    return {
      success: false,
      message: 'Error al obtener el dashboard',
    };
  }
}

/**
 * Obtener ranking de comunidades
 */
export async function getCommunityRanking(): Promise<{
  success: boolean;
  message: string;
  data?: Array<{
    rank: number;
    communityId: string;
    communityName: string;
    leaderName: string;
    memberCount: number;
    totalCommission: number;
  }>;
}> {
  try {
    const db = await getDb();

    const communitiesSnapshot = await db
      .collection('communities')
      .orderBy('totalCommission', 'desc')
      .limit(10)
      .get();

    const ranking = await Promise.all(
      communitiesSnapshot.docs.map(async (doc, index) => {
        const data = doc.data();

        let leaderName = 'Sin líder';
        if (data.leaderId) {
          const leaderDoc = await db.collection('community_leaders').doc(data.leaderId).get();
          if (leaderDoc.exists) {
            leaderName = leaderDoc.data()?.displayName || 'Sin nombre';
          }
        }

        return {
          rank: index + 1,
          communityId: doc.id,
          communityName: data.name,
          leaderName,
          memberCount: data.memberCount || 0,
          totalCommission: data.totalCommission || 0,
        };
      })
    );

    return {
      success: true,
      message: 'Ranking obtenido',
      data: ranking,
    };
  } catch (error) {
    console.error('Error getting community ranking:', error);
    return {
      success: false,
      message: 'Error al obtener el ranking',
    };
  }
}

/**
 * Obtener miembros de una comunidad (para líder)
 */
export async function getLeaderMembers(leaderId: string): Promise<{
  success: boolean;
  message: string;
  data?: Array<{
    id: string;
    name: string;
    email: string;
    joinedAt: Date;
    status: string;
  }>;
}> {
  try {
    const db = await getDb();

    const membersSnapshot = await db
      .collection('community_members')
      .where('leaderId', '==', leaderId)
      .get();

    const members = membersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.displayName,
        email: data.email,
        joinedAt: data.joinedAt?.toDate() || new Date(),
        status: data.status || 'active',
      };
    });

    return {
      success: true,
      message: 'Miembros obtenidos',
      data: members,
    };
  } catch (error) {
    console.error('Error getting leader members:', error);
    return {
      success: false,
      message: 'Error al obtener los miembros',
    };
  }
}

/**
 * Obtener stats de dropshipping de la comunidad del líder
 */
export async function getLeaderDropshippingStats(leaderId: string): Promise<{
  success: boolean;
  message: string;
  data?: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}> {
  try {
    const db = await getDb();

    // Get leader's community
    const leaderDoc = await db.collection('community_leaders').doc(leaderId).get();
    if (!leaderDoc.exists) {
      return {
        success: false,
        message: 'Líder no encontrado',
      };
    }

    const leaderData = leaderDoc.data();
    const communityId = leaderData?.communityId;

    if (!communityId) {
      return {
        success: false,
        message: 'El líder no tiene comunidad',
      };
    }

    // Get members of this community
    const membersSnapshot = await db
      .collection('community_members')
      .where('communityId', '==', communityId)
      .get();

    const memberIds = membersSnapshot.docs.map((doc) => doc.id);

    // Get dropshipping requests from members
    const allStats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    for (const memberId of memberIds) {
      const requestsSnapshot = await db
        .collection('dropshipping_requests')
        .where('userId', '==', memberId)
        .get();

      requestsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        allStats.total++;
        if (data.status === 'pending') allStats.pending++;
        else if (data.status === 'approved') allStats.approved++;
        else if (data.status === 'rejected') allStats.rejected++;
      });
    }

    return {
      success: true,
      message: 'Stats obtenidos',
      data: allStats,
    };
  } catch (error) {
    console.error('Error getting leader dropshipping stats:', error);
    return {
      success: false,
      message: 'Error al obtener stats',
    };
  }
}
