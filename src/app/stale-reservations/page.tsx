
import { getStaleReservationAlerts, checkForStaleReservations } from '@/lib/api';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { StaleReservationsContent } from '@/components/stale-reservations-content';
import { Suspense } from 'react';

export default async function StaleReservationsPage() {
    // Run check for stale reservations when this page is loaded
    await checkForStaleReservations();
    const alerts = await getStaleReservationAlerts();

    return (
      <Suspense>
        <AuthProviderWrapper allowedRoles={['admin', 'plataformas']}>
          <StaleReservationsContent initialAlerts={alerts} />
        </AuthProviderWrapper>
      </Suspense>
    );
}
