// Agrupación de fechas por día, semana y mes. Funciones puras, sin dependencias.
//
// Está separado de actividad-comercial.ts (de donde salieron inicioDeSemana/finDeSemana)
// porque ese módulo arrastra el SDK de cliente de Firebase, y estas funciones las usan
// también server actions que corren con el admin SDK. Allí se reexportan para que sus
// consumidores no cambien: la definición sigue siendo una sola.

export type Granularidad = 'dia' | 'semana' | 'mes';

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

// A qué periodo pertenece un día (formato YYYY-MM-DD).
// Se opera sobre la cadena y con fechas en mediodía UTC para que el huso horario no
// desplace un día de una semana a la siguiente.
export function claveDePeriodo(fechaISO: string, granularidad: Granularidad): string {
    if (granularidad === 'dia') return fechaISO;
    if (granularidad === 'mes') return fechaISO.slice(0, 7); // YYYY-MM
    const lunes = inicioDeSemana(new Date(fechaISO + 'T12:00:00'));
    return lunes.toISOString().slice(0, 10);
}

// Cómo se muestra ese periodo en la interfaz.
export function etiquetaDePeriodo(clave: string, granularidad: Granularidad): string {
    if (granularidad === 'mes') {
        const [a, m] = clave.split('-');
        const nombre = new Date(Number(a), Number(m) - 1, 1)
            .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
        return nombre.charAt(0).toUpperCase() + nombre.slice(1);
    }
    const d = new Date(clave + 'T12:00:00');
    const corto = (x: Date) => x.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    if (granularidad === 'semana') {
        const fin = new Date(d);
        fin.setDate(fin.getDate() + 6);
        return `${corto(d)} – ${corto(fin)}`;
    }
    return corto(d);
}
