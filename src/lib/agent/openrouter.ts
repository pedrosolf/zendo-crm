import OpenAI from "openai";
import { getConfig, marca } from "@/lib/config";
import { cadenaDeModelos, type EslabonModelo } from "./contingencia";

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
  /** Si el principal no contesta a tiempo. Vacio = sin respaldo. */
  respaldoDefault: string;
  embeddingDefault: string;
}

const PROVEEDORES: Record<ProveedorLLM, DatosProveedor> = {
  openrouter: {
    nombre: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    variableClave: "OPENROUTER_API_KEY",
    modeloDefault: "google/gemini-2.5-flash",
    respaldoDefault: "",
    embeddingDefault: "nvidia/nemotron-3-embed-1b:free",
  },
  nvidia: {
    nombre: "NVIDIA NIM",
    baseURL: "https://integrate.api.nvidia.com/v1",
    variableClave: "NVIDIA_API_KEY",
    // Elegido el 2026-11-05 entre los gratuitos de NIM: acierta las tools de muni-bot
    // (clasificar y registrar con la categoria exacta) en 2-5 s.
    modeloDefault: "nvidia/nemotron-3-ultra-550b-a55b",
    // La capa gratuita de NIM a veces deja al modelo grande colgado minutos enteros
    // (visto el 2026-11-05: 90 s sin respuesta mientras este contestaba en 0,8 s).
    respaldoDefault: "nvidia/nemotron-3.5-lightning-30b-a3b",
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

const clientes = new Map<ProveedorLLM, OpenAI>();

/**
 * Cliente OpenAI-compatible de un proveedor (por defecto, el elegido). Uno por
 * proveedor: la cadena de respaldo puede saltar de NVIDIA a OpenRouter en el mismo turno.
 * Devuelve null si ese proveedor no tiene clave.
 */
export function clienteDe(id: ProveedorLLM = proveedorLLM()): OpenAI | null {
  const p = PROVEEDORES[id];
  const apiKey = process.env[p.variableClave];
  if (!apiKey) return null;
  let c = clientes.get(id);
  if (!c) {
    c = new OpenAI({
      apiKey,
      baseURL: p.baseURL,
      // El reintento lo decide el agente (con otro modelo): el SDK reintentaria el mismo.
      maxRetries: 0,
      // OpenRouter usa estos headers para su ranking (opcional); NVIDIA los ignora.
      defaultHeaders:
        id === "openrouter"
          ? { "HTTP-Referer": process.env.APP_BASE_URL || "http://localhost:3000", "X-Title": marca().nombre }
          : undefined,
    });
    clientes.set(id, c);
  }
  return c;
}

/** Cliente del proveedor elegido; lanza si no tiene clave. Nombre heredado. */
export function getOpenRouterClient(): OpenAI {
  const c = clienteDe();
  if (!c) {
    const p = datosProveedor();
    throw new Error(`${p.variableClave} no configurada (proveedor ${p.nombre})`);
  }
  return c;
}

/** AGENT_MODEL (entorno) -> config.agente.modelo -> default del proveedor. */
export function getAgentModel(): string {
  return process.env.AGENT_MODEL || getConfig().agente.modelo || datosProveedor().modeloDefault;
}

/**
 * Principal y respaldos, en orden. AGENT_MODEL_FALLBACK es una lista separada por comas;
 * cada entrada puede llevar proveedor ("openrouter:google/gemini-2.5-flash"). Los de un
 * proveedor sin clave se descartan.
 */
export function cadenaDelAgente(principal: string): EslabonModelo[] {
  return cadenaDeModelos({
    proveedor: proveedorLLM(),
    principal,
    respaldoEnv: process.env.AGENT_MODEL_FALLBACK,
    respaldoDefault: datosProveedor().respaldoDefault,
  }).filter((e) => Boolean(process.env[PROVEEDORES[e.proveedor].variableClave]));
}

/**
 * Tope de espera por llamada al modelo. Vercel corta la funcion a los 60 s y el job queda
 * en "processing" para siempre: sin tope, un proveedor colgado deja al bot mudo sin un
 * solo error. 20 s deja lugar para el respaldo y para las tools dentro de ese minuto.
 */
export const TIMEOUT_LLM_MS = Number(process.env.AGENT_LLM_TIMEOUT_MS) || 20_000;

/**
 * Presupuesto del turno entero (todas las rondas de tools). Debajo de los 60 s de Vercel
 * con margen para mandar el aviso y cerrar el job.
 */
export const PRESUPUESTO_TURNO_MS = Number(process.env.AGENT_BUDGET_MS) || 50_000;

/** Hay clave para el proveedor elegido (nombre heredado de cuando solo era OpenRouter). */
export function hasOpenRouterKey(): boolean {
  return Boolean(claveLLM());
}

/** Texto para avisos: "falta NVIDIA_API_KEY" / "falta OPENROUTER_API_KEY". */
export function faltaClaveLLM(): string {
  return `falta ${datosProveedor().variableClave}`;
}
