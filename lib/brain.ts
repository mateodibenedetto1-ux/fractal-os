/**
 * Segundo cerebro de un cliente de Fractal Consulting.
 * Une la ficha de marca (estilo ADN) con el onboarding, el avatar, los objetivos y el producto de Fractal,
 * adaptado a consultoría: dueños, agencias, coaches, productores y expertos.
 * Cada sección pertenece a un módulo del curso; los módulos son las etapas del Recorrido Fractal.
 */

export interface BrainField {
  k: string;
  label: string;
  help?: string;
  short?: boolean; // una línea
}

export interface BrainSection {
  k: string;
  n: number;
  title: string;
  intro: string;
  mod: string; // módulo del curso al que pertenece
  fields: BrainField[];
}

/** Módulos del curso de Fractal Consulting (3 meses). Cada uno es una etapa del Recorrido Fractal. */
export interface Module {
  k: string;
  n: string;
  title: string;
  about: string;
  lead: 'Mateo' | 'Lorena' | 'Mateo + Lorena';
  weeks: number;
}

export const MODULES: Module[] = [
  { k: 'icp', n: '01', title: 'ICP & Research', about: 'Entender al cliente ideal, el mercado y sus necesidades.', lead: 'Mateo + Lorena', weeks: 2 },
  { k: 'oferta', n: '02', title: 'Oferta', about: 'Propuesta de valor, packaging y pricing.', lead: 'Mateo', weeks: 1 },
  { k: 'brand', n: '03', title: 'Brand & Positioning', about: 'Posicionamiento, diferenciación y narrativa.', lead: 'Lorena', weeks: 1 },
  { k: 'creative', n: '04', title: 'Creative Strategy', about: 'Investigación creativa, ideas y dirección.', lead: 'Lorena', weeks: 1 },
  { k: 'content', n: '05', title: 'Content', about: 'Hooks, guiones, historias, YouTube y distribución.', lead: 'Lorena', weeks: 2 },
  { k: 'acquisition', n: '06', title: 'Acquisition', about: 'Prospección, funnels y captación de leads.', lead: 'Mateo', weeks: 2 },
  { k: 'sales', n: '07', title: 'Sales', about: 'Conversaciones, CRM, seguimiento y cierre.', lead: 'Mateo', weeks: 1 },
  { k: 'operations', n: '08', title: 'Operations', about: 'SOPs, procesos, automatización y delegación.', lead: 'Mateo', weeks: 2 },
  { k: 'metrics', n: '09', title: 'Metrics & Growth', about: 'KPIs, cuellos de botella y optimización.', lead: 'Mateo', weeks: 1 },
];

