import "server-only";

/**
 * Direccion -> coordenadas con Nominatim (OpenStreetMap), el mismo servicio que usa el
 * mapa del wizard. Por WhatsApp no hay mapa: el vecino escribe la direccion y aca se
 * busca dentro de la ciudad del municipio.
 *
 *   DENUNCIAS_CIUDAD   "Corrientes, Argentina" (se agrega a la busqueda)
 *   DENUNCIAS_CENTRO   "-27.4806,-58.8341"     (centro de la ciudad, para acotar y como
 *                                               ubicacion aproximada)
 *   NOMINATIM_EMAIL    contacto que pide la politica de uso de Nominatim
 */

export interface Punto {
  lat: number;
  lng: number;
}

export function centroCiudad(): Punto {
  const [lat, lng] = (process.env.DENUNCIAS_CENTRO ?? "-27.4806,-58.8341").split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : { lat: -27.4806, lng: -58.8341 };
}

export function ciudad(): string {
  return process.env.DENUNCIAS_CIUDAD?.trim() || "Corrientes, Argentina";
}

/** Grados de margen alrededor del centro (~20 km): fuera de eso no es de este municipio. */
const MARGEN = 0.2;

/**
 * Nominatim no entiende esquinas ("9 de Julio y Mendoza"): si la direccion tal cual no
 * aparece, se prueba con la primera calle y se avisa con `aproximada` para dejar la
 * esquina anotada en la referencia del reclamo.
 */
export async function ubicar(direccion: string): Promise<(Punto & { encontrada: string; aproximada: boolean }) | null> {
  const exacta = await geocodificar(direccion);
  if (exacta) return { ...exacta, aproximada: false };
  const partes = direccion.split(/\s+(?:y|e\/|esq\.?|esquina(?:\s+con)?|entre)\s+/i).map((s) => s.trim()).filter(Boolean);
  if (partes.length < 2) return null;
  await new Promise((r) => setTimeout(r, 1100)); // politica de Nominatim: 1 por segundo
  const calle = await geocodificar(partes[0]);
  return calle ? { ...calle, aproximada: true } : null;
}

export async function geocodificar(direccion: string): Promise<(Punto & { encontrada: string }) | null> {
  const c = centroCiudad();
  const params = new URLSearchParams({
    format: "json",
    q: `${direccion}, ${ciudad()}`,
    limit: "1",
    viewbox: `${c.lng - MARGEN},${c.lat + MARGEN},${c.lng + MARGEN},${c.lat - MARGEN}`,
    bounded: "1",
  });
  const email = process.env.NOMINATIM_EMAIL;
  if (email) params.set("email", email);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": "BuilderCRM-denuncias/1.0", "Accept-Language": "es" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return null;
    const datos = (await r.json()) as { lat: string; lon: string; display_name: string }[];
    const p = datos[0];
    if (!p) return null;
    return { lat: Number(p.lat), lng: Number(p.lon), encontrada: p.display_name };
  } catch {
    return null;
  }
}
