// Funciones cosméticas CoSIng (Comisión Europea), traducidas al español.
//
// El equipo pidió que en "Desarrollamos" el cliente elija funciones avaladas en vez de
// describir libremente lo que quiere: una idea libre no se puede cotizar y a veces pide
// cosas que no son cosméticas. La fuente es el documento COSING_Functions.pdf que envió
// el laboratorio (87 funciones); aquí están todas, con el nombre oficial en inglés como
// `id` para que el equipo técnico lo reconozca en ClickUp tal cual lo usa el regulador.
//
// `cliente: true` marca las que se muestran en el formulario público: son las que un
// cliente entiende como beneficio del producto (hidratante, exfoliante, calmante…). Las
// demás son funciones técnicas del formulador —tensioactivo, solvente, regulador de pH—
// que no tiene sentido preguntarle a quien cotiza. Se guardan igual para poder ampliar
// la selección sin volver a transcribir el documento.

export type FuncionCosing = { id: string; nombre: string; descripcion: string; cliente: boolean };

export const FUNCIONES_COSING: FuncionCosing[] = [
    { id: 'ABRASIVE', nombre: 'Abrasivo', descripcion: 'Retira tejido o materiales no deseados de la superficie del cuerpo, incluida la limpieza mecánica dental.', cliente: false },
    { id: 'ABSORBENT', nombre: 'Absorbente', descripcion: 'Capta sustancias solubles en agua o en aceite.', cliente: false },
    { id: 'ADHESIVE', nombre: 'Adhesivo', descripcion: 'Tiende a unir o adherir superficies entre sí.', cliente: false },
    { id: 'ANTI-SEBORRHEIC', nombre: 'Antiseborreico', descripcion: 'Previene o alivia los síntomas de la seborrea y la dermatitis seborreica, incluida la caspa.', cliente: true },
    { id: 'ANTI-SEBUM', nombre: 'Antisebo', descripcion: 'Ayuda a controlar la producción de sebo.', cliente: true },
    { id: 'ANTICAKING', nombre: 'Antiaglomerante', descripcion: 'Evita que los sólidos en partículas formen grumos y permite que fluyan libremente.', cliente: false },
    { id: 'ANTICORROSIVE', nombre: 'Anticorrosivo', descripcion: 'Previene o inhibe la corrosión del material de envase.', cliente: false },
    { id: 'ANTIFOAMING', nombre: 'Antiespumante', descripcion: 'Suprime la espuma durante la fabricación o reduce la tendencia del producto a formarla.', cliente: false },
    { id: 'ANTIMICROBIAL', nombre: 'Antimicrobiano', descripcion: 'Previene o ralentiza el crecimiento microbiano.', cliente: true },
    { id: 'ANTIOXIDANT', nombre: 'Antioxidante', descripcion: 'Inhibe las reacciones promovidas por el oxígeno, evitando la oxidación y la rancidez.', cliente: true },
    { id: 'ANTIPERSPIRANT', nombre: 'Antitranspirante', descripcion: 'Reduce la transpiración.', cliente: true },
    { id: 'ANTIPLAQUE', nombre: 'Antiplaca', descripcion: 'Ayuda a proteger contra la placa dental.', cliente: true },
    { id: 'ANTISTATIC', nombre: 'Antiestático', descripcion: 'Previene o reduce la electricidad estática neutralizando la carga eléctrica de las superficies.', cliente: true },
    { id: 'ASTRINGENT', nombre: 'Astringente', descripcion: 'Contrae o tensa la piel.', cliente: true },
    { id: 'BINDING', nombre: 'Aglutinante', descripcion: 'Aporta propiedades adhesivas durante y después de la compresión en tabletas o pastillas cosméticas.', cliente: false },
    { id: 'BLEACHING', nombre: 'Blanqueador', descripcion: 'Blanquea o aclara el tono del cabello o de la piel.', cliente: true },
    { id: 'BUFFERING', nombre: 'Tampón (buffer)', descripcion: 'Estabiliza el pH de un medio acuoso en un rango estrecho aunque se añada un ácido o una base.', cliente: false },
    { id: 'BULKING', nombre: 'Relleno (bulking)', descripcion: 'Ingrediente sólido inerte que diluye otros sólidos o aumenta el volumen del producto.', cliente: false },
    { id: 'CHELATING', nombre: 'Quelante', descripcion: 'Forma complejos con iones metálicos que podrían afectar la estabilidad o la apariencia del cosmético.', cliente: false },
    { id: 'CLEANSING', nombre: 'Limpiador', descripcion: 'Ayuda a mantener limpia la superficie del cuerpo.', cliente: true },
    { id: 'COLORANT', nombre: 'Colorante', descripcion: 'Destinado a colorear el producto, el cuerpo o partes de él por absorción o reflexión de la luz visible.', cliente: false },
    { id: 'DENATURANT', nombre: 'Desnaturalizante', descripcion: 'Hace el cosmético no apto para ingerir; se añade sobre todo a productos con alcohol etílico.', cliente: false },
    { id: 'DEODORANT', nombre: 'Desodorante', descripcion: 'Reduce o elimina el mal olor y contribuye a evitar su formación sobre la piel.', cliente: true },
    { id: 'DEPILATORY', nombre: 'Depilatorio', descripcion: 'Rompe la resistencia mecánica de la fibra capilar para poder retirarla con un frotado suave.', cliente: true },
    { id: 'DETANGLING', nombre: 'Desenredante', descripcion: 'Reduce o elimina el enredo del cabello y facilita el peinado.', cliente: true },
    { id: 'DISPERSING NON-SURFACTANT', nombre: 'Dispersante no tensioactivo', descripcion: 'Facilita la dispersión de sólidos en líquidos recubriendo el sólido por adsorción.', cliente: false },
    { id: 'EMULSION STABILISING', nombre: 'Estabilizante de emulsión', descripcion: 'Ayuda al proceso de emulsificación y mejora la estabilidad y la vida útil de la emulsión.', cliente: false },
    { id: 'EPILATING', nombre: 'Epilatorio', descripcion: 'Se aplica sobre la piel y se retira rápido para arrancar el vello entero desde el folículo.', cliente: true },
    { id: 'EXFOLIATING', nombre: 'Exfoliante', descripcion: 'Inicia o acelera la eliminación de las capas de células muertas de la superficie de la piel.', cliente: true },
    { id: 'EYELASH CONDITIONING', nombre: 'Acondicionador de pestañas', descripcion: 'Acondiciona y mejora la apariencia de las pestañas: brillo, grosor, longitud o separación.', cliente: true },
    { id: 'FILM FORMING', nombre: 'Formador de película', descripcion: 'Produce, al aplicarse, una película continua sobre la piel, el cabello o las uñas.', cliente: false },
    { id: 'FLAVOURING', nombre: 'Saborizante', descripcion: 'Aporta sabor o gusto a un producto cosmético.', cliente: false },
    { id: 'FOAMING', nombre: 'Espumante', descripcion: 'Atrapa numerosas burbujas pequeñas de aire o gas en un volumen pequeño de líquido.', cliente: true },
    { id: 'FRAGRANCE', nombre: 'Fragancia', descripcion: 'Aporta olor: crea un aroma agradable perceptible o enmascara un mal olor.', cliente: false },
    { id: 'GEL FORMING', nombre: 'Gelificante', descripcion: 'Da consistencia de gel a una preparación líquida.', cliente: false },
    { id: 'HAIR CONDITIONING', nombre: 'Acondicionador capilar', descripcion: 'Mejora la apariencia y el tacto del cabello: fácil de peinar, suave, brillante, con volumen.', cliente: true },
    { id: 'HAIR DYEING', nombre: 'Tinte capilar', descripcion: 'Aporta color al cabello, de forma temporal, semipermanente o permanente.', cliente: true },
    { id: 'HAIR FIXING', nombre: 'Fijador capilar', descripcion: 'Permite el control físico del peinado.', cliente: true },
    { id: 'HAIR WAVING OR STRAIGHTENING', nombre: 'Ondulado o alisado capilar', descripcion: 'Modifica la estructura química del cabello para fijarlo en el estilo deseado.', cliente: true },
    { id: 'HUMECTANT', nombre: 'Humectante', descripcion: 'Retiene o conserva la humedad del producto durante su uso.', cliente: true },
    { id: 'KERATOLYTIC', nombre: 'Queratolítico', descripcion: 'Ayuda a eliminar las células muertas del estrato córneo.', cliente: true },
    { id: 'LIGHT STABILIZER', nombre: 'Estabilizante de luz', descripcion: 'Protege el producto cosmético del deterioro causado por la luz.', cliente: false },
    { id: 'LYTIC', nombre: 'Lítico', descripcion: 'Ayuda a descomponer lípidos, proteínas y polisacáridos en componentes más pequeños, normalmente por enzimas.', cliente: false },
    { id: 'MOISTURISING', nombre: 'Hidratante', descripcion: 'Aumenta el contenido de agua de la piel y la mantiene suave y tersa.', cliente: true },
    { id: 'NAIL CONDITIONING', nombre: 'Acondicionador de uñas', descripcion: 'Mejora las características cosméticas de la uña: hidratación, brillo, menos fragilidad y descamación.', cliente: true },
    { id: 'NAIL SCULPTING', nombre: 'Esculpido de uñas', descripcion: 'Forma una estructura dura que se asemeja a la lámina ungueal.', cliente: true },
    { id: 'NOT REPORTED', nombre: 'Sin función reportada', descripcion: 'Sin función reportada actualmente.', cliente: false },
    { id: 'OCCLUSIVE', nombre: 'Oclusivo', descripcion: 'Previene o ralentiza la evaporación del agua desde la superficie de la piel.', cliente: true },
    { id: 'OPACIFYING', nombre: 'Opacificante', descripcion: 'Reduce la transparencia o translucidez del cosmético.', cliente: false },
    { id: 'ORAL CARE', nombre: 'Cuidado oral', descripcion: 'Aporta efectos cosméticos a la cavidad oral: limpieza, desodorización, protección.', cliente: true },
    { id: 'OXIDISING', nombre: 'Oxidante', descripcion: 'Cambia la naturaleza química de otro ingrediente añadiendo oxígeno o quitando hidrógeno.', cliente: false },
    { id: 'PEARLESCENT', nombre: 'Nacarado', descripcion: 'Aporta apariencia nacarada al cosmético.', cliente: false },
    { id: 'PERFUMING', nombre: 'Perfumante', descripcion: 'Se usa en perfumes y materias primas aromáticas.', cliente: false },
    { id: 'pH ADJUSTERS', nombre: 'Regulador de pH', descripcion: 'Controla el pH de los productos cosméticos.', cliente: false },
    { id: 'PLASTICISER', nombre: 'Plastificante', descripcion: 'Ablanda y flexibiliza polímeros sintéticos que de otro modo no se podrían deformar o extender.', cliente: false },
    { id: 'PRESERVATIVE', nombre: 'Conservante', descripcion: 'Inhibe el desarrollo de microorganismos en el producto cosmético.', cliente: false },
    { id: 'PROPELLANT', nombre: 'Propelente', descripcion: 'Genera presión en un envase aerosol y expulsa el contenido al abrir la válvula.', cliente: false },
    { id: 'REDUCING', nombre: 'Reductor', descripcion: 'Cambia la naturaleza química de otro ingrediente añadiendo hidrógeno o quitando oxígeno.', cliente: false },
    { id: 'REFATTING', nombre: 'Reengrasante', descripcion: 'Repone los lípidos del cabello o de las capas superiores de la piel.', cliente: true },
    { id: 'REFRESHING', nombre: 'Refrescante', descripcion: 'Aporta una sensación agradable de frescura a la piel.', cliente: true },
    { id: 'SKIN CONDITIONING', nombre: 'Acondicionador de la piel', descripcion: 'Mantiene la piel en buen estado.', cliente: true },
    { id: 'SKIN CONDITIONING - EMOLLIENT', nombre: 'Emoliente', descripcion: 'Actúa como lubricante sobre la piel y le da una apariencia suave y tersa.', cliente: true },
    { id: 'SKIN CONDITIONING - HUMECTANT', nombre: 'Humectante de la piel', descripcion: 'Aumenta el contenido de agua de las capas superiores de la piel captando humedad del ambiente.', cliente: true },
    { id: 'SKIN CONDITIONING - MISCELLANEOUS', nombre: 'Acondicionador de la piel (otros)', descripcion: 'Mejora la apariencia de la piel seca o dañada reduciendo la descamación y devolviendo elasticidad.', cliente: true },
    { id: 'SKIN CONDITIONING - OCCLUSIVE', nombre: 'Oclusivo de la piel', descripcion: 'Retarda la evaporación del agua de la piel; suelen ser lípidos que permanecen en la superficie.', cliente: true },
    { id: 'SKIN PROTECTING', nombre: 'Protector de la piel', descripcion: 'Ayuda a evitar los efectos dañinos de factores externos sobre la piel.', cliente: true },
    { id: 'SLIP MODIFIER', nombre: 'Modificador de deslizamiento', descripcion: 'Mejora las propiedades de flujo de otros ingredientes sin reaccionar químicamente con ellos.', cliente: false },
    { id: 'SMOOTHING', nombre: 'Alisador de la piel', descripcion: 'Busca una superficie cutánea uniforme reduciendo asperezas o irregularidades.', cliente: true },
    { id: 'SOLVENT', nombre: 'Solvente', descripcion: 'Disuelve otros componentes del cosmético.', cliente: false },
    { id: 'SOOTHING', nombre: 'Calmante', descripcion: 'Alivia la incomodidad de la piel o del cuero cabelludo.', cliente: true },
    { id: 'SURFACE MODIFIER', nombre: 'Modificador de superficie', descripcion: 'Se aplica a otros componentes para hacerlos más hidrófilos o hidrófobos o modificar sus propiedades.', cliente: false },
    { id: 'SURFACTANT', nombre: 'Tensioactivo', descripcion: 'Ayuda a que ingredientes que normalmente no se mezclan se disuelvan o dispersen entre sí.', cliente: false },
    { id: 'SURFACTANT - CLEANSING', nombre: 'Tensioactivo limpiador', descripcion: 'Humecta superficies, emulsiona aceites y suspende la suciedad; aporta espuma a los limpiadores.', cliente: false },
    { id: 'SURFACTANT - DISPERSING', nombre: 'Tensioactivo dispersante', descripcion: 'Ayuda a distribuir un sólido insoluble en una fase líquida.', cliente: false },
    { id: 'SURFACTANT - EMULSIFYING', nombre: 'Tensioactivo emulsionante', descripcion: 'Ayuda a suspender o dispersar un líquido en otro reduciendo la tensión superficial.', cliente: false },
    { id: 'SURFACTANT - FOAM BOOSTING', nombre: 'Tensioactivo potenciador de espuma', descripcion: 'Aumenta la capacidad espumante o estabiliza la espuma.', cliente: false },
    { id: 'SURFACTANT - HYDROTROPE', nombre: 'Tensioactivo hidrótropo', descripcion: 'Mejora la solubilidad en agua de otro tensioactivo.', cliente: false },
    { id: 'SURFACTANT - SOLUBILIZING', nombre: 'Tensioactivo solubilizante', descripcion: 'Ayuda a disolver un componente en un medio donde normalmente no es soluble.', cliente: false },
    { id: 'TANNING', nombre: 'Bronceador', descripcion: 'Oscurece la piel con o sin exposición a la radiación UV.', cliente: true },
    { id: 'TONIC', nombre: 'Tónico', descripcion: 'Produce una sensación de bienestar en la piel y el cabello.', cliente: true },
    { id: 'UV ABSORBER', nombre: 'Absorbente UV', descripcion: 'Protege el producto cosmético de los efectos de la luz UV.', cliente: false },
    { id: 'UV FILTER', nombre: 'Filtro UV', descripcion: 'Protege la piel o el cabello de ciertas radiaciones UV absorbiéndolas, reflejándolas o dispersándolas.', cliente: true },
    { id: 'VISCOSITY CONTROLLING', nombre: 'Regulador de viscosidad', descripcion: 'Aumenta o reduce la viscosidad (espesor) del cosmético.', cliente: false },
];

export const FUNCIONES_COSING_CLIENTE = FUNCIONES_COSING.filter(f => f.cliente);

const POR_ID = new Map(FUNCIONES_COSING.map(f => [f.id, f]));

export function esFuncionCosing(id: string): boolean {
    return POR_ID.has(id);
}

export function nombreFuncionCosing(id: string): string {
    return POR_ID.get(id)?.nombre ?? id;
}
