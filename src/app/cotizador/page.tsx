import { CotizadorWizard } from '@/components/cotizador/cotizador-wizard';

export const dynamic = 'force-dynamic';

// Ruta pública: no lleva AuthProviderWrapper. La Fase 0 del plan añade el rol `cliente`
// y la verificación de correo; hasta entonces se puede cotizar sin cuenta, y la escritura
// la hace el servidor con el admin SDK, no el navegador.
export default function CotizadorPage() {
    return (
        <div className="min-h-screen bg-muted/20 py-8 px-4">
            <div className="max-w-2xl mx-auto mb-6 text-center">
                <h1 className="text-3xl font-bold font-headline tracking-tight">Cotiza tu maquila</h1>
                <p className="text-muted-foreground mt-1">
                    Cuéntanos qué quieres fabricar y te respondemos con una propuesta.
                </p>
            </div>
            <CotizadorWizard />
        </div>
    );
}
