// Sincroniza las cuentas Dropi vía MCP: trae órdenes (últimos N días) y las importa
// con el motor (plataforma DROPI, atribución por cupo). Corre LOCAL (sin límite HTTP).
// Uso: npx tsx scripts/dropi-sync.ts [días]
import { listDropiAccounts, fetchDropiOrders } from '@/lib/dropi-mcp';
import { importPlatformSales } from '@/lib/platform-sales';

async function main() {
    const days = Number(process.argv[2]) || 3;
    const accounts = await listDropiAccounts();
    console.log(`Cuentas Dropi: ${accounts.length} · ventana ${days} días\n`);
    for (const acc of accounts) {
        if (!acc.refreshToken) { console.log(`- ${acc.label}: sin token, se omite`); continue; }
        console.log(`== ${acc.label} [${acc.bodega || '?'}/${acc.pais || '?'}] ==`);
        const t0 = Date.now();
        const rows = await fetchDropiOrders(acc as any, days, m => process.stdout.write('\r' + m + '          '));
        console.log(`\n${rows.length} órdenes en ${((Date.now() - t0) / 1000).toFixed(0)}s. Importando…`);
        const r = await importPlatformSales('DROPI', rows, 45, { bodega: acc.bodega, pais: acc.pais });
        console.log('  →', JSON.stringify({ nuevas: r.nuevas, actualizadas: r.actualizadas, entregadas: r.entregadas, atribuidas: r.atribuidas, publicas: r.publicas, sobreCupo: r.sobreCupo, mesesAbiertos: r.mesesAbiertos }), '\n');
    }
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
