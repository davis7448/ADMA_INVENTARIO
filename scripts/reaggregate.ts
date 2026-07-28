// Recalcula los pre-agregados (platformReportMonths) sobre las ventas existentes,
// sin re-importar: importPlatformSales(platform, [], …) recorre el histórico y
// reescribe los resúmenes con la lógica actual (bodega×comercial, exclusiones).
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { importPlatformSales } from '@/lib/platform-sales';
async function main(){
  const snap=await getDocs(collection(db,'platformReportMonths'));
  const platforms=[...new Set(snap.docs.map(d=>(d.data() as any).platform).filter(Boolean))] as string[];
  console.log('Plataformas a re-agregar:', platforms.join(', '));
  for(const p of platforms){
    console.log(`\n== ${p} ==`); const t0=Date.now();
    const r=await importPlatformSales(p,[],45,{},m=>process.stdout.write('\r  '+m+'          '));
    console.log(`\n  → OK en ${((Date.now()-t0)/1000).toFixed(0)}s`);
  }
  process.exit(0);
}
main().catch(e=>{console.error('ERROR:',e instanceof Error?e.message:e);process.exit(1);});
