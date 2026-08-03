// Contenido de los manuales de capacitación (colección `manuales`).
// Editar aquí y volver a correr: npx tsx scripts/seed-manual.ts
// Los pantallazos los agrega scripts/capture-manual.ts (no se pisan al re-sembrar).
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { ManualGuia } from '@/lib/manual-types';

const COMERCIAL: ManualGuia = {
    slug: 'comercial',
    titulo: 'Manual del Comercial',
    descripcion: 'Cómo ingresar clientes, registrar difusión, pedir modificaciones y consultar el catálogo. Para qué sirve cada cosa y cuándo se usa.',
    audiencia: 'comercial',
    orden: 1,
    secciones: [
        {
            titulo: 'Para qué sirve cada parte',
            descripcion: 'Antes de operar, ten claro qué hace cada sección del Módulo Comercial.',
            pasos: [
                {
                    titulo: 'El Módulo Comercial de un vistazo',
                    ruta: '/commercial/dashboard',
                    explicacion:
                        'El menú de la izquierda tiene todo lo que necesitas:\n' +
                        '• Dashboard: tus indicadores (ventas, clientes, metas).\n' +
                        '• CRM / Clientes: la base de tus clientes y su historial.\n' +
                        '• Difusión: registro de a quién le ofreciste cada producto.\n' +
                        '• Catálogo: los productos que puedes ofrecer.\n' +
                        '• Solicitudes: pedidos de creación o cambios de un item en la plataforma.\n' +
                        '• Retos, Tareas y Academia: gestión personal y formación.',
                    cuandoUsar: 'Cada día al iniciar: revisa el Dashboard y las alertas de seguimiento del CRM.',
                    anotaciones: [
                        { numero: 1, texto: 'Menú del módulo comercial: aquí navegas entre CRM, Difusión, Catálogo y Solicitudes.', buscar: 'CRM / Clientes' },
                        { numero: 2, texto: 'Difusión: donde registras a quién le ofertaste un producto.', buscar: 'Difusión' },
                        { numero: 3, texto: 'Solicitudes: donde pides que creen o modifiquen un item.', buscar: 'Solicitudes' },
                    ],
                },
            ],
        },
        {
            titulo: 'Ingresar clientes al CRM',
            descripcion: 'Todo cliente debe quedar registrado: es la base para atribuir ventas y hacer seguimiento.',
            pasos: [
                {
                    titulo: 'Ver tu cartera de clientes',
                    ruta: '/commercial/crm/dashboard',
                    explicacion:
                        'El CRM muestra tus clientes organizados por estado (tablero). Puedes buscar, filtrar y abrir la ficha de cada uno. ' +
                        'Las alertas de seguimiento te avisan a quién no has contactado hace tiempo.',
                    cuandoUsar: 'Todos los días, para saber a quién contactar.',
                    anotaciones: [
                        { numero: 1, texto: 'Buscador: encuentra un cliente por nombre o correo.', buscar: 'Buscar' },
                        { numero: 2, texto: 'Botón para registrar un cliente nuevo.', buscar: 'Nuevo' },
                    ],
                },
                {
                    titulo: 'Registrar un cliente nuevo',
                    ruta: '/commercial/crm/register',
                    explicacion:
                        'Llena los datos del cliente. El correo es el dato MÁS importante: es la llave con la que el sistema le atribuye las ventas ' +
                        'de las plataformas y las privatizaciones de producto. Debe ser el mismo correo con el que el cliente opera en la plataforma.',
                    cuandoUsar: 'Apenas consigues un cliente nuevo, antes de pedir cualquier privatización a su nombre.',
                    ojo: 'Si el correo queda mal escrito, sus ventas NO se le atribuirán y aparecerán como "públicas". Verifícalo con el cliente.',
                    anotaciones: [
                        { numero: 1, texto: 'Nombre del cliente o de su tienda.', buscar: 'Nombre' },
                        { numero: 2, texto: 'Correo: la llave para atribuir ventas. Debe ser exacto.', buscar: 'Correo' },
                    ],
                },
                {
                    titulo: 'Importar varios clientes a la vez',
                    ruta: '/commercial/crm/import',
                    explicacion: 'Si tienes una lista en Excel, puedes cargarla de una sola vez en lugar de registrarlos uno por uno.',
                    cuandoUsar: 'Cuando migras una cartera existente o recibes una lista grande de prospectos.',
                },
                {
                    titulo: 'La ficha del cliente',
                    ruta: '/commercial/crm/dashboard',
                    explicacion:
                        'Al abrir un cliente ves su historial completo en pestañas:\n' +
                        '• Notas: lo que has conversado con él.\n' +
                        '• Pedidos: sus compras.\n' +
                        '• Tests: productos que está probando.\n' +
                        '• Ofertas: los productos que le has difundido (se alimenta de Difusión).',
                    cuandoUsar: 'Antes de llamar a un cliente, para saber qué le has ofrecido y qué ha comprado.',
                },
            ],
        },
        {
            titulo: 'Difusión: registrar lo que ofreces',
            descripcion: 'La difusión se hace por fuera (WhatsApp, estados, llamadas), pero se REGISTRA aquí.',
            pasos: [
                {
                    titulo: 'Registrar una difusión',
                    ruta: '/commercial/difusion',
                    explicacion:
                        'Registra a qué cliente le ofreciste qué producto, por cuál canal y con qué resultado. ' +
                        'Esto construye el historial que luego permite medir cuántas ofertas se convirtieron en pedidos.',
                    cuandoUsar:
                        'Cada vez que ofreces un producto: lanzamiento de producto nuevo, aviso de reabastecimiento, ' +
                        'remarketing a un cliente que dejó de comprar, o cambio de precio.',
                    ojo: 'Si no registras la difusión, no hay forma de medir tu gestión ni de saber a quién ya se le ofreció el producto.',
                },
            ],
        },
        {
            titulo: 'Solicitudes: pedir creación o cambios de un item',
            descripcion: 'Es el canal formal para que Plataformas cree, privatice, reserve o dé de baja un producto.',
            pasos: [
                {
                    titulo: 'Crear una solicitud (4 pasos)',
                    ruta: '/commercial/solicitudes',
                    explicacion:
                        'El asistente te guía en 4 pasos:\n' +
                        '1. Producto: cuál es y cuántas unidades.\n' +
                        '2. Plataforma: en qué plataforma y bodega va (Dropi, Venndelo, EFFI… / INGENIO o LABORATORIO).\n' +
                        '3. Visibilidad: privado (solo para tu cliente) o público (cualquiera lo vende).\n' +
                        '4. Confirmar: revisas y envías.\n' +
                        'La fecha y tu nombre se registran automáticamente.',
                    cuandoUsar: 'Cuando necesitas que un producto exista o cambie en la plataforma para poder venderlo.',
                    ojo: 'La bodega importa: define de dónde sale la mercancía. Si eliges mal, la solicitud llega al equipo equivocado.',
                    anotaciones: [
                        { numero: 1, texto: 'Botón para iniciar una solicitud nueva.', buscar: 'Nueva' },
                    ],
                },
                {
                    titulo: 'Privado vs. público: la diferencia clave',
                    ruta: '/commercial/solicitudes',
                    explicacion:
                        'PRIVADO: el producto queda asignado al correo de TU cliente y solo él lo vende. Debes indicar la cantidad (el "cupo").\n' +
                        'PÚBLICO: cualquier dropshipper puede venderlo; no se atribuye a un cliente puntual.',
                    cuandoUsar:
                        'Privado cuando negociaste exclusividad o un cupo con un cliente. Público cuando el producto es de venta abierta.',
                    ojo: 'Si tu cliente vende MÁS de lo que pediste en privado, el excedente se cuenta como venta pública (no se te atribuye).',
                },
                {
                    titulo: 'Estados de la solicitud',
                    ruta: '/commercial/solicitudes',
                    explicacion:
                        'Pendiente → En revisión → Aprobado → Creado. Si algo está mal, queda Rechazado con el motivo. ' +
                        'El estado se sincroniza automáticamente con el tablero de Plataformas.',
                    cuandoUsar: 'Consúltalo para saber si ya puedes ofrecer el producto: solo cuando esté en "Creado".',
                },
            ],
        },
        {
            titulo: 'Catálogo y reportes',
            pasos: [
                {
                    titulo: 'Consultar el catálogo',
                    ruta: '/commercial/catalog',
                    explicacion: 'Muestra los productos disponibles con su precio y stock. Los productos privados de otros clientes no aparecen.',
                    cuandoUsar: 'Antes de ofrecer: para confirmar precio y que haya existencias.',
                },
                {
                    titulo: 'Ver tus ventas por mes',
                    ruta: '/ventas-plataformas',
                    explicacion:
                        'Cada mes muestra el total y el desglose por comercial, bodega, plataforma y país. ' +
                        'Las ventas se atribuyen por el cupo privatizado del producto.',
                    cuandoUsar: 'Para revisar tu resultado del mes y verificar que tus ventas quedaron bien atribuidas.',
                    ojo: 'Es solo consulta: los comerciales no importan archivos.',
                },
            ],
        },
    ],
};

