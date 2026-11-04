import "server-only";

/**
 * Embeddings por OpenRouter (misma clave que el agente). EMBEDDING_MODEL elige el modelo;
 * el default es gratuito. Los gratuitos se caen seguido: un lote que falla devuelve null
 * en esas posiciones y quien llama sigue (D4 de la spec 13).
 */

export const MODELO_EMBEDDING_DEFAULT = "nvidia/nemotron-3-embed-1b:free";
const LOTE = 32;

export function modeloEmbedding(): string {
  return process.env.EMBEDDING_MODEL?.trim() || MODELO_EMBEDDING_DEFAULT;
}

async function lote(textos: string[], modelo: string): Promise<(number[] | null)[]> {
  const clave = process.env.OPENROUTER_API_KEY;
  if (!clave) return textos.map(() => null);
  for (let intento = 0; intento < 2; intento++) {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelo, input: textos }),
        signal: AbortSignal.timeout(60_000),
      });
      const datos = (await r.json().catch(() => null)) as
        | { data?: { index: number; embedding: number[] }[]; error?: { message?: string } }
        | null;
      if (r.ok && datos?.data?.length === textos.length) {
        const salida: (number[] | null)[] = textos.map(() => null);
        for (const d of datos.data) salida[d.index] = d.embedding;
        return salida;
      }
      console.warn(`[conocimiento] embeddings ${modelo}: ${r.status} ${datos?.error?.message ?? ""}`.trim());
    } catch (err) {
      console.warn("[conocimiento] embeddings fallo:", err instanceof Error ? err.message : err);
    }
  }
  return textos.map(() => null);
}

export async function vectorizar(textos: string[], modelo = modeloEmbedding()): Promise<(number[] | null)[]> {
  const salida: (number[] | null)[] = [];
  for (let i = 0; i < textos.length; i += LOTE) {
    salida.push(...(await lote(textos.slice(i, i + LOTE), modelo)));
  }
  return salida;
}
