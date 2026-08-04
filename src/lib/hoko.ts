// Integración con HOKO Colombia (solo servidor).
//
// IMPORTANTE — cómo se obtienen los datos y por qué:
// La API pública documentada (https://documenter.getpostman.com/view/1189414/UVBzpAnL)
// expone /api/member/order, pero devuelve 0 para ADMA: esos endpoints listan las
// órdenes de la tienda como COMPRADORA, y ADMA opera como PROVEEDOR (surte productos
// que venden otras tiendas). Las ventas del lado proveedor solo están en el panel
// (Laravel Nova) → se consultan por /nova-api/orders con sesión.
//
// Limitaciones conocidas de esta vía:
//  · Es API interna: HOKO puede cambiarla sin aviso.
//  · El listado NO trae el valor de la venta ni el producto (el producto solo está en
//    el detalle, 1 petición por orden). El ingreso llega por Excel hasta que HOKO
//    habilite un endpoint de proveedor.
import type { ParsedRow } from '@/lib/platform-sales';

const BASE = 'https://hoko.com.co';

export type HokoCuenta = { email: string; password: string; bodega: string; pais: string };

// Estados del panel → estados internos del motor.
function mapEstado(raw: unknown): string {
    const n = String(raw ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
    if (!n) return 'PENDIENTE';
    if (n.startsWith('ENTREGAD') || n.startsWith('FINALIZAD')) return 'ENTREGADO';
    if (n.startsWith('DEVUELT') || n.startsWith('DEVOLUC')) return 'DEVOLUCION';
    if (n.startsWith('ANULAD') || n.startsWith('CANCEL')) return 'CANCELADO';
    if (n.startsWith('RECHAZ')) return 'RECHAZADO';
    return n;
}

function safeId(s: unknown): string {
    return String(s ?? '')
        .replace(/[\/\\.#$\[\]]/g, '_').replace(/\s+/g, '_')
        .replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'X';
}

// --- Sesión (Laravel + Nova): cookies manuales porque fetch no trae cookie jar ---
class Sesion {
    private cookies = new Map<string, string>();

    private guardar(res: Response) {
        // getSetCookie está disponible en Node 18.14+/undici
        const raw = (res.headers as any).getSetCookie?.() ?? [];
        for (const c of raw) {
            const [par] = c.split(';');
            const i = par.indexOf('=');
            if (i > 0) this.cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
        }
    }

    private cabecera(): string {
        return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    }

    private xsrf(): string {
        return decodeURIComponent(this.cookies.get('XSRF-TOKEN') || '');
    }

    async login(email: string, password: string): Promise<void> {
        const inicio = await fetch(`${BASE}/admin/login`, { redirect: 'manual' });
        this.guardar(inicio);
        const res = await fetch(`${BASE}/admin/login`, {
            method: 'POST',
            redirect: 'manual',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'X-XSRF-TOKEN': this.xsrf(),
                Cookie: this.cabecera(),
            },
            body: JSON.stringify({ email, password }),
        });
        this.guardar(res);
        if (res.status !== 200) {
            throw new Error(`HOKO login ${res.status}: ${(await res.text()).slice(0, 200)}`);
        }
    }

    async nova(path: string): Promise<any> {
        const res = await fetch(`${BASE}/nova-api/${path.replace(/^\//, '')}`, {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                Cookie: this.cabecera(),
            },
        });
        const texto = await res.text();
        if (!res.ok) throw new Error(`HOKO nova ${path} ${res.status}: ${texto.slice(0, 200)}`);
        return JSON.parse(texto);
    }
}

// Los filtros de Nova viajan como JSON en base64.
function filtroFechas(desde: string, hasta: string): string {
    const f = [
        { 'App\\Nova\\Filters\\DateFrom': desde },
        { 'App\\Nova\\Filters\\DateTo': hasta },
    ];
    return Buffer.from(JSON.stringify(f)).toString('base64');
}

// Convierte los `fields` de Nova en un objeto plano
function campos(recurso: any): Record<string, any> {
    const o: Record<string, any> = {};
    for (const f of recurso.fields || []) {
        const k = f.attribute;
        if (k && o[k] === undefined) o[k] = f.value;
    }
    // el estado viene en un ComputedField sin attribute estable
    const computed = (recurso.fields || []).filter((f: any) => f.component === 'computed-field' || f.attribute === 'ComputedField');
    if (computed.length) o.__estado = computed[0].value;
    return o;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Trae las órdenes de los últimos `days` días. Se consulta DÍA A DÍA porque el
// listado no incluye la fecha: el día consultado es el que se asigna a la venta.
export async function fetchHokoOrders(
    cuenta: HokoCuenta,
    days: number,
    onProgress?: (m: string) => void,
): Promise<ParsedRow[]> {
    const s = new Sesion();
    await s.login(cuenta.email, cuenta.password);

    const filas: ParsedRow[] = [];
    const hoy = new Date();
    for (let d = 0; d < days; d++) {
        const dia = new Date(hoy.getTime() - d * 86400000).toISOString().slice(0, 10);
        const filtro = filtroFechas(dia, dia);
        let page = 1;
        while (true) {
            const data = await s.nova(`orders?perPage=100&page=${page}&filters=${filtro}`);
            const recursos = data.resources || [];
            for (const r of recursos) {
                const c = campos(r);
                const id = r.id?.value ?? c.id;
                if (!id) continue;
                filas.push({
                    guia: safeId(id),
                    fecha: dia,
                    estado: mapEstado(c.__estado),
                    itemIds: [],          // el producto solo está en el detalle
                    total: 0,             // HOKO no expone el valor al proveedor
                    tienda: c.store || undefined,     // tienda que vendió
                    bodega: c.cellar || cuenta.bodega,
                });
            }
            const total = Number(data.total) || 0;
            if (page * 100 >= total || recursos.length === 0) break;
            page++;
            await sleep(200);
        }
        if (d % 5 === 0) onProgress?.(`HOKO ${cuenta.bodega}: ${dia} · ${filas.length} órdenes`);
        await sleep(150);
    }
    return filas;
}
