"use client";

import { useState } from "react";
import { Copy, FileBox, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { slugDesdeNombre, slugValido } from "@/lib/estudio/archivos";
import type { PerfilResumen, PlantillaResumen } from "@/lib/estudio/tipos";
import { Campo } from "./campos-ui";

type Origen = { tipo: "vacio" } | { tipo: "plantilla"; clave: string } | { tipo: "perfil"; slug: string };

/** Alta de un perfil: nombre, identificador y de donde parte (escenario 2). */
export function DialogNuevoPerfil({
  abierto,
  onCerrar,
  onCreado,
  plantillas,
  perfiles,
  origenInicial,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: (slug: string) => void;
  plantillas: PlantillaResumen[];
  perfiles: PerfilResumen[];
  origenInicial?: Origen;
}) {
  const [nombre, setNombre] = useState("");
  const [asistente, setAsistente] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [origen, setOrigen] = useState<Origen>(origenInicial ?? { tipo: "vacio" });
  const [creando, setCreando] = useState(false);

  const slugFinal = slugTocado ? slug : slugDesdeNombre(nombre);
  const repetido = perfiles.some((p) => p.slug === slugFinal);
  const valido = nombre.trim().length > 0 && slugValido(slugFinal) && !repetido;

  async function crear() {
    setCreando(true);
    try {
      const r = await fetch("/api/estudio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "crear", nombre, asistente, slug: slugFinal, desde: origen }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error([d.error, ...(d.errores ?? [])].join(" "));
      toast.success(`Perfil ${nombre} creado`);
      onCreado(d.slug);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setCreando(false);
    }
  }

  const opciones: { origen: Origen; titulo: string; descripcion: string; icono: typeof Sparkles }[] = [
    { origen: { tipo: "vacio" }, titulo: "Desde cero", descripcion: "Pipeline generico de ventas, sin campos ni modulos.", icono: Sparkles },
    ...plantillas.map((p) => ({ origen: { tipo: "plantilla" as const, clave: p.clave }, titulo: `Plantilla: ${p.titulo}`, descripcion: p.descripcion, icono: FileBox })),
    ...perfiles.map((p) => ({ origen: { tipo: "perfil" as const, slug: p.slug }, titulo: `Duplicar ${p.nombre}`, descripcion: `Copia la config y la marca de ${p.slug}.`, icono: Copy })),
  ];
  const igual = (a: Origen, b: Origen) => JSON.stringify(a) === JSON.stringify(b);

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo perfil</DialogTitle>
          <DialogDescription>Un perfil por cliente. Despues lo adaptas paso a paso en el asistente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Campo etiqueta="Nombre del cliente">
            <Input autoFocus value={nombre} maxLength={60} placeholder="Clinica Norte" onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <Campo
            etiqueta="Nombre del asistente"
            ayuda="Como se presenta el bot en WhatsApp, Instagram y Messenger. Vacio = el de la plantilla (o Asistente)."
          >
            <Input value={asistente} maxLength={40} placeholder="muni-bot" onChange={(e) => setAsistente(e.target.value)} />
          </Campo>
          <Campo
            etiqueta="Identificador"
            ayuda={repetido ? undefined : `config/perfiles/${slugFinal || "..."}`}
            errores={repetido ? ["Ya existe un perfil con ese identificador."] : []}
          >
            <Input
              value={slugFinal}
              className="font-mono text-xs"
              onChange={(e) => {
                setSlugTocado(true);
                setSlug(e.target.value.toLowerCase());
              }}
            />
          </Campo>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Partir de</p>
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {opciones.map((o) => (
                <button
                  key={JSON.stringify(o.origen)}
                  type="button"
                  onClick={() => setOrigen(o.origen)}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-3 rounded-lg border p-2.5 text-left",
                    igual(o.origen, origen) ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                  )}
                >
                  <o.icono className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">{o.titulo}</span>
                    <span className="block text-xs text-muted-foreground">{o.descripcion}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCerrar} className="cursor-pointer">Cancelar</Button>
            <Button disabled={!valido || creando} onClick={crear} className="cursor-pointer">
              {creando && <Loader2 className="h-4 w-4 animate-spin" />} Crear y adaptar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