const LOGISTICA: ManualGuia = {
    slug: 'logistica',
    titulo: 'Manual de Logística',
    descripcion: 'Ingresos, salidas, ajustes, devoluciones, despachos y recepción de importaciones. Qué usar en cada caso y cómo auditar.',
    audiencia: 'logistica',
    orden: 2,
    secciones: [
        {
            titulo: 'El Panel de Logística',
            descripcion: 'Casi toda la operación diaria ocurre en una sola pantalla, dividida en pestañas.',
            pasos: [
                {
                    titulo: 'Las cuatro pestañas',
                    ruta: '/logistics',
                    explicacion:
                        '• Salidas: sacar mercancía para un pedido.\n' +
                        '• Recepción: ingresar mercancía que llega del proveedor.\n' +
                        '• Ajustes: corregir el stock cuando el conteo físico no cuadra.\n' +
                        '• Devoluciones: reingresar lo que devuelve un cliente.',
                    cuandoUsar: 'Es tu pantalla de trabajo diaria.',
                    anotaciones: [
                        { numero: 1, texto: 'Salidas: despachar mercancía de un pedido.', buscar: 'Salidas' },
                        { numero: 2, texto: 'Recepción: ingresar mercancía del proveedor.', buscar: 'Recepción' },
                        { numero: 3, texto: 'Ajustes: corregir diferencias de inventario.', buscar: 'Ajustes' },
                        { numero: 4, texto: 'Devoluciones: reingresar producto devuelto.', buscar: 'Devoluciones' },
                    ],
                },
            ],
        },
        {
            titulo: 'Ingresos (entradas de mercancía)',
            pasos: [
                {
                    titulo: 'Recepción de mercancía de proveedor',
                    ruta: '/logistics',
                    explicacion:
                        'En la pestaña "Recepción" seleccionas el proveedor y el motivo, agregas los productos recibidos con su cantidad y confirmas. ' +
                        'El stock sube y queda registrado quién y cuándo lo ingresó.',
                    cuandoUsar: 'Cuando llega mercancía comprada localmente o una devolución de cliente que vuelve a stock vendible.',
                    ojo: 'Cuenta físicamente antes de confirmar. Una vez registrado, corregir exige un ajuste que queda auditado.',
                },
                {
                    titulo: 'Recepción de importaciones (con orden de compra)',
                    ruta: '/logistics/recepciones',
                    explicacion:
                        'Para mercancía que viene de una orden de compra (importación) se usa este flujo aparte: cuentas contra lo esperado, ' +
                        'registras discrepancias, tomas fotos reales, asignas ubicación y cargas al inventario.',
                    cuandoUsar: 'Cuando llega un contenedor o pedido de importación documentado en Compras.',
                    ojo: 'Si lo recibido no cuadra con lo esperado, debes dejar la nota de discrepancia: eso dispara la verificación de Compras.',
                },
            ],
        },
        {
            titulo: 'Salidas y despachos',
            pasos: [
                {
                    titulo: 'Crear una salida de pedido',
                    ruta: '/logistics',
                    explicacion: 'En "Salidas" registras los productos que salen para un pedido. El stock baja y la orden queda lista para despacho.',
                    cuandoUsar: 'Cuando alistas un pedido para enviarlo.',
                },
                {
                    titulo: 'Despacho de guías',
                    ruta: '/dispatch',
                    explicacion:
                        'Aquí gestionas las órdenes pendientes por despachar, los despachos parciales y puedes buscar una guía puntual ' +
                        'para saber su estado.',
                    cuandoUsar: 'Al entregar a la transportadora y cuando alguien pregunta por el estado de una guía.',
                },
                {
                    titulo: 'Inventario pendiente',
                    ruta: '/pending-inventory',
                    explicacion: 'Productos que quedaron en estado pendiente: reservados o comprometidos pero aún sin salir.',
                    cuandoUsar: 'Para depurar: si algo lleva mucho pendiente, hay que resolverlo o liberarlo.',
                },
            ],
        },
        {
            titulo: 'Ajustes y devoluciones',
            pasos: [
                {
                    titulo: 'Ajustar stock',
                    ruta: '/logistics',
                    explicacion: 'En "Ajustes" corriges la cantidad de un producto cuando el conteo físico no coincide con el sistema. Debes indicar el motivo.',
                    cuandoUsar: 'Solo tras un conteo físico verificado, o por avería/pérdida detectada.',
                    ojo: 'Todo ajuste queda auditado con tu usuario. No es para "cuadrar" sin explicación: el motivo debe ser real.',
                },
                {
                    titulo: 'Devoluciones y averías',
                    ruta: '/returns-damages',
                    explicacion: 'Registro de lo que vuelve del cliente y de lo que llega o queda averiado, separando lo vendible de lo no vendible.',
                    cuandoUsar: 'Cuando la transportadora devuelve un pedido o se detecta producto dañado.',
                },
            ],
        },
        {
            titulo: 'Auditar y controlar',
            descripcion: 'Qué revisar periódicamente para que el inventario sea confiable.',
            pasos: [
                {
                    titulo: 'Alertas de stock',
                    ruta: '/stock-alerts',
                    explicacion: 'Productos por agotarse o en cero, para pedir reabastecimiento a tiempo.',
                    cuandoUsar: 'Revisión semanal, y antes de campañas o lanzamientos.',
                },
                {
                    titulo: 'Historial de movimientos',
                    ruta: '/history',
                    explicacion: 'Traza cada entrada, salida y ajuste: qué producto, cuánto, quién y cuándo.',
                    cuandoUsar: 'Cuando el stock no cuadra y hay que reconstruir qué pasó.',
                },
                {
                    titulo: 'Inventario y ubicaciones',
                    ruta: '/products',
                    explicacion:
                        'La lista de productos con su stock y su ubicación en bodega. Desde aquí puedes exportar a Excel ' +
                        '(el export incluye la ubicación) para hacer conteos físicos.',
                    cuandoUsar: 'Para inventarios cíclicos: exportas, cuentas en piso y luego registras los ajustes necesarios.',
                },
            ],
        },
    ],
};

