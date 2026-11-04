"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { PASOS, RUTAS_DE_PASO, type ClavePaso } from "@/lib/estudio/guias";
import type { PropsPaso } from "./tipos";

export function PasoRevisar({ config, errores, irA }: PropsPaso & { irA: (p: ClavePaso) => void }) {
  const campos = config.contacto?.campos ?? [];
  const activos = config.modulos?.activos ?? [];
  const resumen: Record<ClavePaso, string> = {
    negocio: `${config.moneda ?? "USD"} · ${config.zonaHoraria ?? "UTC"} · ${config.idioma ?? "es"}`,
    marca: `${config.marca.nombre} (${config.marca.nombreCorto})`,
    pipeline: config.pipeline.etapas.map((e) => e.nombre).join(" > "),
    campos: campos.length ? campos.map((c) => c.etiqueta).join(", ") : "sin campos propios",
    agente: `${config.agente?.nombre || "Asistente"} · ${config.agente?.prompt ? "prompt propio" : "prompt generico"}`,
    modulos: activos.length ? activos.join(", ") : "ningun modulo extra",
    revisar: "",
  };

  return (
    <div className="space-y-2">
      {PASOS.filter((p) => p.clave !== "revisar").map((p) => {
        const propios = errores.filter((e) => RUTAS_DE_PASO[p.clave].some((r) => e.startsWith(r)));
        return (
          <button
            key={p.clave}
            type="button"
            onClick={() => irA(p.clave)}
            className="flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left hover:bg-muted/40"
          >
            {propios.length === 0 ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            )}
            <span className="min-w-0 space-y-0.5">
              <span className="block text-sm font-medium">{p.titulo}</span>
              <span className="block truncate text-xs text-muted-foreground">{resumen[p.clave]}</span>
              {propios.map((e) => (
                <span key={e} className="block text-xs text-destructive">{e}</span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
