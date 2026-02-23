"use server";

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getUnassignedUsers, getAllAreas, setUserPosition, getAllUserPositions, type UserBasic } from '@/lib/commercial-api';

// Schema para asignar usuario a área
const AssignUserSchema = z.object({
  userId: z.string().min(1, "El ID del usuario es requerido"),
  areaId: z.string().min(1, "El área es requerida"),
  cargo: z.string().min(1, "El cargo es requerido"),
  nivel: z.number().min(1).max(3, "El nivel debe ser 1, 2 o 3"),
});

export type AssignUserFormState = {
  message: string;
  success: boolean;
  errors?: {
    userId?: string[];
    areaId?: string[];
    cargo?: string[];
    nivel?: string[];
  };
};

/**
 * Obtiene la lista de usuarios sin área asignada
 */
export async function getUnassignedUsersAction(): Promise<UserBasic[]> {
  try {
    return await getUnassignedUsers();
  } catch (error) {
    console.error("Error getting unassigned users:", error);
    return [];
  }
}

/**
 * Obtiene todas las áreas disponibles
 */
export async function getAreasAction() {
  try {
    return await getAllAreas();
  } catch (error) {
    console.error("Error getting areas:", error);
    return [];
  }
}

/**
 * Obtiene todas las posiciones de usuarios
 */
export async function getUserPositionsAction() {
  try {
    return await getAllUserPositions();
  } catch (error) {
    console.error("Error getting user positions:", error);
    return [];
  }
}

/**
 * Asigna un usuario a un área
 */
export async function assignUserToAreaAction(
  formData: FormData
): Promise<AssignUserFormState> {
  const validatedFields = AssignUserSchema.safeParse({
    userId: formData.get('userId'),
    areaId: formData.get('areaId'),
    cargo: formData.get('cargo'),
    nivel: Number(formData.get('nivel')),
  });

  if (!validatedFields.success) {
    return {
      message: 'La validación falló',
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { userId, areaId, cargo, nivel } = validatedFields.data;

  try {
    await setUserPosition(userId, {
      areaId,
      cargo,
      nivel,
      posicionX: 50,
      posicionY: 50,
    });

    revalidatePath('/commercial/tareas');
    revalidatePath('/commercial/tareas?tab=organigrama');

    return {
      message: 'Usuario asignado correctamente al área',
      success: true,
    };
  } catch (error) {
    console.error("Error assigning user to area:", error);
    return {
      message: 'Error al asignar el usuario. Intenta de nuevo.',
      success: false,
    };
  }
}
