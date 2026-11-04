"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Power, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { esquemaConfig, type ConfigClienteEntrada } from "@/lib/config/schema";
import { PASOS, RUTAS_DE_PASO, type ClavePaso } from "@/lib/estudio/guias";
import type { ModuloDisponible, ResultadoAplicar } from "@/lib/estudio/tipos";
import { PanelGuia } from "./PanelGuia";
import { PasoNegocio } from "./pasos/PasoNegocio";
import { PasoMarca } from "./pasos/PasoMarca";
import { PasoPipeline } from "./pasos/PasoPipeline";
import { PasoCampos } from "./pasos/PasoCampos";
import { PasoAgente } from "./pasos/PasoAgente";
import { PasoModulos } from "./pasos/PasoModulos";
import { PasoRevisar } from "./pasos/PasoRevisar";
import { avisarResultado } from "./avisos";

/** Asistente de 7 pasos que edita un perfil (specs/nucleo/12-estudio.md, escenario 3). */
export function Asistente({
  slug,
  modulos,
  onVolver,
}: {
  slug: string;
  modulos: ModuloDisponible[];
  onVolver: () => void;
}) {
  const [config, setConfig] = useState<ConfigClienteEntrada | null>(null);
  const [guardado, setGuardado] = useState<string>("");
  const [activo, setActivo] = useState(false);
  const [paso, setPaso] = useState<ClavePaso>("negocio");
  const [ocupado, setOcupado] = useState<null | "guardar" | "activar">(null);
  const [erroresServidor, setErroresServidor] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/estudio/perfiles/${slug}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setConfig(d.config);
        setGuardado(JSON.stringify(d.config));
        setActivo(d.activo);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "No se pudo leer el perfil"));
  }, [slug]);

  // El mismo esquema que valida el nucleo al arrancar: lo que pasa aca, arranca.
  const errores = useMemo(() => {
    if (!config) return [];
    const r = esquemaConfig.safeParse(config);
    const locales = r.success ? [] : r.error.issues.map((i) => `${i.path.join(".") || "config"}: ${i.message}`);
    return [...locales, ...erroresServidor.filter((e) => !locales.includes(e))];
  }, [config, erroresServidor]);

  const sucio = config !== null && JSON.stringify(config) !== guardado;
  useEffect(() => {
    if (!sucio) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sucio]);

  if (!config) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando perfil...
      </div>
    );
  }

  const cambiar = (fn: (c: ConfigClienteEntrada) => ConfigClienteEntrada) => {
    setErroresServidor([]);
    setConfig((c) => (c ? fn(c) : c));
  };
  const indice = PASOS.findIndex((p) => p.clave === paso);
  const props = { config, cambiar, errores };

  async function guardar(): Promise<boolean> {
    setOcupado("guardar");
    try {
      const r = await fetch(`/api/estudio/perfiles/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErroresServidor(d.errores ?? []);
        toast.error(d.error ?? "No se pudo guardar");
        return false;
      }
      setGuardado(JSON.stringify(config));
      if (d.aplicado) avisarResultado(d.aplicado as ResultadoAplicar, "Guardado y aplicado");
      else toast.success("Perfil guardado");
      return true;
    } finally {
      setOcupado(null);
    }
  }

  async function activar() {
    if (sucio && !(await guardar())) return;
    setOcupado("activar");
    try {
      const r = await fetch(`/api/estudio/perfiles/${slug}/activar`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) {
        setErroresServidor(d.errores ?? []);
        toast.error(d.error ?? "No se pudo activar");
        return;
      }
      setActivo(true);
      avisarResultado(d.aplicado as ResultadoAplicar, `${config!.marca.nombre} esta activo`, true);
    } finally {
      setOcupado(null);
    }
  }

  const contar = (p: ClavePaso) => errores.filter((e) => RUTAS_DE_PASO[p].some((r) => e.startsWith(r))).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => (!sucio || confirm("Hay cambios sin guardar. Salir igual?")) && onVolver()} className="cursor-pointer">
          <ArrowLeft className="h-4 w-4" /> Perfiles
        </Button>
        <h2 className="text-lg font-semibold">{config.marca.nombre || slug}</h2>
        <code className="text-xs text-muted-foreground">config/perfiles/{slug}</code>
        {activo && <Badge>Activo</Badge>}
        {sucio && <Badge variant="outline">Sin guardar</Badge>}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" disabled={!sucio || !!ocupado} onClick={guardar} className="cursor-pointer">
            {ocupado === "guardar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </Button>
          <Button size="sm" disabled={!!ocupado || errores.length > 0 || (activo && !sucio)} onClick={activo ? guardar : activar} className="cursor-pointer">
            {ocupado === "activar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
            {activo ? "Guardar y aplicar" : "Activar perfil"}
          </Button>
        </div>
      </div>

      {/* Pasos */}
      <nav className="flex gap-1 overflow-x-auto border-b pb-px" aria-label="Pasos">
        {PASOS.map((p, i) => {
          const n = contar(p.clave);
          return (
            <button
              key={p.clave}
              type="button"
              onClick={() => setPaso(p.clave)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
                paso === p.clave ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px]", paso === p.clave ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {i + 1}
              </span>
              {p.titulo}
              {n > 0 && <span className="rounded-full bg-destructive px-1.5 text-[10px] text-white">{n}</span>}
            </button>
          );
        })}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {paso === "negocio" && <PasoNegocio {...props} />}
          {paso === "marca" && <PasoMarca {...props} slug={slug} />}
          {paso === "pipeline" && <PasoPipeline {...props} />}
          {paso === "campos" && <PasoCampos {...props} />}
          {paso === "agente" && <PasoAgente {...props} />}
          {paso === "modulos" && <PasoModulos {...props} disponibles={modulos} />}
          {paso === "revisar" && <PasoRevisar {...props} irA={setPaso} />}

          <div className="flex justify-between border-t pt-4">
            <Button variant="ghost" size="sm" disabled={indice === 0} onClick={() => setPaso(PASOS[indice - 1].clave)} className="cursor-pointer">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            {indice < PASOS.length - 1 && (
              <Button variant="outline" size="sm" onClick={() => setPaso(PASOS[indice + 1].clave)} className="cursor-pointer">
                Siguiente: {PASOS[indice + 1].titulo} <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <PanelGuia paso={paso} />
      </div>
    </div>
  );
}
