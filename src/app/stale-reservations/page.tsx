
import { getStaleReservationAlerts } from '@/lib/api';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { StaleReservationsContent } from '@/components/stale-reservations-content';

export default async function StaleReservationsPage() {
    const alerts = await getStaleReservationAlerts();

    return (
      <AuthProviderWrapper allowedRoles={['admin']}>
        <StaleReservationsContent initialAlerts={alerts} />
      </AuthProviderWrapper>
    );
}
