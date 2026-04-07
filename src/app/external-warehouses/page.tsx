import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import { ExternalWarehouseContainer } from './components/external-warehouse-container';

export default function ExternalWarehousesPage() {
  return (
    <AuthProviderWrapper allowedRoles={['admin', 'plataformas']}>
      <div className="container mx-auto py-6 px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bodegas Externas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona el inventario de tus operadores logísticos externos. Carga el Excel diario, mapea productos y visualiza rotación.
          </p>
        </div>
        <ExternalWarehouseContainer />
      </div>
    </AuthProviderWrapper>
  );
}
