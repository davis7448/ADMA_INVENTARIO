
"use client";

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@/lib/types';
import { findUserByEmail, addUser } from '@/lib/api';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import { app } from '@/lib/firebase';


interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser?.email) {
        let appUser = await findUserByEmail(firebaseUser.email);
        
        if (!appUser) {
          // If no user profile exists in Firestore, create one
          console.log(`No profile found for ${firebaseUser.email}, creating one...`);
          const newUser: Omit<User, 'id'> = {
            name: firebaseUser.email.split('@')[0],
            email: firebaseUser.email,
            role: 'plataformas', // Default role for new sign-ups
            avatarUrl: `https://i.pravatar.cc/150?u=${firebaseUser.email}`
          };
          const newUserId = await addUser(newUser);
          appUser = { id: newUserId, ...newUser };
          console.log(`Profile created with ID: ${newUserId}`);
        }

        setUser(appUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (loading) return; // Don't do anything while loading

    // If we don't have a user and are not on the login page, redirect to login
    if (!user && pathname !== '/login') {
      router.push('/login');
    }
    // If we have a user and are on the login page, redirect to home
    if (user && pathname === '/login') {
        router.push('/');
    }
  }, [user, loading, pathname, router]);


  const login = async (email: string, password: string): Promise<boolean> => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // After successful sign-in, onAuthStateChanged will fire.
        // We force a redirect here to ensure navigation happens.
        router.push('/');
        return true;
    } catch (error) {
        console.error("Login failed:", error);
        return false;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    router.push('/login');
  };

  const value = { user, login, logout, loading };

  if (loading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <div>Loading...</div>
        </div>
    );
  }
  
  if (!user && pathname !== '/login') {
     // Don't render children if not logged in and not on login page
     // This prevents brief flashes of content before redirecting.
    return null;
  }
  
  // If user is logged in and on the login page, don't render children until redirect happens
  if (user && pathname === '/login') {
    return null;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
