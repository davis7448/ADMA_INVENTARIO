
import { getRotationCategories } from '@/lib/api';
import type { RotationCategory } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { SettingsContent } from '@/components/settings-content';

export default async function SettingsPage() {
    const rotationCategories: RotationCategory[] = await getRotationCategories();

    return (
      <AuthProviderWrapper allowedRoles={['admin', 'plataformas']}>
        <SettingsContent initialRotationCategories={rotationCategories} />
      </AuthProviderWrapper>
    );
}
