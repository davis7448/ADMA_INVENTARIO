
"use server";

import { z } from 'zod';
import { getAuth } from 'firebase-admin/auth';
import { app as adminApp } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { findUserByEmail, addUser, updateUserRoleInDb, sendPasswordReset } from '@/lib/api';
import type { CreateUserFormState, CreateUserFormValues } from '@/lib/definitions';
import { CreateUserFormSchema } from '@/lib/definitions';
import type { UserRole } from '@/lib/types';

// Helper to check if the caller is an admin
async function isAdmin(email: string | undefined): Promise<boolean> {
    if (!email) return false;
    const user = await findUserByEmail(email);
    return user?.role === 'admin';
}

export async function createUserAction(
  data: CreateUserFormValues
): Promise<CreateUserFormState> {

  // This action requires admin privileges which we can't check on the client,
  // but would typically check here using the session.
  // For this demo, we assume the check happens on the page level.

  const validatedFields = CreateUserFormSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      message: 'Validation failed. Please check your inputs.',
      errors: validatedFields.error.flatten().fieldErrors,
      success: false,
    };
  }

  const { name, email, password, role } = validatedFields.data;

  try {
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
    });
    
    revalidatePath('/settings');
    return {
      message: 'User created successfully.',
      success: true,
    };
  } catch (error: any) {
    console.error("Error creating user:", error);
    let errorMessage = 'An unexpected error occurred.';
    if (error.code === 'auth/email-already-exists') {
        errorMessage = 'A user with this email already exists in Firebase Authentication.';
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
        return { success: true, message: 'User role updated successfully.' };
    } catch (error) {
        console.error("Error updating user role:", error);
        return { success: false, message: 'Failed to update user role.' };
    }
}

export async function resetUserPasswordAction(email: string): Promise<{ success: boolean, message: string }> {
    try {
        await sendPasswordReset(email);
        return { success: true, message: 'Password reset email sent successfully.' };
    } catch (error) {
        console.error("Error sending password reset email:", error);
        return { success: false, message: 'Failed to send password reset email.' };
    }
}