export const BRAIN: BrainSection[] = [
  {
    k: 'partida', n: 1, title: 'Punto de partida', mod: 'icp',
    intro: 'Dónde está tu negocio hoy. Sé breve y honesto: no hay respuestas correctas.',
    fields: [
      { k: 'nombre', label: 'Nombre completo', short: true },
      { k: 'contacto', label: 'WhatsApp y email', short: true },
      { k: 'rubro', label: 'Rubro o nicho en el que trabajás hoy', short: true },
      { k: 'links', label: 'Links relevantes', help: 'Instagram personal y de marca, web, TikTok, YouTube: lo que uses activamente.' },
      { k: 'facturacion', label: '¿Cuánto facturás por mes?', help: 'Número específico. Ej: "USD 8.000/mes promedio de los últimos 3 meses".', short: true },
      { k: 'equipo', label: '¿Tenés equipo o trabajás solo?', help: 'Si tenés equipo, un rol por línea.' },
      { k: 'tiempo', label: '¿Cuánto tiempo por semana le podés dedicar al proceso?', help: '2–4 horas, 5–8 horas o más de 8.', short: true },
      { k: 'intentos', label: '¿Qué intentaste antes para crecer y qué no funcionó?', help: 'Agencias, cursos, freelancers, estrategias.' },
      { k: 'exito_90', label: 'Si en 3 meses esto sale perfecto, ¿qué cambia?', help: '2–3 cosas concretas de tu día a día y de tus números.' },
      { k: 'fechas', label: 'Fechas críticas de los próximos 90 días', help: 'Viajes, lanzamientos, eventos, cohortes.' },
      { k: 'decision', label: '¿Qué te hizo arrancar ahora?', help: 'El momento real, no la razón prolija.' },
    ],
  },
  {
    k: 'cliente', n: 2, title: 'Cliente de alto valor', mod: 'icp',
    intro: 'Cuanto más nítido sea tu cliente ideal, mejor se diseña la oferta, el contenido y la venta.',
    fields: [
      { k: 'perfil', label: 'Perfil', help: 'Profesión, país, edad, ingresos mensuales y estado familiar.' },
      { k: 'avatar_nombre', label: 'Nombre del avatar', help: 'Un nombre propio para personalizarlo. Ej: "Tania".', short: true },
      { k: 'rutina', label: 'Rutina y momento de vida', help: 'Cómo se ve un día típico y en qué etapa está.' },
      { k: 'valor_real', label: 'Qué hace que sea un cliente de alto valor', help: 'Por qué puede pagar, comprometerse y obtener resultados.' },
      { k: 'problemas', label: 'Problemas de alto valor', help: 'Los 3 a 5 problemas que más le cuestan dinero, tiempo o energía.' },
      { k: 'herida', label: 'La herida', help: 'Lo que le dolió y todavía condiciona cómo decide.' },
      { k: 'brecha', label: 'La gran brecha', help: 'La distancia entre dónde está y dónde quiere estar.' },
      { k: 'emociones', label: 'Sus 5 emociones más fuertes' },
      { k: 'miedos', label: 'Sus 5 mayores miedos' },
      { k: 'frases_dolor', label: 'Frases de dolor que dice o piensa', help: 'Textuales, como las escuchás en llamadas o mensajes.' },
      { k: 'deseo', label: 'Deseo profundo', help: 'Lo que realmente quiere, más allá de lo que pide.' },
      { k: 'probo', label: 'Soluciones que ya probó' },
      { k: 'no_quiere', label: 'Lo que ya no quiere hacer' },
      { k: 'depende', label: 'De quién depende realmente su éxito' },
      { k: 'culpa', label: 'A quién culpa de su situación' },
      { k: 'objeciones', label: 'Sus 5 objeciones más grandes' },
      { k: 'previo_compra', label: 'Lo que se dice justo antes de comprar' },
      { k: 'resultado', label: 'El resultado que busca', help: 'Concreto y medible, en sus palabras.' },
      { k: 'conciencia', label: 'Etapa de conciencia predominante', help: 'Inconsciente, consciente del problema, de la solución, del producto o muy consciente.', short: true },
      { k: 'mercado', label: 'Investigación de mercado', help: 'Competidores, precios, qué se está vendiendo y qué huecos ves.' },
      { k: 'narrativa_avatar', label: 'Tu cliente en un párrafo', help: 'Presentalo como si se lo contaras a alguien.' },
    ],
  },
  {
    k: 'ofertas', n: 3, title: 'Ofertas y escalera', mod: 'oferta',
    intro: 'Propuesta de valor, packaging y pricing: cómo se ordena lo que vendés, de la primera compra al programa premium.',
    fields: [
      { k: 'propuesta', label: 'Propuesta de valor', help: 'Qué resultado entregás, para quién y en cuánto tiempo, en una frase.' },
      { k: 'entrada', label: 'Oferta de entrada', help: 'Nombre, promesa, precio y formato.' },
      { k: 'core', label: 'Oferta core', help: 'Nombre, promesa, a quién está dirigida, precio, duración, formato y resultado concreto.' },
      { k: 'premium', label: 'Oferta premium' },
      { k: 'otros', label: 'Otros productos, upsells o servicios', help: 'Uno por línea, con el mismo detalle.' },
      { k: 'bonos', label: 'Bonos y garantías', help: 'Cómo reducís la fricción para que decidan.' },
      { k: 'pricing', label: 'Precio, ticket promedio y forma de pago', help: 'Mensual, único o en cuotas, por producto.' },
      { k: 'clientes_nivel', label: 'Clientes activos hoy por nivel de la escalera' },
      { k: 'ltv', label: 'LTV promedio del cliente', help: 'Si no lo sabés, escribí "sin datos".', short: true },
    ],
  },
  {
    k: 'marca', n: 4, title: 'Marca y posicionamiento', mod: 'brand',
    intro: 'El porqué de tu marca y el lugar que querés ocupar en la mente de tu cliente.',
    fields: [
      { k: 'nombre_marca', label: 'Nombre de la marca y de quien la lidera', help: 'Cómo te presentás y cómo querés que te nombren.', short: true },
      { k: 'descripcion', label: 'Descripción de la empresa', help: 'Qué hacés, para quién y cómo, en dos o tres frases.' },
      { k: 'mision', label: 'Misión', help: 'Qué transformación concreta producís.' },
      { k: 'vision', label: 'Visión a 3 años', help: 'Cómo se ve tu negocio y tu vida si todo sale bien.' },
      { k: 'creencia', label: 'Creencia central', help: 'La idea que sostiene todo lo que hacés.' },
      { k: 'valores', label: 'Valores no negociables' },
      { k: 'percepcion', label: '¿Cómo querés ser percibido en el mercado?', help: 'Cómo querés que la gente te recuerde y hable de vos.' },
      { k: 'posicionamiento', label: 'Posicionamiento en una línea', help: 'La frase que te define como referente.', short: true },
      { k: 'diferencia', label: '¿Qué hace distinta a tu marca?', help: 'Lo que nadie más en tu nicho puede decir.' },
    ],
  },
  {
    k: 'narrativa', n: 5, title: 'Genio único y narrativa', mod: 'brand',
    intro: 'Lo que te hace distinto y la historia que hace que te elijan a vos.',
    fields: [
      { k: 'historia_origen', label: 'Historia de origen' },
      { k: 'quiebre', label: 'Momento de quiebre', help: 'El punto en el que cambió todo.' },
      { k: 'postura', label: 'Postura que defendés', help: 'Lo que pensás distinto a tu industria.' },
      { k: 'metodo', label: 'Método propio', help: 'Nombre, pasos y por qué funciona.' },
      { k: 'enemigo', label: 'Enemigo común', help: 'La idea, el sistema o la práctica contra la que vas.' },
      { k: 'verdad', label: 'La verdad central', help: 'Lo que tu cliente necesita entender para avanzar.' },
      { k: 'creencias', label: 'Creencias a instalar', help: 'Creencia actual de tu cliente → creencia que querés que adopte.' },
      { k: 'frase_maestra', label: 'Frase maestra', short: true },
      { k: 'movimiento', label: 'Movimiento', help: 'A qué se suma tu cliente cuando te elige.' },
      { k: 'identidad', label: 'La identidad que le ofrecés', help: 'En quién se convierte trabajando con vos.' },
      { k: 'mapa', label: 'El mapa de la transformación', help: 'Las etapas que recorre desde el inicio hasta el resultado.' },
    ],
  },
  {
    k: 'creativa', n: 6, title: 'Estrategia creativa', mod: 'creative',
    intro: 'Investigación creativa, ideas y dirección: de dónde salen las ideas y cómo se tienen que ver.',
    fields: [
      { k: 'investigacion', label: 'Investigación creativa', help: 'Qué contenido funciona en tu nicho y por qué: cuentas, piezas, formatos.' },
      { k: 'referentes', label: 'Referentes y anti-referentes', help: 'Quiénes te inspiran y de quiénes te querés diferenciar.' },
      { k: 'estetica', label: 'Estética y dirección de arte', help: 'Colores, tipografías, locaciones, sensaciones.' },
      { k: 'angulos', label: 'Ángulos e ideas', help: 'Temas, historias y enfoques que querés explorar.' },
      { k: 'produccion', label: 'Cómo producís', help: 'Quién graba y edita, con qué equipo y cuánto tiempo tenés.' },
    ],
  },
  {
    k: 'contenido', n: 7, title: 'Contenido y voz', mod: 'content',
    intro: 'Hooks, guiones, historias, YouTube y distribución, con una voz que siga siendo tuya.',
    fields: [
      { k: 'tono', label: 'Tono', help: 'Adjetivos y ejemplos de cómo hablás.' },
      { k: 'palabras_si', label: 'Palabras y expresiones que sí usás' },
      { k: 'palabras_no', label: 'Palabras prohibidas' },
      { k: 'pilares', label: 'Pilares de contenido', help: 'Los 3 a 5 temas sobre los que vas a hablar siempre.' },
      { k: 'hooks', label: 'Hooks y piezas que mejor te funcionaron', help: 'Con links y números si los tenés.' },
      { k: 'historias', label: 'Historias (stories)', help: 'Cuántas subís, qué tipo de secuencias y cuántas views tienen.' },
      { k: 'youtube', label: 'YouTube y contenido largo', help: 'Si ya publicás, qué; si no, qué te gustaría hacer.' },
      { k: 'distribucion', label: 'Plataformas, frecuencia y distribución', help: 'Dónde publicás hoy, cada cuánto y dónde querés crecer.' },
    ],
  },
  {
    k: 'adquisicion', n: 8, title: 'Adquisición', mod: 'acquisition',
    intro: 'Prospección, funnels y captación de leads: cómo te encuentran y cómo dejan sus datos.',
    fields: [
      { k: 'canales_hoy', label: '¿Cómo conseguís clientes hoy?', help: 'De qué canal viene cada cliente y cuántas ventas trae. Ej: "60% IG orgánico ≈ 8 ventas/mes, 30% referidos ≈ 4".' },
      { k: 'canal_potenciar', label: 'Canal a potenciar' },
      { k: 'embudo', label: 'Embudo actual', help: 'De la primera vez que te ven hasta que te escriben o compran.' },
      { k: 'lead_magnet', label: 'Captación de datos', help: 'Recursos, formularios, ManyChat, comunidad, listas.' },
      { k: 'prospeccion', label: 'Prospección activa', help: 'Si salís a buscar clientes: cómo, dónde y con qué mensaje.' },
      { k: 'lanzamientos', label: 'Calendario de lanzamientos' },
      { k: 'internacional', label: 'Mercados y países objetivo' },
    ],
  },
  {
    k: 'ventas', n: 9, title: 'Ventas', mod: 'sales',
    intro: 'Conversaciones, CRM, seguimiento y cierre.',
    fields: [
      { k: 'quien_vende', label: '¿Quién vende y con qué estructura?', help: 'Fundador, closer, setter, equipo; guion y etapas.' },
      { k: 'proceso', label: 'Proceso de ventas', help: 'De la primera conversación al pago: chat, llamada o ambos.' },
      { k: 'crm', label: 'CRM y seguimiento', help: 'Dónde registrás cada lead y cómo hacés el seguimiento.' },
      { k: 'cierre', label: 'Tasa de cierre y ciclo de venta', help: 'Cuántas conversaciones o llamadas necesitás por venta y cuánto tarda.' },
      { k: 'objeciones_reales', label: 'Objeciones que escuchás en las ventas' },
    ],
  },
  {
    k: 'operacion', n: 10, title: 'Operación y entrega', mod: 'operations',
    intro: 'El producto de adentro hacia afuera: no cómo se vende, sino cómo se vive desde que alguien entra hasta que sale o sube de nivel.',
    fields: [
      { k: 'journey', label: 'El camino completo de un cliente', help: 'Primeras 24 h, onboarding, avances, revisiones y cierre.' },
      { k: 'onboarding', label: 'Onboarding', help: 'Qué recibe en las primeras 24 h, quién lo hace, cuánto tarda y qué depende solo de vos.' },
      { k: 'contenido_programa', label: 'Clases y contenido del programa', help: 'Módulos, grabado o en vivo, plataforma, frecuencia de actualización, recursos.' },
      { k: 'llamadas', label: 'Llamadas y acompañamiento', help: 'Individuales o grupales, frecuencia, quién las da, cómo se registran los acuerdos.' },
      { k: 'sops', label: 'Procesos documentados (SOPs)', help: 'Qué está escrito y qué vive solo en tu cabeza.' },
      { k: 'automatizacion', label: 'Herramientas y automatizaciones' },
      { k: 'continuidad', label: 'Upsells y continuidad', help: 'Qué se ofrece al terminar, cómo es la transición y cuántos suben de nivel.' },
      { k: 'cuellos', label: 'Lo que hoy depende solo de vos', help: 'Las tareas que, si faltás, frenan el negocio. Es lo primero a delegar.' },
    ],
  },
  {
    k: 'ia', n: 11, title: 'Reglas para la IA de Fractal', mod: 'operations',
    intro: 'La guía que la IA de Fractal va a respetar en cada respuesta, guion o documento que cree para vos.',
    fields: [
      { k: 'nunca', label: 'Lo que nunca debería hacer' },
      { k: 'siempre', label: 'Lo que siempre debería tener en cuenta' },
      { k: 'formato', label: 'Formato preferido', help: 'Listas, prosa, tablas.' },
      { k: 'longitud', label: 'Longitud de las respuestas', short: true },
      { k: 'estructura', label: 'Estructura', help: 'Cómo te gusta que se ordene la información.' },
      { k: 'idioma', label: 'Idioma y variante', help: 'Ej: español rioplatense, neutro, mexicano.', short: true },
      { k: 'notas', label: 'Notas adicionales' },
    ],
  },
  {
    k: 'metricas', n: 12, title: 'Métricas y crecimiento', mod: 'metrics',
    intro: 'KPIs, cuellos de botella y optimización: hacia dónde va el negocio y cómo medimos que avanza.',
    fields: [
      { k: 'kpis', label: 'Los números que mirás hoy', help: 'Alcance, leads, conversaciones, ventas, facturación, retención.' },
      { k: 'obj_90', label: 'Objetivo de facturación a 90 días', short: true },
      { k: 'obj_6m', label: 'Objetivo a 6 meses', short: true },
      { k: 'obj_anio', label: 'Objetivo al cierre del año', short: true },
      { k: 'clientes_mes', label: 'Clientes nuevos por mes para llegar al objetivo', short: true },
      { k: 'margen', label: 'Línea con más margen y con más potencial de escala' },
      { k: 'trabas', label: 'Cuellos de botella', help: 'Lo que hoy te impide llegar a esos números.' },
      { k: 'resultados', label: 'Resultados de clientes', help: 'Antes y después, con números cuando los haya.' },
      { k: 'testimonios', label: 'Testimonios textuales' },
      { k: 'credenciales', label: 'Credenciales, prensa y colaboraciones' },
    ],
  },
];

