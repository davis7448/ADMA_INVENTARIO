// Backfill único del histórico de Venndelo, corriendo LOCAL (sin el límite de
// 5 min de la request HTTP del cron). Reusa exactamente la misma lógica.
// Uso: VENNDELO_REFRESH_TOKEN=xxx npx tsx scripts/backfill-venndelo.ts [días]
import { fetchVenndeloOrders } from '@/lib/venndelo';
import { importPlatformSales } from '@/lib/platform-sales';

async function main() {
    const days = Number(process.argv[2]) || 3650; // 10 años = todo el histórico
    console.log(`\n== Backfill Venndelo — ventana ${days} días ==`);
    const t0 = Date.now();
    const rows = await fetchVenndeloOrders(days, (m) => process.stdout.write(`\r${m}          `));
    console.log(`\n${rows.length} filas obtenidas en ${((Date.now() - t0) / 1000).toFixed(0)}s. Importando…`);

    const result = await importPlatformSales('VENNDELO', rows, 45, { bodega: 'INGENIO', pais: 'COLOMBIA' });
    console.log('\nResultado:', JSON.stringify(result, null, 2));
    console.log(`\nTotal: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    process.exit(0);
}

main().catch((e) => { console.error('\nERROR:', e); process.exit(1); });
