import type { Channel } from "@/lib/channels/types";

/**
 * Los modelos escriben Markdown aunque el prompt les pida que no ("**#1011**"), y ningun
 * canal lo muestra: WhatsApp tiene su propio formato (*negrita*, _cursiva_, ~tachado~) y
 * Instagram y Messenger no tienen ninguno. Sin esto el vecino ve los asteriscos dobles.
 * Se aplica solo a lo que escribe el agente, no a lo que escribe una persona del equipo.
 */
export function aFormatoDeCanal(texto: string, canal: Channel): string {
  const whatsapp = canal === "whatsapp";
  let t = texto.replace(/\r\n?/g, "\n");

  // Bloques de codigo: se queda el contenido.
  t = t.replace(/```[a-z]*\n?([\s\S]*?)```/gi, "$1");
  // Vinetas con * o + al inicio de linea -> guion (un * suelto se leeria como negrita).
  t = t.replace(/^(\s*)[*+]\s+/gm, "$1- ");
  // Titulos: el texto, en negrita en WhatsApp.
  t = t.replace(/^#{1,6}\s+(.+)$/gm, (_m, titulo: string) => (whatsapp ? `*${titulo.trim()}*` : titulo.trim()));
  // Links [texto](url) -> "texto: url" (si el texto ya es la url, solo la url).
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, txt: string, url: string) => (txt === url ? url : `${txt}: ${url}`));
  // Negrita, cursiva y tachado.
  t = t.replace(/\*\*(.+?)\*\*/g, whatsapp ? "*$1*" : "$1");
  t = t.replace(/__(.+?)__/g, whatsapp ? "*$1*" : "$1");
  t = t.replace(/~~(.+?)~~/g, whatsapp ? "~$1~" : "$1");
  if (!whatsapp) t = t.replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, "$1$2");
  // Codigo en linea: WhatsApp lo muestra monoespaciado con ```; mas simple, sin marcas.
  t = t.replace(/`([^`\n]+)`/g, "$1");

  return t.replace(/\n{3,}/g, "\n\n").trim();
}
