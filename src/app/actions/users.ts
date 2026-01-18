

"use server";

import { z } from 'zod';
import { getAuth } from 'firebase-admin/auth';
// We are re-importing the app here to ensure environment variables are loaded before initialization.
import { getApp } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { findUserByEmail, addUser, updateUserProfile, updateUserRoleInDb, sendPasswordReset, uploadImageAndGetURL, updateUserWarehouseInDb } from '@/lib/api';
import type { CreateUserFormState, CreateUserFormValues, UpdateProfileFormValues, UpdateProfileFormState } from '@/lib/definitions';
import { CreateUserFormSchema, UpdateProfileFormSchema } from '@/lib/definitions';
import type { User, UserRole } from '@/lib/types';
import { app as clientApp } from '@/lib/firebase';

export async function createUserAction(
  data: CreateUserFormValues
): Promise<CreateUserFormState> {

  // This action requires admin privileges which we can't check on the client,
  // but would typically check here using the session.
  // For this demo, we assume the check happens on the page level.

  const validatedFields = CreateUserFormSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      message: 'La validación falló. Por favor, revisa tus entradas.',
      errors: validatedFields.error.flatten().fieldErrors,
      success: false,
    };
  }

  const { name, email, password, role } = validatedFields.data;

  try {
    const adminApp = await getApp();
    const auth = getAuth(adminApp);
    // Create user in Firebase Auth
    await auth.createUser({
      email,
      password,
      displayName: name,
    });


    // Create user profile in Firestore
    await addUser({
      name,
      email,
      role,
      avatarUrl: `https://i.pravatar.cc/150?u=${email}`,
      commercialCode: validatedFields.data.commercialCode,
    });
    
    revalidatePath('/settings');
    return {
      message: 'Usuario creado con éxito.',
      success: true,
    };
  } catch (error: any) {
    console.error("Error creating user:", error);
    let errorMessage = 'Ocurrió un error inesperado.';
    if (error.message.includes('FIREBASE_PRIVATE_KEY')) {
        errorMessage = "La creación de usuarios está deshabilitada en el entorno de prototipado. Por favor, despliega la aplicación y configura los secretos del servidor.";
    } else if (error.code === 'auth/email-already-exists') {
        errorMessage = 'Ya existe un usuario con este correo electrónico en Firebase Authentication.';
    }
    return {
      message: errorMessage,
      success: false,
    };
  }
}

export async function updateUserRoleAction(userId: string, role: UserRole): Promise<{ success: boolean, message: string }> {
    try {
        await updateUserRoleInDb(userId, role);
        revalidatePath('/settings');
        return { success: true, message: 'Rol de usuario actualizado con éxito.' };
    } catch (error) {
        console.error("Error updating user role:", error);
        return { success: false, message: 'No se pudo actualizar el rol del usuario.' };
    }
}

export async function updateUserWarehouseAction(userId: string, warehouseId: string): Promise<{ success: boolean; message: string }> {
    try {
        await updateUserWarehouseInDb(userId, warehouseId);
        revalidatePath('/settings');
        return { success: true, message: 'Bodega del usuario actualizada con éxito.' };
    } catch (error) {
        console.error("Error updating user warehouse:", error);
        return { success: false, message: 'No se pudo actualizar la bodega del usuario.' };
    }
}

export async function updateUserSalaryAction(userId: string, salary: number): Promise<{ success: boolean; message: string }> {
    try {
        await updateUserProfile(userId, { salary });
        revalidatePath('/settings');
        revalidatePath('/tablero-resultados');
        return { success: true, message: 'Salario del usuario actualizado con éxito.' };
    } catch (error) {
        console.error("Error updating user salary:", error);
        return { success: false, message: 'No se pudo actualizar el salario del usuario.' };
    }
}

export async function resetUserPasswordAction(email: string): Promise<{ success: boolean, message: string }> {
    try {
        await sendPasswordReset(email);
        return { success: true, message: 'Correo de restablecimiento de contraseña enviado con éxito.' };
    } catch (error) {
        console.error("Error sending password reset email:", error);
        return { success: false, message: 'No se pudo enviar el correo de restablecimiento de contraseña.' };
    }
}

export async function updateUserCommercialCodeAction(userId: string, commercialCode: string): Promise<{ success: boolean; message: string }> {
    try {
        await updateUserProfile(userId, { commercialCode });
        revalidatePath('/settings');
        return { success: true, message: 'Código comercial actualizado con éxito.' };
    } catch (error) {
        console.error("Error updating user commercial code:", error);
        return { success: false, message: 'No se pudo actualizar el código comercial del usuario.' };
    }
}

export async function updateUserAction(userId: string, formData: FormData): Promise<UpdateProfileFormState> {
    
    const validatedFields = UpdateProfileFormSchema.safeParse({
        name: formData.get('name'),
        phone: formData.get('phone'),
        avatar: formData.get('avatar'),
    });

    if (!validatedFields.success) {
        const fieldErrors = validatedFields.error.flatten().fieldErrors;
        const firstError = Object.values(fieldErrors).flat()[0] || 'La validación falló. Por favor, revisa tus entradas.';
        return {
            message: firstError,
            errors: fieldErrors,
            success: false,
        };
    }

    try {
        const { avatar, ...profileData } = validatedFields.data;
        let avatarUrl: string | undefined = undefined;

        const imageFile = formData.get('avatar');
        if (imageFile instanceof File && imageFile.size > 0) {
            avatarUrl = await uploadImageAndGetURL(imageFile);
        }

        const profileUpdate: Partial<Omit<User, 'id'>> = {
            ...profileData,
        };

        if (avatarUrl) {
            profileUpdate.avatarUrl = avatarUrl;
        }

        await updateUserProfile(userId, profileUpdate);

        revalidatePath('/settings');
        revalidatePath('/'); // To update header avatar

        return {
            message: 'Perfil actualizado con éxito.',
            success: true,
        };

    } catch(error) {
        console.error("Error updating profile:", error);
        const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
        return {
            message: errorMessage,
            success: false,
        };
    }
}
