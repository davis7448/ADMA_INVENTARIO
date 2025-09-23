

"use client";

import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { User, Warehouse } from '@/lib/types';
import { findUserByEmail, addUser, getWarehouses } from '@/lib/api';
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
  setWarehouse: (warehouseId: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const auth = getAuth(app);
  
  const { warehouses, currentWarehouse, setWarehouse, loading: warehouseLoading } = useWarehouse();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser?.email) {
        let appUser = await findUserByEmail(firebaseUser.email);
        
        if (!appUser) {
          // If no user profile exists in Firestore, create one
          console.log(`No se encontró perfil para ${firebaseUser.email}, creando uno...`);
          const newUser: Omit<User, 'id'> = {
            name: firebaseUser.email.split('@')[0],
            email: firebaseUser.email,
            role: 'commercial', // Default role for new sign-ups
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

    // If user has a specific warehouse, force it (unless they are admin or commercial)
    if (user?.warehouseId && warehouses.length > 0 && user.role !== 'admin' && user.role !== 'commercial') {
      if (currentWarehouse?.id !== user.warehouseId) {
        setWarehouse(user.warehouseId);
      }
    }

    const isLoginPage = pathname === '/login';

    if (!user && !isLoginPage) {
      router.push('/login');
    } else if (user && isLoginPage) {
      router.push('/');
    }
  }, [user, loading, warehouseLoading, pathname, router, warehouses, currentWarehouse, setWarehouse]);


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

  const value = { user, login, logout, loading: loading || warehouseLoading, warehouses, currentWarehouse, setWarehouse };

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