async function main() {
    for (const guia of [COMERCIAL, LOGISTICA]) {
        // Conservar los pantallazos ya capturados al re-sembrar el texto
        const prev = await getDoc(doc(db, 'manuales', guia.slug));
        if (prev.exists()) {
            const anterior = prev.data() as ManualGuia;
            const imgs = new Map<string, { url?: string; anot?: any[] }>();
            (anterior.secciones || []).forEach(s => (s.pasos || []).forEach(p => {
                if (p.imagenUrl) imgs.set(p.titulo, { url: p.imagenUrl, anot: p.anotaciones });
            }));
            guia.secciones.forEach(s => s.pasos.forEach(p => {
                const hit = imgs.get(p.titulo);
                if (hit?.url) {
                    p.imagenUrl = hit.url;
                    // conservar las coordenadas ya calculadas
                    if (hit.anot) p.anotaciones = hit.anot;
                }
            }));
        }
        await setDoc(doc(db, 'manuales', guia.slug), { ...guia, updatedAt: Date.now() }, { merge: true });
        const pasos = guia.secciones.reduce((a, s) => a + s.pasos.length, 0);
        console.log(`✔ ${guia.slug}: ${guia.secciones.length} secciones, ${pasos} pasos`);
    }
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e); process.exit(1); });
