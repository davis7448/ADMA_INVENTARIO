// Actividad de los comerciales, reunida de las cuatro fuentes donde queda registrada.
//
// Sirve para auditar la gestión: qué hizo cada comercial, cuándo, con qué cliente y en
// qué columna del kanban está hoy ese cliente.
//
// De dónde sale cada cosa, y por qué de ahí:
//
//   alta          → clients.created_at + created_by_name
//   nota/testeo/  → arrays embebidos en el documento del cliente
//   pedido
//   oferta        → productPromotions (trae commercialId, commercialName y date)
//   cambio_estado → client_events, SOLO los tipos status_change y edit
//   edicion
//
// OJO con el doble conteo: escribir una nota deja rastro a la vez en `clients.notes[]`
// y en `client_events` como tipo 'note'. Lo mismo con pedidos, testeos y ofertas. Si se
// leyeran ambas fuentes, la gestión de cada comercial saldría inflada. Por eso de
// client_events solo se toman los dos tipos que no están representados en ningún otro
// lado.
import { collection, getDocs, query, where, orderBy } from '@/lib/fs';
import { db } from './firebase';
import { getAllClients } from './commercial-api';
import { getPromotions, PROMOTION_CHANNEL_LABELS, PROMOTION_TYPE_LABELS } from '@/app/actions/promotions';
import type { CommercialClient, ClientStatus } from '@/types/commercial';

export type ActividadTipo = 'alta' | 'nota' | 'oferta' | 'testeo' | 'pedido' | 'cambio_estado' | 'edicion';

export const TIPO_ETIQUETA: Record<ActividadTipo, string> = {
    alta: 'Alta de cliente',
    nota: 'Nota',
    oferta: 'Oferta / difusión',
    testeo: 'Testeo',
    pedido: 'Pedido',
    cambio_estado: 'Cambio de estado',
    edicion: 'Edición de datos',
};

export const ESTADO_ETIQUETA: Record<ClientStatus, string> = {
    finding_winner: 'Buscando ganador',
    testing: 'Testeando',
    selling: 'Vendiendo',
    scaling: 'Escalando',
};

export const ESTADOS_KANBAN: ClientStatus[] = ['finding_winner', 'testing', 'selling', 'scaling'];

// 'confirmada': el registro guarda quién lo hizo.
// 'inferida':   no guarda autor y se le imputa al comercial dueño del cliente. Pasa con
//               las notas anteriores al arreglo de autoría, que se guardaban con el
//               literal "Usuario" o sin nada. Se distingue para no acreditarle a nadie
//               una gestión que el sistema nunca registró.
export type Atribucion = 'confirmada' | 'inferida';

export type RegistroActividad = {
    fecha: Date | null; // null = el registro no guardó fecha
    tipo: ActividadTipo;
    comercialId?: string;
    comercialNombre: string;
    atribucion: Atribucion;
    clienteId: string;
    clienteNombre: string;
    estadoKanban: ClientStatus;
    detalle: string;
};

const SIN_COMERCIAL = 'Sin identificar';

// Autores que no identifican a nadie:
//  · 'usuario'  — el literal que guardaba el código antes del arreglo de autoría.
//  · 'comercial' — valor por defecto de `assignedCommercialName` en el formulario de
//    registro cuando el usuario no tiene nombre ni correo (crm/register/page.tsx).
//    Hay 1 cliente con ese valor; sin esta lista aparecería como si fuera una persona.
const AUTORES_VACIOS = new Set(['', 'usuario', 'comercial', 'sin autor', 'sin asignar', 'undefined', 'null']);

function esAutorReal(nombre?: string | null): boolean {
    if (!nombre) return false;
    return !AUTORES_VACIOS.has(String(nombre).trim().toLowerCase());
}

// Normaliza el nombre a mostrar: los placeholders no deben leerse como un comercial.
function nombreComercial(nombre?: string | null): string {
    return esAutorReal(nombre) ? String(nombre) : SIN_COMERCIAL;
}

function aFecha(valor: any): Date | null {
    if (!valor) return null;
    if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
    if (typeof valor?.toDate === 'function') return valor.toDate();
    // Los timestamps de Firestore leídos por el SDK admin llegan como {_seconds}
    if (typeof valor?._seconds === 'number') return new Date(valor._seconds * 1000);
    if (typeof valor?.seconds === 'number') return new Date(valor.seconds * 1000);
    const d = new Date(valor);
    return isNaN(d.getTime()) ? null : d;
}

