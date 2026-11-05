import "server-only";
import { claveLLM, datosProveedor } from "@/lib/agent/openrouter";

/**
 * Embeddings por el mismo proveedor del agente (OpenRouter o NVIDIA NIM, ver
 * src/lib/agent/openrouter.ts). EMBEDDING_MODEL elige el modelo; el default es gratuito.
 * Los gratuitos se caen seguido: un lote que falla devuelve null en esas posiciones y
 * quien llama sigue (D4 de la spec 13).
 *
 * NVIDIA exige `input_type` en los modelos asimetricos: "passage" para los fragmentos de
 * documentos y "query" para la pregunta. OpenRouter no lo acepta, asi que solo va ahi.
 */

const LOTE = 32;

export type TipoTexto = "passage" | "query";

export function modeloEmbedding(): string {
  return process.env.EMBEDDING_MODEL?.trim() || datosProveedor().embeddingDefault;
}

async function lote(textos: string[], modelo: string, tipo: TipoTexto): Promise<(number[] | null)[]> {
  const clave = claveLLM();
  if (!clave) return textos.map(() => null);
  const p = datosProveedor();
  for (let intento = 0; intento < 2; intento++) {
    try {
      const r = await fetch(`${p.baseURL}/embeddings`, {
        method: "POST",
        headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelo,
          input: textos,
          ...(p.id === "nvidia" ? { input_type: tipo, truncate: "END" } : {}),
        }),
        signal: AbortSignal.timeout(60_000),
      });
      const datos = (await r.json().catch(() => null)) as
        | { data?: { index: number; embedding: number[] }[]; error?: { message?: string }; message?: string }
        | null;
      if (r.ok && datos?.data?.length === textos.length) {
        const salida: (number[] | null)[] = textos.map(() => null);
        for (const d of datos.data) salida[d.index] = d.embedding;
        return salida;
      }
      console.warn(`[conocimiento] embeddings ${modelo}: ${r.status} ${datos?.error?.message ?? datos?.message ?? ""}`.trim());
    } catch (err) {
      console.warn("[conocimiento] embeddings fallo:", err instanceof Error ? err.message : err);
    }
  }
  return textos.map(() => null);
}

export async function vectorizar(
  textos: string[],
  modelo = modeloEmbedding(),
  tipo: TipoTexto = "passage"
): Promise<(number[] | null)[]> {
  const salida: (number[] | null)[] = [];
  for (let i = 0; i < textos.length; i += LOTE) {
    salida.push(...(await lote(textos.slice(i, i + LOTE), modelo, tipo)));
  }
  return salida;
}
