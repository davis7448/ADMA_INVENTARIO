
import { getOrGenerateStockAlerts } from '@/lib/api';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { StockAlertsContent } from '@/components/stock-alerts-content';
import { subDays } from 'date-fns';

export default async function StockAlertsPage() {
    const result = await getOrGenerateStockAlerts();

    return (
      <AuthProviderWrapper allowedRoles={['admin', 'commercial', 'logistics']}>
        <StockAlertsContent 
          initialAlerts={result.alerts} 
          error={result.error} 
          lastGenerated={result.lastGenerated}
        />
      </AuthProviderWrapper>
    );
}
