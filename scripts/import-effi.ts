// Importa EFFI desde los dos archivos (local, misma lógica que la UI).
// Uso: npx tsx scripts/import-effi.ts <alistamiento.xls> <guias.xlsx>
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { parseEffiFiles } from '@/lib/effi';
import { importPlatformSales } from '@/lib/platform-sales';

async function main() {
    const alistPath = process.argv[2] || '/tmp/archivos_temporales_effi/reporte de alistamiento.xls';
    const guiasPath = process.argv[3] || '/tmp/archivos_temporales_effi/guias de transporte effi.xlsx';

    const alistStr = fs.readFileSync(alistPath, 'latin1');
    const wbA = XLSX.read(alistStr, { type: 'string' });
    const alistRows = XLSX.utils.sheet_to_json<any[]>(wbA.Sheets[wbA.SheetNames[0]], { header: 1, raw: false, defval: '' });

    const wbG = XLSX.readFile(guiasPath);
    const guiasRows = XLSX.utils.sheet_to_json<any[]>(wbG.Sheets[wbG.SheetNames[0]], { header: 1, raw: true, defval: '' });

    const parsed = parseEffiFiles(alistRows as any[][], guiasRows as any[][]);
    console.log(`Guías parseadas: ${parsed.length}. Importando…`);
    const result = await importPlatformSales('EFFI', parsed, 45, { bodega: 'INGENIO', pais: 'COLOMBIA' }, (m) => process.stdout.write(`\r${m}       `));
    console.log('\nResultado:', JSON.stringify(result, null, 2));
    process.exit(0);
}
main().catch((e) => { console.error('\nERROR:', e); process.exit(1); });
