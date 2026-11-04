"use client";

import { AlertTriangle, BookOpen, Lightbulb } from "lucide-react";
import { GUIAS, type ClavePaso } from "@/lib/estudio/guias";

/** Panel lateral con la guia del paso: que es, que decidir, ejemplos y cuidados. */
export function PanelGuia({ paso }: { paso: ClavePaso }) {
  const g = GUIAS[paso];
  return (
    <aside className="space-y-4 rounded-xl border bg-muted/30 p-4 text-sm lg:sticky lg:top-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" /> Guia
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold leading-snug">{g.titulo}</h3>
        <p className="text-muted-foreground text-[13px] leading-relaxed">{g.resumen}</p>
      </div>
      <ol className="space-y-2 text-[13px] leading-relaxed">
        {g.pasos.map((p, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
              {i + 1}
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ol>
      {g.ejemplos && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Ejemplos
          </p>
          <ul className="space-y-1 text-[12px] text-muted-foreground">
            {g.ejemplos.map((e) => (
              <li key={e} className="rounded-md bg-background px-2 py-1.5">
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}
      {g.cuidado && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> Cuidado
          </p>
          <ul className="list-disc space-y-1 pl-4 text-[12px] text-muted-foreground">
            {g.cuidado.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
