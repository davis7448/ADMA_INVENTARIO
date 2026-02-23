import { Timestamp } from 'firebase/firestore';

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
  createdAt: Timestamp;
}

export interface CommunityMember {
  id: string;
  email: string;
  displayName: string;
  leaderId: string;
  communityId: string;
  referredBy?: string;
  joinedAt: Timestamp;
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
}

export interface RegisterMemberDTO {
  email: string;
  displayName: string;
  inviteCode: string;
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
