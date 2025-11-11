
import { getStaleReservationAlerts, checkForStaleReservations } from '@/lib/api';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { StaleReservationsContent } from '@/components/stale-reservations-content';
import { Suspense } from 'react';

export default async function StaleReservationsPage() {
    // Run check for stale reservations when this page is loaded
    try {
        await checkForStaleReservations();
    } catch (error) {
        console.warn('Failed to check for stale reservations during build:', error);
    }

    let alerts: any[] = [];
    try {
        alerts = await getStaleReservationAlerts();
    } catch (error) {
        console.warn('Failed to fetch stale reservation alerts during build:', error);
        alerts = [];
    }

    return (
      <Suspense>
        <AuthProviderWrapper allowedRoles={['admin', 'plataformas']}>
          <StaleReservationsContent initialAlerts={alerts} />
        </AuthProviderWrapper>
      </Suspense>
    );
}
