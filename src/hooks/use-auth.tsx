
"use client";

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@/lib/types';
import { findUserByEmail } from '@/lib/api';
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
        const appUser = await findUserByEmail(firebaseUser.email);
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

    // If we have a user and are on the login page, redirect to home
    if (user && pathname === '/login') {
      router.push('/');
    }

    // If we don't have a user and are not on the login page, redirect to login
    if (!user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);


  const login = async (email: string, password: string): Promise<boolean> => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle setting the user, and the useEffect will handle redirection.
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
