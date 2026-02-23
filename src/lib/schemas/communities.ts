import { z } from 'zod';

// ============================================
// ESQUEMAS DE VALIDACIÓN - COMUNIDADES
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
