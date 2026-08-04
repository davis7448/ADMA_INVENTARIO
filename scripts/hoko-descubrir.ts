// Descubre los endpoints de HOKO una vez tengamos credenciales.
// Uso: HOKO_EMAIL=... HOKO_PASSWORD=... npx tsx scripts/hoko-descubrir.ts
import { getHokoToken, hokoFetch } from '@/lib/hoko';

const CANDIDATOS = [
  'user', 'me', 'profile',
  'orders', 'order', 'ordenes', 'pedidos', 'ventas', 'sales',
  'products', 'productos', 'inventory', 'inventario',
  'shipments', 'guias', 'tracking', 'statuses', 'estados',
];

async function main() {
  await getHokoToken();
  console.log('✔ login OK\n');
  for (const p of CANDIDATOS) {
    try {
      const r = await hokoFetch(p);
      if (r.status === 404) continue;         // no existe
      console.log(`[${r.status}] /api/${p}`);
      if (r.status === 200) console.log('     ' + r.body.replace(/\s+/g, ' ').slice(0, 300));
    } catch (e) {
      console.log(`[ERR] /api/${p}: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
    }
  }
  process.exit(0);
}
main().catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
