"use server";

import { z } from 'zod';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';

// ============================================
// CONSTANTES DE VALIDACIÓN
// ============================================

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ============================================
// ESQUEMAS DE VALIDACIÓN
// ============================================

export const DropshippingSchema = z.object({
  productLink: z.string().url('Link de producto inválido'),
  quantity: z.number().int().positive('Cantidad debe ser positiva'),
  country: z.string().min(2, 'País requerido'),
  observations: z.string().max(500, 'Observaciones muy largas').optional(),
  modality: z.enum(['dropshipping', 'bulk', 'both']),
});

// Schema for submission (includes imageUrl and userId from form)
export const SubmitDropshippingSchema = z.object({
  productLink: z.string().url('Link de producto inválido'),
  quantity: z.number().int().positive('Cantidad debe ser positiva'),
  country: z.string().min(2, 'País requerido'),
  observations: z.string().max(500, 'Observaciones muy largas').optional(),
  modality: z.enum(['dropshipping', 'bulk', 'both']),
  imageUrl: z.string(),
  userId: z.string(),
});

export const ApprovalSchema = z.object({
  requestId: z.string(),
  approvedQuantity: z.number().int().positive(),
  approvedModality: z.enum(['dropshipping', 'bulk', 'both']),
  adminResponse: z.string().optional(),
});

export const RejectionSchema = z.object({
  requestId: z.string(),
  adminResponse: z.string().min(1, 'Razón requerida'),
});

// ============================================
// HELPERS
// ============================================

async function getDb() {
  return getFirestore();
}

function validateImageFile(image: File): { valid: boolean; error?: string } {
  if (!image || !image.type) {
    return { valid: false, error: 'Imagen requerida' };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
    return { valid: false, error: `Tipo de imagen no permitido. Solo: ${ALLOWED_IMAGE_TYPES.join(', ')}` };
  }

  if (image.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `Imagen muy grande. Máximo: ${MAX_IMAGE_SIZE / 1024 / 1024}MB` };
  }

  return { valid: true };
}

// ============================================
// ACTIONS
// ============================================

export async function submitDropshippingRequest(
  data: {
    productLink: string;
    quantity: number;
    country: string;
    observations?: string;
    modality: 'dropshipping' | 'bulk' | 'both';
    imageUrl: string;
    userId: string;
  }
): Promise<{ success: boolean; message: string; requestId?: string }> {
  const validated = SubmitDropshippingSchema.safeParse(data);

  if (!validated.success) {
    return {
      success: false,
      message: validated.error.errors[0]?.message || 'Validation failed',
    };
  }

  const { productLink, quantity, country, observations, modality, imageUrl, userId } = validated.data;

  try {
    const db = await getDb();

    const requestRef = await db.collection('dropshipping_requests').add({
      userId,
      imageUrl,
      productLink,
      quantity,
      country,
      observations: observations || null,
      modality,
      status: 'pending',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    revalidatePath('/dropshipping');
    
    return {
      success: true,
      message: 'Solicitud enviada correctamente',
      requestId: requestRef.id,
    };
  } catch (error: any) {
    console.error('Error submitting dropshipping request:', error);
    return {
      success: false,
      message: error.message || 'Error al enviar solicitud',
    };
  }
}

export async function getDropshippingRequests(
  filters?: {
    status?: 'pending' | 'approved' | 'rejected';
    userId?: string;
  }
): Promise<{
  success: boolean;
  requests?: Array<{
    id: string;
    userId: string;
    imageUrl: string;
    productLink: string;
    quantity: number;
    country: string;
    observations?: string;
    modality: string;
    status: string;
    adminResponse?: string;
    approvedQuantity?: number;
    approvedModality?: string;
    reviewedBy?: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  message?: string;
}> {
  try {
    const db = await getDb();
    let query = db.collection('dropshipping_requests').orderBy('createdAt', 'desc');

    if (filters?.status) {
      query = query.where('status', '==', filters.status) as any;
    }
    if (filters?.userId) {
      query = query.where('userId', '==', filters.userId) as any;
    }

    const snapshot = await query.limit(100).get();

    const requests = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        imageUrl: data.imageUrl,
        productLink: data.productLink,
        quantity: data.quantity,
        country: data.country,
        observations: data.observations,
        modality: data.modality,
        status: data.status,
        adminResponse: data.adminResponse,
        approvedQuantity: data.approvedQuantity,
        approvedModality: data.approvedModality,
        reviewedBy: data.reviewedBy,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      };
    });

    return { success: true, requests };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function getPendingDropshippingCount(): Promise<{
  success: boolean;
  count?: number;
}> {
  try {
    const db = await getDb();
    const snapshot = await db.collection('dropshipping_requests')
      .where('status', '==', 'pending')
      .count()
      .get();
    
    return { success: true, count: snapshot.data().count };
  } catch (error: any) {
    return { success: false };
  }
}

export async function approveDropshippingRequest(
  data: z.infer<typeof ApprovalSchema>
): Promise<{ success: boolean; message: string }> {
  const validated = ApprovalSchema.safeParse(data);

  if (!validated.success) {
    return { success: false, message: 'Invalid data' };
  }

  const { requestId, approvedQuantity, approvedModality, adminResponse } = validated.data;

  try {
    const db = await getDb();
    
    await db.collection('dropshipping_requests').doc(requestId).update({
      status: 'approved',
      approvedQuantity,
      approvedModality,
      adminResponse: adminResponse || null,
      reviewedBy: 'admin', // Should come from session
      updatedAt: Timestamp.now(),
    });

    revalidatePath('/dropshipping/admin');
    
    return { success: true, message: 'Solicitud aprobada' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function rejectDropshippingRequest(
  data: z.infer<typeof RejectionSchema>
): Promise<{ success: boolean; message: string }> {
  const validated = RejectionSchema.safeParse(data);

  if (!validated.success) {
    return { success: false, message: 'Invalid data' };
  }

  const { requestId, adminResponse } = validated.data;

  try {
    const db = await getDb();
    
    await db.collection('dropshipping_requests').doc(requestId).update({
      status: 'rejected',
      adminResponse,
      reviewedBy: 'admin', // Should come from session
      updatedAt: Timestamp.now(),
    });

    revalidatePath('/dropshipping/admin');
    
    return { success: true, message: 'Solicitud rechazada' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export { validateImageFile, MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES };
