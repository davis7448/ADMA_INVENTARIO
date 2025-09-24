

import { getRotationCategories, getUsers, getEntryReasons, getWarehouses, getLocations } from '@/lib/api';
import type { RotationCategory, User, EntryReason, Warehouse, Location } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { SettingsContent } from '@/components/settings-content';
import { Suspense } from 'react';

export default async function SettingsPage() {
    const [rotationCategories, users, entryReasons, warehouses, locations] = await Promise.all([
        getRotationCategories(),
        getUsers().catch(err => {
            console.warn("Could not fetch users. This is expected in the prototype environment if admin SDK is not configured.");
            return []; // Return empty array on error
        }),
        getEntryReasons(),
        getWarehouses(),
        getLocations(),
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
