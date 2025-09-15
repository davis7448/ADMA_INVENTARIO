"use client";

import { useAuth } from '@/hooks/use-auth';
import type { User, UserRole } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AuthProviderWrapperProps {
  allowedRoles: UserRole[];
  children: (user: User | null) => React.ReactNode;
}

export function AuthProviderWrapper({ allowedRoles, children }: AuthProviderWrapperProps) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !allowedRoles.includes(user.role)) {
      router.push('/');
    }
  }, [user, router, allowedRoles]);

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No tienes permiso para ver esta página.</p>
      </div>
    );
  }

  return <>{children(user)}</>;
}
