// Manual del Comercial — versión detallada (campo por campo, casos y errores).
// Uso: npx tsx scripts/seed-manual-comercial.ts
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from '@/lib/fs';
import type { ManualGuia } from '@/lib/manual-types';

const GUIA: ManualGuia = {
    slug: 'comercial',
    titulo: 'Manual del Comercial',
    descripcion: 'Paso a paso de CRM, difusión, solicitudes y catálogo: qué va en cada campo, casos reales del día a día y los errores que más se cometen.',
    audiencia: 'comercial',
    orden: 1,
    secciones: [
        {
            titulo: 'Empieza aquí',
            descripcion: 'Qué hace cada sección y en qué orden se usan.',
            pasos: [
                {
                    titulo: 'Mapa del Módulo Comercial',
                    ruta: '/commercial/dashboard',
                    explicacion:
                        'El flujo normal de trabajo es este:\n' +
                        '1) CRM: registras al cliente.\n' +
                        '2) Solicitudes: pides que creen o privaticen el producto que le vas a vender.\n' +
                        '3) Difusión: registras a quién le ofreciste el producto.\n' +
                        '4) Ventas Plataformas: verificas que la venta te quedó atribuida.\n' +
                        'Catálogo lo consultas en cualquier momento para ver precio y stock.',
                    cuandoUsar: 'Cada día: revisa primero tu Dashboard y las alertas de seguimiento del CRM.',
                    anotaciones: [
                        { numero: 1, texto: 'CRM / Clientes: tu cartera.', buscar: 'CRM / Clientes' },
                        { numero: 2, texto: 'Difusión: registro de lo que ofreces.', buscar: 'Difusión' },
                        { numero: 3, texto: 'Solicitudes: pedir creación/cambios de un item.', buscar: 'Solicitudes' },
                        { numero: 4, texto: 'Catálogo: precios y stock disponibles.', buscar: 'Catálogo' },
                    ],
                },
            ],
        },
        {
            titulo: 'CRM: registrar y gestionar clientes',
            descripcion: 'El cliente debe existir ANTES de pedir una privatización a su nombre.',
            pasos: [
                {
                    titulo: 'Tu cartera de clientes',
                    ruta: '/commercial/crm/dashboard',
                    explicacion:
                        'Ves tus clientes organizados por estado. Puedes buscarlos, filtrarlos y abrir su ficha. ' +
                        'Las alertas de seguimiento marcan a quién llevas tiempo sin contactar.',
                    cuandoUsar: 'A diario, para decidir a quién llamar.',
                },
                {
                    titulo: 'Formulario de registro: datos obligatorios',
                    ruta: '/commercial/crm/register',
                    explicacion:
                        'Los tres datos que no pueden faltar:\n\n' +
                        '• NOMBRE COMPLETO: nombre del cliente o de su tienda. Es como lo verás en todos los reportes.\n' +
                        '• CORREO ELECTRÓNICO PRINCIPAL: el dato MÁS importante. Es la llave con la que el sistema le atribuye ' +
                        'las ventas de las plataformas y las privatizaciones. Debe ser EXACTAMENTE el correo con el que el ' +
                        'cliente opera en Dropi/Venndelo/EFFI.\n' +
                        '• CELULAR PRINCIPAL: para el contacto y el seguimiento.',
                    cuandoUsar: 'Apenas cierras un cliente nuevo, antes de pedir cualquier privatización.',
                    ojo: 'Un correo mal escrito (una letra, un punto) hace que sus ventas NO se le atribuyan: aparecerán como Orgánicas y no contarán para ti. Confírmalo con el cliente antes de guardar.',
                    anotaciones: [
                        { numero: 1, texto: 'Nombre completo: como aparecerá en los reportes.', buscar: 'Nombre Completo' },
                        { numero: 2, texto: 'Correo principal: la llave de atribución. Debe ser exacto.', buscar: 'Correo Electrónico Principal' },
                        { numero: 3, texto: 'Celular principal: contacto para seguimiento.', buscar: 'Celular Principal' },
                    ],
                },
                {
                    titulo: 'Formulario de registro: datos complementarios',
                    ruta: '/commercial/crm/register',
                    explicacion:
                        '• CORREOS ADICIONALES: si el cliente opera con más de un correo en las plataformas, agrégalos todos. ' +
                        'El sistema también atribuye ventas por estos correos.\n' +
                        '• TELÉFONOS ADICIONALES: otros números de contacto.\n' +
                        '• CIUDAD: para segmentar y para logística.\n' +
                        '• CATEGORÍA y TIPO DE CLIENTE: clasifican la cartera (permiten filtrar y priorizar).\n' +
                        '• FECHA DE CUMPLEAÑOS: para acciones de relacionamiento.\n' +
                        '• VENTAS PROMEDIO: cuánto vende al mes aproximadamente; ayuda a priorizar.\n' +
                        '• ASIGNAR A COMERCIAL: quién lo atiende. Si eres comercial, normalmente eres tú.',
                    cuandoUsar: 'Complétalos cuando los tengas: mientras más completo el perfil, mejor el seguimiento.',
                    ojo: 'Si el cliente usa varios correos en la plataforma y solo registras uno, las ventas hechas con los otros correos no se le atribuirán.',
                    anotaciones: [
                        { numero: 1, texto: 'Correos adicionales: TODOS los correos con que opera.', buscar: 'Correos Electrónicos Adicionales' },
                        { numero: 2, texto: 'Categoría y tipo: clasificación de la cartera.', buscar: 'Categoría' },
                        { numero: 3, texto: 'Asignar a comercial: quién atiende al cliente.', buscar: 'Asignar a Comercial' },
                    ],
                },
                {
                    titulo: 'Importar varios clientes desde Excel',
                    ruta: '/commercial/crm/import',
                    explicacion: 'Permite cargar una lista completa en vez de registrarlos uno a uno. Revisa que la columna de correo venga limpia.',
                    cuandoUsar: 'Al migrar una cartera existente o cargar una lista grande de prospectos.',
                    ojo: 'Antes de importar, verifica que no haya correos repetidos ni con espacios: se crearían clientes duplicados.',
                },
                {
                    titulo: 'La ficha del cliente y sus pestañas',
                    ruta: '/commercial/crm/dashboard',
                    explicacion:
                        'Al abrir un cliente encuentras:\n' +
                        '• NOTAS: historial de lo conversado. Escribe siempre lo acordado.\n' +
                        '• PEDIDOS: lo que ha comprado.\n' +
                        '• TESTS: productos que está probando.\n' +
                        '• OFERTAS: todo lo que le has difundido (se alimenta solo desde Difusión).',
                    cuandoUsar: 'Antes de llamarlo: para no repetir ofertas y retomar donde quedaron.',
                },
            ],
        },
        {
            titulo: 'Difusión: registrar lo que ofreces',
            descripcion: 'La oferta la haces por fuera (WhatsApp, estados, llamada); aquí queda el registro.',
            pasos: [
                {
                    titulo: 'Registrar una difusión',
                    ruta: '/commercial/difusion',
                    explicacion:
                        'Indicas: el PRODUCTO ofrecido, el CLIENTE, el CANAL (WhatsApp, estado de Instagram, directo, grupo) ' +
                        'y el TIPO (producto nuevo, reabastecimiento, remarketing, cambio de precio). ' +
                        'Luego puedes marcar el RESULTADO: sin respuesta, interesado, pedido o rechazado.',
                    cuandoUsar: 'Cada vez que ofreces un producto a un cliente, sin excepción.',
                    ojo: 'Si no registras la difusión, tu gestión no queda medida y nadie sabe a quién ya se le ofreció ese producto (se duplican ofertas al mismo cliente).',
                    anotaciones: [
                        { numero: 1, texto: 'Botón para registrar una nueva difusión.', buscar: 'Registrar Difusión' },
                    ],
                },
                {
                    titulo: 'Remarketing: recuperar clientes',
                    ruta: '/commercial/difusion',
                    explicacion:
                        'Cuando un producto se reabastece, el sistema te sugiere los clientes que ya lo compraron o lo probaron, ' +
                        'para que los contactes de una vez. El botón "Seleccionarlos (remarketing)" los agrega en bloque.',
                    cuandoUsar: 'Al llegar mercancía de un producto que ya se vendía, o para reactivar clientes dormidos.',
                },
            ],
        },
        {
            titulo: 'Solicitudes: crear o modificar un item',
            descripcion: 'Asistente de 4 pasos. La fecha y tu nombre se registran automáticamente.',
            pasos: [
                {
                    titulo: 'Paso 1 — ¿Qué necesitas?',
                    ruta: '/commercial/solicitudes',
                    acciones: [{ click: 'Nueva Solicitud', esperar: 3000 }],
                    explicacion:
                        'Eliges el tipo de solicitud:\n' +
                        '• CREAR UN ITEM NUEVO: el producto todavía no existe en la plataforma.\n' +
                        '• SUMAR STOCK (recarga): el item ya existe y llegó más mercancía.\n' +
                        '• AJUSTAR STOCK: corregir la cantidad publicada (subirla o bajarla a un número exacto).\n' +
                        '• DEJAR EL ID EN CERO / RETIRAR: sacar el producto de circulación.',
                    cuandoUsar: 'Crear = producto nuevo. Sumar = llegó más. Ajustar = el número está mal. Retirar = ya no se vende.',
                    ojo: 'No uses "Crear item nuevo" si el producto YA existe en la plataforma: se duplicaría. Búscalo primero.',
                    anotaciones: [
                        { numero: 1, texto: 'Tipo de solicitud: define todo el resto del formulario.', buscar: '¿Qué necesitas?' },
                    ],
                },
                {
                    titulo: 'Paso 1 — Producto, SKU, variantes y combos',
                    ruta: '/commercial/solicitudes',
                    explicacion:
                        '• BUSCA EL PRODUCTO: escribe y selecciónalo del inventario (así queda enlazado al producto real).\n' +
                        '• NOMBRE DEL PRODUCTO: obligatorio. Si no está en inventario, escríbelo tal como debe publicarse.\n' +
                        '• SKU: el código del producto. Sirve para cruzar la venta con el inventario y calcular el costo.\n' +
                        '• ¿APLICA A UNA VARIANTE?: si el producto tiene colores/tallas, elige cuál. Si vas a repartir stock ' +
                        'entre varias, elige "Varias variantes". Si necesitas un combo (x2, x3), usa "Crear combo/variante nueva" ' +
                        'e indica NOMBRE DEL COMBO y UNIDADES POR COMBO.',
                    cuandoUsar: 'Los combos se usan cuando el cliente vende paquetes (ej. "Combo x2" descuenta 2 unidades del inventario por venta).',
                    ojo: 'Si el producto tiene variantes y no eliges ninguna, la solicitud aplica al producto completo. Revisa que sea lo que quieres.',
                },
                {
                    titulo: 'Paso 2 — Plataforma, bodega y país',
                    ruta: '/commercial/solicitudes',
                    explicacion:
                        '• PLATAFORMA (obligatorio): Dropi, Venndelo, EFFI, marcas blancas, etc.\n' +
                        '• BODEGA: de dónde sale la mercancía (INGENIO o LABORATORIO).\n' +
                        '• PAÍS (obligatorio): normalmente COLOMBIA.',
                    cuandoUsar: 'Siempre. Estos tres datos definen a qué equipo y a qué tablero llega la solicitud.',
                    ojo: 'La combinación plataforma + bodega importa: en el tablero de Plataformas existen opciones separadas (ej. "DROPI INGENIO" y "DROPI LABORATORIO"). Si eliges mal la bodega, la solicitud sale con la plataforma equivocada.',
                },
                {
                    titulo: 'Paso 2 — ID, stock y precio',
                    ruta: '/commercial/solicitudes',
                    explicacion:
                        '• ID EN PLATAFORMA (obligatorio si el item ya existe): el número del item en Dropi. Con él se cruzan las ventas.\n' +
                        '• STOCK ACTUAL EN PLATAFORMA: el que muestra hoy el item, para que Plataformas verifique.\n' +
                        '• STOCK: cuántas unidades pides publicar (o Nº de paquetes si es combo).\n' +
                        '• PRECIO (COP) y TIPO DE PRECIO: Dropshipping (el habitual) o Especial (precio negociado).\n' +
                        '• STOCK POR VARIANTE: si elegiste varias variantes, repartes aquí las cantidades.',
                    cuandoUsar: 'El ID es clave en recargas y ajustes: sin él, Plataformas no sabe qué item tocar.',
                    ojo: 'El STOCK que pides en una privatización es el CUPO de tu cliente. Si vende más de eso, el excedente se cuenta como venta pública/orgánica y no se te atribuye.',
                },
                {
                    titulo: 'Paso 3 — Público, privado y privatización',
                    ruta: '/commercial/solicitudes',
                    explicacion:
                        'Para items NUEVOS eliges:\n' +
                        '• PÚBLICO: visible para todos los clientes de la plataforma.\n' +
                        '• PRIVADO: solo para los correos que indiques.\n\n' +
                        'Para items EXISTENTES eliges si hay que cambiar la privatización:\n' +
                        '• Dejarlo como está · Privatizar (asignar a correos) · Quitar privatización (dejarlo público).\n\n' +
                        '• CORREO(S) DE PRIVATIZACIÓN: el correo del cliente. Puedes poner varios separados por coma.',
                    cuandoUsar: 'Privado cuando negociaste exclusividad o un cupo. Público cuando es venta abierta.',
                    ojo: 'El correo debe ser el MISMO que registraste en el CRM y con el que el cliente opera. Si no coincide, la venta no se le atribuye.',
                },
                {
                    titulo: 'Paso 4 — Confirmar y seguimiento',
                    ruta: '/commercial/solicitudes',
                    explicacion:
                        'Revisas el resumen y envías. La solicitud pasa por: PENDIENTE → EN REVISIÓN → APROBADO → CREADO. ' +
                        'Si algo está mal queda RECHAZADA con el motivo; corriges y vuelves a enviar. ' +
                        'El estado se sincroniza automáticamente con el tablero del equipo de Plataformas.',
                    cuandoUsar: 'Solo puedes ofrecer el producto cuando la solicitud está en CREADO.',
                    anotaciones: [
                        { numero: 1, texto: 'Aquí ves el estado de todas tus solicitudes.', buscar: 'Nueva Solicitud' },
                    ],
                },
            ],
        },
        {
            titulo: 'Catálogo y verificación de ventas',
            pasos: [
                {
                    titulo: 'Consultar el catálogo',
                    ruta: '/commercial/catalog',
                    explicacion: 'Productos disponibles con precio y stock. No verás los productos privados de otros clientes.',
                    cuandoUsar: 'Antes de ofrecer: confirma precio y existencias para no prometer lo que no hay.',
                },
                {
                    titulo: 'Verificar que tus ventas quedaron atribuidas',
                    ruta: '/ventas-plataformas',
                    explicacion:
                        'Cada mes muestra el total y el desglose por comercial, bodega, plataforma y país. ' +
                        'Busca tu nombre y revisa que el número tenga sentido.\n\n' +
                        'ORGÁNICAS = ventas sin solicitud detrás: la plataforma las generó sola y no son de ningún comercial.',
                    cuandoUsar: 'Al cierre de cada mes, y cuando creas que falta una venta tuya.',
                    ojo: 'Si tus ventas aparecen en Orgánicas, casi siempre es porque el correo del cliente no coincide o porque el cliente vendió por encima del cupo que pediste.',
                },
            ],
        },
        {
            titulo: 'Casos frecuentes (paso a paso completo)',
            descripcion: 'Situaciones reales del día a día, de principio a fin.',
            pasos: [
                {
                    titulo: 'Caso 1: cliente nuevo quiere vender un producto en exclusiva',
                    explicacion:
                        '1) CRM → registra al cliente con su correo exacto.\n' +
                        '2) Solicitudes → Nueva Solicitud → "Crear un item nuevo".\n' +
                        '3) Paso 2 → plataforma, bodega, país, stock = las unidades que le vas a dar (su cupo) y precio.\n' +
                        '4) Paso 3 → PRIVADO + el correo del cliente.\n' +
                        '5) Espera a que quede en CREADO.\n' +
                        '6) Difusión → registra que le ofreciste el producto.\n' +
                        '7) Fin de mes → Ventas Plataformas: verifica que la venta salga a tu nombre.',
                    cuandoUsar: 'Es el flujo estándar de una negociación nueva con exclusividad.',
                },
                {
                    titulo: 'Caso 2: llegó más mercancía de un producto que ya vende',
                    explicacion:
                        '1) Solicitudes → "Sumar stock (recarga de un item existente)".\n' +
                        '2) Indica el ID EN PLATAFORMA del item y el stock actual que muestra hoy.\n' +
                        '3) Pon las unidades nuevas que se van a sumar.\n' +
                        '4) Paso 3 → normalmente "No, dejarlo como está" (ya está privatizado).\n' +
                        '5) Difusión → avisa al cliente y a otros que ya lo compraron (remarketing).',
                    cuandoUsar: 'Reabastecimientos. Es el caso más común.',
                    ojo: 'Si el cupo se agotó y no pides la recarga, las ventas siguientes se contarán como orgánicas.',
                },
                {
                    titulo: 'Caso 3: el cliente dejó de vender el producto',
                    explicacion:
                        '1) Solicitudes → "Dejar el ID en cero / retirar" con el ID del item, o\n' +
                        '2) Solicitudes → Paso 3 → "Quitar privatización" si el producto se libera para que otros lo vendan.\n' +
                        '3) Difusión → ofrécelo a otros clientes (el producto queda disponible).',
                    cuandoUsar: 'Cuando se acaba la exclusividad o el cliente no rotó el producto.',
                },
            ],
        },
        {
            titulo: 'Errores comunes y cómo corregirlos',
            pasos: [
                {
                    titulo: 'Mis ventas aparecen como Orgánicas',
                    explicacion:
                        'Causas, en orden de frecuencia:\n' +
                        '1) El correo del cliente en el CRM no es igual al que usa en la plataforma → corrige el correo o agrégalo como correo adicional.\n' +
                        '2) El cliente vendió MÁS que el cupo que pediste → pide una recarga (sumar stock).\n' +
                        '3) La solicitud nunca se creó o quedó rechazada → revísala en Solicitudes.\n' +
                        '4) El producto es público → las ventas públicas no se atribuyen a nadie.',
                    cuandoUsar: 'Cuando revisas Ventas Plataformas y no ves tus ventas.',
                },
                {
                    titulo: 'La solicitud llegó con la plataforma equivocada',
                    explicacion:
                        'Casi siempre es la BODEGA: en el tablero de Plataformas las opciones están separadas por bodega ' +
                        '(DROPI INGENIO / DROPI LABORATORIO). Si elegiste la bodega incorrecta, la solicitud se procesa donde no es. ' +
                        'Solución: avisa a Plataformas para corregirla y verifica la bodega antes de enviar la siguiente.',
                    cuandoUsar: 'Si te reportan que la solicitud salió mal clasificada.',
                },
                {
                    titulo: 'Registré mal un cliente (correo equivocado)',
                    explicacion:
                        'Entra a la ficha del cliente en el CRM y corrige el correo. Si el cliente ya tenía ventas con el correo ' +
                        'errado, avisa para que se re-procese la atribución; el sistema recalcula al reimportar las ventas.',
                    cuandoUsar: 'Apenas lo detectes: mientras más tiempo pase, más ventas quedan sin atribuir.',
                },
                {
                    titulo: 'Ofrecí un producto que no tenía stock',
                    explicacion:
                        'Consulta SIEMPRE el Catálogo antes de ofrecer. Si ya lo ofreciste y no hay stock, revisa con Compras/Logística ' +
                        'si viene reabastecimiento y avisa al cliente con la fecha estimada.',
                    cuandoUsar: 'Prevención: es el error que más afecta la confianza del cliente.',
                },
            ],
        },
    ],
};

async function main() {
    // Conservar los pantallazos ya capturados (se identifican por el título del paso)
    const prev = await getDoc(doc(db, 'manuales', GUIA.slug));
    if (prev.exists()) {
        const ant = prev.data() as ManualGuia;
        const imgs = new Map<string, { url?: string; anot?: any[] }>();
        (ant.secciones || []).forEach(s => (s.pasos || []).forEach(p => {
            if (p.imagenUrl) imgs.set(p.titulo, { url: p.imagenUrl, anot: p.anotaciones });
        }));
        GUIA.secciones.forEach(s => s.pasos.forEach(p => {
            const hit = imgs.get(p.titulo);
            if (hit?.url) { p.imagenUrl = hit.url; if (hit.anot) p.anotaciones = hit.anot; }
        }));
    }
    await setDoc(doc(db, 'manuales', GUIA.slug), { ...GUIA, updatedAt: Date.now() }, { merge: true });
    const pasos = GUIA.secciones.reduce((a, s) => a + s.pasos.length, 0);
    console.log(`✔ ${GUIA.slug}: ${GUIA.secciones.length} secciones, ${pasos} pasos`);
    process.exit(0);
}
main().catch(e => { console.error('ERROR:', e); process.exit(1); });
