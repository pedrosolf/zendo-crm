import { describe, expect, it } from "vitest";
import {
  cadenaDeModelos,
  debeAvisar,
  MARGEN_FINAL_MS,
  tiempoParaLlamada,
  VENTANA_AVISO_MS,
} from "@/lib/agent/contingencia";

// Un modelo colgado en el proveedor dejaba al bot mudo: la plataforma cortaba la
// funcion a los 60 s, el job quedaba en "processing" y el cliente no recibia nada.

describe("cadenaDeModelos", () => {
  const base = { proveedor: "nvidia" as const, principal: "nvidia/ultra" };

  it("sin lista usa el respaldo por defecto del proveedor", () => {
    expect(cadenaDeModelos({ ...base, respaldoDefault: "nvidia/lightning" })).toEqual([
      { proveedor: "nvidia", modelo: "nvidia/ultra" },
      { proveedor: "nvidia", modelo: "nvidia/lightning" },
    ]);
  });

  it("la lista manda, en orden, y acepta otro proveedor con prefijo", () => {
    const c = cadenaDeModelos({
      ...base,
      respaldoEnv: " nvidia/lightning , openrouter:google/gemini-2.5-flash ",
      respaldoDefault: "nvidia/otro",
    });
    expect(c).toEqual([
      { proveedor: "nvidia", modelo: "nvidia/ultra" },
      { proveedor: "nvidia", modelo: "nvidia/lightning" },
      { proveedor: "openrouter", modelo: "google/gemini-2.5-flash" },
    ]);
  });

  it("no repite el principal ni duplicados", () => {
    const c = cadenaDeModelos({ ...base, respaldoEnv: "nvidia/ultra,nvidia/x,nvidia:nvidia/x" });
    expect(c.map((e) => e.modelo)).toEqual(["nvidia/ultra", "nvidia/x"]);
  });

  it("off deja solo el principal", () => {
    expect(cadenaDeModelos({ ...base, respaldoEnv: "OFF", respaldoDefault: "nvidia/lightning" })).toHaveLength(1);
  });
});

describe("tiempoParaLlamada", () => {
  it("respeta el tope por llamada cuando sobra tiempo", () => {
    expect(tiempoParaLlamada(50_000, 20_000)).toBe(20_000);
  });

  it("acorta la ultima llamada para que entre el aviso antes del corte", () => {
    expect(tiempoParaLlamada(15_000, 20_000)).toBe(15_000 - MARGEN_FINAL_MS);
  });

  it("sin tiempo util no llama: pasa directo al aviso", () => {
    expect(tiempoParaLlamada(MARGEN_FINAL_MS + 1_000, 20_000)).toBe(0);
    expect(tiempoParaLlamada(-1, 20_000)).toBe(0);
  });
});

describe("debeAvisar", () => {
  const aviso = "Estoy fuera de servicio, volve en unos minutos.";
  const ahora = new Date("2026-11-09T12:00:00Z");
  const hace = (ms: number) => new Date(ahora.getTime() - ms);

  it("avisa si el hilo no tiene salientes o el ultimo fue otra cosa", () => {
    expect(debeAvisar(null, aviso, ahora)).toBe(true);
    expect(debeAvisar({ body: "Hola!", createdAt: hace(1_000) }, aviso, ahora)).toBe(true);
  });

  it("no repite el aviso dentro de la ventana", () => {
    expect(debeAvisar({ body: aviso, createdAt: hace(60_000) }, aviso, ahora)).toBe(false);
  });

  it("vuelve a avisar pasada la ventana", () => {
    expect(debeAvisar({ body: aviso, createdAt: hace(VENTANA_AVISO_MS) }, aviso, ahora)).toBe(true);
  });
});
