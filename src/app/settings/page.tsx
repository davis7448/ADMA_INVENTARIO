

import { getRotationCategories, getUsers, getEntryReasons, getWarehouses, getLocations } from '@/lib/api';
import type { RotationCategory, User, EntryReason, Warehouse, Location } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { SettingsContent } from '@/components/settings-content';
import { Suspense } from 'react';

export default async function SettingsPage() {
    const [rotationCategories, users, entryReasons, warehouses, locations] = await Promise.all([
        getRotationCategories().catch(err => {
            console.warn('Failed to fetch rotation categories during build:', err);
            return [];
        }),
        getUsers().catch(err => {
            console.warn("Could not fetch users. This is expected in the prototype environment if admin SDK is not configured.");
            return []; // Return empty array on error
        }),
        getEntryReasons().catch(err => {
            console.warn('Failed to fetch entry reasons during build:', err);
            return [];
        }),
        getWarehouses().catch(err => {
            console.warn('Failed to fetch warehouses during build:', err);
            return [];
        }),
        getLocations().catch(err => {
            console.warn('Failed to fetch locations during build:', err);
            return [];
        }),
    ]);

    return (
      <Suspense>
        <AuthProviderWrapper allowedRoles={['admin', 'plataformas', 'commercial', 'logistics']}>
          <SettingsContent 
              initialRotationCategories={rotationCategories} 
              initialUsers={users}
              initialEntryReasons={entryReasons}
              initialWarehouses={warehouses}
              initialLocations={locations}
          />
        </AuthProviderWrapper>
      </Suspense>
    );
}
