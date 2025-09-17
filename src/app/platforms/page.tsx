
import { getPlatforms } from '@/lib/api';
import type { Platform } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { PlatformsContent } from '@/components/platforms-content';

export default async function PlatformsPage() {
    const platforms: Platform[] = await getPlatforms();

    return (
      <AuthProviderWrapper allowedRoles={['admin']}>
        <PlatformsContent initialPlatforms={platforms} />
      </AuthProviderWrapper>
    );
}