// Resuelve el autor de un registro y de paso dice si el dato es confirmado o inferido.
function resolverAutor(
    autorNombre: string | undefined | null,
    autorId: string | undefined | null,
    cliente: CommercialClient,
): { comercialId?: string; comercialNombre: string; atribucion: Atribucion } {
    if (esAutorReal(autorNombre)) {
        return { comercialId: autorId || undefined, comercialNombre: String(autorNombre), atribucion: 'confirmada' };
    }
    return {
        comercialId: cliente.assigned_commercial_id,
        comercialNombre: nombreComercial(cliente.assigned_commercial_name),
        atribucion: 'inferida',
    };
}

function dentroDelRango(fecha: Date | null, desde: Date, hasta: Date): boolean {
    // Los registros sin fecha se conservan siempre: son 81 notas del historial y
    // descartarlas escondería trabajo real. La pantalla los muestra aparte.
    if (!fecha) return true;
    return fecha >= desde && fecha <= hasta;
}

export async function getActividadComercial(opciones: {
    desde: Date;
    hasta: Date;
    comercialId?: string;
}): Promise<RegistroActividad[]> {
    const { desde, hasta, comercialId } = opciones;
    const [clientes, ofertas, eventos] = await Promise.all([
        getAllClients(),
        getPromotions({ max: 5000 }),
        getEventosEnRango(desde, hasta),
    ]);

    const porCliente = new Map(clientes.map(c => [c.id!, c]));
    const registros: RegistroActividad[] = [];

    const agregar = (r: RegistroActividad) => {
        if (!dentroDelRango(r.fecha, desde, hasta)) return;
        if (comercialId && r.comercialId !== comercialId) return;
        registros.push(r);
    };

    for (const cliente of clientes) {
        const base = {
            clienteId: cliente.id!,
            clienteNombre: cliente.name,
            estadoKanban: cliente.status,
        };

        // Alta del cliente. Es la fuente más completa que hay: el created_by_name se
        // viene guardando bien desde hace tiempo.
        agregar({
            ...base,
            fecha: aFecha((cliente as any).created_at),
            tipo: 'alta',
            ...resolverAutor((cliente as any).created_by_name, (cliente as any).created_by, cliente),
            detalle: `Registró al cliente ${cliente.name}`,
        });

        for (const nota of (cliente as any).notes || []) {
            agregar({
                ...base,
                fecha: aFecha(nota.created_at),
                tipo: 'nota',
                ...resolverAutor(nota.created_by_name, nota.created_by, cliente),
                detalle: String(nota.content || '').slice(0, 300),
            });
        }

        for (const testeo of (cliente as any).tests || []) {
            const producto = testeo.productName || testeo.product_name || 'producto sin nombre';
            agregar({
                ...base,
                fecha: aFecha(testeo.created_at),
                tipo: 'testeo',
                ...resolverAutor(testeo.created_by_name, testeo.created_by, cliente),
                detalle: `Testeo de ${producto}${testeo.result ? ` · resultado: ${testeo.result}` : ''}`,
            });
        }

        for (const pedido of (cliente as any).orders || []) {
            const unidades = (pedido.items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0);
            agregar({
                ...base,
                fecha: aFecha(pedido.created_at),
                tipo: 'pedido',
                ...resolverAutor(pedido.created_by_name, pedido.created_by, cliente),
                detalle: `Pedido de ${unidades} und por $${Number(pedido.total || 0).toLocaleString('es-CO')}`,
            });
        }
    }

    // Ofertas de difusión: traen su propio comercial y fecha, no hay que inferir nada.
    for (const oferta of ofertas) {
        const cliente = porCliente.get(oferta.clientId);
        const canal = PROMOTION_CHANNEL_LABELS[oferta.channel] || oferta.channel;
        const tipoOferta = PROMOTION_TYPE_LABELS[oferta.promotionType] || oferta.promotionType;
        agregar({
            fecha: aFecha(oferta.date),
            tipo: 'oferta',
            comercialId: oferta.commercialId,
            comercialNombre: nombreComercial(oferta.commercialName),
            atribucion: 'confirmada',
            clienteId: oferta.clientId,
            clienteNombre: cliente?.name || oferta.clientName,
            // El cliente pudo eliminarse (p. ej. por fusión de duplicados)
            estadoKanban: cliente?.status || 'finding_winner',
            detalle: `Ofertó ${oferta.productName} por ${canal} (${tipoOferta})${oferta.outcome ? ` · ${oferta.outcome}` : ''}`,
        });
    }

    // De client_events solo lo que no está en las otras fuentes (ver nota de arriba).
    for (const evento of eventos) {
        if (evento.type !== 'status_change' && evento.type !== 'edit') continue;
        // Los eventos que deja un script de mantenimiento (p. ej. la fusión de clientes
        // duplicados) no son gestión de nadie: aparecerían como un comercial inventado.
        if (evento.created_by === 'script') continue;
        const cliente = porCliente.get(evento.clientId);
        if (!cliente) continue;
        agregar({
            fecha: aFecha(evento.created_at),
            tipo: evento.type === 'status_change' ? 'cambio_estado' : 'edicion',
            ...resolverAutor(evento.created_by_name, evento.created_by, cliente),
            clienteId: evento.clientId,
            clienteNombre: cliente.name,
            estadoKanban: cliente.status,
            detalle: evento.description || '',
        });
    }

    // Más reciente primero; los sin fecha al final
    return registros.sort((a, b) => {
        if (!a.fecha && !b.fecha) return 0;
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return b.fecha.getTime() - a.fecha.getTime();
    });
}

