
"use client";

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { User, Warehouse } from '@/lib/types';
import { findUserByEmail, addUser } from '@/lib/api';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import { app } from '@/lib/firebase';
import { useWarehouse } from '@/hooks/use-warehouse';


interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  warehouses: Warehouse[];
  currentWarehouse: Warehouse | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const auth = getAuth(app);
  
  const searchParams = useSearchParams();
  const warehouseIdFromUrl = searchParams.get('warehouse');
  const { warehouses, currentWarehouse, loading: warehouseLoading } = useWarehouse(warehouseIdFromUrl);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser?.email) {
        let appUser = await findUserByEmail(firebaseUser.email);
        
        if (!appUser) {
          console.log(`No se encontró perfil para ${firebaseUser.email}, creando uno...`);
          const newUser: Omit<User, 'id'> = {
            name: firebaseUser.email.split('@')[0],
            email: firebaseUser.email,
            role: 'commercial', 
            avatarUrl: `https://i.pravatar.cc/150?u=${firebaseUser.email}`
          };
          const newUserId = await addUser(newUser);
          appUser = { id: newUserId, ...newUser };
          console.log(`Perfil creado con ID: ${newUserId}`);
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
    if (loading || warehouseLoading) return;

    const isLoginPage = pathname === '/login';

    if (!user) {
      if (!isLoginPage) {
        router.push('/login');
      }
      return;
    }

    if (isLoginPage) {
      router.push('/');
      return;
    }
    
    const canChangeWarehouse = user.role === 'admin' || user.role === 'commercial';
    if (!canChangeWarehouse && user.warehouseId) {
      const currentUrlWarehouse = searchParams.get('warehouse');
      if (currentUrlWarehouse !== user.warehouseId) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('warehouse', user.warehouseId);
        // Use replace to avoid adding to browser history
        router.replace(`${pathname}?${params.toString()}`);
      }
    } else if (!searchParams.has('warehouse') && user.warehouseId && !canChangeWarehouse) {
        // If no warehouse is in the URL, but the user has one assigned, redirect
        const params = new URLSearchParams(searchParams.toString());
        params.set('warehouse', user.warehouseId);
        router.replace(`${pathname}?${params.toString()}`);
    }

  }, [user, loading, warehouseLoading, pathname, router, searchParams]);


  const login = async (email: string, password: string): Promise<boolean> => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        return true;
    } catch (error) {
        console.error("Falló el inicio de sesión:", error);
        return false;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    router.push('/login');
  };

  const value = { user, login, logout, loading: loading || warehouseLoading, warehouses, currentWarehouse };

  if (loading || warehouseLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <div>Cargando...</div>
        </div>
    );
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
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
