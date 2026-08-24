"use server";

// Movimiento diario por comercial y país.
//
// Se calcula al vuelo con el admin SDK: los últimos 30 días son ~5.700 ventas y se leen
// en menos de un segundo con proyección de campos, así que no hace falta una colección
// pre-agregada como platformReportMonths (que además quedó desactualizada).
//
// Se proyectan solo los campos que se usan: leer los documentos completos multiplicaría
// el coste sin aportar nada.
import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from '@/lib/firebase-admin';
// Se reutiliza la canonicalización del motor de ventas en vez de duplicarla: sin ella el
// mismo comercial sale repetido ("MARCELA" y "marcela" son dos filas distintas) y los
// números del tablero no cuadrarían con los de Ventas de Plataformas.
import { canonicalCommercial } from '@/lib/platform-sales';

const SIN_COMERCIAL = 'Orgánicas';

export type CeldaMovimiento = { ventas: number; unidades: number; ingreso: number; entregadas: number };

export type MovimientoDiario = {
    dias: string[];                                   // YYYY-MM-DD, ascendente
    comerciales: string[];                            // ordenados por volumen
    porComercialDia: Record<string, Record<string, CeldaMovimiento>>;
    totalPorComercial: Record<string, CeldaMovimiento>;
    totalPorDia: Record<string, CeldaMovimiento>;
    porPais: Record<string, CeldaMovimiento>;
    porPlataforma: Record<string, CeldaMovimiento>;
    total: CeldaMovimiento;
    paisesDisponibles: string[];
    plataformasDisponibles: string[];
};

const vacia = (): CeldaMovimiento => ({ ventas: 0, unidades: 0, ingreso: 0, entregadas: 0 });

function acumular(c: CeldaMovimiento, unidades: number, ingreso: number, entregada: boolean) {
    c.ventas += 1;
    c.unidades += unidades;
    c.ingreso += ingreso;
    if (entregada) c.entregadas += 1;
}

export async function getMovimientoDiario(opciones: {
    dias: number;
    pais?: string;
    plataforma?: string;
}): Promise<MovimientoDiario> {
    const { dias, pais, plataforma } = opciones;
    const desde = Date.now() - dias * 86400000;

    const vacio: MovimientoDiario = {
        dias: [], comerciales: [], porComercialDia: {}, totalPorComercial: {},
        totalPorDia: {}, porPais: {}, porPlataforma: {}, total: vacia(),
        paisesDisponibles: [], plataformasDisponibles: [],
    };

    try {
        const fs = getFirestore(await getApp());

        // Alias de comercial (mismo criterio que el motor de ventas)
        const aliasSnap = await fs.collection('commercialAliases').limit(1000).get();
        const alias = new Map<string, string>();
        for (const d of aliasSnap.docs) {
            const raw = d.get('rawNormalized'); const can = d.get('canonical');
            if (raw && can) alias.set(raw, can);
        }

        const snap = await fs.collection('platformSales')
            .where('orderDate', '>=', desde)
            .select('orderDate', 'commercialName', 'pais', 'platform', 'total', 'esEntregado', 'quantity')
            .get();

        const res: MovimientoDiario = { ...vacio, porComercialDia: {}, totalPorComercial: {}, totalPorDia: {}, porPais: {}, porPlataforma: {}, total: vacia() };
        const paises = new Set<string>();
        const plataformas = new Set<string>();
        const diasSet = new Set<string>();

        for (const d of snap.docs) {
            const paisDoc = String(d.get('pais') || '—');
            const platDoc = String(d.get('platform') || '—');
            paises.add(paisDoc);
            plataformas.add(platDoc);
            // Los filtros se aplican DESPUÉS de recoger los valores disponibles, para que
            // el selector siga ofreciendo todas las opciones del periodo.
            if (pais && pais !== 'todos' && paisDoc !== pais) continue;
            if (plataforma && plataforma !== 'todas' && platDoc !== plataforma) continue;

            const fecha = new Date(Number(d.get('orderDate')) || 0).toISOString().slice(0, 10);
            const comercial = canonicalCommercial(d.get('commercialName'), alias);
            const unidades = Number(d.get('quantity')) || 0;
            const ingreso = Number(d.get('total')) || 0;
            const entregada = !!d.get('esEntregado');

            diasSet.add(fecha);
            res.porComercialDia[comercial] ||= {};
            res.porComercialDia[comercial][fecha] ||= vacia();
            res.totalPorComercial[comercial] ||= vacia();
            res.totalPorDia[fecha] ||= vacia();
            res.porPais[paisDoc] ||= vacia();
            res.porPlataforma[platDoc] ||= vacia();

            acumular(res.porComercialDia[comercial][fecha], unidades, ingreso, entregada);
            acumular(res.totalPorComercial[comercial], unidades, ingreso, entregada);
            acumular(res.totalPorDia[fecha], unidades, ingreso, entregada);
            acumular(res.porPais[paisDoc], unidades, ingreso, entregada);
            acumular(res.porPlataforma[platDoc], unidades, ingreso, entregada);
            acumular(res.total, unidades, ingreso, entregada);
        }

        res.dias = [...diasSet].sort();
        res.comerciales = Object.keys(res.totalPorComercial)
            .sort((a, b) => res.totalPorComercial[b].ventas - res.totalPorComercial[a].ventas);
        res.paisesDisponibles = [...paises].sort();
        res.plataformasDisponibles = [...plataformas].sort();
        return res;
    } catch (error) {
        console.error('[movimiento-diario] error:', error);
        return vacio;
    }
}
