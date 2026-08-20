// Rutas accesibles sin iniciar sesión.
//
// Hay DOS guardias y ambos redirigen a /login por su cuenta: `middleware.ts` en el
// servidor y `use-auth.tsx` en el navegador. Una ruta pública tiene que estar exenta en
// los dos, o el servidor la deja pasar y el cliente la rebota igual. Por eso la lista
// vive aquí y no duplicada en cada guardia.
export const RUTAS_PUBLICAS = ['/login', '/cotizador'];

export function esRutaPublica(pathname: string): boolean {
    return RUTAS_PUBLICAS.some(r => pathname === r || pathname.startsWith(r + '/'));
}
