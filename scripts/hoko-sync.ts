// Sincroniza las ventas de HOKO (vía panel) e importa al motor.
// Uso: npx tsx scripts/hoko-sync.ts [días] [--prueba]
import { fetchHokoOrders, type HokoCuenta } from '@/lib/hoko';
import { importPlatformSales } from '@/lib/platform-sales';

// Cada usuario de HOKO corresponde a una bodega de ADMA.
const CUENTAS: HokoCuenta[] = [
    { email: process.env.HOKO_IMPORTACIONES_EMAIL!, password: process.env.HOKO_IMPORTACIONES_PASSWORD!, bodega: 'IMPORTACIONES', pais: 'COLOMBIA' },
    { email: process.env.HOKO_LABORATORIO_EMAIL!, password: process.env.HOKO_LABORATORIO_PASSWORD!, bodega: 'LABORATORIO', pais: 'COLOMBIA' },
];

async function main() {
    const dias = Number(process.argv[2]) || 30;
    const prueba = process.argv.includes('--prueba');
    for (const cuenta of CUENTAS) {
        if (!cuenta.email || !cuenta.password) { console.log(`- ${cuenta.bodega}: sin credenciales, se omite`); continue; }
        console.log(`\n== HOKO ${cuenta.bodega} · ventana ${dias} días ==`);
        const t0 = Date.now();
        const filas = await fetchHokoOrders(cuenta, dias, m => process.stdout.write('\r  ' + m + '        '));
        console.log(`\n  ${filas.length} órdenes en ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        const estados: Record<string, number> = {};
        filas.forEach(f => { estados[f.estado] = (estados[f.estado] || 0) + 1; });
        console.log('  estados:', JSON.stringify(estados));
        if (prueba) { console.log('  (modo prueba: no se importa)'); continue; }
        if (!filas.length) continue;
        const r = await importPlatformSales('HOKO', filas, 45, { bodega: cuenta.bodega, pais: cuenta.pais });
        console.log('  →', JSON.stringify({ nuevas: r.nuevas, actualizadas: r.actualizadas, entregadas: r.entregadas }));
    }
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
