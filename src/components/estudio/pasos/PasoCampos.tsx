"use client";

import { Bot, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TIPOS_CAMPO, type ConfigClienteEntrada } from "@/lib/config/schema";
import { claveDesdeTexto } from "@/lib/estudio/archivos";
import { Campo, Opciones, erroresDe } from "../campos-ui";
import type { PropsPaso } from "./tipos";

type CampoCfg = NonNullable<NonNullable<ConfigClienteEntrada["contacto"]>["campos"]>[number];

const ETIQUETA_TIPO: Record<(typeof TIPOS_CAMPO)[number], string> = {
  texto: "Texto",
  numero: "Numero",
  seleccion: "Seleccion",
  booleano: "Si / No",
  fecha: "Fecha",
};

export function PasoCampos({ config, cambiar, errores }: PropsPaso) {
  const campos = config.contacto?.campos ?? [];
  const setCampos = (fn: (c: CampoCfg[]) => CampoCfg[]) =>
    cambiar((c) => ({ ...c, contacto: { ...c.contacto, campos: fn(c.contacto?.campos ?? []) } }));
  const setCampo = (i: number, parcial: Partial<CampoCfg>) =>
    setCampos((cs) => cs.map((x, j) => (j === i ? { ...x, ...parcial } : x)));

  return (
    <div className="space-y-4">
      {campos.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sin campos propios. El contacto tiene igual nombre, telefono, email y notas.
        </p>
      )}

      {campos.map((c, i) => {
        const base = `contacto.campos.${i}`;
        const pideAgente = Boolean(c.agente && c.agente.calificar !== false);
        return (
          <div key={i} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Campo etiqueta="Etiqueta" className="min-w-44 flex-1" errores={erroresDe(errores, `${base}.etiqueta`)}>
                <Input
                  value={c.etiqueta}
                  maxLength={60}
                  onChange={(e) => {
                    const etiqueta = e.target.value;
                    const seguia = !c.clave || c.clave === claveDesdeTexto(c.etiqueta);
                    setCampo(i, { etiqueta, ...(seguia ? { clave: claveDesdeTexto(etiqueta) } : {}) });
                  }}
                />
              </Campo>
              <Campo etiqueta="Clave" className="w-40" errores={erroresDe(errores, `${base}.clave`)}>
                <Input value={c.clave} onChange={(e) => setCampo(i, { clave: e.target.value })} className="font-mono text-xs" />
              </Campo>
              <Campo etiqueta="Tipo" className="w-36">
                <Opciones
                  valor={c.tipo}
                  opciones={TIPOS_CAMPO.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO[t] }))}
                  onChange={(v) => setCampo(i, { tipo: v as CampoCfg["tipo"] })}
                />
              </Campo>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar campo"
                onClick={() => setCampos((cs) => cs.filter((_, j) => j !== i))}
                className="cursor-pointer text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {c.tipo === "seleccion" && (
              <Campo etiqueta="Opciones" ayuda="Separadas por coma." errores={erroresDe(errores, base).filter((e) => e.includes("opciones"))}>
                <Input
                  value={(c.opciones ?? []).join(", ")}
                  placeholder="Compra, Arriendo"
                  onChange={(e) =>
                    setCampo(i, { opciones: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                  }
                />
              </Campo>
            )}

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <Casilla activo={!!c.requerido} etiqueta="Obligatorio" onChange={(v) => setCampo(i, { requerido: v })} />
              <Casilla activo={!!c.enTabla} etiqueta="Mostrar en la tabla" onChange={(v) => setCampo(i, { enTabla: v })} />
              <Casilla
                activo={pideAgente}
                etiqueta="El agente lo averigua"
                icono
                onChange={(v) => setCampo(i, { agente: v ? { calificar: true, descripcion: c.agente?.descripcion } : undefined })}
              />
            </div>

            {pideAgente && (
              <Campo etiqueta="Que tiene que preguntar el agente" ayuda="Ej: presupuesto maximo en dolares">
                <Input
                  value={c.agente?.descripcion ?? ""}
                  maxLength={300}
                  onChange={(e) => setCampo(i, { agente: { calificar: true, descripcion: e.target.value || undefined } })}
                />
              </Campo>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="cursor-pointer"
        onClick={() =>
          setCampos((cs) => [...cs, { clave: `campo_${cs.length + 1}`, etiqueta: `Campo ${cs.length + 1}`, tipo: "texto" }])
        }
      >
        <Plus className="h-3.5 w-3.5" /> Agregar campo
      </Button>
    </div>
  );
}

function Casilla({
  activo,
  etiqueta,
  onChange,
  icono,
}: {
  activo: boolean;
  etiqueta: string;
  onChange: (v: boolean) => void;
  icono?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={activo} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 cursor-pointer accent-[var(--primary)]" />
      {icono && <Bot className="h-3.5 w-3.5 text-primary" />}
      {etiqueta}
    </label>
  );
}
