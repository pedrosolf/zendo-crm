import OpenAI from "openai";
import { getConfig, marca } from "@/lib/config";

/**
 * Proveedor del LLM del agente. Los dos hablan la API de OpenAI (chat completions con
 * tool calling y embeddings), asi que el resto del agente no cambia: solo la URL, la
 * clave y el modelo por defecto.
 *
 *   LLM_PROVIDER=openrouter  (default)  OPENROUTER_API_KEY  openrouter.ai
 *   LLM_PROVIDER=nvidia                 NVIDIA_API_KEY      build.nvidia.com (NIM)
 *
 * Sin LLM_PROVIDER se elige por la clave que haya: OpenRouter si esta, si no NVIDIA.
 * El archivo conserva su nombre heredado para no mover los imports del nucleo.
 */

export type ProveedorLLM = "openrouter" | "nvidia";

interface DatosProveedor {
  nombre: string;
  baseURL: string;
  variableClave: "OPENROUTER_API_KEY" | "NVIDIA_API_KEY";
  modeloDefault: string;
  embeddingDefault: string;
}

const PROVEEDORES: Record<ProveedorLLM, DatosProveedor> = {
  openrouter: {
    nombre: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    variableClave: "OPENROUTER_API_KEY",
    modeloDefault: "google/gemini-2.5-flash",
    embeddingDefault: "nvidia/nemotron-3-embed-1b:free",
  },
  nvidia: {
    nombre: "NVIDIA NIM",
    baseURL: "https://integrate.api.nvidia.com/v1",
    variableClave: "NVIDIA_API_KEY",
    // Elegido el 2026-11-05 entre los gratuitos de NIM: acierta las tools de muni-bot
    // (clasificar y registrar con la categoria exacta) en 2-5 s.
    modeloDefault: "nvidia/nemotron-3-ultra-550b-a55b",
    embeddingDefault: "nvidia/nemotron-3-embed-1b",
  },
};

export function proveedorLLM(): ProveedorLLM {
  const elegido = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (elegido === "nvidia" || elegido === "openrouter") return elegido;
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.NVIDIA_API_KEY) return "nvidia";
  return "openrouter";
}

export function datosProveedor(): DatosProveedor & { id: ProveedorLLM } {
  const id = proveedorLLM();
  return { id, ...PROVEEDORES[id] };
}

export function claveLLM(): string | undefined {
  return process.env[datosProveedor().variableClave] || undefined;
}

let client: OpenAI | null = null;
let clientDe: string | null = null;

/** Cliente OpenAI-compatible del proveedor elegido. */
export function getOpenRouterClient(): OpenAI {
  const p = datosProveedor();
  const apiKey = claveLLM();
  if (!apiKey) throw new Error(`${p.variableClave} no configurada (proveedor ${p.nombre})`);
  if (!client || clientDe !== p.id) {
    client = new OpenAI({
      apiKey,
      baseURL: p.baseURL,
      // OpenRouter usa estos headers para su ranking (opcional); NVIDIA los ignora.
      defaultHeaders:
        p.id === "openrouter"
          ? { "HTTP-Referer": process.env.APP_BASE_URL || "http://localhost:3000", "X-Title": marca().nombre }
          : undefined,
    });
    clientDe = p.id;
  }
  return client;
}

/** AGENT_MODEL (entorno) -> config.agente.modelo -> default del proveedor. */
export function getAgentModel(): string {
  return process.env.AGENT_MODEL || getConfig().agente.modelo || datosProveedor().modeloDefault;
}

/** Hay clave para el proveedor elegido (nombre heredado de cuando solo era OpenRouter). */
export function hasOpenRouterKey(): boolean {
  return Boolean(claveLLM());
}

/** Texto para avisos: "falta NVIDIA_API_KEY" / "falta OPENROUTER_API_KEY". */
export function faltaClaveLLM(): string {
  return `falta ${datosProveedor().variableClave}`;
}
