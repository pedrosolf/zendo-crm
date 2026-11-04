"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Errores del esquema que empiezan con `ruta` (ej. "marca.colorPrimario"). */
export function erroresDe(errores: string[], ruta: string): string[] {
  return errores
    .filter((e) => e.startsWith(`${ruta}:`) || e.startsWith(`${ruta}.`))
    .map((e) => e.slice(e.indexOf(":") + 1).trim());
}

export function Campo({
  etiqueta,
  ayuda,
  errores = [],
  children,
  className,
}: {
  etiqueta: string;
  ayuda?: ReactNode;
  errores?: string[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium">{etiqueta}</Label>
      {children}
      {ayuda && errores.length === 0 && <p className="text-[11px] text-muted-foreground">{ayuda}</p>}
      {errores.map((e) => (
        <p key={e} className="text-[11px] text-destructive">
          {e}
        </p>
      ))}
    </div>
  );
}

export function EntradaColor({
  valor,
  onChange,
  invalido,
}: {
  valor: string;
  onChange: (v: string) => void;
  invalido?: boolean;
}) {
  const valido = /^#[0-9a-fA-F]{6}$/.test(valor);
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Elegir color"
        value={valido ? valor : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-11 cursor-pointer rounded-md border bg-transparent p-1"
      />
      <Input
        value={valor}
        onChange={(e) => onChange(e.target.value.trim())}
        aria-invalid={invalido || !valido}
        className="font-mono text-xs w-28"
        maxLength={7}
      />
    </div>
  );
}

export function Interruptor({
  activo,
  onChange,
  etiqueta,
  descripcion,
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  etiqueta: string;
  descripcion?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40">
      <input
        type="checkbox"
        checked={activo}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--primary)]"
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{etiqueta}</span>
        {descripcion && <span className="block text-xs text-muted-foreground">{descripcion}</span>}
      </span>
    </label>
  );
}

/** <select> nativo con el estilo de los inputs: listas cortas y fijas. */
export function Opciones({
  valor,
  opciones,
  onChange,
  className,
}: {
  valor: string;
  opciones: { valor: string; etiqueta: string }[];
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.etiqueta}
        </option>
      ))}
    </select>
  );
}
