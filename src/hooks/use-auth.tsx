
"use client";

import React, { createContext, useState, useContext, useEffect, ReactNode, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { User, Warehouse } from '@/lib/types';
import { findUserByEmail, addUser } from '@/lib/api';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import { app } from '@/lib/firebase';
import { useWarehouse } from '@/hooks/use-warehouse';
import { Loader2 } from 'lucide-react';


interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  warehouses: Warehouse[];
  currentWarehouse: Warehouse | null;
  effectiveWarehouseId: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const auth = getAuth(app);
  
  const searchParams = useSearchParams();
  
  // Determine the effective warehouseId for data fetching
  const effectiveWarehouseId = useMemo(() => {
      if (user?.role === 'logistics') {
          return user.warehouseId || 'wh-bog';
      }
      return searchParams.get('warehouse');
  }, [user, searchParams]);
  const { warehouses, currentWarehouse, loading: warehouseLoading } = useWarehouse(effectiveWarehouseId);

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
    }

  }, [user, loading, warehouseLoading, pathname, router]);


  const login = async (email: string, password: string): Promise<boolean> => {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await result.user.getIdToken();

        // Set session cookie
        const response = await fetch('/api/set-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        });
        if (!response.ok) {
            throw new Error('Failed to set session');
        }

        console.log('Login successful');
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

  const value = { user, login, logout, loading: loading || warehouseLoading, warehouses, currentWarehouse, effectiveWarehouseId };

  if (loading || warehouseLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
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
