import { Timestamp } from 'firebase/firestore';

// ============================================
// TIPOS DE INVITACIÓN (NUEVO)
// ============================================

export type InviteType = 'leader' | 'member';

export interface CommunityInviteCode {
  id: string;
  code: string;
  communityId: string;
  leaderId?: string;
  maxUses?: number;
  usedCount: number;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
  isActive: boolean;
  type: InviteType;
}

export interface CommunityMemberInvite {
  id: string;
  code: string;
  communityId: string;
  leaderId: string;
  memberId?: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  isUsed: boolean;
  type: 'member';
}

// ============================================
// COMUNIDADES
// ============================================

export interface Community {
  id: string;
  name: string;
  leaderId: string;
  description?: string;
  inviteCode: string;
  memberCount: number;
  totalSales: number;
  totalCommission: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CommunityLeader {
  id: string;
  email: string;
  displayName: string;
  phone?: string;
  communityId?: string;
  verified: boolean;
  commissionRate: number;
  totalCommission: number;
  rank: number;
  inviteCode: string;       // Código de invitación usado
  registeredAt: Timestamp;  // Fecha de registro
  status: 'pending' | 'active' | 'suspended';
  createdAt: Timestamp;
}

export interface CommunityMember {
  id: string;
  email: string;
  displayName: string;
  leaderId: string;
  communityId: string;
  userId: string;           // FK al usuario (Auth)
  referredBy?: string;
  joinedAt: Timestamp;
  status: 'active' | 'inactive';
}

export interface CommunityRanking {
  leaderId: string;
  leaderName: string;
  communityName: string;
  totalCommission: number;
  memberCount: number;
  rank: number;
}

// DTOs para registro
export interface RegisterLeaderDTO {
  email: string;
  displayName: string;
  phone?: string;
  communityName: string;
  communityDescription?: string;
  inviteCode: string;       // Código de invitación
}

export interface RegisterMemberDTO {
  email: string;
  displayName: string;
  inviteCode: string;
}

// DTOs para Admin
export interface GenerateLeaderInviteDTO {
  communityId: string;
  maxUses?: number;
}

export interface GenerateMemberInviteDTO {
  leaderId: string;
}

// ============================================
// RETOS
// ============================================

export type ChallengeType = 'individual' | 'community';
export type ChallengeStatus = 'active' | 'completed' | 'cancelled';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: ChallengeType;
  communityId?: string;
  targetMetric: string;
  targetValue: number;
  prize: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: ChallengeStatus;
  createdBy: string;
  createdAt: Timestamp;
}

export interface CreateChallengeDTO {
  title: string;
  description: string;
  type: ChallengeType;
  communityId?: string;
  targetMetric: string;
  targetValue: number;
  prize: string;
  startDate: Date;
  endDate: Date;
}

// ============================================
// DROPSHIPPING
// ============================================

export type DropshippingStatus = 'pending' | 'approved' | 'rejected';
export type DropshippingModality = 'dropshipping' | 'bulk' | 'both';

export interface DropshippingRequest {
  id: string;
  userId: string;
  imageUrl: string;
  productLink: string;
  quantity: number;
  country: string;
  observations: string;
  modality: DropshippingModality;
  status: DropshippingStatus;
  adminResponse?: string;
  approvedQuantity?: number;
  approvedModality?: string;
  reviewedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DropshippingDTO {
  imageUrl: string;
  productLink: string;
  quantity: number;
  country: string;
  observations: string;
  modality: DropshippingModality;
}

export interface DropshippingApprovalDTO {
  approvedQuantity: number;
  approvedModality: DropshippingModality;
  adminResponse?: string;
}

export interface DropshippingRejectionDTO {
  adminResponse: string;
}