/** Avance de un módulo: el promedio de sus secciones. */
export function modulePct(data: Record<string, string>, m: Module) {
  const secs = BRAIN.filter((s) => s.mod === m.k);
  return secs.length ? Math.round(secs.reduce((a, s) => a + sectionPct(data, s), 0) / secs.length) : 0;
}

export type BrainData = Record<string, string>;
const filled = (v?: string) => !!v && v.trim().length >= 2;

export function sectionPct(data: BrainData, s: BrainSection) {
  const n = s.fields.filter((f) => filled(data[`${s.k}.${f.k}`])).length;
  return Math.round((n / s.fields.length) * 100);
}

export function brainPct(data: BrainData) {
  const all = BRAIN.flatMap((s) => s.fields.map((f) => `${s.k}.${f.k}`));
  return Math.round((all.filter((k) => filled(data[k])).length / all.length) * 100);
}

/** Exporta el segundo cerebro como Markdown (para descargar o dárselo a la IA). */
export function brainMarkdown(data: BrainData, name: string) {
  const out = [`# Segundo cerebro · ${name}`, ''];
  for (const s of BRAIN) {
    out.push(`## ${s.n}. ${s.title}`, '');
    for (const f of s.fields) {
      const v = data[`${s.k}.${f.k}`]?.trim();
      if (v) out.push(`**${f.label}**`, v, '');
    }
  }
  return out.join('\n');
}
