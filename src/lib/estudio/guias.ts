/**
 * Guias del asistente del Estudio, una por paso (FR-011). Genericas: los rubros solo
 * aparecen como ejemplos entre varios. Las lee el navegador.
 */

export type ClavePaso = "negocio" | "marca" | "pipeline" | "campos" | "agente" | "modulos" | "revisar";

export interface Guia {
  titulo: string;
  resumen: string;
  /** Que mirar y que decidir en este paso. */
  pasos: string[];
  ejemplos?: string[];
  /** Errores que se ven seguido. */
  cuidado?: string[];
}

export const PASOS: { clave: ClavePaso; titulo: string }[] = [
  { clave: "negocio", titulo: "Negocio" },
  { clave: "marca", titulo: "Marca" },
  { clave: "pipeline", titulo: "Pipeline" },
  { clave: "campos", titulo: "Campos" },
  { clave: "agente", titulo: "Agente" },
  { clave: "modulos", titulo: "Modulos" },
  { clave: "revisar", titulo: "Revisar" },
];

/** Prefijos de error del esquema que corresponden a cada paso. */
export const RUTAS_DE_PASO: Record<ClavePaso, string[]> = {
  negocio: ["idioma", "moneda", "zonaHoraria"],
  marca: ["marca"],
  pipeline: ["pipeline"],
  campos: ["contacto"],
  agente: ["agente", "roles"],
  modulos: ["modulos"],
  revisar: [],
};

