"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ConfigClienteEntrada } from "@/lib/config/schema";
import { claveDesdeTexto } from "@/lib/estudio/archivos";
import { Campo, EntradaColor, Opciones, erroresDe } from "../campos-ui";
import type { PropsPaso } from "./tipos";

type Etapa = ConfigClienteEntrada["pipeline"]["etapas"][number];

const COLORES = ["#64748b", "#2563eb", "#8b5cf6", "#0ea5e9", "#f59e0b", "#ea580c", "#16a34a", "#dc2626"];

function tipoDe(e: Etapa): string {
  return e.ganada ? "ganada" : e.perdida ? "perdida" : "abierta";
}

export function PasoPipeline({ config, cambiar, errores }: PropsPaso) {
  const etapas = config.pipeline.etapas;
  const setEtapas = (fn: (e: Etapa[]) => Etapa[]) =>
    cambiar((c) => ({ ...c, pipeline: { ...c.pipeline, etapas: fn(c.pipeline.etapas) } }));
  const setEtapa = (i: number, parcial: Partial<Etapa>) =>
    setEtapas((es) => es.map((e, j) => (j === i ? { ...e, ...parcial } : e)));
  const mover = (i: number, d: -1 | 1) =>
    setEtapas((es) => {
      const n = [...es];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  const sinGanada = !etapas.some((e) => e.ganada);
  const sinPerdida = !etapas.some((e) => e.perdida);

  return (
    <div className="space-y-5">
      <Campo etiqueta="Nombre del pipeline" errores={erroresDe(errores, "pipeline.nombre")} className="max-w-sm">
        <Input
          value={config.pipeline.nombre ?? ""}
          maxLength={60}
          onChange={(e) => cambiar((c) => ({ ...c, pipeline: { ...c.pipeline, nombre: e.target.value } }))}
        />
      </Campo>

      <div className="space-y-2">
        {etapas.map((e, i) => (
          <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border p-3 xl:flex-nowrap">
            <div className="flex flex-col gap-1">
              <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="cursor-pointer rounded p-0.5 hover:bg-muted disabled:opacity-30">
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-label="Bajar" disabled={i === etapas.length - 1} onClick={() => mover(i, 1)} className="cursor-pointer rounded p-0.5 hover:bg-muted disabled:opacity-30">
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <Campo etiqueta="Nombre" className="min-w-32 flex-1" errores={erroresDe(errores, `pipeline.etapas.${i}.nombre`)}>
              <Input
                value={e.nombre}
                maxLength={60}
                onChange={(ev) => {
                  const nombre = ev.target.value;
                  // La clave sigue al nombre mientras no se haya editado a mano.
                  const seguia = !e.clave || e.clave === claveDesdeTexto(e.nombre);
                  setEtapa(i, { nombre, ...(seguia ? { clave: claveDesdeTexto(nombre) } : {}) });
                }}
              />
            </Campo>
            <Campo etiqueta="Clave" className="w-36 shrink-0" errores={erroresDe(errores, `pipeline.etapas.${i}.clave`)}>
              <Input value={e.clave} onChange={(ev) => setEtapa(i, { clave: ev.target.value })} className="font-mono text-xs" />
            </Campo>
            <Campo etiqueta="Color" errores={erroresDe(errores, `pipeline.etapas.${i}.color`)}>
              <EntradaColor valor={e.color ?? "#64748b"} onChange={(v) => setEtapa(i, { color: v })} />
            </Campo>
            <Campo etiqueta="Tipo" className="w-32">
              <Opciones
                valor={tipoDe(e)}
                opciones={[
                  { valor: "abierta", etiqueta: "En curso" },
                  { valor: "ganada", etiqueta: "Ganada" },
                  { valor: "perdida", etiqueta: "Perdida" },
                ]}
                onChange={(v) => setEtapa(i, { ganada: v === "ganada", perdida: v === "perdida" })}
              />
            </Campo>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Quitar etapa"
              disabled={etapas.length <= 2}
              onClick={() => setEtapas((es) => es.filter((_, j) => j !== i))}
              className="cursor-pointer text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {erroresDe(errores, "pipeline.etapas")
        .filter((e) => !/^\d/.test(e))
        .map((e) => (
          <p key={e} className="text-xs text-destructive">{e}</p>
        ))}
      {(sinGanada || sinPerdida) && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Consejo: marca una etapa como {sinGanada ? "ganada" : ""}
          {sinGanada && sinPerdida ? " y otra como " : ""}
          {sinPerdida ? "perdida" : ""} para que los reportes calculen la conversion.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="cursor-pointer"
        onClick={() =>
          setEtapas((es) => {
            // Las nuevas van antes de las etapas de cierre.
            const cierre = es.findIndex((e) => e.ganada || e.perdida);
            const pos = cierre === -1 ? es.length : cierre;
            const nueva: Etapa = { clave: `etapa_${es.length + 1}`, nombre: `Etapa ${es.length + 1}`, color: COLORES[es.length % COLORES.length] };
            return [...es.slice(0, pos), nueva, ...es.slice(pos)];
          })
        }
      >
        <Plus className="h-3.5 w-3.5" /> Agregar etapa
      </Button>
    </div>
  );
}
