import { CotizadorWizard } from '@/components/cotizador/cotizador-wizard';

export const dynamic = 'force-dynamic';

// Ruta pública: no lleva AuthProviderWrapper. La Fase 0 del plan añade el rol `cliente`
// y la verificación de correo; hasta entonces se puede cotizar sin cuenta, y la escritura
// la hace el servidor con el admin SDK, no el navegador.
//
// El formulario V5 trae su propia cabecera y fondo (el layout general le quita el
// padding a esta ruta) y carga la fuente Sora de los títulos, que es la del prototipo
// aprobado (el resto de la app usa Poppins).
export default function CotizadorPage() {
    return (
        <div>
            <link rel="stylesheet" precedence="default" href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&display=swap" />
            <style>{`.cotizador-v5 .sora, .cotizador-v5 h1, .cotizador-v5 h2, .cotizador-v5 h3 { font-family: 'Sora', 'Poppins', sans-serif; }`}</style>
            <CotizadorWizard />
        </div>
    );
}