export const GUIAS: Record<ClavePaso, Guia> = {
  negocio: {
    titulo: "Lo basico del negocio",
    resumen:
      "Moneda, zona horaria e idioma. Parecen detalles, pero deciden como se ven los montos y que dia le nombra el agente a quien escribe de noche.",
    pasos: [
      "Moneda: la que usa el cliente para cotizar (codigo de 3 letras: USD, CLP, ARS, MXN, EUR).",
      "Zona horaria: la del negocio, no la tuya. El servidor corre en UTC; sin esto el agente dice 'manana' cuando ya es hoy.",
      "Idioma: el de la interfaz y el del agente.",
    ],
    ejemplos: ["Clinica en Buenos Aires: ARS + America/Argentina/Buenos_Aires", "Inmobiliaria en Santiago: CLP + America/Santiago"],
    cuidado: ["La zona horaria es un identificador IANA (Region/Ciudad), no 'GMT-3'."],
  },
  marca: {
    titulo: "Que el cliente reconozca su CRM",
    resumen:
      "Nombre, colores y logo aparecen en el login, el sidebar, la pestana del navegador y el icono de la app en el celular.",
    pasos: [
      "Nombre: tal cual lo escribe el cliente (max 60).",
      "Nombre corto: lo que se lee bajo el icono del celular y en las notificaciones (max 12).",
      "Color primario: botones y acciones. Elegi uno con contraste: el texto se pone blanco o negro solo.",
      "Color del sidebar: suele ser un tono muy oscuro del color de marca.",
      "Logo e icono: PNG cuadrado. El icono tiene que leerse a 64 px, asi que mejor el simbolo sin texto.",
    ],
    cuidado: [
      "Un primario muy claro (amarillo, cian) en botones con texto blanco no se lee: mira la vista previa.",
      "Si no tenes logo todavia, deja el generico y anotalo como pendiente.",
    ],
  },
  pipeline: {
    titulo: "Las etapas por las que pasa un cliente",
    resumen:
      "El pipeline es el camino de un lead desde que escribe hasta que compra (o no). El agente mueve las operaciones entre estas etapas.",
    pasos: [
      "Usa los nombres que el equipo del cliente ya dice en voz alta ('Visita agendada', 'Presupuesto enviado').",
      "Entre 4 y 8 etapas. Menos no ordena nada; mas nadie las mantiene.",
      "Marca una etapa como ganada y otra como perdida: los reportes las necesitan para calcular conversion.",
      "La clave es el identificador interno (snake_case). Se genera sola desde el nombre.",
    ],
    ejemplos: [
      "Clinica: Consulta nueva > Turno agendado > Atendido > Tratamiento > Alta / No vino",
      "Servicios: Nuevo lead > Calificado > Propuesta > Negociacion > Ganado / Perdido",
    ],
    cuidado: [
      "Cambiar la clave de una etapa que ya existe crea una etapa nueva: la vieja se conserva con sus operaciones.",
      "Las etapas que saques del perfil no se borran de la base si tienen operaciones.",
    ],
  },
  campos: {
    titulo: "Lo que hay que saber de cada contacto",
    resumen:
      "Campos propios del negocio en la ficha del contacto. Si marcas que el agente lo averigue, va a preguntarlo en la conversacion y lo deja anotado.",
    pasos: [
      "Pregunta al cliente: 'que necesitas saber de alguien antes de llamarlo?'. Eso son los campos.",
      "Tipo seleccion cuando las respuestas son pocas y conocidas (Compra / Arriendo). Texto cuando son libres (zona, motivo).",
      "Mostrar en tabla: solo 2 o 3, los que sirven para filtrar la lista.",
      "Para el agente, la descripcion le dice que preguntar: 'presupuesto maximo en dolares', no 'presupuesto'.",
    ],
    ejemplos: ["Inmobiliaria: tipo de operacion, zona, presupuesto", "Clinica: tratamiento de interes, obra social, primera vez"],
    cuidado: ["No pidas al agente mas de 3 o 4 datos: la conversacion se vuelve un formulario."],
  },
  agente: {
    titulo: "Como habla y que busca el agente",
    resumen:
      "El agente contesta WhatsApp, Instagram y Messenger. Aqui va su nombre, su prompt base y lo que dice cuando pasa la conversacion a una persona.",
    pasos: [
      "Nombre: como se presenta ('Sofia, del equipo de Casa Sur').",
      "Prompt: que hace el negocio, que tiene que lograr el agente, tono y limites. El CRM le agrega solo el contexto del contacto, la etapa y los datos a averiguar.",
      "Deja el prompt vacio para usar el generico del nucleo y probar primero.",
      "Etiqueta del asesor: como se llama al rol de quien atiende (Asesor, Vendedor, Recepcion).",
    ],
    ejemplos: [
      "'Sos el asistente de Clinica Norte. Respondes rapido y con calidez, averiguas el tratamiento y la obra social, y ofreces turno. Nunca das diagnosticos ni precios cerrados.'",
    ],
    cuidado: [
      "El prompt global de Ajustes > Agente y el de cada canal mandan sobre este: este es el punto de partida.",
      "Proba siempre en el Simulador despues de cambiar el prompt.",
    ],
  },
  modulos: {
    titulo: "Que funciones tiene este CRM",
    resumen:
      "Las funciones del nucleo se pueden apagar si el cliente no las usa, y los modulos de modules/ agregan pantallas, tablas y tools del agente.",
    pasos: [
      "Apaga lo que el cliente no va a usar: menos menu, menos dudas.",
      "Activa un modulo solo si el negocio lo necesita (propiedades, visitas, pedidos...).",
      "Si el modulo que hace falta no existe, se crea con la skill crear-modulo.",
    ],
    cuidado: [
      "Activar o desactivar un modulo necesita aplicar migraciones y reiniciar el servidor: el Estudio te lo recuerda al guardar.",
    ],
  },
  revisar: {
    titulo: "Revisar y activar",
    resumen:
      "Guardar escribe el perfil en config/perfiles/. Activar lo pone en uso: el CRM entero pasa a esta marca, pipeline, campos y agente.",
    pasos: [
      "Revisa que no haya errores en ningun paso.",
      "Activa y mira el sidebar, el pipeline y el simulador.",
      "Cuando este listo para el cliente: commit de config/ y public/marca/, y deploy.",
    ],
    cuidado: [
      "Todos los perfiles comparten la misma base de datos local: los contactos de un perfil se ven en otro.",
    ],
  },
};
