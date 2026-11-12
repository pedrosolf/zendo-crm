/**
 * Como se escriben en el historial los mensajes que no son texto (audios y ubicaciones
 * de WhatsApp). Puro: lo usan el webhook al guardar y las tools al leer. El agente solo
 * ve texto, asi que la nota de voz entra transcripta y el pin entra con coordenadas.
 */

export interface Ubicacion {
  latitude: number;
  longitude: number;
  name?: string | null;
  address?: string | null;
}

const PREFIJO_UBICACION = "📍 Ubicacion compartida:";
const PREFIJO_AUDIO = "🎤 Audio:";
const PREFIJO_FOTO = "📷 Foto";

export function textoDeUbicacion(u: Ubicacion): string {
  const lat = u.latitude.toFixed(6);
  const lng = u.longitude.toFixed(6);
  const extra = [u.name, u.address].map((x) => x?.trim()).filter(Boolean).join(" - ");
  return `${PREFIJO_UBICACION} ${lat},${lng}${extra ? ` (${extra})` : ""}`;
}

/** Coordenadas de un texto armado por textoDeUbicacion (o escritas "lat,lng"). */
export function coordenadasDe(texto: string): { lat: number; lng: number } | null {
  const m = /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/.exec(texto);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function textoDeAudio(transcripcion: string | null): string {
  const t = transcripcion?.trim();
  return t ? `${PREFIJO_AUDIO} "${t}"` : `${PREFIJO_AUDIO} (no se pudo transcribir)`;
}

/** La foto queda guardada en el mensaje (raw_payload); el agente ve que llego y su epigrafe. */
export function textoDeFoto(epigrafe: string | null | undefined, cantidad = 1): string {
  const e = epigrafe?.trim();
  const base = cantidad > 1 ? `${PREFIJO_FOTO}s (${cantidad})` : PREFIJO_FOTO;
  return e ? `${base}: "${e}"` : base;
}

/** Lo que se le agrega al prompt del canal para que el agente sepa leer esto. */
export const GUIA_MEDIOS =
  `Los mensajes que empiezan con "${PREFIJO_AUDIO}" son notas de voz transcriptas automaticamente: ` +
  "puede haber palabras mal entendidas; si algo importante no se entiende (un nombre, un numero, una direccion), " +
  "pedi que lo escriba. Si dice \"no se pudo transcribir\", pedile amablemente que lo escriba. " +
  `Los que empiezan con "${PREFIJO_UBICACION}" son un pin del mapa con latitud,longitud: usalos como la ubicacion que te paso. ` +
  `Los que empiezan con "${PREFIJO_FOTO}" son fotos que mando (no ves la imagen; si trae texto, es lo que escribio con la foto): agradecela y segui.`;
