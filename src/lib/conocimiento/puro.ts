/**
 * Base de conocimiento: piezas puras (sin base, sin red). Las prueba
 * tests/conocimiento.test.ts. Ver specs/nucleo/13-base-de-conocimiento.md.
 */

export const MAX_BYTES_CONOCIMIENTO = 15 * 1024 * 1024;

export type MimeConocimiento = "application/pdf" | "text/plain" | "text/markdown";

/** Tipo por CONTENIDO (FR-009): firma %PDF- o texto UTF-8 valido. null = no se acepta. */
export function detectarTipo(bytes: Uint8Array, nombre: string): MimeConocimiento | null {
  const firma = String.fromCharCode(...bytes.slice(0, 5));
  if (firma === "%PDF-") return "application/pdf";
  if (bytes.length === 0) return null;
  try {
    const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(0, 64 * 1024));
    // Un binario cualquiera suele traer bytes nulos aunque decodifique.
    if (texto.includes("\u0000")) return null;
  } catch {
    return null;
  }
  return /\.(md|markdown)$/i.test(nombre) ? "text/markdown" : "text/plain";
}

/** Limpia el texto extraido: espacios repetidos, guiones de corte de linea, lineas vacias. */
export function limpiarTexto(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parte el texto en fragmentos de ~`tamano` caracteres con `solape` de contexto entre
 * uno y el siguiente (FR-003). Prefiere cortar en parrafo, despues en frase, despues en
 * espacio; nunca a mitad de palabra salvo una palabra mas larga que el fragmento.
 */
export function fragmentar(texto: string, tamano = 1200, solape = 200): string[] {
  const t = limpiarTexto(texto);
  if (!t) return [];
  if (t.length <= tamano) return [t];
  const fragmentos: string[] = [];
  let inicio = 0;
  while (inicio < t.length) {
    let fin = Math.min(inicio + tamano, t.length);
    if (fin < t.length) {
      const ventana = t.slice(inicio, fin);
      const minimo = Math.floor(tamano * 0.5);
      const corte = [ventana.lastIndexOf("\n\n"), ventana.search(/[.!?]\s[^.!?]*$/), ventana.lastIndexOf(" ")].find(
        (i) => i >= minimo
      );
      if (corte !== undefined && corte > 0) fin = inicio + corte + 1;
    }
    const trozo = t.slice(inicio, fin).trim();
    if (trozo) fragmentos.push(trozo);
    if (fin >= t.length) break;
    // El siguiente arranca `solape` antes, alineado a un espacio para no partir palabras.
    let siguiente = Math.max(fin - solape, inicio + 1);
    const espacio = t.indexOf(" ", siguiente);
    if (espacio !== -1 && espacio < fin) siguiente = espacio + 1;
    inicio = siguiente;
  }
  return fragmentos;
}

export function coseno(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let s = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? s / Math.sqrt(na * nb) : 0;
}

const VACIAS = new Set(
  "de la el los las en y a un una unos unas que con por para del al lo le se su sus es son hay como cual cuanto cuanta cuantos cuantas mas menos muy tiene tienen tenes quiero saber me mi tu esto esta este ese esa o u".split(" ")
);

export function tokens(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !VACIAS.has(w));
}

/**
 * Puntaje por palabras (0..1): proporcion de terminos de la consulta presentes en el
 * fragmento, con coincidencia por prefijo para plurales y conjugaciones ("zapatilla" ~
 * "zapatillas"). Es el respaldo cuando no hay embeddings (D4).
 */
export function puntajePalabras(consulta: string, contenido: string): number {
  const q = [...new Set(tokens(consulta))];
  if (q.length === 0) return 0;
  const c = new Set(tokens(contenido));
  const lista = [...c];
  let hits = 0;
  for (const w of q) {
    if (c.has(w)) hits += 1;
    else {
      const raiz = w.slice(0, Math.max(4, w.length - 2));
      if (lista.some((x) => x.startsWith(raiz))) hits += 0.7;
    }
  }
  return hits / q.length;
}

export interface Candidato {
  contenido: string;
  embedding: number[] | null;
}

/**
 * Puntaje final: si hay vector de consulta y del fragmento, mezcla coseno (peso fuerte)
 * con palabras; si no, solo palabras.
 */
export function puntuar(consulta: string, vectorConsulta: number[] | null, c: Candidato): number {
  const palabras = puntajePalabras(consulta, c.contenido);
  if (vectorConsulta && c.embedding && c.embedding.length === vectorConsulta.length) {
    return 0.75 * coseno(vectorConsulta, c.embedding) + 0.25 * palabras;
  }
  return palabras * 0.6;
}
