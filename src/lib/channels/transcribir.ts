import "server-only";

/**
 * Notas de voz de WhatsApp -> texto, para que el agente las lea.
 *
 * Coarena y OpenRouter gratis no aceptan audio (probado el 2026-11-12); NVIDIA NIM si,
 * con `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` y el audio como `audio_url` en
 * data URL (ogg/opus tal cual llega de WhatsApp, sin convertir). Es un modelo de
 * razonamiento: sin `enable_thinking: false` se gasta los tokens pensando y devuelve
 * content null. Tarda ~1 s para una nota corta.
 *
 *   NVIDIA_API_KEY        obligatoria para transcribir (sin ella, el audio entra sin texto)
 *   TRANSCRIPCION_MODEL   otro modelo de NIM con audio, si aparece uno mejor
 */

const MODELO_DEFAULT = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";
/** Una nota de voz de 5 minutos en opus pesa ~2 MB. */
const MAXIMO_BYTES = 8 * 1024 * 1024;

export function puedeTranscribir(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

/** Baja el adjunto. Los de Zernio piden la misma clave de la API. */
export async function descargarMedio(url: string): Promise<{ bytes: Buffer; mime: string } | null> {
  try {
    const host = new URL(url).hostname;
    const headers: Record<string, string> = {};
    if (/(^|\.)zernio\.com$/.test(host) && process.env.ZERNIO_API_KEY) {
      headers.Authorization = `Bearer ${process.env.ZERNIO_API_KEY}`;
    }
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) {
      console.warn(`[medios] descarga ${r.status} ${host}`);
      return null;
    }
    const largo = Number(r.headers.get("content-length") ?? 0);
    if (largo > MAXIMO_BYTES) return null;
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length > MAXIMO_BYTES) return null;
    return { bytes, mime: (r.headers.get("content-type") ?? "audio/ogg").split(";")[0].trim() };
  } catch (err) {
    console.warn("[medios] descarga fallo:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function transcribirAudio(bytes: Buffer, mime: string): Promise<string | null> {
  const clave = process.env.NVIDIA_API_KEY;
  if (!clave) return null;
  try {
    const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.TRANSCRIPCION_MODEL?.trim() || MODELO_DEFAULT,
        temperature: 0,
        max_tokens: 1200,
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcribi literalmente este mensaje de voz, en el idioma en que esta hablado. Devolve solo la transcripcion, sin comillas ni comentarios.",
              },
              { type: "audio_url", audio_url: { url: `data:${mime || "audio/ogg"};base64,${bytes.toString("base64")}` } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const j = (await r.json().catch(() => null)) as { choices?: { message?: { content?: string | null } }[] } | null;
    const texto = j?.choices?.[0]?.message?.content?.trim();
    if (!r.ok || !texto) {
      console.warn(`[medios] transcripcion ${r.status} sin texto`);
      return null;
    }
    return texto.slice(0, 4000);
  } catch (err) {
    console.warn("[medios] transcripcion fallo:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Atajo para el webhook: URL del adjunto -> texto (o null). */
export async function transcribirDesdeUrl(url: string): Promise<string | null> {
  if (!puedeTranscribir()) return null;
  const medio = await descargarMedio(url);
  return medio ? transcribirAudio(medio.bytes, medio.mime) : null;
}