async function getEventosEnRango(desde: Date, hasta: Date) {
    try {
        const q = query(
            collection(db, 'client_events'),
            where('created_at', '>=', desde),
            where('created_at', '<=', hasta),
            orderBy('created_at', 'desc'),
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    } catch (error) {
        console.error('Error leyendo client_events:', error);
        return [];
    }
}

// --- Agregados ---

export type FilaResumen = {
    comercialNombre: string;
    porTipo: Record<ActividadTipo, number>;
    total: number;
    inferidos: number; // cuántos de esos registros no tienen autor confirmado
};

export function resumenPorComercial(registros: RegistroActividad[]): FilaResumen[] {
    const mapa = new Map<string, FilaResumen>();
    for (const r of registros) {
        let fila = mapa.get(r.comercialNombre);
        if (!fila) {
            fila = {
                comercialNombre: r.comercialNombre,
                porTipo: { alta: 0, nota: 0, oferta: 0, testeo: 0, pedido: 0, cambio_estado: 0, edicion: 0 },
                total: 0,
                inferidos: 0,
            };
            mapa.set(r.comercialNombre, fila);
        }
        fila.porTipo[r.tipo]++;
        fila.total++;
        if (r.atribucion === 'inferida') fila.inferidos++;
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
}

// Lunes a domingo. Devuelve, por comercial, cuántas acciones hizo cada día.
export type FilaSemana = {
    comercialNombre: string;
    porDia: number[]; // 7 posiciones, índice 0 = lunes
    total: number;
};

export function inicioDeSemana(fecha: Date): Date {
    const d = new Date(fecha);
    d.setHours(0, 0, 0, 0);
    // getDay(): 0 = domingo. Se corre para que la semana empiece en lunes.
    const diff = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - diff);
    return d;
}

export function finDeSemana(lunes: Date): Date {
    const d = new Date(lunes);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function semanaPorDia(registros: RegistroActividad[], lunes: Date): FilaSemana[] {
    const domingo = finDeSemana(lunes);
    const mapa = new Map<string, FilaSemana>();

    for (const r of registros) {
        if (!r.fecha || r.fecha < lunes || r.fecha > domingo) continue;
        let fila = mapa.get(r.comercialNombre);
        if (!fila) {
            fila = { comercialNombre: r.comercialNombre, porDia: [0, 0, 0, 0, 0, 0, 0], total: 0 };
            mapa.set(r.comercialNombre, fila);
        }
        const indice = (r.fecha.getDay() + 6) % 7;
        fila.porDia[indice]++;
        fila.total++;
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
}

export type FilaKanban = {
    comercialNombre: string;
    porEstado: Record<ClientStatus, number>;
    total: number;
};

export function clientesPorEstado(clientes: CommercialClient[], comercialId?: string): FilaKanban[] {
    const mapa = new Map<string, FilaKanban>();
    for (const c of clientes) {
        if (comercialId && c.assigned_commercial_id !== comercialId) continue;
        const nombre = nombreComercial(c.assigned_commercial_name);
        let fila = mapa.get(nombre);
        if (!fila) {
            fila = {
                comercialNombre: nombre,
                porEstado: { finding_winner: 0, testing: 0, selling: 0, scaling: 0 },
                total: 0,
            };
            mapa.set(nombre, fila);
        }
        if (fila.porEstado[c.status] !== undefined) fila.porEstado[c.status]++;
        fila.total++;
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
}
